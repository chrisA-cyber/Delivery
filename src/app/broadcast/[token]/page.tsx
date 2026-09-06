import type { Metadata } from "next";
import { BroadcastDisplay } from "@/components/rounds/broadcast-display";
export const metadata: Metadata = { title: "Delivery · On air", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function BroadcastPage({ params }: { params: Promise<{ token: string }> }) {
  return <BroadcastDisplay token={(await params).token} />;
}
