import type { Metadata } from "next";
import { PublicAssignmentExperience } from "@/components/game/public-assignment-experience";

export const metadata: Metadata = { title: "Your turn · Delivery", description: "Try the exact phrase, Switch, or scene from the video. Your voice. Your delivery.", robots: { index: false, follow: false } };

export default async function AssignmentPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ attempt?: string; claim?: string }> }) {
  const { code } = await params;
  const { attempt, claim } = await searchParams;
  return <PublicAssignmentExperience code={code} attemptId={attempt} claimId={claim} />;
}
