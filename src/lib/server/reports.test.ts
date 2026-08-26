import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnvCacheForTests } from "@/lib/server/env";
import {
  prepareReportActor,
  reportIdempotencyKey,
} from "@/lib/server/reports";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DELIVERY_DEVICE_SECRET", "a-long-report-test-signing-secret");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  resetEnvCacheForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});

describe("report actors", () => {
  it("derives anonymous device and network HMACs without storing an address", async () => {
    const key = crypto.randomUUID();
    const actor = await prepareReportActor(
      new Request("https://delivery.test/api/reports", {
        headers: { "x-forwarded-for": "203.0.113.77" },
      }),
      null,
      key,
    );

    expect(actor.reporterId).toBeNull();
    expect(actor.anonymousReporterHash).toMatch(/^[a-f0-9]{64}$/);
    expect(actor.anonymousNetworkHash).toMatch(/^[a-f0-9]{64}$/);
    expect(actor.anonymousNetworkHash).not.toContain("203.0.113.77");
    expect(actor.guest?.setCookie).toContain("HttpOnly");
  });

  it("uses the account identity and no anonymous metadata when signed in", async () => {
    const user = { id: crypto.randomUUID() } as User;
    const actor = await prepareReportActor(
      new Request("https://delivery.test/api/reports"),
      user,
      crypto.randomUUID(),
    );
    expect(actor.reporterId).toBe(user.id);
    expect(actor.anonymousReporterHash).toBeNull();
    expect(actor.anonymousNetworkHash).toBeNull();
    expect(actor.guest).toBeNull();
  });

  it("rejects a predictable caller-supplied idempotency key", () => {
    expect(() => reportIdempotencyKey(new Request("https://delivery.test/api/reports", {
      headers: { "idempotency-key": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    }))).toThrow(expect.objectContaining({
      code: "IDEMPOTENCY_KEY_INVALID",
      status: 422,
    }));
  });
});
