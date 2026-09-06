import type { Metadata } from "next";
import { RoundBuilder } from "@/components/rounds/round-builder";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = {
  title: "Friend rounds · One link. Everyone’s delivery.",
  description: "Pick a scene or a funny line, invite your friends, and record whenever you want. Reveal everyone’s camera-free performances together.",
  referrer: "no-referrer",
};

export default async function RoundsPage({ searchParams }: { searchParams: Promise<{ mode?: string; clip?: string; role?: string; prompt?: string; energy?: string; from?: string }> }) {
  const params = await searchParams;
  return <PageShell eyebrow="A group chat with a microphone" title="Your friends. Their delivery." description="One shared assignment. Record when it suits you. Then reveal the takes, find your favorite, and run it back."><RoundBuilder initialMode={params.mode} initialClipId={params.clip} initialRoleId={params.role} initialPromptId={params.prompt} initialEnergyId={params.energy} previousToken={params.from} /></PageShell>;
}
