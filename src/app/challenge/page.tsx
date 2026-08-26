import type { Metadata } from "next";
import { ChallengeBuilder } from "@/components/challenge/challenge-builder";
import { PageShell } from "@/components/shell/page-shell";
import { ProGate } from "@/components/pricing/pro-gate";

export const metadata: Metadata = { title: "Challenge a friend" };

export default function ChallengePage() {
  return <PageShell eyebrow="Weaponize friendship" title="Pick their line." description="Choose exactly what they have to say and how they have to say it. They record; you both get the receipts."><ProGate feature="custom challenges"><ChallengeBuilder /></ProGate></PageShell>;
}
