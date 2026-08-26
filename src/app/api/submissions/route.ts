import { z } from "zod";

import { assertAccountNotDeleting } from "@/lib/server/account-deletion";
import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { moderateLine } from "@/lib/server/moderation";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import {
  assertContentLength,
  assertJsonRequest,
  assertSameOrigin,
} from "@/lib/server/request";
import { throwSubmissionWriteError } from "@/lib/server/submissions";
import { requireUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const submissionSchema = z
  .object({
    text: z.string().trim().min(4).max(180),
    category: z
      .enum([
        "main-character",
        "group-chat",
        "gaming",
        "anime-energy",
        "cinema-coded",
        "workplace",
        "romance",
        "villain-era",
        "brainrot",
        "customer-service",
        "streamer-mode",
        "wildcard",
      ])
      .default("wildcard"),
    sourceContext: z.string().trim().max(500).optional(),
    suggestedEnergy: z.string().trim().max(180).optional(),
    confirmOriginalOrLicensed: z.literal(true),
  })
  .strict();

function normalizeLine(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    assertJsonRequest(request);
    assertContentLength(request, 16 * 1024);
    const user = await requireUser();
    await assertAccountNotDeleting(user.id);
    const rateLimit = await enforceRateLimit(`submission:${user.id}`, {
      limit: 8,
      windowMs: 24 * 60 * 60 * 1_000,
    });
    const parsed = submissionSchema.parse(await request.json());
    const text = normalizeLine(parsed.text);
    const moderation = await moderateLine(text);

    if (moderation.decision === "rejected") {
      return jsonOk(
        { accepted: false, status: "rejected" as const, moderation },
        requestId,
        { status: 200, headers: rateLimitHeaders(rateLimit) },
      );
    }

    // The service boundary owns moderation and rate limiting; browser clients
    // intentionally have no direct INSERT grant on the review queue.
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("line_submissions")
      .insert({
        submitted_by: user.id,
        proposed_body: text,
        proposed_category: parsed.category,
        proposed_tags: [],
        suggested_energy: parsed.suggestedEnergy ?? null,
        state: "review",
        automated_labels: moderation.categories,
        automated_scores: {
          decision: moderation.decision,
          provider: moderation.provider,
          source_context: parsed.sourceContext ?? null,
          rights_confirmed: true,
        },
      })
      .select("id,state,created_at")
      .single();
    if (error) throwSubmissionWriteError(error);

    return jsonOk(
      { accepted: true, submission: data, moderation },
      requestId,
      { status: 201, headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
