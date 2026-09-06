import type { Metadata } from "next";
import { PricingTable } from "@/components/pricing/pricing-table";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return <PageShell eyebrow="Free + Pro" title="Keep the mic hot." description="Play Classic and Say It Back for free. An account lets you save your takes and challenge a friend in Say It Back."><PricingTable /></PageShell>;
}
