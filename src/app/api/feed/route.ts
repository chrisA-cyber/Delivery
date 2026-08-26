import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/server/env";
import { getOptionalUser } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ configured: false, items: [] }, { headers: { "Cache-Control": "no-store" } });
  const filter = new URL(request.url).searchParams.get("filter") ?? "for-you";
  const supabase = await createServerSupabaseClient();
  const user = await getOptionalUser();
  let query = supabase.from("delivery_feed").select("id,user_id,handle,display_name,avatar_path,prompt_body,category,energy_label,duration_ms,published_at,overall,commitment,comedy,accuracy,chaos,headline,verdict,reaction_count").order("published_at", { ascending: false }).limit(24);

  if (filter === "following") {
    if (!user) return NextResponse.json({ configured: true, signedIn: false, items: [] }, { headers: { "Cache-Control": "private, no-store" } });
    const { data: follows, error: followsError } = await supabase.from("follows").select("following_id").eq("follower_id", user.id).limit(500);
    if (followsError) return NextResponse.json({ error: "Feed could not be loaded." }, { status: 502 });
    const ids = ((follows ?? []) as Array<Record<string, unknown>>).map((row) => String(row.following_id));
    if (!ids.length) return NextResponse.json({ configured: true, signedIn: true, items: [] }, { headers: { "Cache-Control": "private, no-store" } });
    query = query.in("user_id", ids);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Feed could not be loaded." }, { status: 502 });
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  let viewerReactions = new Map<string, string>();
  if (user && rows.length) {
    const ids = rows.map((row) => String(row.id));
    const { data: reactions, error: reactionError } = await supabase.from("reactions").select("delivery_id,kind").eq("user_id", user.id).in("delivery_id", ids);
    if (reactionError) return NextResponse.json({ error: "Feed reactions could not be loaded." }, { status: 502 });
    viewerReactions = new Map(((reactions ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.delivery_id), String(row.kind)]));
  }
  const items = rows.map((row) => ({ ...row, viewer_reaction: viewerReactions.get(String(row.id)) ?? null }));
  return NextResponse.json({ configured: true, signedIn: Boolean(user), items }, { headers: { "Cache-Control": "private, no-store" } });
}
