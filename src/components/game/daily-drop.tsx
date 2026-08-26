"use client";

import { CalendarDays, Flame, LoaderCircle, LogIn, Trophy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { GameExperience } from "@/components/game/game-experience";
import { DailyBoardPreview } from "@/components/game/daily-board-preview";
import { useApp } from "@/components/providers/app-provider";
import type { DailyPrompt } from "@/data/content";
import { toGamePrompt } from "@/lib/game-prompts";

type DailyResponse = { ok: true; data: DailyPrompt & { market?: string } } | { ok: false; error: { message: string } };

export function DailyDrop() {
  const { authenticated, authReady } = useApp();
  const [daily, setDaily] = useState<(DailyPrompt & { market?: string }) | null>(null);
  const [error, setError] = useState("");
  const [boardRefresh, setBoardRefresh] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const dateKey = new Date().toISOString().slice(0, 10);
      const response = await fetch(`/api/prompts/daily?market=global&date=${dateKey}`, { cache: "no-store" });
      const body = await response.json() as DailyResponse;
      if (!response.ok || !body.ok) throw new Error(body.ok ? "Daily Drop could not load." : body.error.message);
      setDaily(body.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Daily Drop could not load.");
    }
  }, []);

  useEffect(() => {
    void load();
    const now = new Date();
    const nextUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 1);
    const timer = window.setTimeout(() => { setDaily(null); void load(); }, Math.max(1_000, nextUtcMidnight - now.getTime()));
    return () => window.clearTimeout(timer);
  }, [load]);

  return <>
    <div className="mx-auto mb-6 max-w-4xl rounded-2xl border border-orange-400/20 bg-orange-400/10 p-3 text-orange-200 sm:px-4 lg:mb-3 lg:flex lg:items-center lg:gap-5 lg:py-2.5 2xl:mb-6 2xl:block 2xl:py-3"><div className="flex items-center justify-between gap-4 lg:shrink-0 lg:justify-start 2xl:justify-between"><div className="flex items-center gap-2"><CalendarDays className="size-4" /><span className="mono-label">Today&apos;s global line</span></div><div className="flex items-center gap-4 text-xs font-black"><span className="flex items-center gap-1"><Flame className="size-3.5" /> Resets 00:00 UTC</span><span className="hidden items-center gap-1 sm:flex"><Trophy className="size-3.5" /> Same line worldwide</span></div></div><div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:mt-0 lg:min-w-0 lg:flex-1 2xl:mt-2"><p className="text-xs font-bold leading-5 text-orange-100/60">{authReady && !authenticated ? "Guest scores are practice. Sign in before submitting to lock today’s score and streak." : "Your first signed-in score is locked. Publish it to appear on today’s board; later takes are practice."}</p>{authReady && !authenticated && <Link href="/login?next=/daily" className="button-ghost min-h-8 shrink-0 self-start border border-electric/20 px-3 text-electric sm:self-auto"><LogIn className="size-3.5" /> Sign in to rank</Link>}</div></div>
    {error ? <div className="panel-solid mx-auto max-w-4xl p-8 text-center"><p className="text-xl font-black">The daily envelope got stuck.</p><p className="mt-2 text-sm text-white/45">{error}</p><button onClick={() => void load()} className="button-primary mt-6">Try again</button></div> : !daily ? <div className="panel mx-auto grid min-h-96 max-w-4xl place-content-center text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-acid" /><p className="mono-label mt-4 text-white/35">Opening today&apos;s envelope</p></div> : <><GameExperience key={`${daily.dateKey}:${daily.market ?? "global"}`} mode="daily" initialPrompt={toGamePrompt(daily.prompt, daily.energy)} dailyDate={daily.dateKey} dailyMarket={daily.market ?? "global"} onJudged={() => setBoardRefresh((value) => value + 1)} /><DailyBoardPreview refreshKey={boardRefresh} /></>}
  </>;
}
