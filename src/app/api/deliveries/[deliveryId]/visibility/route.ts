import { z } from "zod";

import { assertAccountNotDeleting } from "@/lib/server/account-deletion";
import { AppError, ExternalServiceError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { setDeliveryVisibility } from "@/lib/server/deliveries";
import { moderateLine } from "@/lib/server/moderation";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";
import { requireUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({ deliveryId: z.string().uuid() });
const bodySchema = z.object({ visibility: z.enum(["public", "private"]) }).strict();

interface DeliveryForPublish {
  id: string;
  user_id: string;
  state: string;
  transcript: string | null;
  moderation_labels: string[];
  prompts: { body: string } | { body: string }[] | null;
  delivery_scores:
    | { headline: string; verdict: string; evidence: Record<string, unknown> }
    | { headline: string; verdict: string; evidence: Record<string, unknown> }[]
    | null;
}

function joined<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

const stickyBlockingLabels = new Set([
  "publish-rejected",
  "publish-review",
  "publish-limited",
  "harassment",
  "hate",
  "sexual",
  "violence",
  "self-harm",
  "privacy",
]);

function isStickyBlockingLabel(label: string): boolean {
  const root = label.split("/")[0] ?? label;
  return (
    stickyBlockingLabels.has(label) ||
    stickyBlockingLabels.has(root) ||
    label.startsWith("manual-") ||
    label.startsWith("moderator-")
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ deliveryId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    assertJsonRequest(request);
    assertContentLength(request, 4 * 1024);
    const user = await requireUser();
    await assertAccountNotDeleting(user.id);
    const rateLimit = await enforceRateLimit(`delivery-visibility:${user.id}`, {
      limit: 20,
      windowMs: 10 * 60 * 1_000,
    });
    const { deliveryId } = paramsSchema.parse(await context.params);
    const { visibility } = bodySchema.parse(await request.json());
    const admin = createSupabaseAdminClient();

    if (visibility === "public") {
      const { data, error } = await admin
        .from("deliveries")
        .select(
          "id,user_id,state,transcript,moderation_labels,prompts(body),delivery_scores(headline,verdict,evidence)",
        )
        .eq("id", deliveryId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw new ExternalServiceError("Supabase publishing", { cause: error });
      const delivery = data as unknown as DeliveryForPublish | null;
      if (!delivery || delivery.state !== "judged") {
        throw new AppError("DELIVERY_NOT_FOUND", "That take is not ready to publish.", 404);
      }
      const prompt = joined(delivery.prompts);
      const score = joined(delivery.delivery_scores);
      if (!prompt || !score || !delivery.transcript) {
        throw new AppError("DELIVERY_INCOMPLETE", "That take is not ready to publish.", 409);
      }
      if (delivery.moderation_labels.some(isStickyBlockingLabel)) {
        throw new AppError(
          "PUBLISH_REVIEW_REQUIRED",
          "This take is already queued for moderator review and must stay private.",
          409,
        );
      }

      let moderation;
      try {
        moderation = await moderateLine(
          [
            prompt.body,
            delivery.transcript,
            score.headline,
            score.verdict,
            JSON.stringify(score.evidence),
          ].join("\n"),
        );
      } catch (error) {
        const failureLabels = [
          ...new Set([
            ...delivery.moderation_labels,
            "publish-moderation-unavailable",
          ]),
        ];
        const { error: updateError } = await admin
          .from("deliveries")
          .update({ moderation_labels: failureLabels })
          .eq("id", deliveryId)
          .eq("user_id", user.id)
          .eq("visibility", "private");
        if (updateError) {
          console.error("Failed to persist publish moderation outage", {
            requestId,
            deliveryId,
            updateError,
          });
        }
        throw error;
      }

      // A successful provider retry may clear only its own transient outage
      // marker. Safety, manual, and historical moderation labels are unioned.
      const priorLabels = delivery.moderation_labels.filter(
        (label) => label !== "publish-moderation-unavailable",
      );
      const labels = [
        ...new Set([
          ...priorLabels.filter(
            (label) => moderation.decision === "approved" || label !== "publish-approved",
          ),
          ...moderation.categories,
          moderation.decision === "approved"
            ? "publish-approved"
            : `publish-${moderation.decision}`,
        ]),
      ];
      const { error: labelError } = await admin
        .from("deliveries")
        .update({ moderation_labels: labels })
        .eq("id", deliveryId)
        .eq("user_id", user.id)
        .eq("visibility", "private");
      if (labelError) {
        throw new ExternalServiceError("Supabase publishing", { cause: labelError });
      }
      if (moderation.decision !== "approved") {
        throw new AppError(
          "PUBLISH_REVIEW_REQUIRED",
          "This take is staying private while it receives a safety review.",
          422,
          { decision: moderation.decision },
        );
      }
    }

    const result = await setDeliveryVisibility(deliveryId, user.id, visibility);
    return jsonOk({ deliveryId, ...result }, requestId, {
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
