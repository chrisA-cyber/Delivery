"use client";

import { Clapperboard, Play, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useApp } from "@/components/providers/app-provider";
import type { SayAttempt } from "@/lib/say-it-back/types";
import { formatDate } from "@/lib/utils";

export function SayHistory() {
  const { authenticated, contentRating } = useApp();
  const [attempts, setAttempts] = useState<SayAttempt[]>([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    if (!authenticated) { setAttempts([]); return; }
    const controller = new AbortController();
    setError("");
    void fetch(`/api/say-it-back/history?maxRating=${contentRating}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "Your dubs could not be loaded.");
        setAttempts(body.data?.attempts ?? []);
      }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Your dubs could not be loaded."); });
    return () => controller.abort();
  }, [authenticated, contentRating, revision]);

  async function remove(id: string) {
    setBusy(id); setError("");
    try {
      const response = await fetch(`/api/say-it-back/attempts/${id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "That dub could not be deleted.");
      setAttempts((current) => current.filter((attempt) => attempt.id !== id));
      setConfirm(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "That dub could not be deleted."); }
    finally { setBusy(null); }
  }

  if (!authenticated) return null;
  return <section className="mt-10" aria-labelledby="dub-history-title">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><p className="mono-label text-electric">Your scenes</p><h2 id="dub-history-title" className="mt-2 text-2xl font-bold">Say It Back history</h2></div>
      <Link href="/say-it-back" className="button-secondary"><Clapperboard className="size-4" /> New dub</Link>
    </div>
    <p className="mb-4 text-sm leading-6 text-white/60">Your voice, the original scene, and the exact matching rules from that take. Dubs stay private until you choose to challenge someone.</p>
    {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/15 p-4 text-sm"><p>{error}</p><button className="button-ghost" onClick={() => setRevision((value) => value + 1)}><RefreshCw className="size-4" /> Try again</button></div>}
    {attempts.length ? <div className="grid gap-4 md:grid-cols-2">{attempts.map((attempt) => <article key={attempt.id} className="panel overflow-hidden">
      <Link href={`/say-it-back?attempt=${attempt.id}`} className="group relative block aspect-video overflow-hidden bg-black">
        {/* Immutable curated posters are local assets and need no image service. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attempt.clip.posterUrl} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
        <span className="absolute inset-0 grid place-items-center bg-black/10"><span className="grid size-12 place-items-center rounded-full bg-black/65 text-white"><Play className="size-5" fill="currentColor" /></span></span>
        <span className="absolute bottom-3 left-3 rounded-lg bg-black/75 px-3 py-1 text-xs font-bold">Watch your dub</span>
      </Link>
      <div className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="mono-label text-electric">Say It Back</p><h3 className="mt-2 text-xl font-bold">{attempt.clip.title}</h3><p className="mt-2 text-xs text-white/60">{formatDate(attempt.createdAt)} · {attempt.clip.roles.find((role) => role.id === attempt.roleId)?.name}</p></div><p className="display-type text-4xl text-acid">{attempt.score?.overall ?? "—"}</p></div>
        <p className="mt-4 text-sm leading-6 text-white/65">{attempt.score?.coachNote ?? "Your dub is saved. Reopen it to finish matching."}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2"><Link href={`/say-it-back?attempt=${attempt.id}`} className="button-secondary text-xs"><Play className="size-4" /> Replay & compare</Link>
        {confirm === attempt.id ? <><button onClick={() => void remove(attempt.id)} disabled={busy === attempt.id} className="button-ghost text-xs text-red-200">Delete permanently</button><button onClick={() => setConfirm(null)} className="button-ghost text-xs">Cancel</button></> : <button onClick={() => setConfirm(attempt.id)} className="button-ghost text-xs text-white/60"><Trash2 className="size-4" /> Delete</button>}</div>
      </div>
    </article>)}</div> : !error && <div className="panel p-6 text-sm leading-6 text-white/65">Your saved dubs will appear here. <Link href="/say-it-back" className="font-bold text-electric underline underline-offset-4">Choose your first scene.</Link></div>}
  </section>;
}
