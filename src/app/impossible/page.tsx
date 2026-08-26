import type { Metadata } from "next";
import { Skull } from "lucide-react";
import { GameExperience } from "@/components/game/game-experience";
import { gamePrompt } from "@/lib/game-prompts";
import { ProGate } from "@/components/pricing/pro-gate";

export const metadata: Metadata = { title: "Impossible Energy" };

export default function ImpossiblePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(255,76,200,.16),transparent_35rem)] px-3 pb-10 pt-24 sm:px-6 sm:pt-28 lg:pt-20">
      <div className="mx-auto mb-6 flex max-w-4xl items-center gap-3 rounded-2xl border border-hot/25 bg-hot/10 p-3 text-hot sm:px-4"><Skull className="size-4" /><span className="mono-label">No sensible delivery exists. Make one.</span></div>
      <ProGate feature="Impossible Energy"><GameExperience mode="impossible" initialPrompt={gamePrompt("impossible")} packId="impossible-energy" /></ProGate>
    </main>
  );
}
