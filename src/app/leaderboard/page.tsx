import type { Metadata } from "next";
import { Leaderboard } from "@/components/social/leaderboard";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = { title: "Leaderboards" };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const query = await searchParams;
  const initialPeriod = query.period === "daily" || query.period === "all_time" ? query.period : "weekly";
  return <PageShell eyebrow="Receipts, ranked" title="Let the tape decide." description="Confident whispers. Perfectly timed meltdowns. Rankings reward the requested performance, with the rules visible below."><Leaderboard initialPeriod={initialPeriod} /></PageShell>;
}
