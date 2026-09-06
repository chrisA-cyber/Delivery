import Link from "next/link";
import type { Metadata } from "next";
import { RoundBuilder } from "@/components/rounds/round-builder";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = {
  title: "Friend rounds · One link. Everyone’s delivery.",
  description: "Pick Classic, Say It Back, or Switch, invite your friends, and record whenever you want. Reveal everyone’s camera-free performances together.",
  referrer: "no-referrer",
};

export default async function RoundsPage({ searchParams }: { searchParams: Promise<{ mode?: string; clip?: string; role?: string; prompt?: string; energy?: string; challenge?: string; from?: string; community?: string }> }) {
  const params = await searchParams;
  return <PageShell eyebrow={params.community === "1" ? "Your community takes the mic" : "A group chat with a microphone"} title={params.community === "1" ? "Their voices. Your show." : "Your friends. Their delivery."} description={params.community === "1" ? "Choose an assignment, share your code, and collect performances. Pick the showcase, let viewers vote, and run it back." : "One shared assignment. Record when it suits you. Then reveal the takes, find your favorite, and run it back."}><div className="mb-6 flex flex-wrap gap-3"><Link className="button-secondary" href="/rounds?community=1">Host a community round</Link><Link className="button-secondary" href="/join">Enter a join code</Link></div><RoundBuilder community={params.community === "1"} initialMode={params.mode} initialClipId={params.clip} initialRoleId={params.role} initialPromptId={params.prompt} initialEnergyId={params.energy} initialChallengeId={params.challenge} previousToken={params.from} /></PageShell>;
}
