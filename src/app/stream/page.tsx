import Link from "next/link";
import type { Metadata } from "next";
import { Keyboard } from "lucide-react";
import { StreamSetup } from "@/components/stream/stream-setup";
import { PageShell } from "@/components/shell/page-shell";
import { ProGate } from "@/components/pricing/pro-gate";

export const metadata: Metadata = { title: "Stream mode" };

export default function StreamPage() {
  return <PageShell eyebrow="Stream Mode / Host operated" title="You run the room." description="Put Classic on stream with a readable stage, keyboard controls, and a direction vote you operate from your own chat or poll."><div className="mb-8 flex flex-wrap gap-3"><Link href="/rounds?community=1" className="button-primary">Host a community round →</Link><Link href="/join" className="button-secondary">Enter a join code</Link></div><div className="mb-8 inline-flex items-center gap-2 rounded-lg border border-electric/25 bg-electric/5 px-3 py-2 text-electric"><Keyboard className="size-4" /><span className="mono-label">Screen capture + host hotkeys</span></div><ProGate feature="Stream Mode"><StreamSetup /></ProGate></PageShell>;
}
