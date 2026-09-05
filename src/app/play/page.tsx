import type { Metadata } from "next";
import Link from "next/link";
import { GameExperience } from "@/components/game/game-experience";
import { ProGate } from "@/components/pricing/pro-gate";
import {
  getPackById,
  getPromptById,
  isActivePrompt,
  ENERGY_MODIFIERS,
} from "@/data/content";
import {
  gamePrompt,
  gamePromptById,
  gamePromptForPack,
} from "@/lib/game-prompts";

export const metadata: Metadata = { title: "Play" };

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string; prompt?: string; energy?: string }>;
}) {
  const params = await searchParams;
  const requestedContent = params.prompt
    ? getPromptById(params.prompt)
    : undefined;
  if (
    params.prompt &&
    (!requestedContent ||
      !isActivePrompt(params.prompt) ||
      (params.energy &&
        !ENERGY_MODIFIERS.some((item) => item.id === params.energy)))
  ) {
    return (
      <main className="game-main">
        <section className="game-experience panel-solid p-6 sm:p-10">
          <p className="mono-label text-acid">An earlier assignment</p>
          <h1 className="mt-3 text-3xl font-bold">
            This line has left the new-round deck.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/70">
            Saved results and existing challenges keep their original content.
            This link can no longer start a new Classic round.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/play" className="button-primary">
              Play a fresh Classic line
            </Link>
            <Link href="/daily" className="button-secondary">
              Open today’s Daily
            </Link>
          </div>
        </section>
      </main>
    );
  }
  const requestedPack = params.pack ? getPackById(params.pack) : undefined;
  const packId = requestedPack?.id;
  const requiresPro = Boolean(
    requestedPack?.access === "pro" ||
      requestedContent?.packIds.some((id) => getPackById(id)?.access === "pro"),
  );
  let prompt = params.prompt
    ? gamePromptById(params.prompt, params.energy)
    : null;
  if (!prompt && packId) {
    try {
      prompt = gamePromptForPack(packId);
    } catch {
      prompt = null;
    }
  }
  prompt ??= gamePrompt("classic");
  const game = (
    <GameExperience
      initialPrompt={prompt}
      packId={packId}
      runtimeInitial={!params.prompt}
    />
  );
  return (
    <main className="game-main">
      {requiresPro ? (
        <ProGate feature="this premium pack">{game}</ProGate>
      ) : (
        game
      )}
    </main>
  );
}
