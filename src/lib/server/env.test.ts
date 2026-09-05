import { afterEach, describe, expect, it, vi } from "vitest";

import { getServerEnv, resetEnvCacheForTests } from "@/lib/server/env";

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
