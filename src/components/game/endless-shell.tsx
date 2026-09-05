"use client";

import { Flame, Gauge, Layers3 } from "lucide-react";
import React, { useState } from "react";
import { GameExperience } from "@/components/game/game-experience";
import type { JudgeResult, Prompt } from "@/types/game";

export function EndlessShell({ prompt }: { prompt: Prompt }) {
  const [rounds, setRounds] = useState(0);
  const [sessionBest, setSessionBest] = useState(0);
  const [hotStreak, setHotStreak] = useState(0);
  const [previewRounds, setPreviewRounds] = useState(0);

  function recordRound(result: JudgeResult) {
    if (result.source === "fallback") { setPreviewRounds((value) => value + 1); return; }
    setRounds((value) => value + 1);
    setSessionBest((value) => Math.max(value, result.scores.overall));
    setHotStreak((value) => result.scores.overall >= 70 ? value + 1 : 0);
  }

  return <>
    <header className="mx-auto mb-6 max-w-6xl border-b border-white/15 pb-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="mono-label text-acid">Hot Streak / Classic back to back</p><h1 className="mt-2 text-2xl font-bold">How long can you keep the bit going?</h1></div><p className="max-w-md text-sm leading-6 text-white/65">A live score of 70+ keeps your streak going. These counters last for this visit; your plan&apos;s judging allowance still applies.</p></div>
      <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-4">{[{ label: "Hot streak", value: hotStreak, Icon: Flame, color: "text-acid" }, { label: "Session best", value: sessionBest || "—", Icon: Gauge, color: "text-electric" }, { label: "Judged rounds", value: rounds, Icon: Layers3, color: "text-hot" }].map(({ label, value, Icon, color }) => <div key={label} className="flex flex-col gap-2 rounded-xl border border-white/15 bg-white/[.025] p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"><Icon className={`size-4 shrink-0 ${color}`} /><div><dd className="font-mono text-xl font-bold">{value}</dd><dt className="mt-1 text-xs text-white/65">{label}</dt></div></div>)}</dl>
      {previewRounds > 0 && <p role="status" className="mt-4 text-sm leading-6 text-orange-200">{previewRounds} local preview {previewRounds === 1 ? "round" : "rounds"}. Synthetic judging does not count toward this score or streak.</p>}
    </header>
    <GameExperience mode="endless" initialPrompt={prompt} onJudged={recordRound} />
  </>;
}
