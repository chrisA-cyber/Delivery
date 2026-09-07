"use client";

import { ArrowRight, Headphones, Link2, LoaderCircle, Share2, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ScoreRing } from "@/components/game/score-ring";
import { SavedAudio } from "@/components/game/saved-audio";
import { ReportAction } from "@/components/safety/report-action";
import type { ApiResponse, ShareDelivery } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const scoreLabels = [["commitment", "Commitment"], ["comedy", "Comedy"], ["accuracy", "Accuracy"], ["chaos", "Chaos"]] as const;

export function PublicDelivery({ deliveryId }: { deliveryId: string }) {
  const [delivery, setDelivery] = useState<ShareDelivery | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/share/${encodeURIComponent(deliveryId)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as ApiResponse<ShareDelivery>;
        if (!response.ok || !body.ok) throw new Error(body.ok ? "This take is unavailable." : body.error.message);
        setDelivery(body.data);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "This take is unavailable.");
      });
    return () => controller.abort();
  }, [deliveryId]);

  async function share() {
    if (!delivery) return;
    const url = window.location.href;
    const text = `${delivery.player?.displayName ?? "Someone"} scored ${delivery.score} on Delivery. Your mic next.`;
    try {
      if (navigator.share) await navigator.share({ title: "A Delivery just dropped", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setNotice("Link copied");
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      try { await navigator.clipboard.writeText(url); setNotice("Link copied"); }
      catch { setNotice("Sharing is unavailable. Copy this take’s address from your browser."); }
    }
  }

  if (error) return <div className="panel-solid mx-auto max-w-xl p-7 text-center"><p className="mono-label text-hot">Tape unavailable</p><h1 className="mt-4 text-3xl font-black">Private, removed, or lost to the timeline.</h1><p className="mt-3 text-sm leading-6 text-white/65">{error}</p><Link href="/play" className="button-primary mt-7">Make your own <ArrowRight className="size-4" /></Link></div>;
  if (!delivery) return <div className="panel mx-auto grid min-h-96 max-w-xl place-content-center text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-acid" /><p className="mono-label mt-4 text-white/65">Rewinding the tape</p></div>;

  return <div className="mx-auto max-w-4xl">
    <div className="mb-5 flex items-center justify-between"><span className="mono-label text-acid">Public delivery</span><span className="mono-label text-white/60">{formatDate(delivery.createdAt)}</span></div>
    <section className="panel-solid relative overflow-hidden p-5 sm:p-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-acid" />
      <div className="relative grid gap-8 lg:grid-cols-[220px_1fr] lg:items-center">
        <ScoreRing score={delivery.score} />
        <div><span className="mono-label inline-flex rounded-full bg-hot px-3 py-1.5 text-black">{delivery.verdictTag.replaceAll("_", " ")}</span><h1 className="mt-5 text-balance text-3xl font-black leading-tight tracking-[-0.05em] sm:text-5xl">{delivery.verdict}</h1>{delivery.player && <Link href={`/u/${delivery.player.username}`} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-white/55 hover:text-acid"><UserRound className="size-4" /> {delivery.player.displayName} · @{delivery.player.username}</Link>}</div>
      </div>
      <div className="relative mt-8 rounded-xl bg-paper p-5 text-ink sm:p-7"><p className="mono-label text-black/65">The line</p><p className="mt-3 text-2xl font-black leading-8">“{delivery.promptText}”</p>{delivery.energy && <p className="mt-4 flex items-start gap-2 text-sm font-bold leading-6 text-black/65"><Sparkles className="mt-1 size-3.5 shrink-0 text-hot" /> {delivery.energy}</p>}</div>
      {delivery.audioUrl ? <div className="relative mt-5 rounded-2xl border border-electric/20 bg-electric/[0.08] p-4"><p className="mb-3 flex items-center gap-2 text-xs font-black text-electric"><Headphones className="size-4" /> Hear the evidence</p><SavedAudio key={delivery.audioUrl} url={delivery.audioUrl} label="Public take playback" refreshPath={`/api/share/${encodeURIComponent(delivery.id)}`} /></div> : <p className="relative mt-5 text-center text-xs font-bold text-white/60">Audio is unavailable, but the receipts remain.</p>}
      <div className="relative mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">{scoreLabels.map(([key, label]) => <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><p className="display-type text-3xl text-acid">{delivery.scores[key]}</p><p className="mono-label mt-2 text-white/60">{label}</p></div>)}</div>
    </section>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"><Link href="/play" className="button-primary min-h-14">Take the mic <ArrowRight className="size-4" /></Link><button onClick={share} className="button-secondary min-h-14"><Share2 className="size-4" /> Share</button><Link href="/challenge" className="button-secondary min-h-14"><Link2 className="size-4" /> Challenge</Link><ReportAction deliveryId={delivery.id} className="button-ghost min-h-14" context="Public delivery" /></div>
    {notice && <p role="status" className="mono-label mt-4 text-center text-acid">{notice}</p>}
  </div>;
}
