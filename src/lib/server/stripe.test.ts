import type Stripe from "stripe";
import { describe, expect, it } from "vitest";

import {
  CHECKOUT_PURCHASE_INTENT_KEY,
  chooseCanonicalDeliverySubscription,
  findBlockingDeliverySubscription,
  findReusableDeliveryCheckoutSession,
} from "@/lib/server/stripe";

function subscription(
  id: string,
  status: Stripe.Subscription.Status,
  created: number,
  priceId: string,
): Stripe.Subscription {
  return {
    id,
    status,
    created,
    metadata: {},
    items: { data: [{ price: { id: priceId } }] },
  } as unknown as Stripe.Subscription;
}

describe("Stripe current-customer reconciliation", () => {
  it("uses one stable per-user purchase-intent key across clock boundaries", () => {
    expect(CHECKOUT_PURCHASE_INTENT_KEY).toBe("subscription-purchase-intent");
    expect(CHECKOUT_PURCHASE_INTENT_KEY).not.toMatch(/\d/);
  });

  it("keeps a current active Delivery subscription over an old deletion event", () => {
    const oldCanceled = subscription("sub_old", "canceled", 100, "price_delivery");
    const currentActive = subscription("sub_new", "active", 200, "price_delivery");
    expect(chooseCanonicalDeliverySubscription(
      [oldCanceled, currentActive],
      new Set(["price_delivery"]),
    )?.id).toBe("sub_new");
  });

  it("selects the newest snapshot when only terminal Delivery subscriptions remain", () => {
    const first = subscription("sub_first", "canceled", 100, "price_delivery");
    const latest = subscription("sub_latest", "canceled", 200, "price_delivery");
    expect(chooseCanonicalDeliverySubscription(
      [first, latest],
      new Set(["price_delivery"]),
    )?.id).toBe("sub_latest");
  });

  it("ignores unrelated Stripe products", () => {
    expect(chooseCanonicalDeliverySubscription(
      [subscription("sub_other", "active", 300, "price_other")],
      new Set(["price_delivery"]),
    )).toBeNull();
  });

  it("blocks a second checkout for every recoverable Delivery subscription", () => {
    for (const status of [
      "active",
      "trialing",
      "past_due",
      "unpaid",
      "paused",
      "incomplete",
    ] as Stripe.Subscription.Status[]) {
      expect(findBlockingDeliverySubscription(
        [subscription(`sub_${status}`, status, 100, "price_delivery")],
        new Set(["price_delivery"]),
      )?.status).toBe(status);
    }
    expect(findBlockingDeliverySubscription(
      [subscription("sub_terminal", "incomplete_expired", 100, "price_delivery")],
      new Set(["price_delivery"]),
    )).toBeNull();
    const retiredPrice = subscription("sub_retired", "past_due", 100, "price_retired");
    retiredPrice.metadata = { product: "delivery_pro" };
    expect(findBlockingDeliverySubscription(
      [retiredPrice],
      new Set(["price_current"]),
    )?.id).toBe("sub_retired");
  });

  it("reuses only the same user's matching open Delivery Checkout session", () => {
    const session = {
      id: "cs_open",
      status: "open",
      mode: "subscription",
      url: "https://checkout.stripe.test/session",
      client_reference_id: "user_1",
      metadata: {
        product: "delivery_pro",
        supabase_user_id: "user_1",
        interval: "annual",
      },
    } as unknown as Stripe.Checkout.Session;
    expect(findReusableDeliveryCheckoutSession([session], "user_1", "annual")?.id)
      .toBe("cs_open");
    expect(findReusableDeliveryCheckoutSession([session], "user_1", "monthly"))
      .toBeNull();
    expect(findReusableDeliveryCheckoutSession([session], "user_2", "annual"))
      .toBeNull();
  });
});
