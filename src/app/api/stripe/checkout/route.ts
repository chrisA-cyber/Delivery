import { createHash } from "node:crypto";

import { z } from "zod";

import {
  assertAccountNotDeleting,
  isStripeResourceMissing,
} from "@/lib/server/account-deletion";
import {
  AppError,
  ExternalServiceError,
  jsonError,
  jsonOk,
  requestIdFrom,
} from "@/lib/server/api-error";
import { getServerEnv } from "@/lib/server/env";
import { requireBillingAvailability } from "@/lib/server/billing";
import { createRequestFingerprint, runIdempotent } from "@/lib/server/idempotency";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import {
  assertContentLength,
  assertJsonRequest,
  assertSameOrigin,
} from "@/lib/server/request";
import {
  CHECKOUT_PURCHASE_INTENT_KEY,
  findBlockingDeliverySubscription,
  findReusableDeliveryCheckoutSession,
  getAppOrigin,
  getProPriceId,
  getStripe,
  isDeliveryCheckoutSession,
} from "@/lib/server/stripe";
import { requireUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const checkoutSchema = z
  .object({ interval: z.enum(["monthly", "annual"]).default("monthly") })
  .strict();

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    assertJsonRequest(request);
    assertContentLength(request, 2 * 1024);
    requireBillingAvailability("checkoutAvailable");
    const user = await requireUser();
    await assertAccountNotDeleting(user.id);
    const rateLimit = await enforceRateLimit(`checkout:${user.id}`, {
      limit: 8,
      windowMs: 10 * 60 * 1_000,
    });
    const { interval } = checkoutSchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();
    const [{ data: profile, error: profileError }, { data: subscription, error: subscriptionError }] =
      await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).single(),
        supabase
          .from("subscriptions")
          .select("stripe_customer_id,state")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
    if (profileError || subscriptionError) {
      throw new ExternalServiceError("Supabase", {
        cause: profileError ?? subscriptionError,
      });
    }
    const stripe = getStripe();
    let customerId = (subscription?.stripe_customer_id as string | null | undefined) ?? null;
    let createdCustomer = false;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email,
          name: (profile.display_name as string | null) ?? undefined,
          metadata: { supabase_user_id: user.id },
        },
        { idempotencyKey: `delivery-customer-${user.id}` },
      );
      customerId = customer.id;
      createdCustomer = true;
      const { error } = await createSupabaseAdminClient().from("subscriptions").upsert(
        {
          user_id: user.id,
          tier: "free",
          state: "inactive",
          stripe_customer_id: customerId,
        },
        { onConflict: "user_id" },
      );
      if (error) {
        try {
          await stripe.customers.del(customerId);
        } catch (cleanupError) {
          if (!isStripeResourceMissing(cleanupError)) {
            console.error("Unused Stripe customer needs reconciliation", {
              requestId,
              userId: user.id,
            });
          }
        }
        throw new ExternalServiceError("Supabase", { cause: error });
      }
    }

    // Close the race where deletion containment starts while Stripe creates a
    // new Customer. No Checkout Session (and therefore no charge) may exist
    // after a deletion job is claimed; a newly-created empty customer is removed.
    try {
      await assertAccountNotDeleting(user.id);
    } catch (error) {
      if (createdCustomer && customerId) {
        try {
          await stripe.customers.del(customerId);
        } catch (cleanupError) {
          if (!isStripeResourceMissing(cleanupError)) {
            console.error("Unused Stripe customer needs reconciliation", {
              requestId,
              userId: user.id,
            });
          }
        }
      }
      throw error;
    }

    const origin = getAppOrigin(request);
    const minuteBucket = Math.floor(Date.now() / 60_000);
    let checkout;
    try {
      checkout = await runIdempotent(
        "stripe-checkout",
        user.id,
        CHECKOUT_PURCHASE_INTENT_KEY,
        createRequestFingerprint(customerId, interval),
        90_000,
        async () => {
          const monthlyPriceId = getProPriceId("monthly");
          const annualPriceId = getProPriceId("annual");
          const deliveryPriceIds = new Set([monthlyPriceId, annualPriceId]);
          const currentSubscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: "all",
            limit: 100,
          });
          if (currentSubscriptions.has_more) {
            throw new ExternalServiceError("Stripe subscription reconciliation");
          }
          const blocking = findBlockingDeliverySubscription(
            currentSubscriptions.data,
            deliveryPriceIds,
          );
          if (blocking) {
            const portal = await stripe.billingPortal.sessions.create({
              customer: customerId,
              return_url: `${origin}/settings#account`,
            });
            return {
              url: portal.url,
              mode: "portal" as const,
              reason: "existing_subscription" as const,
              status: blocking.status,
              reused: false,
            };
          }

          const openSessions = await stripe.checkout.sessions.list({
            customer: customerId,
            status: "open",
            limit: 100,
          });
          if (openSessions.has_more) {
            throw new ExternalServiceError("Stripe Checkout reconciliation");
          }
          const reusable = findReusableDeliveryCheckoutSession(
            openSessions.data,
            user.id,
            interval,
          );
          if (reusable?.url) {
            return {
              url: reusable.url,
              mode: "checkout" as const,
              reason: "open_session" as const,
              status: null,
              reused: true,
            };
          }
          // A user changing cadence should have one open purchase intent, not
          // two links that could both complete later.
          for (const openSession of openSessions.data) {
            if (isDeliveryCheckoutSession(openSession, user.id)) {
              await stripe.checkout.sessions.expire(openSession.id);
            }
          }

          await assertAccountNotDeleting(user.id);
          const checkoutDigest = createHash("sha256")
            .update(`${user.id}:${customerId}:${interval}:${minuteBucket}`)
            .digest("hex")
            .slice(0, 32);
          const session = await stripe.checkout.sessions.create(
            {
              mode: "subscription",
              customer: customerId,
              client_reference_id: user.id,
              line_items: [{
                price: interval === "annual" ? annualPriceId : monthlyPriceId,
                quantity: 1,
              }],
              success_url: `${origin}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
              cancel_url: `${origin}/pricing?checkout=canceled`,
              allow_promotion_codes: true,
              billing_address_collection: "auto",
              automatic_tax: { enabled: getServerEnv().STRIPE_ENABLE_AUTOMATIC_TAX },
              subscription_data: {
                metadata: { supabase_user_id: user.id, product: "delivery_pro" },
              },
              metadata: {
                supabase_user_id: user.id,
                product: "delivery_pro",
                interval,
              },
            },
            { idempotencyKey: `delivery-checkout-${checkoutDigest}` },
          );
          if (!session.url) throw new Error("Stripe Checkout did not return a URL.");
          return {
            url: session.url,
            mode: "checkout" as const,
            reason: "new_session" as const,
            status: null,
            reused: false,
          };
        },
      );
    } catch (error) {
      if (error instanceof AppError && error.code === "IDEMPOTENCY_CONFLICT") {
        throw new AppError(
          "CHECKOUT_CHOICE_IN_PROGRESS",
          "Another billing choice is already opening. Wait a moment, then try again.",
          409,
          { retryAfterSeconds: 2 },
          { cause: error },
        );
      }
      throw error;
    }

    return jsonOk(
      checkout.value,
      requestId,
      {
        status: checkout.value.mode === "checkout" && !checkout.value.reused ? 201 : 200,
        headers: {
          ...rateLimitHeaders(rateLimit),
          "Idempotency-Replayed": checkout.replayed ? "true" : "false",
        },
      },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
