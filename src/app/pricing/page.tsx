import type { Metadata } from "next";
import { PricingTable } from "@/components/pricing/pricing-table";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return <PageShell eyebrow="Free to start · Pro when it becomes a problem" title="Keep the mic hot." description="The full game is fun for free. Pro removes the daily ceiling and opens every pack, deep stats, custom challenges, and creator controls."><PricingTable /></PageShell>;
}
