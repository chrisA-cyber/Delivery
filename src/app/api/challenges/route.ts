import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import { assertAccountNotDeleting } from "@/lib/server/account-deletion";
import { AppError, ExternalServiceError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { resolveCanonicalDeliveryContent } from "@/lib/server/content";
import { preflightJudgingUsage } from "@/lib/server/entitlements";
import { getServerEnv } from "@/lib/server/env";
import { moderateLine } from "@/lib/server/moderation";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";
import { requireUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({ promptId: z.string().trim().min(2).max(120), energyId: z.string().trim().min(2).max(120), maxRating: z.enum(["everyone", "teen", "mature"]).default("everyone"), message: z.string().trim().max(180).optional() }).strict();

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request); assertJsonRequest(request); assertContentLength(request, 8 * 1024);
    const user = await requireUser();
    await assertAccountNotDeleting(user.id);
    const usage = await preflightJudgingUsage(user);
    if (usage.tier !== "pro") throw new AppError("PRO_REQUIRED", "Custom challenges are a Delivery Pro feature.", 403, { upgradeCode: "DELIVERY_PRO" });
    const rateLimit = await enforceRateLimit(`challenge-create:${user.id}`, { limit: 30, windowMs: 24 * 60 * 60 * 1000 });
    const body = schema.parse(await request.json());
    if (body.message) {
      const messageModeration = await moderateLine(body.message);
      if (messageModeration.decision !== "approved") {
        throw new AppError(
          messageModeration.decision === "rejected"
            ? "CHALLENGE_MESSAGE_REJECTED"
            : "CHALLENGE_MESSAGE_REVIEW_REQUIRED",
          messageModeration.decision === "rejected"
            ? "That invite message crosses a community safety boundary."
            : "That invite message needs review, so it cannot be sent yet.",
          422,
        );
      }
    }
    const supabase = await createServerSupabaseClient();
    const [{ data: prompt, error: promptError }, { data: energy, error: energyError }] = await Promise.all([
      supabase.from("prompts").select("id,body").eq("slug", body.promptId).eq("state", "published").eq("draw_enabled", true).maybeSingle(),
      supabase.from("energy_modifiers").select("id,instruction").eq("slug", body.energyId).eq("state", "published").eq("draw_enabled", true).maybeSingle(),
    ]);
    if (promptError || energyError) throw new ExternalServiceError("Supabase challenges", { cause: promptError ?? energyError });
    if (!prompt || !energy) throw new AppError("CHALLENGE_CONTENT_NOT_FOUND", "That line or energy is no longer available.", 404);
    // Creation is a fresh draw: use the same canonical audience, availability,
    // direction and entitlement checks as a new Classic take. Challenge admission
    // itself remains a separate authenticated check for existing signed invites.
    const content = await resolveCanonicalDeliveryContent({
      promptId: body.promptId,
      promptText: String((prompt as Record<string, unknown>).body),
      energy: String((energy as Record<string, unknown>).instruction),
      mode: "classic", maxRating: body.maxRating, user, usage,
    });
    const code = randomBytes(6).toString("hex");
    const token = randomBytes(24).toString("base64url");
    const tokenDigest = `\\x${createHash("sha256").update(token).digest("hex")}`;
    const { data, error } = await createSupabaseAdminClient().from("challenges").insert({
      code, token_digest: tokenDigest, created_by: user.id,
      prompt_id: content.promptId, energy_modifier_id: content.energyId,
      state: "open", visibility: "link", message: body.message || null, max_entries: 2,
    }).select("id,code,expires_at").single();
    if (error) throw new ExternalServiceError("Supabase challenges", { cause: error });
    const env = getServerEnv();
    const origin = env.NEXT_PUBLIC_APP_URL ? new URL(env.NEXT_PUBLIC_APP_URL).origin : new URL(request.url).origin;
    return jsonOk({ ...data, inviteUrl: `${origin}/challenge/${code}.${token}` }, requestId, { status: 201, headers: rateLimitHeaders(rateLimit) });
  } catch (error) { return jsonError(error, requestId); }
}
