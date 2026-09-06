import "server-only";

import type { BillingAvailability } from "@/lib/billing";
import { AppError } from "@/lib/server/api-error";
import { getServerEnv } from "@/lib/server/env";

export function getBillingAvailability(): BillingAvailability {
  const env = getServerEnv();
  const portalAvailable = Boolean(env.STRIPE_SECRET_KEY && env.NEXT_PUBLIC_APP_URL);
  return {
    // A checkout must be able to activate the purchase through its webhook.
    checkoutAvailable: Boolean(portalAvailable && env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_PRO_MONTHLY_PRICE_ID && env.STRIPE_PRO_ANNUAL_PRICE_ID),
    portalAvailable,
  };
}

export function requireBillingAvailability(feature: "checkoutAvailable" | "portalAvailable"): void {
  if (!getBillingAvailability()[feature]) {
    throw new AppError(
      "BILLING_UNAVAILABLE",
      feature === "checkoutAvailable"
        ? "Pro upgrades are currently unavailable. You can keep playing Classic and Say It Back for free."
        : "Billing management is currently unavailable. Please try again later; free gameplay remains available.",
      503,
    );
  }
}
