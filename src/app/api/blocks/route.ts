import { z } from "zod";

import { assertAccountNotDeleting } from "@/lib/server/account-deletion";
import { AppError, ExternalServiceError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";
import { requireUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({ handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/) }).strict();

async function targetFor(handle: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("profiles").select("id,handle,display_name").eq("handle", handle).maybeSingle();
  if (error) throw new ExternalServiceError("Supabase blocks", { cause: error });
  if (!data) throw new AppError("PROFILE_NOT_FOUND", "That performer is unavailable.", 404);
  if (String(data.id) === userId) throw new AppError("BLOCK_SELF", "You cannot block your own profile.", 422);
  return data as { id: string; handle: string; display_name: string };
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const user = await requireUser();
    const admin = createSupabaseAdminClient();
    const { data: rows, error } = await admin.from("blocks").select("blocked_id,created_at").eq("blocker_id", user.id).order("created_at", { ascending: false }).limit(500);
    if (error) throw new ExternalServiceError("Supabase blocks", { cause: error });
    const ids = (rows ?? []).map((row) => String(row.blocked_id));
    const profiles = ids.length ? await admin.from("profiles").select("id,handle,display_name").in("id", ids) : { data: [], error: null };
    if (profiles.error) throw new ExternalServiceError("Supabase blocks", { cause: profiles.error });
    const byId = new Map((profiles.data ?? []).map((profile) => [String(profile.id), profile]));
    return jsonOk({ blocks: (rows ?? []).flatMap((row) => {
      const profile = byId.get(String(row.blocked_id));
      return profile ? [{ handle: String(profile.handle), displayName: String(profile.display_name), blockedAt: String(row.created_at) }] : [];
    }) }, requestId, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error, requestId, { "Cache-Control": "private, no-store" }); }
}

async function mutate(request: Request, method: "POST" | "DELETE") {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request); assertJsonRequest(request); assertContentLength(request, 4 * 1024);
    const user = await requireUser();
    await assertAccountNotDeleting(user.id);
    const limit = await enforceRateLimit(`block:${user.id}`, { limit: 60, windowMs: 24 * 60 * 60 * 1_000 });
    const body = schema.parse(await request.json());
    const target = await targetFor(body.handle, user.id);
    const admin = createSupabaseAdminClient();
    const query = method === "POST"
      ? admin.from("blocks").upsert({ blocker_id: user.id, blocked_id: target.id }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true })
      : admin.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", target.id);
    const { error } = await query;
    if (error) throw new ExternalServiceError("Supabase blocks", { cause: error });
    return jsonOk({ blocked: method === "POST", profile: { handle: target.handle, displayName: target.display_name } }, requestId, { headers: rateLimitHeaders(limit) });
  } catch (error) { return jsonError(error, requestId); }
}

export async function POST(request: Request) { return mutate(request, "POST"); }
export async function DELETE(request: Request) { return mutate(request, "DELETE"); }
