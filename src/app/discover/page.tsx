import type { Metadata } from "next";
import { PACKS, CONTENT_COUNTS } from "@/data/content";
import { PackBrowser } from "@/components/discover/pack-browser";
import { PageShell } from "@/components/shell/page-shell";
import Link from "next/link";

export const metadata: Metadata = { title: "Prompt packs", description: "Browse Delivery prompt packs and choose your next vocal problem." };

export default function DiscoverPage() {
  return (
    <PageShell eyebrow={`${CONTENT_COUNTS.prompts} lines · ${CONTENT_COUNTS.modifiers} directions`} title="Pick your poison." description="Confessions, failed clutches, catastrophic flirting. Pick a pack, get a line, and let the delivery direction make it worse.">
      <PackBrowser packs={PACKS} />
      <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/15 bg-white/[.025] p-5 sm:flex-row sm:items-center sm:p-6"><div><p className="mono-label text-hot">Community writers room</p><p className="mt-2 text-lg font-black">Have a line the group chat would actually perform?</p><p className="mt-1 text-sm text-white/65">Original submissions get automated safety checks and human review.</p></div><Link href="/submit" className="button-secondary shrink-0">Pitch a line</Link></div>
    </PageShell>
  );
}
