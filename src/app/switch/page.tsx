import type { Metadata } from "next";
import { SwitchExperience } from "@/components/switch/switch-experience";
export const metadata: Metadata = { title: "Switch · One phrase. Keep switching.", description: "Repeat the same phrase with emoji emotions or changing speeds. Play solo or with friends. Record with your avatar or an optional camera." };
export default async function SwitchPage({ searchParams }: { searchParams: Promise<{ id?: string; attempt?: string; claim?: string; challenge?: string }> }) {
  const params = await searchParams;
  return <SwitchExperience initialChallengeId={params.id} initialAttemptId={params.attempt} initialClaimId={params.claim} challengeToken={params.challenge} />;
}
