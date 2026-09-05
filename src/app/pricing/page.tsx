import type { Metadata } from "next";
import { PricingTable } from "@/components/pricing/pricing-table";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return <PageShell eyebrow="Free + Pro" title="Keep the mic hot." description="Play Classic for free. Pro adds more rounds, premium packs, performance stats, custom friend challenges, and the host-operated Stream stage."><PricingTable /></PageShell>;
}
