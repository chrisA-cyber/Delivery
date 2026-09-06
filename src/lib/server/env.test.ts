import { afterEach, describe, expect, it, vi } from "vitest";

import { assertProductionConfiguration, getServerEnv, isRedisConfigured, resetEnvCacheForTests } from "@/lib/server/env";

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});

function productionUrls(values: {
  app?: string;
  supabase?: string;
  upstash?: string;
  deviceSecret?: string;
}) {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", values.app ?? "https://delivery.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", values.supabase ?? "https://project.supabase.co");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", values.upstash ?? "https://redis.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  vi.stubEnv(
    "DELIVERY_DEVICE_SECRET",
    values.deviceSecret ?? "a-production-test-secret-with-32-chars",
  );
  resetEnvCacheForTests();
}

describe("server URL configuration", () => {
  it("rejects an insecure production app origin", () => {
    productionUrls({ app: "http://delivery.example" });
    expect(() => getServerEnv()).toThrow("invalid");
  });

  it("rejects a production app URL with a path", () => {
    productionUrls({ app: "https://delivery.example/app?from=env" });
    expect(() => getServerEnv()).toThrow("invalid");
  });

  it("requires HTTPS for production Supabase and Upstash endpoints", () => {
    productionUrls({ supabase: "http://project.supabase.co" });
    expect(() => getServerEnv()).toThrow("invalid");
    productionUrls({ upstash: "http://redis.upstash.io" });
    expect(() => getServerEnv()).toThrow("invalid");
  });

  it("allows HTTP loopback endpoints in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-anon");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    resetEnvCacheForTests();
    expect(getServerEnv().NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("rejects a weak production device-signing secret", () => {
    productionUrls({ deviceSecret: "too-short" });
    expect(() => getServerEnv()).toThrow("invalid");
  });
});

describe("transcription configuration", () => {
  it("keeps the existing direct-audio transcription contract by default", () => {
    vi.stubEnv("DELIVERY_TRANSCRIPTION_PROVIDER", undefined);
    vi.stubEnv("ELEVENLABS_ZERO_RETENTION", undefined);
    resetEnvCacheForTests();
    expect(getServerEnv().DELIVERY_TRANSCRIPTION_PROVIDER).toBe("audio-judge");
    expect(getServerEnv().ELEVENLABS_ZERO_RETENTION).toBe(false);
  });

  it("permits the explicit Scribe provider and rejects unknown switches", () => {
    vi.stubEnv("DELIVERY_TRANSCRIPTION_PROVIDER", "elevenlabs");
    resetEnvCacheForTests();
    expect(getServerEnv().DELIVERY_TRANSCRIPTION_PROVIDER).toBe("elevenlabs");
    vi.stubEnv("DELIVERY_TRANSCRIPTION_PROVIDER", "automatic-fallback");
    resetEnvCacheForTests();
    expect(() => getServerEnv()).toThrow("invalid");
  });
});

describe("native Redis configuration", () => {
  function nativeRedis(url: string) {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("REDIS_URL", url);
    resetEnvCacheForTests();
  }

  it.each([
    "redis://default:test-password@redis.railway.internal:6379",
    "redis://127.0.0.1:6379/0",
    "redis://[::1]:6379",
    "rediss://default:test-password@redis.example.test:6380/1",
  ])("accepts private or encrypted Redis: %s", (url) => {
    nativeRedis(url);
    expect(isRedisConfigured()).toBe(true);
  });

  it.each([
    "redis://default:test-password@redis.example.test:6379",
    "redis://redis.railway.internal.example.test:6379",
    "redis://redis.railway.internal:6379?tls=false",
    "rediss://redis.example.test:6379/not-a-db",
    "https://redis.example.test",
    "not-a-url",
  ])("rejects unsafe or invalid Redis URLs without exposing them: %s", (url) => {
    nativeRedis(url);
    expect(() => getServerEnv()).toThrow("The server environment is invalid.");
  });

  it("rejects ambiguous stores even when the Upstash pair is complete", () => {
    nativeRedis("redis://redis.railway.internal:6379");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    expect(() => getServerEnv()).toThrow("invalid");
  });

  it("accepts native Redis for production readiness without requiring Upstash", () => {
    nativeRedis("redis://redis.railway.internal:6379");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://delivery.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    for (const key of [
      "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY",
      "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRO_MONTHLY_PRICE_ID",
      "STRIPE_PRO_ANNUAL_PRICE_ID", "DELIVERY_DEVICE_SECRET", "MODERATION_CLEANUP_SECRET",
    ]) vi.stubEnv(key, "test-configuration-value-at-least-32-chars");
    expect(() => assertProductionConfiguration()).not.toThrow();
  });
});
