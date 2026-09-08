import Link from "next/link";
import type { Metadata } from "next";
import { RoundBuilder } from "@/components/rounds/round-builder";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = {
  title: "Friend rounds · One link. Everyone’s delivery.",
  description: "Pick Switch, Classic, or Say It Back. Invite your friends, record with an avatar or optional camera, then reveal and vote together.",
  referrer: "no-referrer",
};

export default async function RoundsPage({ searchParams }: { searchParams: Promise<{ mode?: string; clip?: string; role?: string; prompt?: string; energy?: string; challenge?: string; from?: string; community?: string }> }) {
  const params = await searchParams;
  const community = params.community === "1";
  return <PageShell eyebrow={community ? "Community rounds" : "Friend rounds"} title={community ? "Your community. Your show." : "Bring the group chat."} description={community ? "Collect takes, choose your showcase, and let the crowd vote." : "One challenge. Record anytime, then reveal and vote together."}><div className="mb-5 flex flex-wrap gap-3"><Link className="button-secondary" href={community ? "/rounds" : "/rounds?community=1"}>{community ? "Play with friends" : "Host a community round"}</Link><Link className="button-secondary" href="/join">Enter a join code</Link></div><RoundBuilder community={community} initialMode={params.mode} initialClipId={params.clip} initialRoleId={params.role} initialPromptId={params.prompt} initialEnergyId={params.energy} initialChallengeId={params.challenge} previousToken={params.from} /></PageShell>;
}
