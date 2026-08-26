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

const reportSchema = z
  .object({
    deliveryId: z.string().uuid().optional(),
    profileId: z.string().uuid().optional(),
    promptId: z.string().uuid().optional(),
    submissionId: z.string().uuid().optional(),
    challengeInvite: z
      .string()
      .trim()
      .min(27)
      .max(101)
      .regex(/^[A-Za-z0-9]{6,20}\.[A-Za-z0-9_-]{20,80}$/)
      .optional(),
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
  .strict()
  .refine(
    (value) =>
      [value.deliveryId, value.profileId, value.promptId, value.submissionId].filter(Boolean)
        .length === 1,
    { message: "Choose exactly one item to report." },
  )
  .refine((value) => !value.challengeInvite || Boolean(value.profileId), {
    message: "A signed challenge context may only verify its challenger profile.",
    path: ["challengeInvite"],
  });

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  let responseCookie: string | undefined;
  let rateLimit: RateLimitResult | undefined;
  try {
    assertSameOrigin(request);
    assertJsonRequest(request);
    assertContentLength(request, 8 * 1024);
    const user = await getOptionalUser();
    const body = reportSchema.parse(await request.json());
    const idempotencyKey = reportIdempotencyKey(request);
    const actor = await prepareReportActor(request, user, idempotencyKey);
    responseCookie = actor.guest?.setCookie;
    rateLimit = actor.rateLimit;
    const supabase = await createServerSupabaseClient();
    const target = body.deliveryId
      ? (["deliveries", body.deliveryId] as const)
      : body.profileId
        ? (["profiles", body.profileId] as const)
        : body.promptId
          ? (["prompts", body.promptId] as const)
          : (["line_submissions", body.submissionId!] as const);
    const targetResult = await supabase
      .from(target[0])
      .select("id")
      .eq("id", target[1])
      .maybeSingle();
    let visible = targetResult.data;
    const targetError = targetResult.error;
    if (targetError) throw new ExternalServiceError("Supabase reports", { cause: targetError });
    // A signed invite is a capability to view its authored challenge message,
    // even when the challenger's general profile is private. It proves only
    // that exact creator UUID and returns no additional profile data.
    if (!visible && body.profileId && body.challengeInvite) {
      const separator = body.challengeInvite.indexOf(".");
      const code = body.challengeInvite.slice(0, separator);
      const token = body.challengeInvite.slice(separator + 1);
      const { data: inviteData, error: inviteError } = await supabase.rpc(
        "get_challenge_by_invite",
        { p_code: code, p_token: token },
      );
      if (inviteError) {
        throw new ExternalServiceError("Supabase reports", { cause: inviteError });
      }
      const invite = (Array.isArray(inviteData) ? inviteData[0] : inviteData) as
        | Record<string, unknown>
        | undefined;
      if (invite?.created_by === body.profileId) visible = { id: body.profileId };
    }
    if (!visible) throw new AppError("REPORT_TARGET_NOT_FOUND", "That item is unavailable.", 404);

    const { value, replayed } = await runIdempotent(
      "report",
      actor.idempotencyScope,
      idempotencyKey,
      createRequestFingerprint(
        target[0],
        target[1],
        body.reason,
        body.details ?? "",
      ),
      24 * 60 * 60 * 1_000,
      () => insertReport(actor, {
        deliveryId: body.deliveryId,
        profileId: body.profileId,
        promptId: body.promptId,
        submissionId: body.submissionId,
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
