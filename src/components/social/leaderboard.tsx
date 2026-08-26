"use client";

import { Crown, LoaderCircle, Medal, Radio, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Board = "overall" | "chaos" | "commitment" | "comedy";
type Period = "daily" | "weekly" | "all_time";
type LeaderRow = { rank: number; user_id?: string; handle: string; display_name: string; delivery_id: string; score: number; created_at: string; preview?: boolean };

const rehearsal: LeaderRow[] = [
  { rank: 1, display_name: "Maya Mayhem", handle: "mayhem", delivery_id: "preview-1", score: 98.7, created_at: new Date().toISOString(), preview: true },
  { rank: 2, display_name: "Lag Queen", handle: "lagqueen", delivery_id: "preview-2", score: 97.9, created_at: new Date().toISOString(), preview: true },
  { rank: 3, display_name: "Tiny Mic Tony", handle: "tinymic", delivery_id: "preview-3", score: 97.4, created_at: new Date().toISOString(), preview: true },
  { rank: 4, display_name: "Uncle JPEG", handle: "unc_jpeg", delivery_id: "preview-4", score: 96.8, created_at: new Date().toISOString(), preview: true },
  { rank: 5, display_name: "Soft Launch", handle: "softlaunch", delivery_id: "preview-5", score: 95.6, created_at: new Date().toISOString(), preview: true },
];

export function Leaderboard({ initialPeriod = "weekly" }: { initialPeriod?: Period }) {
  const [board, setBoard] = useState<Board>("overall");
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    void fetch(`/api/leaderboard?metric=${board}&period=${period}`, { signal: controller.signal })
      .then(async (response) => { const body = await response.json() as { configured?: boolean; rows?: LeaderRow[]; error?: string }; if (!response.ok) throw new Error(body.error ?? "Rankings could not load."); setConfigured(body.configured !== false); setRows(body.configured === false ? rehearsal : body.rows ?? []); })
      .catch((cause) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Rankings could not load."); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [board, period]);

  return <div>
    {!configured && <div className="mb-5 rounded-2xl border border-electric/20 bg-electric/10 p-4 text-sm font-bold leading-6 text-electric">Rehearsal rankings · Connect Supabase to calculate this board from eligible public deliveries.</div>}
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="no-scrollbar flex gap-2 overflow-x-auto">{(["overall", "chaos", "commitment", "comedy"] as const).map((item) => <button key={item} onClick={() => setBoard(item)} className={cn("rounded-full border px-4 py-2 text-xs font-black capitalize", board === item ? "border-acid bg-acid text-black" : "border-white/10 bg-white/5 text-white/50")}>{item}</button>)}</div><label className="sr-only" htmlFor="leaderboard-period">Ranking period</label><select id="leaderboard-period" value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="rounded-full border border-white/10 bg-[#111] px-4 py-2 text-xs font-black text-white outline-none"><option value="daily">Today</option><option value="weekly">This week</option><option value="all_time">All time</option></select></div>
    {loading ? <div className="panel grid min-h-80 place-content-center"><LoaderCircle className="size-7 animate-spin text-acid" /><span className="sr-only">Loading leaderboard</span></div> : error ? <div className="panel p-7 text-center"><p className="text-lg font-black">The scoreboard needs a reboot.</p><p className="mt-2 text-sm text-white/40">{error}</p></div> : !rows.length ? <div className="panel grid min-h-72 place-content-center px-6 text-center"><Sparkles className="mx-auto size-6 text-hot" /><p className="mt-4 text-xl font-black">This board is wide open.</p><p className="mt-2 text-sm text-white/40">{period === "daily" ? "The first eligible ranked Daily receipt takes #1." : "Three eligible public deliveries puts a performer in contention."}</p><Link href={period === "daily" ? "/daily" : "/play"} className="button-primary mx-auto mt-6">Set the pace</Link></div> : <>
      <div className="mb-8 grid gap-4 md:grid-cols-3">{rows.slice(0, 3).map((row, index) => <article key={row.delivery_id} className={cn("panel relative overflow-hidden p-6 text-center", index === 0 && "border-acid/30 shadow-acid md:-translate-y-3")}><div className={`absolute inset-x-0 top-0 h-1 ${index === 0 ? "bg-acid" : index === 1 ? "bg-white/50" : "bg-orange-400"}`} />{index === 0 ? <Crown className="mx-auto size-7 text-acid" /> : <Medal className={`mx-auto size-6 ${index === 1 ? "text-white/60" : "text-orange-400"}`} />}<div className={`mx-auto mt-5 grid size-16 place-items-center rounded-full bg-gradient-to-br ${index === 0 ? "from-acid to-emerald-400 text-black" : index === 1 ? "from-electric to-cyan-400" : "from-orange-400 to-hot"} text-lg font-black`}>{row.display_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</div><h3 className="mt-4 text-lg font-black">{row.display_name}</h3><p className="text-xs font-bold text-white/35">@{row.handle}</p><p className="display-type mt-6 text-5xl">{Number(row.score).toFixed(Number(row.score) % 1 ? 1 : 0)}</p><p className="mono-label mt-1 text-white/25">Best {board}</p></article>)}</div>
      <div className="panel-solid overflow-hidden"><div className="hidden grid-cols-[72px_1fr_120px_120px] border-b border-white/10 px-5 py-3 text-white/30 sm:grid"><span className="mono-label">Rank</span><span className="mono-label">Performer</span><span className="mono-label text-right">Score</span><span className="mono-label text-right">Take</span></div>{rows.map((row) => <div key={row.delivery_id} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 border-b border-white/[0.07] px-4 py-4 last:border-0 sm:grid-cols-[72px_1fr_120px_120px] sm:px-5"><span className="font-mono text-sm font-black text-white/35">#{row.rank}</span><Link href={row.preview ? "#" : `/u/${row.handle}`} className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-full bg-white/10 text-xs font-black">{row.display_name.slice(0, 2).toUpperCase()}</div><div><p className="text-sm font-black">{row.display_name}</p><p className="text-xs font-bold text-white/30">@{row.handle}</p></div></Link><div className="text-right"><span className="font-mono text-lg font-black text-acid">{Number(row.score).toFixed(Number(row.score) % 1 ? 1 : 0)}</span></div><div className="hidden justify-end sm:flex">{row.preview ? <span className="mono-label text-white/25">Preview</span> : <Link href={`/d/${row.delivery_id}`} className="button-ghost min-h-9 px-3">Hear it</Link>}</div></div>)}</div>
    </>}
    <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-white/30"><Radio className="size-3.5 text-red-400" /> {period === "daily" ? "Today’s immutable ranked Daily receipts · public profiles only" : "Live eligible personal bests · public profiles only"}</div>
  </div>;
}
