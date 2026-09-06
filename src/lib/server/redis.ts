import "server-only";

import { createClient } from "@redis/client";

import { getServerEnv } from "@/lib/server/env";

const STORE_TIMEOUT_MS = 2_500;
type RedisCommand = Array<string | number>;
type NativeClient = ReturnType<typeof createNativeClient>;
interface NativeConnection {
  url: string;
  client: NativeClient;
  ready: Promise<NativeClient>;
}

let connection: NativeConnection | undefined;

function createNativeClient(url: string) {
  return createClient({
    url,
    RESP: 2,
    socket: { connectTimeout: STORE_TIMEOUT_MS, reconnectStrategy: false },
    disableOfflineQueue: true,
  });
}

function discardConnection(current: NativeConnection): void {
  if (connection === current) connection = undefined;
  if (current.client.isOpen) current.client.destroy();
}

function nativeConnection(url: string): NativeConnection {
  if (connection?.url === url && connection.client.isOpen) return connection;
  if (connection) discardConnection(connection);

  const client = createNativeClient(url);
  // Redis errors may include connection details. Handle the required event
  // without logging credentials; callers receive only the sanitized error below.
  client.on("error", () => {});
  const current: NativeConnection = { url, client, ready: client.connect() };
  connection = current;
  return current;
}

async function nativeCommand(url: string, command: RedisCommand): Promise<unknown> {
  const current = nativeConnection(url);
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const client = await current.ready;
        if (expired) throw new Error("Redis command timed out.");
        return client.sendCommand(command.map(String));
      })(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          expired = true;
          // An outcome may be unknown. Close the socket and never replay the
          // command, including queued commands on this shared connection.
          discardConnection(current);
          reject(new Error("Redis command timed out."));
        }, STORE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    discardConnection(current);
    throw new Error("Redis command failed.");
  } finally {
    clearTimeout(timer);
  }
}

/** One configured store, with no command retries or fallback to another backend. */
export async function redisCommand(command: RedisCommand): Promise<unknown> {
  const env = getServerEnv();
  try {
    if (env.REDIS_URL) return await nativeCommand(env.REDIS_URL, command);
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error("Redis is not configured.");
    }
    const response = await fetch(env.UPSTASH_REDIS_REST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error("Redis request failed.");
    const payload = (await response.json()) as { result?: unknown; error?: string };
    if (payload.error || payload.result === undefined) {
      throw new Error("Invalid Redis response.");
    }
    return payload.result;
  } catch {
    // Do not attach provider errors: URLs/passwords must never reach API logs.
    throw new Error("The distributed store is unavailable.");
  }
}
