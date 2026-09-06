import { afterEach, describe, expect, it, vi } from "vitest";

import { getBillingAvailability } from "@/lib/server/billing";
import { resetEnvCacheForTests } from "@/lib/server/env";
import { POST as checkout } from "@/app/api/stripe/checkout/route";
import { requireUser } from "@/lib/supabase/auth";

vi.mock("@/lib/supabase/auth", () => ({ requireUser: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  resetEnvCacheForTests();
});

describe("billing availability", () => {
  it("rejects checkout before account/provider work when subscription activation is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://delivery.example");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
    vi.stubEnv("STRIPE_PRO_MONTHLY_PRICE_ID", "price_monthly");
    vi.stubEnv("STRIPE_PRO_ANNUAL_PRICE_ID", "price_annual");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    resetEnvCacheForTests();

    const response = await checkout(new Request("https://delivery.example/api/stripe/checkout", {
      method: "POST",
      headers: { origin: "https://delivery.example", "content-type": "application/json" },
      body: JSON.stringify({ interval: "annual" }),
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "BILLING_UNAVAILABLE", message: expect.stringContaining("keep playing") },
    });
    expect(requireUser).not.toHaveBeenCalled();
    // A paused upgrade flow must not block an existing subscriber's portal.
    expect(getBillingAvailability().portalAvailable).toBe(true);
  });
});
