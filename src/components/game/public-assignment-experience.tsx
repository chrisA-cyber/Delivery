"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ContentControl } from "@/components/content/content-control";
import { useApp } from "@/components/providers/app-provider";
import { ProGate } from "@/components/pricing/pro-gate";
import { GameExperience } from "@/components/game/game-experience";
import { SwitchExperience } from "@/components/switch/switch-experience";
import { SayItBackExperience } from "@/components/say-it-back/say-it-back-experience";
import type { GroupAssignment } from "@/lib/groups/types";
import type { Prompt } from "@/types/game";

export function PublicAssignmentExperience({ code, attemptId, claimId }: { code: string; attemptId?: string; claimId?: string }) {
  const { contentRating, updatePreferences } = useApp();
  const [data, setData] = useState<{ assignment: GroupAssignment; requiresPro: boolean } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const switchAssignment = useMemo(() => data?.assignment.mode === "switch" ? { code, assignment: data.assignment } : undefined, [code, data]);
  const sayAssignment = useMemo(() => data?.assignment.mode === "say-it-back" ? { code, assignment: data.assignment } : undefined, [code, data]);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    void fetch(`/api/assignments/${encodeURIComponent(code)}?maxRating=${contentRating}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "This assignment could not load.");
      setData(body.data);
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "This assignment could not load."); });
    return () => controller.abort();
  }, [code, contentRating, retry]);
  if (!data) return <main className="game-main"><section className="panel-solid mx-auto max-w-2xl p-6 sm:p-10"><p className="mono-label text-acid">Your turn</p><h1 className="mt-3 text-3xl font-black">Try the same challenge.</h1>{error ? <><p role="alert" className="mt-4 text-sm leading-7 text-white/70">{error}</p><div className="mt-5"><ContentControl value={contentRating} onChange={(value) => updatePreferences({ contentRating: value })} /></div><button className="button-secondary mt-5" onClick={() => setRetry((value) => value + 1)}>Try again</button><Link href="/play" className="button-ghost mt-5">Choose another challenge</Link></> : <p role="status" className="mt-5 text-white/60">Opening the original assignment…</p>}</section></main>;
  const assignment = data.assignment;
  if (assignment.mode === "switch") return <SwitchExperience publicAssignment={switchAssignment} initialAttemptId={attemptId} initialClaimId={claimId} />;
  if (assignment.mode === "say-it-back") return <SayItBackExperience publicAssignment={sayAssignment} initialAttemptId={attemptId} initialClaimId={claimId} />;
  const prompt: Prompt = { id: assignment.promptId, line: assignment.promptText, energyId: assignment.energyId, energy: assignment.energy, directionLabel: assignment.energy, category: assignment.category, difficulty: assignment.difficulty as Prompt["difficulty"], rating: assignment.rating, pack: "The same challenge", source: "editorial" };
  const game = <GameExperience initialPrompt={prompt} runtimeInitial={false} assignmentCode={code} />;
  return <main className="game-main">{data.requiresPro ? <ProGate feature="this assignment">{game}</ProGate> : game}</main>;
}
