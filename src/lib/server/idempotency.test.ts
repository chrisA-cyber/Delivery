import { afterEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/server/api-error";
import { resetEnvCacheForTests } from "@/lib/server/env";
import { runIdempotent } from "@/lib/server/idempotency";

function useDistributedEnvironment() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  resetEnvCacheForTests();
}

function installFakeUpstash() {
  const locks = new Map<string, string>();
  const results = new Map<string, string>();
  const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    const command = JSON.parse(String(init?.body)) as Array<string | number>;
    const script = String(command[1]);
    let result: unknown;
    if (script.includes("local result=redis.call")) {
      const lockKey = String(command[3]);
      const resultKey = String(command[4]);
      const fingerprint = String(command[5]);
      const owner = String(command[6]);
      const completed = results.get(resultKey);
      if (completed) {
        result = completed.slice(0, 64) === fingerprint
          ? [2, completed.slice(65)]
          : [-1, ""];
      } else {
        const lock = locks.get(lockKey);
        if (!lock) {
          locks.set(lockKey, `${fingerprint}:${owner}`);
          result = [1, ""];
        } else {
          result = lock.slice(0, 64) === fingerprint ? [0, ""] : [-1, ""];
        }
      }
    } else if (script.includes("redis.call('SET',KEYS[2]")) {
      const lockKey = String(command[3]);
      const resultKey = String(command[4]);
      const fingerprint = String(command[5]);
      const owner = String(command[6]);
      const serialized = String(command[7]);
      if (locks.get(lockKey) === `${fingerprint}:${owner}`) {
        results.set(resultKey, `${fingerprint}:${serialized}`);
        locks.delete(lockKey);
        result = 1;
      } else {
        result = 0;
      }
    } else {
      const lockKey = String(command[3]);
      const fingerprint = String(command[4]);
      const owner = String(command[5]);
      if (locks.get(lockKey) === `${fingerprint}:${owner}`) locks.delete(lockKey);
      result = 1;
    }
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, locks, results };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetEnvCacheForTests();
});

describe("runIdempotent", () => {
  it("coalesces concurrent calls and replays the completed value", async () => {
    const operation = vi.fn(async () => ({ score: 91 }));
    const key = crypto.randomUUID();
    const [first, second] = await Promise.all([
      runIdempotent("test", "player", key, "same-request", 10_000, operation),
      runIdempotent("test", "player", key, "same-request", 10_000, operation),
    ]);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(first.value).toEqual({ score: 91 });
    expect(second.value).toEqual({ score: 91 });
    expect([first.replayed, second.replayed]).toContain(true);
  });

  it("rejects a retry key reused for different content", async () => {
    const key = crypto.randomUUID();
    await runIdempotent("test", "player", key, "first", 10_000, async () => "ok");
    await expect(
      runIdempotent("test", "player", key, "different", 10_000, async () => "wrong"),
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
      status: 409,
    } satisfies Partial<AppError>);
  });

  it("allows a failed operation to be retried", async () => {
    const key = crypto.randomUUID();
    await expect(
      runIdempotent("test", "player", key, "request", 10_000, async () => {
        throw new Error("temporary");
      }),
    ).rejects.toThrow("temporary");

    const retried = await runIdempotent(
      "test",
      "player",
      key,
      "request",
      10_000,
      async () => "recovered",
    );
    expect(retried.value).toBe("recovered");
    expect(retried.replayed).toBe(false);
  });

  it("persists a distributed result for replay and rejects a changed fingerprint", async () => {
    useDistributedEnvironment();
    const { results } = installFakeUpstash();
    const key = crypto.randomUUID();
    const operation = vi.fn(async () => ({ score: 97, transcript: "receipt" }));

    const first = await runIdempotent(
      "judge",
      "player",
      key,
      "a".repeat(64),
      10_000,
      operation,
    );
    const replay = await runIdempotent(
      "judge",
      "player",
      key,
      "a".repeat(64),
      10_000,
      operation,
    );

    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ value: { score: 97, transcript: "receipt" }, replayed: true });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(results.size).toBe(1);
    await expect(
      runIdempotent("judge", "player", key, "b".repeat(64), 10_000, operation),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", status: 409 });
  });

  it("returns an in-progress retry response instead of duplicating provider work", async () => {
    vi.useFakeTimers();
    useDistributedEnvironment();
    installFakeUpstash();
    const key = crypto.randomUUID();
    let finish!: (value: string) => void;
    const operation = vi.fn(
      () => new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );
    const owner = runIdempotent(
      "judge",
      "player",
      key,
      "c".repeat(64),
      10_000,
      operation,
    );
    await vi.advanceTimersByTimeAsync(1);
    const retry = runIdempotent(
      "judge",
      "player",
      key,
      "c".repeat(64),
      10_000,
      operation,
    );
    const retryExpectation = expect(retry).rejects.toMatchObject({
      code: "IDEMPOTENCY_IN_PROGRESS",
      status: 409,
    });
    await vi.advanceTimersByTimeAsync(5_250);
    await retryExpectation;
    expect(operation).toHaveBeenCalledTimes(1);
    finish("done");
    await owner;
  });

  it("fails closed before provider work when production idempotency is unavailable", async () => {
    useDistributedEnvironment();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    const operation = vi.fn(async () => "must not run");
    await expect(
      runIdempotent(
        "judge",
        "player",
        crypto.randomUUID(),
        "d".repeat(64),
        10_000,
        operation,
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_UNAVAILABLE", status: 503 });
    expect(operation).not.toHaveBeenCalled();
  });
});
