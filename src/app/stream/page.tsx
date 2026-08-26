import type { Metadata } from "next";
import { Keyboard } from "lucide-react";
import { StreamSetup } from "@/components/stream/stream-setup";
import { PageShell } from "@/components/shell/page-shell";
import { ProGate } from "@/components/pricing/pro-gate";

export const metadata: Metadata = { title: "Stream mode" };

export default function StreamPage() {
  return <PageShell eyebrow="Creator controls · zero dead air" title="Turn chat into a co-host." description="Big readable prompts, rapid keyboard controls, an on-screen energy vote, and a clean stage view built to create clips instead of setup time."><div className="mb-8 inline-flex items-center gap-2 rounded-full border border-electric/20 bg-electric/10 px-3 py-2 text-electric"><Keyboard className="size-4" /><span className="mono-label">OBS-friendly · 16:9 safe</span></div><ProGate feature="Stream Mode"><StreamSetup /></ProGate></PageShell>;
}
