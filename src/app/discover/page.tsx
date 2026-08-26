import type { Metadata } from "next";
import { PACKS, CONTENT_COUNTS, getPromptsForPack } from "@/data/content";
import { PackBrowser } from "@/components/discover/pack-browser";
import { PageShell } from "@/components/shell/page-shell";
import Link from "next/link";

export const metadata: Metadata = { title: "Prompt packs", description: "Browse original Delivery prompt packs and choose your next vocal problem." };

export default function DiscoverPage() {
  const counts = Object.fromEntries(PACKS.map((pack) => [pack.id, getPromptsForPack(pack.id).length]));
  return (
    <PageShell eyebrow={`${CONTENT_COUNTS.prompts} lines · ${CONTENT_COUNTS.modifiers} energies · always growing`} title="Pick your poison." description="Every line is original, short enough to perform, and paired with an energy instruction engineered to create a clip—not a reading exercise.">
      <PackBrowser packs={PACKS} promptCounts={counts} />
      <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-[24px] border border-hot/20 bg-hot/[0.07] p-5 sm:flex-row sm:items-center sm:p-6"><div><p className="mono-label text-hot">Community writers room</p><p className="mt-2 text-lg font-black">Have a line the group chat would actually perform?</p><p className="mt-1 text-sm text-white/40">Original submissions get automated safety checks and human review.</p></div><Link href="/submit" className="button-secondary shrink-0">Pitch a line</Link></div>
    </PageShell>
  );
}
