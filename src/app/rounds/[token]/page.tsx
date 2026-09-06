import type { Metadata } from "next";
import { RoundRoom } from "@/components/rounds/round-room";

export const metadata: Metadata = { title: "Your friend round", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function RoundPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ attempt?: string; take?: string }> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  return <RoundRoom token={token} pendingAttemptId={query.attempt} pendingTakeId={query.take} />;
}
