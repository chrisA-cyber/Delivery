"use client";

import { CalendarDays, LoaderCircle, LogIn } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { GameExperience } from "@/components/game/game-experience";
import { DailyBoardPreview } from "@/components/game/daily-board-preview";
import { useApp } from "@/components/providers/app-provider";
import type { DailyPrompt } from "@/data/content";
import { toGamePrompt } from "@/lib/game-prompts";

type DailyResponse =
  | { ok: true; data: DailyPrompt & { market?: string } }
  | { ok: false; error: { message: string } };

export function DailyDrop() {
  const { authenticated, authReady } = useApp();
  const [daily, setDaily] = useState<
    (DailyPrompt & { market?: string }) | null
  >(null);
  const [error, setError] = useState("");
  const [boardRefresh, setBoardRefresh] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const dateKey = new Date().toISOString().slice(0, 10);
      const response = await fetch(
        `/api/prompts/daily?market=global&date=${dateKey}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as DailyResponse;
      if (!response.ok || !body.ok)
        throw new Error(
          body.ok ? "Daily Drop could not load." : body.error.message,
        );
      setDaily(body.data);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Daily Drop could not load.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
    const now = new Date();
    const nextUtcMidnight = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      1,
    );
    const timer = window.setTimeout(
      () => {
        setDaily(null);
        void load();
      },
      Math.max(1_000, nextUtcMidnight - now.getTime()),
    );
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[1056px] flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
        <p className="flex items-center gap-2 text-xs font-bold text-electric">
          <CalendarDays className="size-4" />
          Same line worldwide · resets 00:00 UTC
        </p>
        <p className="text-xs leading-5 text-white/65">
          {authReady && !authenticated
            ? "Guest takes are practice."
            : "First signed-in score counts. Later takes are practice."}
        </p>
        {authReady && !authenticated && (
          <Link
            href="/login?next=/daily"
            className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-electric"
          >
            <LogIn className="size-3.5" />
            Sign in to rank
          </Link>
        )}
      </div>
      {error ? (
        <div className="panel-solid mx-auto max-w-4xl p-8 text-center">
          <p className="text-xl font-black">The daily envelope got stuck.</p>
          <p className="mt-2 text-sm text-white/45">{error}</p>
          <button onClick={() => void load()} className="button-primary mt-6">
            Try again
          </button>
        </div>
      ) : !daily ? (
        <div className="panel mx-auto grid min-h-96 max-w-4xl place-content-center text-center">
          <LoaderCircle className="mx-auto size-7 animate-spin text-acid" />
          <p className="mono-label mt-4 text-white/35">
            Opening today&apos;s envelope
          </p>
        </div>
      ) : (
        <>
          <GameExperience
            key={`${daily.dateKey}:${daily.market ?? "global"}`}
            mode="daily"
            initialPrompt={toGamePrompt(daily.prompt, daily.energy)}
            dailyDate={daily.dateKey}
            dailyMarket={daily.market ?? "global"}
            onJudged={() => setBoardRefresh((value) => value + 1)}
          />
          <DailyBoardPreview refreshKey={boardRefresh} />
        </>
      )}
    </>
  );
}
