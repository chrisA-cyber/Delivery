import type { Metadata } from "next";
import { RoundRecording } from "@/components/rounds/round-recording";

export const metadata: Metadata = { title: "Record your friend round", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function RoundRecordPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ attempt?: string; claim?: string }> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  return <RoundRecording token={token} initialAttemptId={query.attempt} initialClaimId={query.claim} />;
}
