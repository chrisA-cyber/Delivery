import type { Metadata } from "next";
import { SavedClassicPerformance } from "@/components/exports/saved-classic-performance";

export const metadata: Metadata = { title: "Your Classic performance", robots: { index: false, follow: false } };
export default async function ClassicPerformancePage({ params, searchParams }: { params: Promise<{ attemptId: string }>; searchParams: Promise<{ claim?: string }> }) {
  const [{ attemptId }, query] = await Promise.all([params, searchParams]);
  return <SavedClassicPerformance id={attemptId} claim={query.claim === "1"} />;
}
