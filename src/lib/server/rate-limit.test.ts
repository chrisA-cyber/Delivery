import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("production rate-limit failure policy", () => {
  it("fails closed when the distributed provider is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://quota.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { enforceRateLimit } = await import("@/lib/server/rate-limit");

    await expect(
      enforceRateLimit("production-outage", { limit: 1, windowMs: 60_000 }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT_UNAVAILABLE", status: 503 });
  });

  it("rejects missing production distributed configuration", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { enforceRateLimit } = await import("@/lib/server/rate-limit");

    await expect(
      enforceRateLimit("production-missing", { limit: 1, windowMs: 60_000 }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT_NOT_CONFIGURED", status: 503 });
  });

  it("keeps the process-local fallback for development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://quota.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { enforceRateLimit } = await import("@/lib/server/rate-limit");

    await expect(
      enforceRateLimit("development-outage", { limit: 1, windowMs: 60_000 }),
    ).resolves.toMatchObject({ allowed: true, remaining: 0 });
  });
});
