"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clapperboard, RefreshCw } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import type { GroupAssignment } from "@/lib/groups/types";
import { formatDate } from "@/lib/utils";

export interface SavedClassicTake {
  id: string;
  assignment: Extract<GroupAssignment, { mode: "classic" }>;
  audioUrl: string;
  durationMs: number;
  displayName: string | null;
  createdAt: string;
  expiresAt: string | null;
  saved: boolean;
  owned: boolean;
}

export function ClassicVideoHistory() {
  const { authReady, authenticated, contentRating } = useApp();
  const [attempts, setAttempts] = useState<SavedClassicTake[]>([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!authReady) return;
    const controller = new AbortController();
    setError(""); setAttempts([]);
    void fetch(`/api/classic/attempts?maxRating=${contentRating}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "Your saved video takes could not be loaded.");
        if (!controller.signal.aborted) setAttempts(body.data?.attempts ?? []);
      }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Your saved video takes could not be loaded."); });
    return () => controller.abort();
  }, [authReady, authenticated, contentRating, revision]);
  if (!attempts.length && !error) return null;
  return <section className="mt-10" aria-labelledby="classic-video-history-title"><p className="mono-label text-electric">Saved without judging</p><h2 id="classic-video-history-title" className="mb-5 mt-2 text-2xl font-bold">Classic video takes</h2>
    {error ? <div role="alert" className="rounded-xl border border-white/15 p-4 text-sm leading-6"><p>{error}</p><button type="button" className="button-ghost mt-3" onClick={() => setRevision((value) => value + 1)}><RefreshCw className="size-4" />Try again</button></div> : <div className="grid gap-4 md:grid-cols-2">{attempts.map((attempt) => <article key={attempt.id} className="panel p-5"><p className="text-xs text-white/50">{formatDate(attempt.createdAt)} · {(attempt.durationMs / 1000).toFixed(1)} sec · Private</p><h3 className="mt-3 text-xl font-bold leading-7">“{attempt.assignment.promptText}”</h3><p className="mt-3 text-sm leading-6 text-white/60">{attempt.assignment.energy}</p><Link href={`/performances/classic/${encodeURIComponent(attempt.id)}`} className="button-secondary mt-5 min-h-12"><Clapperboard className="size-4" />Replay & video</Link>{!attempt.saved && <p className="mt-3 text-xs leading-6 text-white/50">Kept on this browser for 24 hours. Open to sign in and keep it.</p>}</article>)}</div>}
  </section>;
}
