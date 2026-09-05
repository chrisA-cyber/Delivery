import type { Metadata } from "next";
import { Skull } from "lucide-react";
import { GameExperience } from "@/components/game/game-experience";
import { gamePrompt } from "@/lib/game-prompts";
import { ProGate } from "@/components/pricing/pro-gate";

export const metadata: Metadata = { title: "Impossible Energy" };

export default function ImpossiblePage() {
  return (
    <main className="min-h-screen px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
      <div className="mx-auto mb-6 flex max-w-6xl items-start gap-3 rounded-xl border border-hot/30 bg-hot/5 p-4 text-hot"><Skull className="mt-0.5 size-4 shrink-0" /><div><p className="mono-label">Impossible Energy</p><p className="mt-2 text-sm leading-6 text-white/70">Harder lines and bigger emotional turns. No sensible delivery exists. Make one.</p></div></div>
      <ProGate feature="Impossible Energy"><GameExperience mode="impossible" initialPrompt={gamePrompt("impossible")} packId="impossible-energy" /></ProGate>
    </main>
  );
}
