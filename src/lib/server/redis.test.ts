// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@redis/client", () => ({ createClient }));

function fakeClient() {
  const client = {
    isOpen: true,
    on: vi.fn(),
    connect: vi.fn(),
    sendCommand: vi.fn().mockResolvedValue([1, 60_000]),
    destroy: vi.fn(() => { client.isOpen = false; }),
  };
  client.connect.mockResolvedValue(client);
  createClient.mockReturnValue(client);
  return client;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("REDIS_URL", "redis://default:test-password@redis.railway.internal:6379");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Redis command transport", () => {
  it("shares the native connection, preserving EVAL arguments without reconnect or offline replay", async () => {
    const client = fakeClient();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { redisCommand } = await import("@/lib/server/redis");
    const command = ["EVAL", "return {redis.call('INCR',KEYS[1]),ARGV[1]}", 1, "test:key", 60_000];
    await Promise.all([redisCommand(command), redisCommand(command)]);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({
      disableOfflineQueue: true,
      socket: { connectTimeout: 2_500, reconnectStrategy: false },
    }));
    expect(client.sendCommand).toHaveBeenCalledTimes(2);
    expect(client.sendCommand).toHaveBeenCalledWith(command.map(String));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("closes an uncertain timed-out connection without replay, then allows a new request to connect", async () => {
    vi.useFakeTimers();
    const client = fakeClient();
    client.sendCommand.mockImplementation(() => new Promise(() => {}));
    const { redisCommand } = await import("@/lib/server/redis");
    const request = expect(redisCommand(["INCR", "test:key"])).rejects.toThrow("distributed store is unavailable");
    await vi.advanceTimersByTimeAsync(2_500);
    await request;
    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(client.sendCommand).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledTimes(1);

    const next = fakeClient();
    await redisCommand(["GET", "test:key"]);
    expect(next.sendCommand).toHaveBeenCalledOnce();
    expect(client.sendCommand).toHaveBeenCalledOnce();
  });

  it("does not dispatch a write after a timed-out connection eventually resolves", async () => {
    vi.useFakeTimers();
    const client = fakeClient();
    let connected!: (value: typeof client) => void;
    client.connect.mockImplementation(() => new Promise((resolve) => { connected = resolve; }));
    const { redisCommand } = await import("@/lib/server/redis");
    const request = expect(redisCommand(["INCR", "test:key"])).rejects.toThrow("unavailable");
    await vi.advanceTimersByTimeAsync(2_500);
    await request;
    connected(client);
    await vi.advanceTimersByTimeAsync(1);
    expect(client.sendCommand).not.toHaveBeenCalled();
  });

  it("fails closed and strips credentials from native failures before they reach callers", async () => {
    const client = fakeClient();
    client.sendCommand.mockRejectedValue(new Error("redis://default:test-password@redis.railway.internal:6379"));
    const { enforceRateLimit } = await import("@/lib/server/rate-limit");
    const { runIdempotent } = await import("@/lib/server/idempotency");
    const { reserveJudgedPlay } = await import("@/lib/server/entitlements");
    const operation = vi.fn();
    await expect(enforceRateLimit("redis-failure", { limit: 1, windowMs: 1_000 }))
      .rejects.toMatchObject({ code: "RATE_LIMIT_UNAVAILABLE", cause: { message: "The distributed store is unavailable." } });
    client.isOpen = true;
    await expect(runIdempotent("judge", "guest", "native-failure", "fingerprint", 10_000, operation))
      .rejects.toMatchObject({ code: "IDEMPOTENCY_UNAVAILABLE" });
    expect(operation).not.toHaveBeenCalled();
    client.isOpen = true;
    await expect(reserveJudgedPlay(null, "native-failure", "guest-scope"))
      .rejects.toMatchObject({ name: "ExternalServiceError", status: 503 });
    const { redisCommand } = await import("@/lib/server/redis");
    await expect(redisCommand(["PING"])).rejects.toMatchObject({
      message: "The distributed store is unavailable.",
    });
  });

  it("preserves the existing Upstash REST protocol when that is the configured backend", async () => {
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: [1, 60_000] })));
    vi.stubGlobal("fetch", fetchMock);
    const { redisCommand } = await import("@/lib/server/redis");
    const command = ["EVAL", "return 1", 0];
    await expect(redisCommand(command)).resolves.toEqual([1, 60_000]);
    expect(fetchMock).toHaveBeenCalledWith("https://redis.upstash.io", expect.objectContaining({
      method: "POST", body: JSON.stringify(command), cache: "no-store",
    }));
    expect(createClient).not.toHaveBeenCalled();
  });
});
