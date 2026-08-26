import "server-only";

import Stripe from "stripe";

import { ExternalServiceError } from "@/lib/server/api-error";
import { getServerEnv, requireEnv } from "@/lib/server/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type BillingInterval = "monthly" | "annual";

// Scope is already the authenticated user ID. Keeping the intent key stable
// closes the cross-instance race at clock-bucket boundaries; the short result
// TTL hands later attempts to authoritative subscription/open-session checks.
export const CHECKOUT_PURCHASE_INTENT_KEY = "subscription-purchase-intent";

let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  const { STRIPE_SECRET_KEY } = requireEnv("STRIPE_SECRET_KEY");
  stripeClient ??= new Stripe(STRIPE_SECRET_KEY, {
    appInfo: { name: "Delivery", version: "1.0.0" },
    maxNetworkRetries: 2,
    timeout: 20_000,
  });
  return stripeClient;
}

export function getProPriceId(interval: BillingInterval): string {
  const key =
    interval === "annual" ? "STRIPE_PRO_ANNUAL_PRICE_ID" : "STRIPE_PRO_MONTHLY_PRICE_ID";
  const env = requireEnv(key);
  return env[key];
}

export function getAppOrigin(request: Request): string {
  const env = getServerEnv();
  if (env.NEXT_PUBLIC_APP_URL) return new URL(env.NEXT_PUBLIC_APP_URL).origin;
  if (env.NODE_ENV === "production") requireEnv("NEXT_PUBLIC_APP_URL");
  return new URL(request.url).origin;
}

function stripeId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function unixToIso(value: number | null | undefined): string | null {
  return value ? new Date(value * 1_000).toISOString() : null;
}

const subscriptionStatusPriority: Record<Stripe.Subscription.Status, number> = {
  active: 6,
  trialing: 6,
  past_due: 5,
  unpaid: 5,
  paused: 5,
  incomplete: 4,
  canceled: 3,
  incomplete_expired: 2,
};

export function chooseCanonicalDeliverySubscription(
  subscriptions: Stripe.Subscription[],
  deliveryPriceIds: ReadonlySet<string>,
): Stripe.Subscription | null {
  return subscriptions
    .filter((subscription) =>
      subscription.items.data.some((item) => deliveryPriceIds.has(item.price.id)),
    )
    .sort((left, right) => {
      const statusDifference =
        subscriptionStatusPriority[right.status] - subscriptionStatusPriority[left.status];
      if (statusDifference) return statusDifference;
      if (right.created !== left.created) return right.created - left.created;
      return right.id.localeCompare(left.id);
    })[0] ?? null;
}

const terminalSubscriptionStatuses = new Set<Stripe.Subscription.Status>([
  "canceled",
  "incomplete_expired",
]);

export function findBlockingDeliverySubscription(
  subscriptions: Stripe.Subscription[],
  deliveryPriceIds: ReadonlySet<string>,
): Stripe.Subscription | null {
  return subscriptions
    .filter(
      (subscription) =>
        !terminalSubscriptionStatuses.has(subscription.status) &&
        (subscription.metadata?.product === "delivery_pro" ||
          subscription.items.data.some((item) => deliveryPriceIds.has(item.price.id))),
    )
    .sort((left, right) => {
      const statusDifference =
        subscriptionStatusPriority[right.status] - subscriptionStatusPriority[left.status];
      if (statusDifference) return statusDifference;
      if (right.created !== left.created) return right.created - left.created;
      return right.id.localeCompare(left.id);
    })[0] ?? null;
}

export function findReusableDeliveryCheckoutSession(
  sessions: Stripe.Checkout.Session[],
  userId: string,
  interval: BillingInterval,
): Stripe.Checkout.Session | null {
  return sessions.find((session) =>
    session.status === "open" &&
    session.mode === "subscription" &&
    session.url &&
    (session.metadata?.product === "delivery_pro" ||
      session.client_reference_id === userId) &&
    session.metadata?.supabase_user_id === userId &&
    session.metadata?.interval === interval,
  ) ?? null;
}

