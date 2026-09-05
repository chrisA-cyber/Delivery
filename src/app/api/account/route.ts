import { NextResponse } from "next/server";
import { z } from "zod";

import { mapAccountHistoryItem } from "@/lib/server/account-history";
import { assertAccountNotDeleting } from "@/lib/server/account-deletion";
import { AppError, ExternalServiceError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { moderateLine } from "@/lib/server/moderation";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOptionalUser, requireUser } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/server/env";

export const dynamic = "force-dynamic";

async function loadAccount() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ authenticated: false, configured: false }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, configured: true }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const supabase = await createServerSupabaseClient();
  const [profileResult, statsResult, subscriptionResult, deliveriesResult, badgesResult] = await Promise.all([
    supabase.from("profiles").select("handle,display_name,avatar_path,bio,is_private").eq("id", user.id).maybeSingle(),
    supabase.from("user_stats_live").select("judged_deliveries,average_score,best_score,average_commitment,average_comedy,average_accuracy,average_chaos,current_daily_streak,longest_daily_streak,reactions_received,followers_count,following_count").eq("user_id", user.id).maybeSingle(),
    supabase.from("subscriptions").select("tier,state,current_period_end,cancel_at_period_end").eq("user_id", user.id).maybeSingle(),
    supabase.from("deliveries").select("id,prompt_id,energy_modifier_id,state,visibility,transcript,moderation_labels,created_at,daily_challenge_date,daily_ranked").eq("user_id", user.id).eq("state", "judged").order("created_at", { ascending: false }).limit(30),
    supabase.from("user_badges").select("badge_id,awarded_at,badges(id,name,description,icon,color,rarity)").eq("user_id", user.id).order("awarded_at", { ascending: false }),
  ]);

  for (const result of [profileResult, statsResult, subscriptionResult, deliveriesResult, badgesResult]) {
    if (result.error) throw new ExternalServiceError("Supabase", { cause: result.error });
  }

  const deliveries = (deliveriesResult.data ?? []) as Array<Record<string, unknown>>;
  const deliveryIds = deliveries.map((row) => String(row.id));
  const promptIds = [...new Set(deliveries.map((row) => String(row.prompt_id)).filter(Boolean))];
  const energyIds = [...new Set(deliveries.map((row) => row.energy_modifier_id ? String(row.energy_modifier_id) : "").filter(Boolean))];

  const [scoresResult, promptsResult, energiesResult] = await Promise.all([
    deliveryIds.length ? supabase.from("delivery_scores").select("delivery_id,overall,commitment,comedy,accuracy,chaos,headline,verdict,rubric_version,provider,model,evidence").in("delivery_id", deliveryIds) : Promise.resolve({ data: [] }),
    promptIds.length ? supabase.from("prompts").select("id,slug,body,category,difficulty,rating").in("id", promptIds) : Promise.resolve({ data: [] }),
    energyIds.length ? supabase.from("energy_modifiers").select("id,slug,instruction").in("id", energyIds) : Promise.resolve({ data: [] }),
  ]);
  for (const result of [scoresResult, promptsResult, energiesResult]) {
    if ("error" in result && result.error) throw new ExternalServiceError("Supabase", { cause: result.error });
  }

  const scores = new Map(((scoresResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.delivery_id), row]));
  const prompts = new Map(((promptsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]));
  const energies = new Map(((energiesResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]));

  const history = deliveries.flatMap((delivery) => {
    const score = scores.get(String(delivery.id));
    const prompt = prompts.get(String(delivery.prompt_id));
    if (!score || !prompt) return [];
    const energy = delivery.energy_modifier_id ? energies.get(String(delivery.energy_modifier_id)) : undefined;
    return [mapAccountHistoryItem(delivery, score, prompt, energy)];
  });

  const profile = profileResult.data as Record<string, unknown> | null;
  const stats = statsResult.data as Record<string, unknown> | null;
  const subscription = subscriptionResult.data as Record<string, unknown> | null;
  const badges = ((badgesResult.data ?? []) as Array<Record<string, unknown>>).flatMap((award) => {
    const relation = Array.isArray(award.badges) ? award.badges[0] : award.badges;
    if (!relation || typeof relation !== "object") return [];
    const badge = relation as Record<string, unknown>;
    return [{
      id: String(badge.id ?? award.badge_id),
      name: String(badge.name ?? "Mystery badge"),
      description: String(badge.description ?? "A documented act of commitment."),
      icon: String(badge.icon ?? "spark"),
      color: String(badge.color ?? "#D7FF3F"),
      rarity: String(badge.rarity ?? "common"),
      awardedAt: String(award.awarded_at),
    }];
  });
  const periodEnd = subscription?.current_period_end ? new Date(String(subscription.current_period_end)).getTime() : null;
  const pro = subscription?.tier === "pro" && (subscription?.state === "active" || subscription?.state === "trialing") && (!periodEnd || periodEnd > Date.now());

  return NextResponse.json({
    authenticated: true,
    configured: true,
    user: { id: user.id, email: user.email ?? null },
    profile: {
      handle: String(profile?.handle ?? `player_${user.id.slice(0, 6)}`),
      displayName: String(profile?.display_name ?? user.user_metadata?.full_name ?? "Delivery Player"),
      bio: profile?.bio ? String(profile.bio) : undefined,
      isPrivate: Boolean(profile?.is_private),
      avatar: String(profile?.display_name ?? user.email ?? "D").slice(0, 1).toUpperCase(),
      avatarUrl: profile?.avatar_path ? String(profile.avatar_path) : undefined,
      level: Math.max(1, Math.floor(Number(stats?.judged_deliveries ?? 0) / 10) + 1),
      xp: Number(stats?.judged_deliveries ?? 0) * 35,
      streak: Number(stats?.current_daily_streak ?? 0),
      followers: Number(stats?.followers_count ?? 0),
      following: Number(stats?.following_count ?? 0),
    },
    stats,
    subscription: subscription ? { ...subscription, tier: pro ? "pro" : "free" } : { tier: "free" },
    badges,
    history,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    return await loadAccount();
  } catch (error) {
    return jsonError(error, requestId, {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie, Authorization",
    });
  }
}

