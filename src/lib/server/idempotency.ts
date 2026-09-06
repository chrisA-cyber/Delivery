import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { AppError } from "@/lib/server/api-error";
import { getServerEnv, isRedisConfigured } from "@/lib/server/env";
import { redisCommand } from "@/lib/server/redis";

interface Entry<T> {
  expiresAt: number;
  fingerprint: string;
  promise: Promise<T>;
}

export interface IdempotentResult<T> {
  value: T;
  replayed: boolean;
}

interface DistributedClaim {
  status: "owner" | "pending" | "complete" | "conflict";
  value?: string;
}

class IdempotencyStoreError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "IdempotencyStoreError";
  }
}

class IdempotencyCommitError extends IdempotencyStoreError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "IdempotencyCommitError";
  }
}

const entries = new Map<string, Entry<unknown>>();
let operations = 0;

function digestKey(namespace: string, scope: string, key: string): string {
  return `${namespace}:${createHash("sha256").update(`${scope}\0${key}`).digest("hex")}`;
}

function conflict(): AppError {
  return new AppError(
    "IDEMPOTENCY_CONFLICT",
    "That retry key was already used for a different take.",
    409,
  );
}

async function distributedCommand(command: Array<string | number>): Promise<unknown> {
  try {
    return await redisCommand(command);
  } catch (error) {
    throw new IdempotencyStoreError("Distributed idempotency failed.", { cause: error });
  }
}

async function claimDistributed(
  digest: string,
  fingerprint: string,
  ownerToken: string,
  resultTtlMs: number,
): Promise<DistributedClaim> {
  const lockKey = `delivery:idempotency:lock:${digest}`;
  const resultKey = `delivery:idempotency:result:${digest}`;
  // Judge functions are capped at 60 seconds. This lets a crashed invocation
  // recover without reopening an ordinary in-flight provider call.
  const lockTtlMs = Math.min(resultTtlMs, 75_000);
  const script = [
    "local result=redis.call('GET',KEYS[2])",
    "if result then if string.sub(result,1,64)~=ARGV[1] then return {-1,''} end return {2,string.sub(result,66)} end",
    "local lock=redis.call('GET',KEYS[1])",
    "if not lock then redis.call('SET',KEYS[1],ARGV[1]..':'..ARGV[2],'PX',ARGV[3]); return {1,''} end",
    "if string.sub(lock,1,64)~=ARGV[1] then return {-1,''} end",
    "return {0,''}",
  ].join("; ");
  const raw = (await distributedCommand([
    "EVAL",
    script,
    2,
    lockKey,
    resultKey,
    fingerprint,
    ownerToken,
    lockTtlMs,
  ])) as [number | string, string?];
  const code = Number(raw?.[0]);
  if (code === -1) return { status: "conflict" };
  if (code === 0) return { status: "pending" };
  if (code === 1) return { status: "owner" };
  if (code === 2 && typeof raw[1] === "string") {
    return { status: "complete", value: raw[1] };
  }
  throw new IdempotencyStoreError("Idempotency store returned an invalid claim.");
}

async function finishDistributed(
  digest: string,
  fingerprint: string,
  ownerToken: string,
  serialized: string,
  ttlMs: number,
): Promise<void> {
  const lockKey = `delivery:idempotency:lock:${digest}`;
  const resultKey = `delivery:idempotency:result:${digest}`;
  const script = [
    "if redis.call('GET',KEYS[1])~=ARGV[1]..':'..ARGV[2] then return 0 end",
    "redis.call('SET',KEYS[2],ARGV[1]..':'..ARGV[3],'PX',ARGV[4])",
    "redis.call('DEL',KEYS[1])",
    "return 1",
  ].join("; ");
  try {
    const finished = Number(
      await distributedCommand([
        "EVAL",
        script,
        2,
        lockKey,
        resultKey,
        fingerprint,
        ownerToken,
        serialized,
        ttlMs,
      ]),
    );
    if (finished !== 1) {
      throw new Error("The idempotency claim expired before completion.");
    }
  } catch (error) {
    throw new IdempotencyCommitError(
      "The completed response could not be committed to idempotency storage.",
      { cause: error },
    );
  }
}

async function releaseDistributed(
  digest: string,
  fingerprint: string,
  ownerToken: string,
): Promise<void> {
  const script =
    "if redis.call('GET',KEYS[1])==ARGV[1]..':'..ARGV[2] then return redis.call('DEL',KEYS[1]) end return 0";
  await distributedCommand([
    "EVAL",
    script,
    1,
    `delivery:idempotency:lock:${digest}`,
    fingerprint,
    ownerToken,
  ]);
}

