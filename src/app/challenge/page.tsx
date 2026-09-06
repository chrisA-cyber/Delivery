import Link from "next/link";
import type { Metadata } from "next";
import { ChallengeBuilder } from "@/components/challenge/challenge-builder";
import { PageShell } from "@/components/shell/page-shell";
import { ProGate } from "@/components/pricing/pro-gate";

export const metadata: Metadata = { title: "Challenge a friend" };

export default async function ChallengePage({ searchParams }: { searchParams: Promise<{ prompt?: string; energy?: string }> }) {
  const query = await searchParams;
  return <PageShell eyebrow="Friend challenges" title="Pick their line." description="Set a line and direction, send a private invite, and see what your friend does with it. Same prompt. Two interpretations."><div className="mb-6 flex flex-wrap gap-3" aria-label="Challenge game mode"><span className="button-primary">Classic</span><Link href="/say-it-back" className="button-secondary">Say It Back challenge</Link><Link href="/switch" className="button-secondary">Switch challenge · Beta</Link></div><ProGate feature="custom challenges"><ChallengeBuilder initialPromptId={query.prompt} initialEnergyId={query.energy} /></ProGate></PageShell>;
}
