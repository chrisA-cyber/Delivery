import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnvCacheForTests } from "@/lib/server/env";
import { getGuestIdentity } from "@/lib/server/guest";
import { runIdempotent } from "@/lib/server/idempotency";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DELIVERY_DEVICE_SECRET", "a-long-test-only-device-signing-secret");
  resetEnvCacheForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});

describe("guest identity", () => {
  it("keeps the signed device identity stable when the network address changes", () => {
    const first = getGuestIdentity(new Request("https://delivery.test/play", {
      headers: { "x-forwarded-for": "192.0.2.10" },
    }));
    expect(first.setCookie).toContain("delivery_device=");
    const cookie = first.setCookie!.split(";")[0]!;

    const moved = getGuestIdentity(new Request("https://delivery.test/play", {
      headers: {
        cookie,
        "x-forwarded-for": "198.51.100.42",
      },
    }));

    expect(moved.idempotencyScope).toBe(first.idempotencyScope);
    expect(moved.scope).not.toBe(first.scope);
    expect(moved.setCookie).toBeUndefined();
  });

  it("coalesces the same first-ever attempt before a device cookie exists", async () => {
    const attemptKey = crypto.randomUUID();
    const first = getGuestIdentity(new Request("https://delivery.test/play", {
      headers: { "x-forwarded-for": "192.0.2.20" },
    }), attemptKey);
    const concurrent = getGuestIdentity(new Request("https://delivery.test/play", {
      headers: { "x-forwarded-for": "192.0.2.20" },
    }), attemptKey);

    expect(first.idempotencyScope).toBe(concurrent.idempotencyScope);
    expect(first.setCookie).toBe(concurrent.setCookie);
    const operation = vi.fn(async () => ({ score: 88 }));
    const [one, two] = await Promise.all([
      runIdempotent("judge", first.idempotencyScope, attemptKey, "same", 10_000, operation),
      runIdempotent("judge", concurrent.idempotencyScope, attemptKey, "same", 10_000, operation),
    ]);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(one.value).toEqual(two.value);
  });
});
