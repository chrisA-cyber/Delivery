"use client";

import { ArrowUpRight, LoaderCircle, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Board = "overall" | "chaos" | "commitment" | "comedy";
type Period = "daily" | "weekly" | "all_time";
type LeaderRow = { rank: number; user_id?: string; handle: string; display_name: string; delivery_id: string; score: number; created_at: string };

export function Leaderboard({ initialPeriod = "weekly" }: { initialPeriod?: Period }) {
  const [board, setBoard] = useState<Board>("overall");
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    void fetch(`/api/leaderboard?metric=${board}&period=${period}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { const body = await response.json() as { configured?: boolean; rows?: LeaderRow[]; error?: string }; if (!response.ok) throw new Error(body.error ?? "Rankings could not load."); setConfigured(body.configured !== false); setRows(body.rows ?? []); })
      .catch((cause) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Rankings could not load."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [board, period, reload]);

  return <div>
    <div className="mb-6 flex flex-col gap-4 border-b border-white/15 pb-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-1" aria-label="Scoring category">{(["overall", "chaos", "commitment", "comedy"] as const).map((item) => <button key={item} onClick={() => setBoard(item)} aria-pressed={board === item} className={cn("min-h-11 rounded-lg px-3 text-sm font-bold capitalize sm:px-4", board === item ? "bg-white text-black" : "text-white/65 hover:bg-white/5")}>{item}</button>)}</div><label className="flex items-center gap-3 text-sm text-white/65">Period<select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="min-h-11 flex-1 rounded-lg border border-white/20 bg-[#232320] px-3 text-sm text-white"><option value="daily">Today</option><option value="weekly">This week</option><option value="all_time">All time</option></select></label></div>
    <div className="mb-6 grid gap-5 rounded-2xl bg-[#f4f0e7] p-6 text-[#171715] md:grid-cols-[1fr_1.3fr] md:items-center"><div><p className="mono-label text-black/60">How this board works</p><h2 className="mt-3 text-2xl font-bold">{period === "daily" ? "One ranked chance a day." : "A best take worth backing up."}</h2></div><p className="text-sm leading-6 text-black/70">{period === "daily" ? "Everyone gets the same line and direction. Your first eligible Daily submission is locked for ranking. Practice takes do not replace it." : "At least three eligible public deliveries put you in contention. The board ranks your best eligible performance in the selected category and period."} Private profiles stay off this board.</p></div>
    {loading ? <div className="panel grid min-h-72 place-content-center"><LoaderCircle className="size-7 animate-spin text-acid" /><span className="sr-only">Loading leaderboard</span></div> : error || !configured ? <div className="panel p-7 text-center"><h2 className="text-2xl font-bold">Rankings are unavailable.</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/65">{error || "The community service is not connected. Rankings will appear when eligible public performances are available."}</p><button onClick={() => setReload((value) => value + 1)} className="button-secondary mt-5">Try again</button></div> : !rows.length ? <div className="panel grid min-h-72 place-content-center px-6 py-8 text-center"><Trophy className="mx-auto size-7 text-acid" /><h2 className="mt-5 text-2xl font-bold">No ranked takes yet.</h2><p className="mt-3 text-sm text-white/65">{period === "daily" ? "The next eligible ranked Daily receipt could take the first spot." : "Three eligible public deliveries puts a performer in contention."}</p><Link href={period === "daily" ? "/daily" : "/play"} className="button-primary mx-auto mt-6">{period === "daily" ? "Play the Daily" : "Play Classic"}</Link></div> : <div className="overflow-hidden rounded-2xl border border-white/20">
      <div className="grid grid-cols-[40px_minmax(0,1fr)_70px] gap-3 border-b border-white/15 bg-white/5 px-4 py-4 sm:grid-cols-[64px_minmax(0,1fr)_90px_100px] sm:px-6"><span className="mono-label text-white/55">Rank</span><span className="mono-label text-white/55">Performer</span><span className="mono-label text-right text-white/55">Score</span><span className="mono-label hidden text-right text-white/55 sm:block">Take</span></div>
      {rows.map((row) => <article key={row.delivery_id} className={cn("grid grid-cols-[40px_minmax(0,1fr)_70px] items-center gap-3 border-b border-white/15 px-4 py-5 last:border-0 sm:grid-cols-[64px_minmax(0,1fr)_90px_100px] sm:px-6", row.rank === 1 && "bg-acid/[.06]")}><span className="font-mono text-sm text-white/65">{String(row.rank).padStart(2, "0")}</span><div className="min-w-0"><Link href={`/u/${row.handle}`} className="inline-flex min-h-11 max-w-full flex-col justify-center"><p className="break-words text-base font-bold">{row.display_name}</p><p className="mt-1 break-all text-xs text-white/60">@{row.handle}</p></Link><Link href={`/d/${row.delivery_id}`} className="mt-1 flex min-h-11 items-center gap-1 text-sm text-acid sm:hidden">Hear it<ArrowUpRight className="size-4" /></Link></div><p className="display-type text-right text-3xl text-acid">{Number(row.score).toFixed(Number(row.score) % 1 ? 1 : 0)}</p><Link href={`/d/${row.delivery_id}`} className="button-ghost hidden px-2 sm:inline-flex">Hear it<ArrowUpRight className="size-4" /></Link></article>)}
    </div>}
    <p className="mt-5 text-center text-xs leading-5 text-white/55">{period === "daily" ? "Ranked Daily receipts · public profiles · UTC date" : "Eligible public performances · public profiles"}</p>
  </div>;
}
