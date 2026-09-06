"use client";

import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/providers/app-provider";
import { isRatingAllowed } from "@/data/content";
import { RoundApiError } from "./round-api";
import { GameExperience } from "@/components/game/game-experience";
import { SayItBackExperience } from "@/components/say-it-back/say-it-back-experience";
import type { Prompt } from "@/types/game";
import { RoundUnavailable } from "./round-shared";
import { useRound } from "./use-round";

export function RoundRecording({ token, initialAttemptId, initialClaimId }: { token: string; initialAttemptId?: string; initialClaimId?: string }) {
  const { contentRating } = useApp();
  const { round, loading, error, refresh } = useRound(token, false);
  const returnPath = `/rounds/${encodeURIComponent(token)}`;
  if (round && !isRatingAllowed(round.assignment.rating, contentRating)) return <RoundUnavailable loading={false} error={new RoundApiError("Choose the appropriate content setting before opening this assignment.", 403, "CONTENT_OPT_IN_REQUIRED")} retry={() => void refresh()} />;
  if (!round || error?.code === "CONTENT_OPT_IN_REQUIRED") return <RoundUnavailable loading={loading} error={error} retry={() => void refresh()} />;
  if (!round.viewerMemberId || round.state !== "open") return <main className="min-h-screen px-4 pb-28 pt-32"><section className="panel-solid mx-auto max-w-xl p-6 sm:p-8"><LockKeyhole className="size-8 text-hot" /><h1 className="mt-5 text-3xl font-bold">{round.state !== "open" ? "This round has closed." : "Join the round first."}</h1><p className="mt-4 text-sm leading-6 text-white/65">{round.state === "revealed" ? "Your friends’ submitted performances are ready to watch." : round.state === "expired" ? "The replay window has ended. You can start another round." : "Choose a display name to keep your recording and submission together."}</p><Link href={returnPath} className="button-primary mt-6"><ArrowLeft className="size-4" />Back to the round</Link></section></main>;
  if (round.assignment.mode === "say-it-back") return <SayItBackExperience initialAttemptId={initialAttemptId} initialClaimId={initialClaimId} roundContext={{ token, returnPath, clip: round.assignment.clip, roleId: round.assignment.roleId }} />;
  const assignment = round.assignment;
  const prompt: Prompt = { id: assignment.promptSlug, line: assignment.promptText, energy: assignment.energy, energyId: assignment.energySlug, category: assignment.category, difficulty: Math.min(5, Math.max(1, assignment.difficulty)) as Prompt["difficulty"], rating: assignment.rating, source: "editorial" };
  return <main className="min-h-screen px-4 pb-20 pt-28 sm:pt-32"><div className="mx-auto max-w-5xl"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Link href={returnPath} className="button-ghost -ml-3 px-3"><ArrowLeft className="size-4" />{round.name}</Link><p className="text-xs text-white/55">Private rehearsal · submit when you’re happy</p></div><GameExperience mode="classic" initialPrompt={prompt} runtimeInitial={false} roundContext={{ token, returnPath }} /></div></main>;
}
