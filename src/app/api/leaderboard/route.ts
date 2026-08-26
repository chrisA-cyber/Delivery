import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/server/env";
import { getOptionalUser } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const periods = new Set(["daily", "weekly", "all_time"]);
const metrics = new Set(["overall", "commitment", "comedy", "chaos"]);

export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie, Authorization",
};

const dailyFields = [
  "period",
  "metric",
  "rank",
  "participant_count",
  "challenge_date",
  "market",
  "user_id",
  "handle",
  "display_name",
  "avatar_path",
  "delivery_id",
  "prompt_id",
  "energy_modifier_id",
  "score",
  "overall",
  "commitment",
  "comedy",
  "accuracy",
  "chaos",
  "headline",
  "created_at",
].join(",");

export async function GET(request: Request) {
  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? "weekly";
  const metric = url.searchParams.get("metric") ?? "overall";
  const market = (url.searchParams.get("market") ?? "global").toLowerCase();
  if (!periods.has(period) || !metrics.has(metric) || market !== "global") {
    return NextResponse.json(
      { error: "Unknown leaderboard." },
      { status: 422, headers: privateHeaders },
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { configured: false, rows: [], viewer: null },
      { headers: privateHeaders },
    );
  }

  try {
    const [supabase, user] = await Promise.all([
      createServerSupabaseClient(),
      getOptionalUser(),
    ]);
    if (period === "daily") {
      const boardRequest = supabase
        .from("daily_leaderboard_live")
        .select(dailyFields)
        .eq("metric", metric)
        .eq("market", "global")
        .order("rank", { ascending: true })
        .limit(100);
      const [board, position] = await Promise.all([
        boardRequest,
        user
          ? supabase.rpc("get_daily_leaderboard_position", {
              p_metric: metric,
              p_market: "global",
            })
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (board.error || position.error) {
        return NextResponse.json(
          { error: "Leaderboard could not be loaded." },
          { status: 502, headers: privateHeaders },
        );
      }
      const viewer = Array.isArray(position.data)
        ? position.data[0] ?? null
        : position.data ?? null;
      return NextResponse.json(
        { configured: true, rows: board.data ?? [], viewer },
        { headers: privateHeaders },
      );
    }

    const { data, error } = await supabase
      .from("leaderboard_live")
      .select("period,metric,rank,user_id,handle,display_name,avatar_path,delivery_id,score,created_at")
      .eq("period", period)
      .eq("metric", metric)
      .order("rank", { ascending: true })
      .limit(100);
    if (error) {
      return NextResponse.json(
        { error: "Leaderboard could not be loaded." },
        { status: 502, headers: privateHeaders },
      );
    }
    // Both relations are viewer-scoped through RLS/privacy functions. Never let
    // a shared cache serve one person's block graph or rank to another viewer.
    return NextResponse.json(
      { configured: true, rows: data ?? [], viewer: null },
      { headers: privateHeaders },
    );
  } catch {
    return NextResponse.json(
      { error: "Leaderboard could not be loaded." },
      { status: 502, headers: privateHeaders },
    );
  }
}
