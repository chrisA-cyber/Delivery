import type { Metadata } from "next";
import { SayItBackExperience } from "@/components/say-it-back/say-it-back-experience";

export const metadata: Metadata = {
  title: "Say It Back · Your voice, their scene",
  description: "Watch a real scene, record its dialogue, and watch it dubbed with your voice. Match the words and timing, then challenge a friend. No camera required.",
};

export default async function SayItBackPage({ searchParams }: { searchParams: Promise<{ clip?: string; role?: string; attempt?: string; challenge?: string; claim?: string }> }) {
  const params = await searchParams;
  return <SayItBackExperience initialClipId={params.clip} initialRoleId={params.role} initialAttemptId={params.attempt} challengeToken={params.challenge} initialClaimId={params.claim} />;
}