export function isDeliveryCheckoutSession(
  session: Stripe.Checkout.Session,
  userId: string,
): boolean {
  return (
    session.status === "open" &&
    session.mode === "subscription" &&
    session.metadata?.supabase_user_id === userId &&
    (session.metadata?.product === "delivery_pro" ||
      session.client_reference_id === userId)
  );
}

async function findUserId(
  subscription: Stripe.Subscription,
  customerId: string,
): Promise<string | null> {
  if (subscription.metadata.supabase_user_id) {
    return subscription.metadata.supabase_user_id;
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw new ExternalServiceError("Supabase billing", { cause: error });
  if (data?.user_id) return String(data.user_id);

  const customer = await getStripe().customers.retrieve(customerId);
  return customer.deleted ? null : customer.metadata.supabase_user_id || null;
}

interface ClaimRow {
  claimed: boolean;
  state: "processing" | "processed" | "ignored" | "failed";
  attempt_count: number;
}

async function claimEvent(event: Stripe.Event, payloadHash: string): Promise<ClaimRow> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "claim_stripe_webhook_event",
    {
      p_event_id: event.id,
      p_event_type: event.type,
      p_stripe_created_at: new Date(event.created * 1_000).toISOString(),
      p_livemode: event.livemode,
      p_payload_hash: payloadHash,
    },
  );
  if (error) throw new ExternalServiceError("Supabase webhook ledger", { cause: error });
  const row = (Array.isArray(data) ? data[0] : data) as ClaimRow | null;
  if (!row) throw new ExternalServiceError("Supabase webhook ledger");
  return row;
}

async function finishEvent(
  eventId: string,
  state: "processed" | "ignored" | "failed",
  errorMessage?: string,
): Promise<void> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "finish_stripe_webhook_event",
    {
      p_event_id: eventId,
      p_state: state,
      p_error: errorMessage?.slice(0, 2_000) ?? null,
    },
  );
  if (error) throw new ExternalServiceError("Supabase webhook ledger", { cause: error });
  const row = (Array.isArray(data) ? data[0] : data) as { finished?: boolean } | null;
  if (!row?.finished) throw new ExternalServiceError("Supabase webhook ledger");
}

async function applySubscription(
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  snapshotRetrievedAt: string,
): Promise<"processed" | "ignored"> {
  const customerId = stripeId(subscription.customer);
  if (!customerId) throw new Error("Subscription is missing its customer.");
  const prices = requireEnv("STRIPE_PRO_MONTHLY_PRICE_ID", "STRIPE_PRO_ANNUAL_PRICE_ID");
  const deliveryPriceIds = new Set([
    prices.STRIPE_PRO_MONTHLY_PRICE_ID,
    prices.STRIPE_PRO_ANNUAL_PRICE_ID,
  ]);
  const deliveryItem = subscription.items.data.find((candidate) =>
    deliveryPriceIds.has(candidate.price.id),
  );
  const item = deliveryItem ?? subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const isDeliveryProPrice = Boolean(deliveryItem);
  let userId: string | null;
  if (isDeliveryProPrice) {
    userId = await findUserId(subscription, customerId);
  } else {
    // A price swap on the same Delivery subscription must revoke Pro rather
    // than leave a stale entitlement. Unrelated subscriptions for the same
    // Stripe customer remain ignored.
    const { data: existing, error: existingError } = await createSupabaseAdminClient()
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();
    if (existingError) {
      throw new ExternalServiceError("Supabase billing", { cause: existingError });
    }
    if (!existing?.user_id) return "ignored";
    userId = String(existing.user_id);
  }
  if (!userId) throw new Error(`No Delivery user is linked to Stripe customer ${customerId}.`);
  const { data: deletionJob, error: deletionError } = await createSupabaseAdminClient()
    .from("account_deletion_jobs")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (deletionError) {
    throw new ExternalServiceError("Supabase billing deletion status", {
      cause: deletionError,
    });
  }
  if (deletionJob) return "ignored";
  const periodStart =
    item?.current_period_start ??
    (subscription as unknown as { current_period_start?: number }).current_period_start;
  const periodEnd =
    item?.current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end;
  const { data, error } = await createSupabaseAdminClient().rpc(
    "apply_stripe_subscription_event",
    {
      p_event_id: event.id,
      p_user_id: userId,
      p_tier: isDeliveryProPrice ? "pro" : "free",
      p_state: subscription.status,
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: subscription.id,
      p_stripe_price_id: priceId,
      p_cancel_at_period_end: subscription.cancel_at_period_end,
      p_current_period_start: unixToIso(periodStart),
      p_current_period_end: unixToIso(periodEnd),
      p_trial_ends_at: unixToIso(subscription.trial_end),
      p_snapshot_retrieved_at: snapshotRetrievedAt,
      p_metadata: {
        canceled_at: unixToIso(subscription.canceled_at),
        latest_invoice_id:
          typeof subscription.latest_invoice === "string"
            ? subscription.latest_invoice
            : subscription.latest_invoice?.id ?? null,
        stripe_event_type: event.type,
        recognized_delivery_price: isDeliveryProPrice,
        reconciled_current_customer_snapshot: true,
      },
    },
  );
  if (error) throw new ExternalServiceError("Supabase billing", { cause: error });
  const row = (Array.isArray(data) ? data[0] : data) as
    | { applied?: boolean; stale?: boolean }
    | null;
  if (!row || (!row.applied && !row.stale)) {
    throw new ExternalServiceError("Supabase billing");
  }
  return "processed";
}