function parseCompleted<T>(serialized: string): T {
  try {
    return JSON.parse(serialized) as T;
  } catch (error) {
    throw new IdempotencyCommitError("The stored idempotent response is invalid.", {
      cause: error,
    });
  }
}

async function runDistributed<T>(
  digest: string,
  fingerprint: string,
  ttlMs: number,
  operation: () => Promise<T>,
): Promise<IdempotentResult<T>> {
  const ownerToken = randomUUID();
  const waitUntil = Date.now() + 5_000;

  while (true) {
    const claim = await claimDistributed(digest, fingerprint, ownerToken, ttlMs);
    if (claim.status === "conflict") throw conflict();
    if (claim.status === "complete") {
      return { value: parseCompleted<T>(claim.value!), replayed: true };
    }
    if (claim.status === "owner") {
      try {
        const value = await operation();
        const serialized = JSON.stringify(value);
        if (serialized === undefined || serialized.length > 256_000) {
          throw new Error("The idempotent response is not safely serializable.");
        }
        await finishDistributed(
          digest,
          fingerprint,
          ownerToken,
          serialized,
          ttlMs,
        );
        return { value, replayed: false };
      } catch (error) {
        try {
          await releaseDistributed(digest, fingerprint, ownerToken);
        } catch (releaseError) {
          console.error("Idempotency claim release failed", {
            error: releaseError instanceof Error ? releaseError.name : "unknown",
          });
        }
        throw error;
      }
    }

    if (Date.now() >= waitUntil) {
      throw new AppError(
        "IDEMPOTENCY_IN_PROGRESS",
        "That take is still being judged. Retry the same attempt in a moment.",
        409,
        { retryAfterSeconds: 2 },
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function runMemory<T>(
  digest: string,
  fingerprint: string,
  ttlMs: number,
  operation: () => Promise<T>,
): Promise<IdempotentResult<T>> {
  const now = Date.now();
  const existing = entries.get(digest) as Entry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    if (existing.fingerprint !== fingerprint) throw conflict();
    return { value: await existing.promise, replayed: true };
  }
  if (existing) entries.delete(digest);

  const promise = operation();
  const entry: Entry<T> = { expiresAt: now + ttlMs, fingerprint, promise };
  entries.set(digest, entry);

  operations += 1;
  if (operations % 250 === 0 || entries.size > 2_000) {
    for (const [entryKey, candidate] of entries) {
      if (candidate.expiresAt <= now) entries.delete(entryKey);
    }
  }

  try {
    return { value: await promise, replayed: false };
  } catch (error) {
    if (entries.get(digest) === entry) entries.delete(digest);
    throw error;
  }
}

/**
 * Coalesces concurrent retries and replays successful results for the TTL.
 * Production uses the configured Redis store so a retry can recover a result
 * from another server instance. Development can run without a distributed store.
 */
export async function runIdempotent<T>(
  namespace: string,
  scope: string,
  key: string,
  fingerprint: string,
  ttlMs: number,
  operation: () => Promise<T>,
): Promise<IdempotentResult<T>> {
  const digest = digestKey(namespace, scope, key);
  const stableFingerprint = /^[a-f0-9]{64}$/i.test(fingerprint)
    ? fingerprint.toLowerCase()
    : createHash("sha256").update(fingerprint).digest("hex");
  const env = getServerEnv();
  if (isRedisConfigured(env)) {
    try {
      return await runDistributed(digest, stableFingerprint, ttlMs, operation);
    } catch (error) {
      if (!(error instanceof IdempotencyStoreError)) throw error;
      if (error instanceof IdempotencyCommitError) {
        throw new AppError(
          "IDEMPOTENCY_UNAVAILABLE",
          "Your take finished backstage, but its retry receipt is temporarily unavailable. Check your history before recording again.",
          503,
          undefined,
          { cause: error },
        );
      }
      if (env.NODE_ENV === "production" || env.REDIS_URL) {
        throw new AppError(
          "IDEMPOTENCY_UNAVAILABLE",
          "The stage is briefly unavailable. Try again in a moment.",
          503,
          undefined,
          { cause: error },
        );
      }
      console.warn("Distributed idempotency unavailable; using process-local storage.", {
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  } else if (env.NODE_ENV === "production") {
    throw new AppError(
      "IDEMPOTENCY_NOT_CONFIGURED",
      "The stage is briefly unavailable. Try again in a moment.",
      503,
    );
  }
  return runMemory(digest, stableFingerprint, ttlMs, operation);
}

export function createRequestFingerprint(...parts: string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part).update("\0");
  return hash.digest("hex");
}
