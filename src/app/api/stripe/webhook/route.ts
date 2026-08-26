import { createHash } from "node:crypto";

import { AppError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { requireEnv } from "@/lib/server/env";
import { assertContentLength } from "@/lib/server/request";
import { getStripe, processStripeEvent } from "@/lib/server/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertContentLength(request, 1024 * 1024);
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return jsonError(
        new AppError("MISSING_SIGNATURE", "Missing Stripe signature.", 400),
        requestId,
      );
    }
    const { STRIPE_WEBHOOK_SECRET } = requireEnv("STRIPE_WEBHOOK_SECRET");
    const payload = await request.text();
    let event;
    try {
      event = getStripe().webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      throw new AppError("INVALID_SIGNATURE", "Invalid Stripe signature.", 400, undefined, {
        cause: error,
      });
    }
    const result = await processStripeEvent(
      event,
      createHash("sha256").update(payload).digest("hex"),
    );
    return jsonOk({ received: true, eventId: event.id, ...result }, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
