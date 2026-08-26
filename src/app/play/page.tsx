import type { Metadata } from "next";
import { GameExperience } from "@/components/game/game-experience";
import { ProGate } from "@/components/pricing/pro-gate";
import { getPackById, getPromptById } from "@/data/content";
import { gamePrompt, gamePromptById, gamePromptForPack } from "@/lib/game-prompts";

export const metadata: Metadata = { title: "Play" };

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ pack?: string; prompt?: string; energy?: string }> }) {
  const params = await searchParams;
  const requestedContent = params.prompt ? getPromptById(params.prompt) : undefined;
  const requestedPack = params.pack ? getPackById(params.pack) : undefined;
  const packId = requestedPack?.id;
  const requiresPro = Boolean(
    requestedPack?.access === "pro" ||
    requestedContent?.packIds.some((id) => getPackById(id)?.access === "pro"),
  );
  let prompt = params.prompt ? gamePromptById(params.prompt, params.energy) : null;
  if (!prompt && packId) {
    try { prompt = gamePromptForPack(packId); } catch { prompt = null; }
  }
  prompt ??= gamePrompt("classic");
  const game = <GameExperience initialPrompt={prompt} packId={packId} runtimeInitial={!params.prompt} />;
  return <main className="min-h-screen px-3 pb-10 pt-24 sm:px-6 sm:pt-28 lg:pt-20">{requiresPro ? <ProGate feature="this premium pack">{game}</ProGate> : game}</main>;
}
