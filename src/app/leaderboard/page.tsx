import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { Leaderboard } from "@/components/social/leaderboard";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = { title: "Leaderboards" };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const query = await searchParams;
  const initialPeriod = query.period === "daily" || query.period === "all_time" ? query.period : "weekly";
  return <PageShell eyebrow="Receipts, ranked" title="The loudest legends." description="High scores reward the whole performance—not volume alone. Daily is one locked same-line receipt; longer boards require three eligible public takes."><div className="mb-8 inline-flex items-center gap-2 rounded-full border border-yellow-300/20 bg-yellow-300/10 px-3 py-2 text-yellow-200"><Trophy className="size-4" /><span className="mono-label">Season 01 · Delusion</span></div><Leaderboard initialPeriod={initialPeriod} /></PageShell>;
}
