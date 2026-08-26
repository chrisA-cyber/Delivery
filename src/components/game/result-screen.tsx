"use client";

import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { ArrowRight, Download, Flame, Globe2, Link2, LoaderCircle, RotateCcw, Share2, Sparkles, Swords } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { ScoreRing } from "@/components/game/score-ring";
import { ENERGY_MODIFIERS } from "@/data/content";
import { createResultCard, downloadBlob } from "@/lib/share-card";
import type { DeliveryReference, JudgeResult, Prompt } from "@/types/game";

const labels = [
  ["commitment", "Commitment", "bg-acid"],
  ["comedy", "Comedy", "bg-hot"],
  ["accuracy", "Accuracy", "bg-electric"],
  ["chaos", "Chaos", "bg-orange-400"],
] as const;

function audioExtension(blob: Blob) {
  if (blob.type.includes("wav")) return "wav";
  if (blob.type.includes("mpeg") || blob.type.includes("mp3")) return "mp3";
  if (blob.type.includes("mp4") || blob.type.includes("m4a")) return "m4a";
  if (blob.type.includes("ogg")) return "ogg";
  return "webm";
}

export function ResultScreen({ prompt, result, delivery, audioBlob, warning, onNext, onRetry, canRetry = true, nextLabel = "One more round", cleanStage = false }: { prompt: Prompt; result: JudgeResult; delivery: DeliveryReference | null; audioBlob: Blob | null; warning?: string; onNext: () => void | Promise<void>; onRetry: () => void; canRetry?: boolean; nextLabel?: string; cleanStage?: boolean }) {
  const [notice, setNotice] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [visibility, setVisibility] = useState(delivery?.visibility ?? "private");
  const [dailyPosition, setDailyPosition] = useState({
    rank: delivery?.dailyRank,
    participants: delivery?.dailyParticipants,
  });
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const { authenticated, reducedMotion, refreshAccount } = useApp();

  useEffect(() => {
    resultHeadingRef.current?.focus({ preventScroll: true });
  }, [result.id]);

  useEffect(() => {
    setDailyPosition({ rank: delivery?.dailyRank, participants: delivery?.dailyParticipants });
  }, [delivery?.dailyParticipants, delivery?.dailyRank, delivery?.id]);

  useEffect(() => {
    if (!delivery?.dailyRanked || visibility !== "public" || dailyPosition.rank) return;
    const controller = new AbortController();
    void fetch("/api/leaderboard?period=daily&metric=overall&market=global", {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json() as { viewer?: { rank?: unknown; participant_count?: unknown } | null };
      if (!response.ok || !body.viewer) return;
      const rank = Number(body.viewer.rank);
      const participants = Number(body.viewer.participant_count);
      if (Number.isInteger(rank) && rank > 0 && Number.isInteger(participants) && participants >= rank) {
        setDailyPosition({ rank, participants });
      }
    }).catch(() => undefined);
    return () => controller.abort();
  }, [dailyPosition.rank, delivery?.dailyRanked, visibility]);

  useEffect(() => {
    if (result.scores.overall < 75 || reducedMotion) return;
    const colors = ["#caff33", "#ff4cc8", "#5d7cff", "#ffffff"];
    void confetti({ particleCount: 110, spread: 75, origin: { y: 0.65 }, colors, disableForReducedMotion: true });
  }, [reducedMotion, result.scores.overall]);

  const dailyStanding = delivery?.dailyRanked && dailyPosition.rank
    ? `#${dailyPosition.rank}${dailyPosition.participants ? ` of ${dailyPosition.participants}` : ""} on today’s Daily`
    : null;
  const shareText = dailyStanding
    ? `I landed ${dailyStanding} with ${result.scores.overall} on Delivery and got “${result.title}.” Your mic next.`
    : `I scored ${result.scores.overall} on Delivery and got “${result.title}.” Your mic next.`;
  const energyId = ENERGY_MODIFIERS.find((item) => item.instruction === prompt.energy)?.id;
  const playableParams = new URLSearchParams({ prompt: prompt.id });
  if (energyId) playableParams.set("energy", energyId);
  const challengePath = `/play?${playableParams.toString()}`;
  const resultPath = delivery?.persisted && delivery.id && visibility === "public" ? `/d/${delivery.id}` : null;
  const sharePath = resultPath ?? challengePath;
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}${sharePath}`;

  async function publishResult() {
    if (!delivery?.persisted || !delivery.id) return;
    setPublishing(true);
    setPublishError("");
    try {
      const response = await fetch(`/api/deliveries/${encodeURIComponent(delivery.id)}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: "public" }),
      });
      const body = await response.json() as { data?: { visibility?: string }; error?: { message?: string } };
      if (!response.ok || body.data?.visibility !== "public") throw new Error(body.error?.message ?? "This result could not be published.");
      setVisibility("public");
      setNotice("Published — your score link is ready");
      await refreshAccount();
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "This result could not be published.");
    } finally {
      setPublishing(false);
    }
  }

  async function nativeShare() {
    try {
      const card = await createResultCard(prompt, result);
      const files = [new File([card], `delivery-${result.id}.png`, { type: "image/png" })];
      if (audioBlob) files.push(new File([audioBlob], `delivery-${result.id}.${audioExtension(audioBlob)}`, { type: audioBlob.type || "audio/wav" }));
      if (!navigator.share) throw new Error("Native sharing unavailable");
      if (navigator.canShare?.({ files })) await navigator.share({ title: "My Delivery score", text: shareText, url: shareUrl, files });
      else await navigator.share({ title: "My Delivery score", text: shareText, url: shareUrl });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      window.open(`https://x.com/intent/post?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`, "_blank", "noopener,noreferrer");
    }
  }

  async function saveCard() {
    const card = await createResultCard(prompt, result);
    downloadBlob(card, `delivery-score-${result.scores.overall}.png`);
    setNotice("Result card saved");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    setNotice(resultPath ? "Score link copied" : "Playable line copied");
  }

  return (
    <motion.section initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto w-full max-w-4xl pb-10 pt-3">
      <div className="mb-5 flex items-center justify-between">
        <span className="mono-label text-acid">{delivery?.dailyRanked === true ? dailyStanding ? `Ranked Daily · ${dailyStanding}` : "Ranked Daily · first score locked" : delivery?.dailyRanked === false ? "Practice Daily · ranked score already locked" : "Judgment delivered"}</span>
        <span className="mono-label text-white/25">{result.source === "fallback" ? "Practice judge" : "AI judge"}</span>
      </div>

      <div className="panel-solid relative overflow-hidden p-5 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-electric via-acid to-hot" />
        <div className="absolute -right-36 -top-36 size-96 rounded-full bg-hot/10 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[220px_1fr] lg:items-center">
          <div className="mx-auto">
            <ScoreRing score={result.scores.overall} />
          </div>
          <div>
            <div className="inline-flex -rotate-1 items-center gap-2 rounded-full bg-hot px-3 py-1.5 text-black">
              <Sparkles className="size-3.5" /> <span className="mono-label">{result.title}</span>
            </div>
            <h1 ref={resultHeadingRef} tabIndex={-1} aria-label={`Score ${result.scores.overall} out of 100. ${result.title}. ${result.verdict}`} className="mt-5 text-balance text-3xl font-black leading-[1.02] tracking-[-0.05em] text-white outline-none sm:text-5xl">{result.verdict}</h1>
            <blockquote className="mt-5 border-l-2 border-acid pl-4 text-sm font-bold leading-6 text-white/55">“{result.moment}”</blockquote>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {result.badge && <span className="rounded-full border border-acid/20 bg-acid/10 px-3 py-1.5 text-xs font-black text-acid">🏅 {result.badge}</span>}
              {result.percentile && <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-white/50">Top {Math.max(1, 100 - result.percentile)}% today</span>}
              <span className="flex items-center gap-1.5 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1.5 text-xs font-black text-orange-300"><Flame className="size-3.5" /> +{result.xp ?? 35} XP</span>
              {dailyStanding && <Link href="/leaderboard?period=daily" className="rounded-full border border-electric/25 bg-electric/10 px-3 py-1.5 text-xs font-black text-electric transition hover:border-electric/50">{dailyStanding}</Link>}
            </div>
          </div>
        </div>

        <div className="relative mt-8 grid gap-4 border-t border-white/10 pt-7 sm:grid-cols-2">
          {labels.map(([key, label, color]) => (
            <div key={key}>
              <div className="mb-2 flex items-center justify-between">
                <span className="mono-label text-white/45">{label}</span>
                <span className="font-mono text-sm font-black">{result.scores[key]}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div initial={{ width: 0 }} animate={{ width: `${result.scores[key]}%` }} transition={{ duration: 0.8, delay: 0.25 }} className={`h-full rounded-full ${color}`} />
              </div>
            </div>
          ))}
        </div>

        {result.transcript && (
          <details className="relative mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <summary className="mono-label cursor-pointer text-white/55">What the judge heard</summary>
            <p className="mt-3 text-sm italic leading-6 text-white/60">“{result.transcript}”</p>
          </details>
        )}
      </div>

      {!cleanStage && warning && <div role="status" className="mt-4 rounded-2xl border border-orange-400/25 bg-orange-400/10 p-4 text-sm font-bold leading-6 text-orange-100">{warning}</div>}

      {!cleanStage && delivery?.persisted && delivery.id && visibility !== "public" && (
        <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-electric/20 bg-electric/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-black">Want a permanent score link?</p><p className="mt-1 text-xs leading-5 text-white/45">Publishing makes this judged take and its audio visible on your public profile. Nothing changes until you choose it.</p></div>
          <button onClick={() => void publishResult()} disabled={publishing} className="button-secondary shrink-0 border-electric/25 text-electric disabled:opacity-50">{publishing ? <LoaderCircle className="size-4 animate-spin" /> : <Globe2 className="size-4" />} {publishing ? "Safety check…" : "Publish result"}</button>
        </div>
      )}
      {!cleanStage && !delivery?.persisted && authenticated && <p className="mt-4 text-center text-xs font-bold text-white/55">This score was not saved, so sharing sends the card and the same playable line instead.</p>}
      {!cleanStage && publishError && <p role="alert" className="mt-3 rounded-xl border border-orange-400/20 bg-orange-400/10 p-3 text-sm font-bold text-orange-100">{publishError}</p>}

      {!cleanStage && <><div className={`mt-4 grid gap-3 ${canRetry ? "sm:grid-cols-[1fr_auto_auto]" : "sm:grid-cols-[1fr_auto]"}`}>
        <button onClick={() => void onNext()} className="button-primary min-h-14">{nextLabel} <ArrowRight className="size-4" /></button>
        <button onClick={() => void nativeShare()} className="button-secondary min-h-14"><Share2 className="size-4" /> {resultPath ? "Share result" : "Share card"}</button>
        {canRetry && <button onClick={onRetry} className="button-secondary min-h-14"><RotateCcw className="size-4" /> Redeliver</button>}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <button onClick={() => void saveCard()} className="button-ghost"><Download className="size-4" /> Save card</button>
        <button onClick={() => void copyLink()} className="button-ghost"><Link2 className="size-4" /> {resultPath ? "Copy score link" : "Copy playable line"}</button>
        <Link href="/challenge" className="button-ghost"><Swords className="size-4" /> Rematch a friend</Link>
      </div>
      {resultPath && <Link href={resultPath} className="mono-label mx-auto mt-4 flex w-fit items-center gap-2 text-white/60 transition hover:text-white"><Globe2 className="size-3.5" /> View public result</Link>}</>}
      {cleanStage && <p className="mono-label mt-4 text-center text-white/55">R · next line&nbsp;&nbsp; V · energy vote&nbsp;&nbsp; F · fullscreen</p>}
      {notice && <p role="status" className="mono-label mt-4 text-center text-acid">{notice}</p>}
    </motion.section>
  );
}
