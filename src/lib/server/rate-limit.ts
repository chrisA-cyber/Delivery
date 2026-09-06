import "server-only";

import { createHash } from "node:crypto";

import { AppError } from "@/lib/server/api-error";
import { getServerEnv, isRedisConfigured } from "@/lib/server/env";
import { redisCommand } from "@/lib/server/redis";

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export interface RateLimitAdapter {
  consume(key: string, policy: RateLimitPolicy): Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

class MemoryRateLimitAdapter implements RateLimitAdapter {
  private readonly buckets = new Map<string, Bucket>();
  private operations = 0;

  async consume(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    const now = Date.now();
    const current = this.buckets.get(key);
    const bucket =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + policy.windowMs }
        : current;

    bucket.count += 1;
    this.buckets.set(key, bucket);

    // Bound memory in long-lived development and Node processes.
    this.operations += 1;
    if (this.operations % 500 === 0) {
      for (const [bucketKey, value] of this.buckets) {
        if (value.resetAt <= now) this.buckets.delete(bucketKey);
      }
    }

    return {
      allowed: bucket.count <= policy.limit,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
    };
  }
}

class DistributedRateLimitAdapter implements RateLimitAdapter {
  constructor(
    private readonly fallback: RateLimitAdapter,
  ) {}

  async consume(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    try {
      const result = await redisCommand([
        "EVAL",
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return {n,redis.call('PTTL',KEYS[1])}",
        1,
        `delivery:rate:${key}`,
        policy.windowMs,
      ]);
      if (!Array.isArray(result) || result.length !== 2 || !result.every(Number.isFinite)) {
        throw new Error("Rate-limit service returned an invalid response.");
      }
      const [count, ttl] = result as [number, number];
      const now = Date.now();
      const remainingMs = Math.max(1, ttl ?? policy.windowMs);
      return {
        allowed: count <= policy.limit,
        limit: policy.limit,
        remaining: Math.max(0, policy.limit - count),
        resetAt: now + remainingMs,
        retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1_000)),
      };
    } catch (error) {
      if (getServerEnv().NODE_ENV === "production" || getServerEnv().REDIS_URL) {
        throw new AppError(
          "RATE_LIMIT_UNAVAILABLE",
          "The stage is briefly unavailable. Try again in a moment.",
          503,
          undefined,
          { cause: error },
        );
      }
      console.warn("Distributed rate limiter unavailable; using process-local limiter.", {
        error: error instanceof Error ? error.name : "unknown",
      });
      return this.fallback.consume(key, policy);
    }
  }
}

const memoryAdapter = new MemoryRateLimitAdapter();
let adapter: RateLimitAdapter | undefined;

function getAdapter(): RateLimitAdapter {
  if (adapter) return adapter;
  const env = getServerEnv();
  if (
    env.NODE_ENV === "production" &&
    !isRedisConfigured(env)
  ) {
    throw new AppError(
      "RATE_LIMIT_NOT_CONFIGURED",
      "The stage is briefly unavailable. Try again in a moment.",
      503,
    );
  }
  adapter =
    isRedisConfigured(env)
      ? new DistributedRateLimitAdapter(memoryAdapter)
      : memoryAdapter;
  return adapter;
}

export function setRateLimitAdapter(nextAdapter: RateLimitAdapter): void {
  adapter = nextAdapter;
}

export function getClientKey(request: Request, namespace: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "local";
  const digest = createHash("sha256").update(ip.slice(0, 128)).digest("hex").slice(0, 32);
  return `${namespace}:${digest}`;
}

export async function enforceRateLimit(
  key: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const result = await getAdapter().consume(key, policy);
  if (!result.allowed) {
    throw new AppError(
      "RATE_LIMITED",
      "The judges need a breather. Try again in a moment.",
      429,
      { retryAfterSeconds: result.retryAfterSeconds },
    );
  }
  return result;
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000)),
  };
  if (!result.allowed) headers["Retry-After"] = String(result.retryAfterSeconds);
  return headers;
}
