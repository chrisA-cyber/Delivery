"use client";

import Link from "next/link";
import { ArrowLeft, LoaderCircle, LockKeyhole, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ContentControl } from "@/components/content/content-control";
import { SavedAudio } from "@/components/game/saved-audio";
import { useApp } from "@/components/providers/app-provider";
import { isRatingAllowed } from "@/data/content";
import { VideoExport } from "./video-export";
import type { SavedClassicTake } from "./classic-video-history";

export function SavedClassicPerformance({ id, claim = false }: { id: string; claim?: boolean }) {
  const { authReady, authenticated, contentRating, updatePreferences } = useApp();
  const [attempt, setAttempt] = useState<SavedClassicTake | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const path = `/performances/classic/${encodeURIComponent(id)}`;
  const apiPath = `/api/classic/attempts/${encodeURIComponent(id)}`;
  useEffect(() => {
    if (!authReady) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setAttempt(null);
    void (async () => {
      if (claim && authenticated) {
        const response = await fetch(`${apiPath}/claim`, { method: "POST", signal: controller.signal });
        if (!response.ok) { const body = await response.json(); throw new Error(body.error?.message ?? "This guest take could not be saved to your account."); }
      }
      const response = await fetch(`${apiPath}?maxRating=${contentRating}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (!response.ok || !body.data?.attempt) throw new Error(body.error?.message ?? "This private take is unavailable. Return in the browser or account that recorded it.");
      if (!controller.signal.aborted) setAttempt(body.data.attempt);
    })().catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "This take could not be opened."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiPath, authReady, authenticated, claim, contentRating, revision]);

  async function remove() {
    setDeleting(true); setError("");
    try {
      const response = await fetch(apiPath, { method: "DELETE" });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error?.message ?? "This performance could not be deleted."); }
      setDeleted(true); setAttempt(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This performance could not be deleted."); }
    finally { setDeleting(false); }
  }

  const allowed = attempt && isRatingAllowed(attempt.assignment.rating, contentRating);
  return <main className="min-h-screen px-4 pb-28 pt-28 sm:pt-32"><div className="mx-auto max-w-3xl"><div className="mb-7 flex flex-wrap items-center justify-between gap-3"><Link href="/profile" className="button-ghost -ml-3 px-3"><ArrowLeft className="size-4" />Your history</Link><ContentControl value={contentRating} onChange={(value) => updatePreferences({ contentRating: value })} compact /></div>
    {loading ? <p role="status" className="panel flex items-center gap-3 p-6"><LoaderCircle className="size-5 animate-spin text-electric" />Opening your private take…</p> : deleted ? <section className="panel p-6"><h1 className="text-2xl font-bold">Performance deleted.</h1><p className="mt-3 text-sm leading-6 text-white/60">The saved recording and its videos are no longer available. Copies already downloaded or shared externally cannot be recalled.</p><Link href="/play" className="button-primary mt-5">Play Classic</Link></section> : attempt && allowed ? <div className="space-y-5"><header><p className="mono-label text-electric">Classic · your private performance</p><h1 className="mt-4 text-3xl font-bold leading-snug sm:text-4xl">“{attempt.assignment.promptText}”</h1><p className="mt-4 text-base leading-7 text-white/65">{attempt.assignment.energy}</p></header><div className="panel p-5"><p className="mb-3 text-xs font-bold text-white/60">Your original audio · {(attempt.durationMs / 1000).toFixed(1)} seconds</p><SavedAudio url={attempt.audioUrl} label="Your saved Classic performance" reloadOnRetry /><p className="mt-3 text-xs leading-6 text-white/50">Saved without a score. Create a video without using a judged play.</p></div><VideoExport mode="classic" attemptId={id} reopenPath={path} initialOpen />
      {!attempt.saved && <section className="rounded-xl border border-electric/25 p-5"><h2 className="flex items-center gap-2 font-bold"><LockKeyhole className="size-4 text-electric" />Keep your performance</h2><p className="mt-2 text-sm leading-6 text-white/60">Guest recordings stay on this browser for 24 hours. Sign in here to keep this take in your account. You can recreate its video after signing in.</p><Link href={`/login?next=${encodeURIComponent(`${path}?claim=1`)}`} className="button-secondary mt-4">Sign in & keep take</Link></section>}
      <div className="border-t border-white/10 pt-4">{confirmDelete ? <div className="space-y-3"><p className="text-sm leading-6 text-white/65">Permanently delete this recording and its videos?</p><div className="flex flex-wrap gap-2"><button type="button" className="button-secondary text-red-200" disabled={deleting} onClick={() => void remove()}>{deleting ? "Deleting…" : "Delete permanently"}</button><button className="button-ghost" type="button" disabled={deleting} onClick={() => setConfirmDelete(false)}>Cancel</button></div></div> : <button type="button" className="button-ghost text-xs text-white/60" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />Delete performance</button>}</div>
    </div> : attempt ? <p className="panel p-6 text-sm leading-7 text-white/65">Choose the appropriate content setting above to open this saved performance.</p> : null}
    {error && <div role="alert" className="mt-5 rounded-xl border border-hot/25 p-5"><p className="text-sm leading-7 text-orange-200">{error}</p><button type="button" className="button-secondary mt-4" onClick={() => setRevision((value) => value + 1)}>Try again</button></div>}
  </div></main>;
}
