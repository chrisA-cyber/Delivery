"use client";

import { Flame, Gauge, Layers3 } from "lucide-react";
import { useState } from "react";

import { GameExperience } from "@/components/game/game-experience";
import type { JudgeResult, Prompt } from "@/types/game";

export function EndlessShell({ prompt }: { prompt: Prompt }) {
  const [rounds, setRounds] = useState(0);
  const [sessionBest, setSessionBest] = useState(0);
  const [hotStreak, setHotStreak] = useState(0);

  function recordRound(result: JudgeResult) {
    setRounds((value) => value + 1);
    setSessionBest((value) => Math.max(value, result.scores.overall));
    setHotStreak((value) => result.scores.overall >= 70 ? value + 1 : 0);
  }

  return <><div className="mx-auto mb-3 max-w-4xl text-center"><p className="text-xs font-bold text-white/35">Back-to-back lines. A 70+ keeps the flame alive; your plan&apos;s judging limit still applies.</p></div><div className="mx-auto mb-5 grid max-w-4xl grid-cols-3 gap-2"><div className="panel flex items-center gap-2 p-3"><Flame className="size-4 text-orange-400" /><div><p className="font-mono text-lg font-black">{hotStreak}</p><p className="mono-label text-[8px] text-white/25">Hot streak</p></div></div><div className="panel flex items-center gap-2 p-3"><Gauge className="size-4 text-acid" /><div><p className="font-mono text-lg font-black">{sessionBest || "—"}</p><p className="mono-label text-[8px] text-white/25">Run best</p></div></div><div className="panel flex items-center gap-2 p-3"><Layers3 className="size-4 text-hot" /><div><p className="font-mono text-lg font-black">{rounds}</p><p className="mono-label text-[8px] text-white/25">Rounds</p></div></div></div><GameExperience mode="endless" initialPrompt={prompt} onJudged={recordRound} /></>;
}
