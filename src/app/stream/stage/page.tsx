import type { Metadata } from "next";
import { GameExperience } from "@/components/game/game-experience";
import { gamePrompt } from "@/lib/game-prompts";
import { ProGate } from "@/components/pricing/pro-gate";

export const metadata: Metadata = {
  title: "Live stage",
  robots: { index: false, follow: false },
};

export default async function StreamStagePage({
  searchParams,
}: {
  searchParams: Promise<{
    vote?: string;
    clean?: string;
    delay?: string;
    maxRating?: string;
  }>;
}) {
  const query = await searchParams;
  const clean = query.clean === "1";
  const maxRating =
    query.maxRating === "mature"
      ? "mature"
      : query.maxRating === "teen"
        ? "teen"
        : "everyone";
  const vote = query.vote !== "0";
  const requestedDelay = Number(query.delay);
  const delay =
    requestedDelay === 3 || requestedDelay === 10 ? requestedDelay : 5;
  return (
    <main
      className={`min-h-screen bg-ink px-3 pb-8 sm:px-8 ${clean ? "pt-3" : "pt-6"}`}
    >
      <ProGate feature="Stream Mode">
        {!clean && (
          <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between">
            <span className="mono-label flex items-center gap-2 text-red-300">
              <span className="size-2 rounded-full bg-red-400" /> Stream stage
            </span>
            <span className="mono-label text-white/55">
              Space · record&nbsp;&nbsp; R · reroll&nbsp;&nbsp; V ·
              vote&nbsp;&nbsp; F · fullscreen
            </span>
          </div>
        )}
        <GameExperience
          mode="stream"
          initialPrompt={gamePrompt(
            "stream",
            undefined,
            maxRating === "mature" ? "everyone" : maxRating,
          )}
          initialContentRating={maxRating}
          cleanStage={clean}
          voteEnabled={vote}
          voteDelaySeconds={delay}
        />
      </ProGate>
    </main>
  );
}