async function reconcileCustomerSubscription(
  event: Stripe.Event,
  seed: Stripe.Subscription,
): Promise<"processed" | "ignored"> {
  const customerId = stripeId(seed.customer);
  if (!customerId) throw new Error("Subscription is missing its customer.");
  const prices = requireEnv("STRIPE_PRO_MONTHLY_PRICE_ID", "STRIPE_PRO_ANNUAL_PRICE_ID");
  const current = await getStripe().subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });
  if (current.has_more) {
    throw new ExternalServiceError("Stripe subscription reconciliation");
  }
  const snapshotRetrievedAt = new Date().toISOString();
  const canonical = chooseCanonicalDeliverySubscription(
    current.data,
    new Set([prices.STRIPE_PRO_MONTHLY_PRICE_ID, prices.STRIPE_PRO_ANNUAL_PRICE_ID]),
  );
  return applySubscription(event, canonical ?? seed, snapshotRetrievedAt);
}

async function dispatchEvent(event: Stripe.Event): Promise<"processed" | "ignored"> {
  const stripe = getStripe();
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription" || !session.subscription) return "ignored";
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
      return reconcileCustomerSubscription(
        event,
        await stripe.subscriptions.retrieve(subscriptionId),
      );
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return reconcileCustomerSubscription(event, event.data.object);
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
        parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } };
      };
      const value = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
      if (!value) return "ignored";
      const id = typeof value === "string" ? value : value.id;
      return reconcileCustomerSubscription(event, await stripe.subscriptions.retrieve(id));
    }
    default:
      return "ignored";
  }
}

export interface StripeEventResult {
  state: "processed" | "ignored";
  replayed: boolean;
  attemptCount: number;
}

export async function processStripeEvent(
  event: Stripe.Event,
  payloadHash: string,
): Promise<StripeEventResult> {
  const claim = await claimEvent(event, payloadHash);
  if (!claim.claimed) {
    if (claim.state === "processing") {
      // A concurrent worker or a recently crashed worker owns the lease. A 503
      // makes Stripe retry instead of acknowledging an event that is not done.
      throw new ExternalServiceError("Stripe webhook processing");
    }
    return {
      state: claim.state === "ignored" ? "ignored" : "processed",
      replayed: true,
      attemptCount: claim.attempt_count,
    };
  }

  try {
    const state = await dispatchEvent(event);
    await finishEvent(event.id, state);
    return { state, replayed: false, attemptCount: claim.attempt_count };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    try {
      await finishEvent(event.id, "failed", message);
    } catch (finishError) {
      console.error("Failed to mark Stripe event failed", {
        eventId: event.id,
        finishError,
      });
    }
    throw error;
  }
}
