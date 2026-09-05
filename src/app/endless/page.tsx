import type { Metadata } from "next";
import { EndlessShell } from "@/components/game/endless-shell";
import { gamePrompt } from "@/lib/game-prompts";

export const metadata: Metadata = { title: "Hot Streak" };

export default function EndlessPage() {
  return <main className="min-h-screen px-4 pb-16 pt-28 sm:px-6 sm:pt-32"><EndlessShell prompt={gamePrompt("endless")} /></main>;
}
