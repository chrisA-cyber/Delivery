import { z } from "zod";

import { AppError, ExternalServiceError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { createRequestFingerprint, runIdempotent } from "@/lib/server/idempotency";
import { rateLimitHeaders, type RateLimitResult } from "@/lib/server/rate-limit";
import {
  insertReport,
  prepareReportActor,
  reportIdempotencyKey,
} from "@/lib/server/reports";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";
import { getOptionalUser } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ deliveryId: z.string().uuid() });
const bodySchema = z
  .object({
    reason: z.enum([
      "harassment",
      "hate",
      "sexual",
      "violence",
      "self_harm",
      "spam",
      "privacy",
      "copyright",
      "other",
    ]),
    details: z.string().trim().min(3).max(1_000).optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ deliveryId: string }> },
) {
  const requestId = requestIdFrom(request);
  let responseCookie: string | undefined;
  let rateLimit: RateLimitResult | undefined;
  try {
    assertSameOrigin(request);
    assertJsonRequest(request);
    assertContentLength(request, 8 * 1024);
    const user = await getOptionalUser();
    const { deliveryId } = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await request.json());
    const idempotencyKey = reportIdempotencyKey(request);
    const actor = await prepareReportActor(request, user, idempotencyKey);
    responseCookie = actor.guest?.setCookie;
    rateLimit = actor.rateLimit;
    const supabase = await createServerSupabaseClient();
    const { data: delivery, error: deliveryError } = await supabase
      .from("deliveries")
      .select("id")
      .eq("id", deliveryId)
      .maybeSingle();
    if (deliveryError) {
      throw new ExternalServiceError("Supabase reports", { cause: deliveryError });
    }
    if (!delivery) throw new AppError("REPORT_TARGET_NOT_FOUND", "That item is unavailable.", 404);
    const { value, replayed } = await runIdempotent(
      "report",
      actor.idempotencyScope,
      idempotencyKey,
      createRequestFingerprint(deliveryId, body.reason, body.details ?? ""),
      24 * 60 * 60 * 1_000,
      () => insertReport(actor, {
        deliveryId,
        reason: body.reason,
        details: body.details,
      }),
    );
    return jsonOk(value, requestId, {
      status: 201,
      headers: {
        ...rateLimitHeaders(rateLimit),
        "Idempotency-Replayed": replayed ? "true" : "false",
        ...(responseCookie ? { "Set-Cookie": responseCookie } : {}),
      },
    });
  } catch (error) {
    return jsonError(error, requestId, {
      ...(rateLimit ? rateLimitHeaders(rateLimit) : {}),
      ...(responseCookie ? { "Set-Cookie": responseCookie } : {}),
    });
  }
}