const profileSchema = z.object({
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/).optional(),
  displayName: z.string().trim().min(1).max(48).optional(),
  bio: z.string().trim().max(240).optional(),
  isPrivate: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Choose at least one profile field.");

export async function PATCH(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request); assertJsonRequest(request); assertContentLength(request, 8 * 1024);
    const user = await requireUser();
    await assertAccountNotDeleting(user.id);
    const rateLimit = await enforceRateLimit(`profile-update:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1_000 });
    const body = profileSchema.parse(await request.json());
    const profileText = [
      body.handle !== undefined ? `Handle: ${body.handle.replaceAll("_", " ")}` : "",
      body.displayName !== undefined ? `Display name: ${body.displayName}` : "",
      body.bio !== undefined && body.bio ? `Bio: ${body.bio}` : "",
    ].filter(Boolean).join("\n");
    const moderation = profileText ? await moderateLine(profileText) : null;
    if (moderation?.decision === "rejected") {
      throw new AppError("PROFILE_TEXT_REJECTED", "That profile text crosses a community safety boundary.", 422);
    }
    const update: Record<string, unknown> = { last_active_at: new Date().toISOString() };
    if (body.handle !== undefined) update.handle = body.handle;
    if (body.displayName !== undefined) update.display_name = body.displayName;
    if (body.bio !== undefined) update.bio = body.bio || null;
    if (body.isPrivate !== undefined) update.is_private = body.isPrivate;
    if (moderation?.decision === "review") update.is_private = true;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("profiles").update(update).eq("id", user.id).select("handle,display_name,bio,avatar_path,is_private").single();
    if (error) {
      if (error.code === "23505") throw new AppError("HANDLE_TAKEN", "That handle is already performing somewhere else.", 409);
      throw new ExternalServiceError("Supabase profile", { cause: error });
    }
    if (moderation?.decision === "review") {
      const { data: existing, error: existingError } = await admin.from("reports").select("id").eq("profile_id", user.id).in("state", ["open", "triaged"]).limit(1).maybeSingle();
      if (existingError) throw new ExternalServiceError("Supabase profile moderation", { cause: existingError });
      if (!existing) {
        const { error: reportError } = await admin.from("reports").insert({
          reporter_id: user.id,
          profile_id: user.id,
          reason: "other",
          details: `Automated profile review: ${moderation.reason} Labels: ${moderation.categories.join(", ") || "none"}.`,
          state: "open",
        });
        if (reportError) throw new ExternalServiceError("Supabase profile moderation", { cause: reportError });
      }
    }
    const profile = data as Record<string, unknown>;
    return jsonOk({ handle: String(profile.handle), displayName: String(profile.display_name), bio: profile.bio ? String(profile.bio) : "", avatarUrl: profile.avatar_path ? String(profile.avatar_path) : null, isPrivate: Boolean(profile.is_private), warning: moderation?.decision === "review" ? "Saved privately while the trust crew takes a look." : undefined }, requestId, { headers: rateLimitHeaders(rateLimit) });
  } catch (error) { return jsonError(error, requestId); }
}
