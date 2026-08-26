import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/server/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOptionalUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Profiles are not configured." }, { status: 503 });
  const { handle } = await params;
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(handle)) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  const supabase = await createServerSupabaseClient();
  const { data: profile, error } = await supabase.from("profiles").select("id,handle,display_name,avatar_path,bio,created_at").eq("handle", handle).maybeSingle();
  if (error) return NextResponse.json({ error: "Profile could not be loaded." }, { status: 502 });
  if (!profile) return NextResponse.json({ error: "Profile not found or private." }, { status: 404 });
  const profileRow = profile as Record<string, unknown>;
  const userId = String(profileRow.id);
  const viewer = await getOptionalUser();
  const [statsResult, deliveriesResult, badgesResult, followResult, blockResult] = await Promise.all([
    supabase.from("user_stats_live").select("judged_deliveries,public_deliveries,average_score,best_score,average_commitment,average_comedy,average_accuracy,average_chaos,current_daily_streak,longest_daily_streak,reactions_received,followers_count,following_count").eq("user_id", userId).maybeSingle(),
    supabase.from("delivery_feed").select("id,prompt_body,energy_label,published_at,overall,commitment,comedy,accuracy,chaos,headline,verdict,reaction_count").eq("user_id", userId).order("published_at", { ascending: false }).limit(12),
    supabase.from("user_badges").select("badge_id,awarded_at,badges(id,name,description,icon,color,rarity)").eq("user_id", userId).order("awarded_at", { ascending: false }),
    viewer && viewer.id !== userId ? supabase.from("follows").select("following_id").eq("follower_id", viewer.id).eq("following_id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    viewer && viewer.id !== userId ? supabase.from("blocks").select("blocked_id").eq("blocker_id", viewer.id).eq("blocked_id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (statsResult.error || deliveriesResult.error || badgesResult.error || followResult.error || blockResult.error) return NextResponse.json({ error: "Profile details could not be loaded." }, { status: 502 });
  const badges = ((badgesResult.data ?? []) as Array<Record<string, unknown>>).flatMap((award) => {
    const relation = Array.isArray(award.badges) ? award.badges[0] : award.badges;
    if (!relation || typeof relation !== "object") return [];
    const badge = relation as Record<string, unknown>;
    return [{ id: String(badge.id ?? award.badge_id), name: String(badge.name), description: String(badge.description), icon: String(badge.icon), color: String(badge.color), rarity: String(badge.rarity), awardedAt: String(award.awarded_at) }];
  });
  return NextResponse.json({ profile: profileRow, stats: statsResult.data, deliveries: deliveriesResult.data ?? [], badges, viewer: { signedIn: Boolean(viewer), isSelf: viewer?.id === userId, following: Boolean(followResult.data), blocked: Boolean(blockResult.data) } }, { headers: { "Cache-Control": "private, no-store" } });
}
