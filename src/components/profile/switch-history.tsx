"use client";

import { Play, RefreshCw, Shuffle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { isRatingAllowed } from "@/data/content";
import type { SwitchAttempt } from "@/lib/switch/types";
import { formatDate } from "@/lib/utils";

export function SwitchHistory() {
  const { authenticated, contentRating } = useApp();
  const [attempts, setAttempts] = useState<SwitchAttempt[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    if (!authenticated) { setAttempts([]); setLoading(false); return; }
    const controller = new AbortController();
    setAttempts([]); setError(""); setLoading(true);
    void fetch(`/api/switch/history?maxRating=${contentRating}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "Your Switch takes could not be loaded.");
        if (!controller.signal.aborted) setAttempts(body.data?.attempts ?? []);
      }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Your Switch takes could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [authenticated, contentRating, revision]);

  async function remove(id: string) {
    if (busy) return;
    setBusy(id); setError("");
    try {
      const response = await fetch(`/api/switch/attempts/${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "That Switch take could not be deleted.");
      setAttempts((current) => current.filter((attempt) => attempt.id !== id)); setConfirm(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "That Switch take could not be deleted."); }
    finally { setBusy(null); }
  }
  const visibleAttempts = attempts.filter((attempt) => isRatingAllowed(attempt.challenge.rating, contentRating));
  if (!authenticated) return null;
  return <section className="mt-10" aria-labelledby="switch-history-title">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="mono-label text-hot">One phrase. Your switches.</p><h2 id="switch-history-title" className="mt-2 text-2xl font-bold">Switch history</h2></div><Link href="/switch" className="button-secondary"><Shuffle className="size-4" />Play Switch</Link></div>
    <p className="mb-4 text-sm leading-6 text-white/60">Reopen your recording with its original phrase and timed cues. Switch beta feedback stays separate from ranked scores.</p>
    {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/15 p-4 text-sm"><p>{error}</p><button className="button-ghost" onClick={() => setRevision((value) => value + 1)}><RefreshCw className="size-4" />Try again</button></div>}
    {loading ? <p role="status" className="panel p-6 text-sm text-white/65">Loading your Switch takes…</p> : visibleAttempts.length ? <div className="grid gap-4 md:grid-cols-2">{visibleAttempts.map((attempt) => <article key={attempt.id} className="panel overflow-hidden p-5"><div className="flex items-start justify-between gap-4"><div><p className="mono-label text-hot">Switch · Unranked beta</p><h3 className="mt-3 text-xl font-bold">{attempt.challenge.title}</h3><p className="mt-2 text-xs text-white/55">{formatDate(attempt.createdAt)} · {(attempt.durationMs / 1000).toFixed(1)} sec · Private</p></div><div className="shrink-0 text-right"><p className="display-type text-4xl text-hot">{attempt.score?.overall ?? "—"}</p><p className="mt-1 text-[10px] text-white/55">{attempt.score?.overall != null ? "Beta feedback" : attempt.score ? "Judgment uncertain" : "Replay ready"}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{attempt.challenge.cues.map((cue) => <span key={cue.id} className="rounded-lg bg-white/5 px-2 py-1.5 text-[11px] text-white/65">{cue.emoji} {cue.directionLabel}</span>)}</div><p className="mt-4 text-sm leading-6 text-white/70">{attempt.score?.coachNote ?? "Your full take is saved. Reopen to replay or get feedback."}</p><div className="mt-5 flex flex-wrap gap-2"><Link href={`/switch?attempt=${encodeURIComponent(attempt.id)}`} className="button-secondary text-xs"><Play className="size-4" />Replay, feedback & video</Link>{confirm === attempt.id ? <><button type="button" onClick={() => void remove(attempt.id)} disabled={Boolean(busy)} className="button-ghost text-xs text-red-200">{busy === attempt.id ? "Deleting…" : "Delete permanently"}</button><button type="button" onClick={() => setConfirm(null)} disabled={Boolean(busy)} className="button-ghost text-xs">Cancel</button></> : <button type="button" onClick={() => setConfirm(attempt.id)} disabled={Boolean(busy)} className="button-ghost text-xs text-white/60"><Trash2 className="size-4" />Delete</button>}</div></article>)}</div> : !error && <div className="panel p-6 text-sm leading-6 text-white/65">Your saved Switch takes will appear here. <Link href="/switch" className="font-bold text-hot underline underline-offset-4">Try your first switch.</Link></div>}
  </section>;
}
