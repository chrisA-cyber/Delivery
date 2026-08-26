import { z } from "zod";

import { AppError, ExternalServiceError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const liftSchema = z.object({
  restrictionId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  internalNote: z.string().trim().max(2_000).optional(),
}).strict();

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const { user } = await requireStaff();
    const rateLimit = await enforceRateLimit(`moderation:restrictions:${user.id}`, {
      limit: 120,
      windowMs: 5 * 60 * 1_000,
    });
    const admin = createSupabaseAdminClient();
    const { data: restrictions, error } = await admin
      .from("account_restrictions")
      .select("id,user_id,action_id,kind,reason,starts_at,ends_at,created_at")
      .in("kind", ["profile-limit", "profile-remove"])
      .lte("starts_at", new Date().toISOString())
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .order("starts_at", { ascending: false })
      .limit(100);
    if (error) throw new ExternalServiceError("Supabase moderation restrictions", { cause: error });
    const userIds = [...new Set((restrictions ?? []).map((row) => String(row.user_id)))];
    const profiles = userIds.length
      ? await admin.from("profiles").select("id,handle,display_name,is_private").in("id", userIds)
      : { data: [], error: null };
    if (profiles.error) {
      throw new ExternalServiceError("Supabase moderation restrictions", {
        cause: profiles.error,
      });
    }
    const byId = new Map((profiles.data ?? []).map((profile) => [String(profile.id), profile]));
    const items = (restrictions ?? []).map((restriction) => {
      const profile = byId.get(String(restriction.user_id));
      return {
        id: String(restriction.id),
        userId: String(restriction.user_id),
        actionId: restriction.action_id ? String(restriction.action_id) : null,
        kind: String(restriction.kind),
        reason: String(restriction.reason),
        startsAt: String(restriction.starts_at),
        endsAt: restriction.ends_at ? String(restriction.ends_at) : null,
        profile: profile ? {
          handle: String(profile.handle),
          displayName: String(profile.display_name),
          isPrivate: Boolean(profile.is_private),
        } : null,
      };
    });
    return jsonOk({ items, capped: items.length === 100 }, requestId, {
      headers: {
        ...rateLimitHeaders(rateLimit),
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return jsonError(error, requestId, { "Cache-Control": "private, no-store, max-age=0" });
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    assertJsonRequest(request);
    assertContentLength(request, 8 * 1_024);
    const { user } = await requireStaff();
    const rateLimit = await enforceRateLimit(`moderation:restriction-lift:${user.id}`, {
      limit: 30,
      windowMs: 10 * 60 * 1_000,
    });
    const body = liftSchema.parse(await request.json());
    const { data, error } = await createSupabaseAdminClient().rpc(
      "lift_moderation_restriction",
      {
        p_restriction_id: body.restrictionId,
        p_actor_id: user.id,
        p_reason: body.reason,
        p_internal_note: body.internalNote ?? null,
      },
    );
    if (error) {
      if (error.code === "23503") throw new AppError("RESTRICTION_NOT_FOUND", "That restriction is unavailable.", 404);
      if (error.code === "55000") throw new AppError("RESTRICTION_ALREADY_LIFTED", "Another reviewer already lifted that restriction.", 409);
      if (error.code === "0A000") throw new AppError("RESTRICTION_WORKFLOW_REQUIRED", "That restriction needs the dedicated operations workflow.", 409);
      if (error.code === "42501") throw new AppError("MODERATION_FORBIDDEN", "Your moderation access changed. Refresh before continuing.", 403);
      if (error.code === "22023") throw new AppError("INVALID_RESTRICTION_LIFT", "That lift request is not valid.", 422);
      throw new ExternalServiceError("Supabase moderation restrictions", { cause: error });
    }
    return jsonOk(data, requestId, { headers: rateLimitHeaders(rateLimit) });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
