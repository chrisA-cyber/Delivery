"use client";

import { ArrowRight, Crown, LoaderCircle, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type DailyLeader = {
  rank: number;
  handle: string;
  display_name: string;
  delivery_id: string;
  score: number;
};

export function DailyBoardPreview({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<DailyLeader[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch("/api/leaderboard?period=daily&metric=overall&market=global", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { configured?: boolean; rows?: DailyLeader[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Today’s board could not load.");
        setConfigured(body.configured !== false);
        setRows((body.rows ?? []).slice(0, 5));
      })
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Today’s board could not load.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refreshKey]);

  return <section className="mx-auto mt-6 max-w-4xl overflow-hidden rounded-2xl border border-acid/15 bg-acid/[0.045]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 sm:px-5"><div><p className="mono-label text-acid">Today’s ranked receipts</p><p className="mt-1 text-xs font-bold text-white/35">One locked score per signed-in mic · ties favor commitment, then earliest finish</p></div><Link href="/leaderboard?period=daily" className="button-ghost min-h-9 px-3">Full board <ArrowRight className="size-3.5" /></Link></header>
    {loading ? <div className="grid min-h-28 place-content-center"><LoaderCircle className="size-5 animate-spin text-acid" /><span className="sr-only">Loading today’s leaderboard</span></div> : error ? <p role="status" className="p-5 text-center text-sm font-bold text-white/40">{error}</p> : !configured ? <div className="p-5 text-center"><Trophy className="mx-auto size-5 text-white/25" /><p className="mt-3 text-sm font-black">The ranked board joins when the production stage is connected.</p></div> : !rows.length ? <div className="p-5 text-center"><Crown className="mx-auto size-5 text-acid" /><p className="mt-3 text-sm font-black">The #1 spot is completely unattended.</p><p className="mt-1 text-xs text-white/35">A ranked Daily receipt opens the board.</p></div> : <div>{rows.map((row) => <div key={row.delivery_id} className="grid grid-cols-[42px_1fr_auto_auto] items-center gap-3 border-b border-white/[0.07] px-4 py-3 last:border-0 sm:px-5"><span className={`font-mono text-sm font-black ${row.rank === 1 ? "text-acid" : "text-white/35"}`}>#{row.rank}</span><Link href={`/u/${row.handle}`} className="min-w-0"><p className="truncate text-sm font-black">{row.display_name}</p><p className="truncate text-[10px] font-bold text-white/30">@{row.handle}</p></Link><span className="font-mono text-lg font-black text-acid">{Math.round(Number(row.score))}</span><Link href={`/d/${row.delivery_id}`} aria-label={`Hear rank ${row.rank}, ${row.display_name}`} className="button-ghost min-h-9 px-2.5"><ArrowRight className="size-3.5" /></Link></div>)}</div>}
  </section>;
}
