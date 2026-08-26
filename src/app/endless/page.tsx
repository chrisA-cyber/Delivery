import type { Metadata } from "next";
import { EndlessShell } from "@/components/game/endless-shell";
import { gamePrompt } from "@/lib/game-prompts";

export const metadata: Metadata = { title: "Hot Streak" };

export default function EndlessPage() {
  return <main className="min-h-screen px-3 pb-10 pt-24 sm:px-6 sm:pt-28 lg:pt-20"><EndlessShell prompt={gamePrompt("endless")} /></main>;
}
