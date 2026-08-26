"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Check, ChevronLeft, CircleAlert, Headphones, Mic, Pause, Play, RotateCcw, Shuffle, Sparkles, Square } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { JudgingLoader } from "@/components/game/judging-loader";
import { ResultScreen } from "@/components/game/result-screen";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { dailyGamePrompt, gamePrompt, gamePromptForPack, toGamePrompt } from "@/lib/game-prompts";
import { createId } from "@/lib/utils";
import { ENERGY_MODIFIERS, type DeliveryPrompt, type EnergyModifier } from "@/data/content";
import type { DeliveryHistoryItem, DeliveryReference, GameMode, JudgeResult, Prompt } from "@/types/game";

type GameStage = "prompt" | "recording" | "review" | "judging" | "result";

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `0:${String(seconds).padStart(2, "0")}`;
}

function normalizeResult(value: unknown): JudgeResult {
  const candidate = (value && typeof value === "object" && "result" in value ? (value as { result: unknown }).result : value) as Partial<JudgeResult> | undefined;
  if (!candidate?.scores) throw new Error("The judge returned an unreadable score");
  return {
    id: candidate.id ?? createId(),
    scores: candidate.scores,
    verdict: candidate.verdict ?? "You said it like rent was due in seven minutes. Disturbingly effective.",
    title: candidate.title ?? "MIC ACTIVITIES",
    moment: candidate.moment ?? "The commitment arrived before the context did.",
    transcript: candidate.transcript ?? "",
    badge: candidate.badge,
    percentile: candidate.percentile,
    xp: candidate.xp ?? 35,
    source: candidate.source ?? "ai",
  };
}

export function GameExperience({ mode = "classic", initialPrompt, packId, dailyDate, dailyMarket, challengeId, challengeToken, challengeReturnPath, runtimeInitial = true, onJudged, cleanStage = false, voteEnabled = false, voteDelaySeconds = 5 }: { mode?: GameMode; initialPrompt?: Prompt; packId?: string; dailyDate?: string; dailyMarket?: string; challengeId?: string; challengeToken?: string; challengeReturnPath?: string; runtimeInitial?: boolean; onJudged?: (result: JudgeResult) => void; cleanStage?: boolean; voteEnabled?: boolean; voteDelaySeconds?: number }) {
  const firstPrompt = useMemo(() => initialPrompt ?? (mode === "daily" ? dailyGamePrompt() : gamePrompt(mode)), [initialPrompt, mode]);
  const [prompt, setPrompt] = useState(firstPrompt);
  const [stage, setStage] = useState<GameStage>("prompt");
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [take, setTake] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitWarning, setSubmitWarning] = useState<string | undefined>();
  const [deliveryReference, setDeliveryReference] = useState<DeliveryReference | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [voteSeconds, setVoteSeconds] = useState(voteDelaySeconds);
  const [voteOptions, setVoteOptions] = useState<EnergyModifier[]>([]);
  const [voteNotice, setVoteNotice] = useState("");
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const attemptIdRef = useRef(createId("attempt"));
  const initialRuntimeLoadedRef = useRef(false);
  const interactionStartedRef = useRef(false);
  const recorder = useAudioRecorder();
  const stopRecording = recorder.stop;
  const { favorites, muted, publicDefault, tier, authenticated, refreshAccount, toggleFavorite, saveDelivery } = useApp();
  const isFavorite = favorites.includes(prompt.id);

  useEffect(() => {
    if (stage !== "recording") return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const next = Date.now() - started;
      setElapsed(next);
      if (next >= 20_000) stopRecording();
    }, 100);
    return () => window.clearInterval(timer);
  }, [stage, stopRecording]);

  useEffect(() => {
    if (recorder.status === "stopped" && stage === "recording") setStage("review");
  }, [recorder.status, stage]);

  useEffect(() => {
    if (!runtimeInitial || initialRuntimeLoadedRef.current || mode === "daily" || mode === "challenge") return;
    initialRuntimeLoadedRef.current = true;
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (packId) query.set("pack", packId);
    else if (mode === "impossible") query.set("pack", "impossible-energy");
    if (tier === "pro") query.set("includePro", "true");
    setPromptLoading(true);
    void fetch(`/api/prompts/random?${query.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { data?: { prompt?: DeliveryPrompt; energy?: EnergyModifier; source?: "curated" | "database" | "trend" } };
        if (!response.ok || !body.data?.prompt || !body.data.energy || interactionStartedRef.current) return;
        const fresh = toGamePrompt(body.data.prompt, body.data.energy);
        fresh.source = body.data.source === "trend" ? "trend" : "editorial";
        setPrompt(fresh);
      })
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setPromptLoading(false); });
    return () => controller.abort();
  }, [mode, packId, runtimeInitial, tier]);

  const begin = useCallback(async () => {
    interactionStartedRef.current = true;
    setSubmitError(null);
    setSubmitWarning(undefined);
    const started = await recorder.start();
    if (started) {
      setElapsed(0);
      setStage("recording");
    }
  }, [recorder]);

  const openVote = useCallback(() => {
    const difficulty = prompt.difficulty === 1 ? "easy" : prompt.difficulty === 2 || prompt.difficulty === 3 ? "medium" : prompt.difficulty === 4 ? "hard" : "impossible";
    const compatible = ENERGY_MODIFIERS.filter((item) => !item.compatibleDifficulties || item.compatibleDifficulties.includes(difficulty));
    const start = Math.floor(Math.random() * Math.max(1, compatible.length));
    const choices = Array.from({ length: Math.min(3, compatible.length) }, (_, index) => compatible[(start + index * 7) % compatible.length]!).filter(Boolean);
    setVoteOptions(choices);
    setVoteSeconds(voteDelaySeconds);
    setVoteNotice("");
    setVoteOpen(true);
  }, [prompt.difficulty, voteDelaySeconds]);

  const chooseVote = useCallback((index: number) => {
    const winner = voteOptions[index];
    if (!winner) return;
    setPrompt((current) => ({ ...current, energy: winner.instruction }));
    setVoteNotice(`Locked #${index + 1}: ${winner.shortLabel}`);
    setVoteOpen(false);
  }, [voteOptions]);

  useEffect(() => {
    if (!voteOpen) return;
    if (voteSeconds <= 0) {
      setVoteOpen(false);
      setVoteNotice("No winner locked — original energy stays.");
      return;
    }
    const timer = window.setTimeout(() => setVoteSeconds((value) => value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [voteOpen, voteSeconds]);

  const retake = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
    setTake((current) => current + 1);
    attemptIdRef.current = createId("attempt");
    recorder.reset();
    setStage("prompt");
  }, [recorder]);

  const nextPrompt = useCallback(async () => {
    interactionStartedRef.current = true;
    const fallback = () => mode === "daily" ? gamePrompt("classic", prompt.id) : packId ? gamePromptForPack(packId, prompt.id) : gamePrompt(mode, prompt.id.replace("-impossible", ""));
    setPromptLoading(true);
    let next: Prompt;
    try {
      const query = new URLSearchParams({ exclude: prompt.id.replace("-impossible", "") });
      if (packId) query.set("pack", packId);
      else if (mode === "impossible") query.set("pack", "impossible-energy");
      if (tier === "pro") query.set("includePro", "true");
      const response = await fetch(`/api/prompts/random?${query.toString()}`, { cache: "no-store" });
      const body = await response.json() as { data?: { prompt?: DeliveryPrompt; energy?: EnergyModifier; source?: "curated" | "database" | "trend" } };
      if (!response.ok || !body.data?.prompt || !body.data.energy) throw new Error("Fresh prompt unavailable");
      next = toGamePrompt(body.data.prompt, body.data.energy);
      next.source = body.data.source === "trend" ? "trend" : "editorial";
    } catch {
      next = fallback();
    } finally {
      setPromptLoading(false);
    }
    recorder.reset();
    setPrompt(next);
    setStage("prompt");
    setTake(1);
    setResult(null);
    setDeliveryReference(null);
    setSubmitError(null);
    setElapsed(0);
    attemptIdRef.current = createId("attempt");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [mode, packId, prompt.id, recorder, tier]);

  const continuePlaying = useCallback(() => {
    if (mode === "challenge" && challengeReturnPath) {
      window.location.assign(challengeReturnPath);
      return;
    }
    if (mode === "daily" || mode === "challenge") {
      window.location.assign("/play");
      return;
    }
    return nextPrompt();
  }, [challengeReturnPath, mode, nextPrompt]);

  useEffect(() => {
    if (mode !== "stream") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a, [contenteditable='true']")) return;
      if (voteOpen && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        chooseVote(Number(event.key) - 1);
      } else if (event.code === "Space") {
        event.preventDefault();
        if (stage === "prompt") void begin();
        else if (stage === "recording") recorder.stop();
      } else if (event.key.toLowerCase() === "r" && stage !== "recording" && stage !== "judging") {
        event.preventDefault(); void nextPrompt();
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      } else if (event.key.toLowerCase() === "v" && voteEnabled && stage === "prompt") {
        event.preventDefault();
        if (voteOpen) setVoteOpen(false);
        else openVote();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [begin, chooseVote, mode, nextPrompt, openVote, recorder, stage, voteEnabled, voteOpen]);

  async function submit() {
    if (!recorder.audioBlob) return;
    setStage("judging");
    setSubmitError(null);
    const formData = new FormData();
    const extension = recorder.audioBlob.type.includes("wav") ? "wav" : recorder.audioBlob.type.includes("mp4") ? "m4a" : recorder.audioBlob.type.includes("ogg") ? "ogg" : "webm";
    formData.append("audio", recorder.audioBlob, `delivery.${extension}`);
    formData.append("promptId", prompt.id);
    formData.append("line", prompt.line);
    formData.append("energy", prompt.energy);
    formData.append("category", prompt.category);
    formData.append("mode", mode);
    formData.append("durationMs", String(recorder.durationMs));
    formData.append("attemptId", attemptIdRef.current);
    formData.append("isPublic", publicDefault ? "true" : "false");
    if (mode === "daily" && dailyDate) formData.append("dailyDate", dailyDate);
    if (mode === "daily" && dailyMarket) formData.append("dailyMarket", dailyMarket);
    if (mode === "challenge" && challengeId) formData.append("challengeId", challengeId);
    if (mode === "challenge" && challengeToken) formData.append("challengeToken", challengeToken);

    try {
      const response = await fetch("/api/judge", {
        method: "POST",
        body: formData,
        headers: { "Idempotency-Key": attemptIdRef.current },
      });
      const body = (await response.json()) as unknown;
      if (!response.ok) {
        const message = body && typeof body === "object" && "error" in body
          ? typeof (body as { error?: unknown }).error === "object" && (body as { error?: { message?: unknown } }).error?.message
            ? String((body as { error: { message: unknown } }).error.message)
            : String((body as { error: unknown }).error)
          : "The judge left the booth";
        throw new Error(message);
      }
      const judged = normalizeResult(body);
      const responseMeta = body && typeof body === "object" ? body as { warning?: unknown; delivery?: unknown } : undefined;
      setSubmitWarning(typeof responseMeta?.warning === "string" ? responseMeta.warning : undefined);
      const delivery = responseMeta?.delivery && typeof responseMeta.delivery === "object"
        ? responseMeta.delivery as Partial<DeliveryReference>
        : undefined;
      const normalizedDelivery: DeliveryReference | null = delivery && typeof delivery.persisted === "boolean"
        ? {
            id: typeof delivery.id === "string" ? delivery.id : null,
            persisted: delivery.persisted,
            visibility: delivery.visibility === "public" || delivery.visibility === "private" || delivery.visibility === "unlisted" ? delivery.visibility : undefined,
            publishedAt: typeof delivery.publishedAt === "string" ? delivery.publishedAt : null,
            dailyRanked: typeof delivery.dailyRanked === "boolean" ? delivery.dailyRanked : undefined,
            dailyRank: typeof delivery.dailyRank === "number" && Number.isInteger(delivery.dailyRank) && delivery.dailyRank > 0 ? delivery.dailyRank : undefined,
            dailyParticipants: typeof delivery.dailyParticipants === "number" && Number.isInteger(delivery.dailyParticipants) && delivery.dailyParticipants > 0 ? delivery.dailyParticipants : undefined,
          }
        : null;
      setDeliveryReference(normalizedDelivery);
      setResult(judged);
      const historyItem: DeliveryHistoryItem = { ...judged, prompt, createdAt: new Date().toISOString(), audioUrl: recorder.audioUrl ?? undefined, visibility: normalizedDelivery?.visibility, dailyRanked: normalizedDelivery?.dailyRanked, dailyRank: normalizedDelivery?.dailyRank, dailyParticipants: normalizedDelivery?.dailyParticipants };
      saveDelivery(historyItem);
      if (normalizedDelivery?.persisted && authenticated) void refreshAccount();
      onJudged?.(judged);
      setStage("result");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Judging failed. Your recording is still here.");
      setStage("review");
    }
  }

  function togglePlayback() {
    if (!audioRef.current) return;
    if (audioRef.current.paused) void audioRef.current.play();
    else audioRef.current.pause();
  }

  if (stage === "judging") return <JudgingLoader />;
  if (stage === "result" && result) return <ResultScreen prompt={prompt} result={result} delivery={deliveryReference} audioBlob={recorder.audioBlob} warning={submitWarning} onNext={continuePlaying} onRetry={retake} canRetry={mode !== "daily" && mode !== "challenge"} nextLabel={mode === "challenge" && challengeReturnPath ? "View matchup" : mode === "daily" || mode === "challenge" ? "Play a fresh line" : "One more round"} cleanStage={cleanStage} />;

  return (
    <section className="mx-auto w-full max-w-4xl pb-10">
      <p className="sr-only" role="status" aria-live="polite">{stage === "recording" ? "Recording in progress" : stage === "review" ? "Recording stopped. Review your take." : "Ready to record"}</p>
      {!cleanStage && <div className="mb-5 flex items-center justify-between lg:mb-3 2xl:mb-5">
        <Link href="/" className="button-ghost min-h-9 px-2.5"><ChevronLeft className="size-4" /> Exit</Link>
        <div className="flex items-center gap-2">
          <span className="mono-label rounded-full border border-white/10 px-3 py-2 text-white/40">Take {take}</span>
          <button onClick={() => toggleFavorite(prompt.id)} className={`grid size-9 place-items-center rounded-full border transition ${isFavorite ? "border-acid/40 bg-acid/10 text-acid" : "border-white/10 text-white/40 hover:text-white"}`} aria-label={isFavorite ? "Remove from favorites" : "Favorite this line"}>
            <Bookmark className="size-4" fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>}

      <AnimatePresence>
        {mode === "stream" && voteEnabled && voteOpen && <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="mb-5 overflow-hidden rounded-2xl border border-electric/30 bg-electric/10 p-4"><div className="flex items-center justify-between gap-3"><div><p className="mono-label text-electric">Energy vote · press the winner</p><p className="mt-1 text-xs font-bold text-white/55">Lock chat&apos;s pick with 1, 2, or 3.</p></div><span className="display-type text-3xl text-electric">{voteSeconds}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{voteOptions.map((option, index) => <button key={option.id} onClick={() => chooseVote(index)} className="rounded-xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-electric/50"><span className="mono-label text-electric">{index + 1}</span><p className="mt-2 text-sm font-black leading-5">{option.shortLabel}</p></button>)}</div></motion.div>}
      </AnimatePresence>
      {mode === "stream" && voteNotice && <p role="status" className="mono-label mb-4 text-center text-electric">{voteNotice}</p>}

      <div className="panel-solid relative overflow-hidden p-5 sm:p-8 lg:p-5 2xl:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-electric via-acid to-hot" />
        <div className="absolute -left-28 -top-28 size-72 rounded-full bg-electric/10 blur-3xl" />
        <div className="relative flex items-center justify-between gap-4">
          <span className="mono-label rounded-full bg-acid px-3 py-1.5 text-black">{prompt.source === "trend" ? "Trending now" : mode === "daily" ? "Daily line" : mode === "impossible" ? "Impossible energy" : "Your line"}</span>
          {mode !== "daily" && mode !== "challenge" && stage === "prompt" && !cleanStage && (
            <button onClick={() => void nextPrompt()} disabled={promptLoading} className="button-ghost min-h-9 px-3 disabled:opacity-50"><Shuffle className={`size-3.5 ${promptLoading ? "animate-spin" : ""}`} /> {promptLoading ? "Loading…" : "Reroll"}</button>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={prompt.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="relative py-10 text-center sm:py-14 lg:py-5 2xl:py-8">
            <p className="mx-auto max-w-3xl text-balance text-[clamp(2.2rem,7vw,4.8rem)] font-black leading-[1.02] tracking-[-0.06em] text-white lg:text-[clamp(2.2rem,5vw,4.5rem)]">“{prompt.line}”</p>
            <div className="mx-auto mt-8 inline-flex max-w-xl items-start gap-3 rounded-2xl border border-hot/25 bg-hot/10 px-4 py-3 text-left lg:mt-4 2xl:mt-8">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-hot" />
              <div><p className="mono-label text-hot">Deliver it</p><p className="mt-1 text-sm font-bold text-white/80 sm:text-base">{prompt.energy}</p></div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="relative border-t border-white/10 pt-7 lg:pt-4 2xl:pt-7">
          {stage === "prompt" && (
            <div className="text-center">
              {recorder.error && <div role="alert" className="mx-auto mb-5 flex max-w-xl items-start gap-3 rounded-2xl border border-orange-400/25 bg-orange-400/10 p-4 text-left text-sm text-orange-100"><CircleAlert className="mt-0.5 size-4 shrink-0" /><span>{recorder.error}</span></div>}
              <button onClick={begin} disabled={recorder.status === "requesting"} className="group relative mx-auto grid size-24 place-items-center rounded-full bg-acid text-black shadow-acid transition hover:scale-105 active:scale-95 disabled:opacity-50 lg:size-20 2xl:size-24" aria-label="Start recording">
                <span className="absolute inset-0 animate-pulseRing rounded-full border border-acid" />
                <Mic className="size-8 transition group-hover:scale-110" />
              </button>
              <p className="mono-label mt-5 text-white/55 lg:mt-3 2xl:mt-5">{recorder.status === "requesting" ? "Opening mic…" : "Tap to deliver"}</p>
              <p className="mt-2 text-xs text-white/55">Your browser will ask for microphone access</p>
            </div>
          )}

          {stage === "recording" && (
            <div className="text-center">
              <div className="mx-auto flex h-20 max-w-xl items-center justify-center gap-1 overflow-hidden" aria-label="Live microphone level">
                {Array.from({ length: 31 }).map((_, index) => {
                  const distance = Math.abs(index - 15) / 15;
                  const height = Math.max(7, (18 + recorder.level * 62) * (1 - distance * 0.45) * (0.6 + ((index * 17) % 10) / 20));
                  return <motion.span key={index} animate={{ height }} transition={{ duration: 0.08 }} className="w-1.5 rounded-full bg-gradient-to-t from-electric via-acid to-hot" />;
                })}
              </div>
              <div className="mt-2 flex items-center justify-center gap-3"><span className="size-2 animate-pulse rounded-full bg-red-500" /><span className="font-mono text-2xl font-black tabular-nums">{formatTime(elapsed)}</span><span className="mono-label text-white/25">/ 0:20</span></div>
              <p role="status" aria-live="polite" className={`mono-label mt-3 ${recorder.level > .82 ? "text-orange-300" : recorder.level > .12 ? "text-acid" : "text-white/55"}`}>{recorder.level > .82 ? "Clipping — back up a little" : recorder.level > .12 ? "Level good" : "A little quiet"}</p>
              <button onClick={recorder.stop} disabled={elapsed < 350} className="mt-6 inline-grid size-20 place-items-center rounded-full bg-red-500 text-white shadow-[0_0_45px_rgba(239,68,68,.26)] transition hover:scale-105 active:scale-95 disabled:cursor-wait disabled:opacity-50" aria-label="Stop recording"><Square className="size-7" fill="currentColor" /></button>
              <p className="mono-label mt-4 text-white/60">{elapsed < 350 ? "Give it one beat…" : "Tap when the art is complete"}</p>
            </div>
          )}

          {stage === "review" && recorder.audioUrl && (
            <div>
              {submitError && <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-orange-400/25 bg-orange-400/10 p-4 text-sm text-orange-100"><CircleAlert className="mt-0.5 size-4 shrink-0" /><div><p className="font-black">The judge fumbled the clipboard.</p><p className="mt-1 text-orange-100/65">{submitError}</p></div></div>}
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <button onClick={togglePlayback} className="grid size-16 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15" aria-label={playing ? "Pause take" : "Play take"}>{playing ? <Pause className="size-6" fill="currentColor" /> : <Play className="ml-1 size-6" fill="currentColor" />}</button>
                <div className="w-full flex-1">
                  <div className="flex h-11 items-center gap-1 overflow-hidden rounded-xl bg-white/[0.04] px-3">
                    {Array.from({ length: 44 }).map((_, index) => <span key={index} className={`w-1 rounded-full ${playing ? "bg-acid" : "bg-white/25"}`} style={{ height: `${8 + ((index * 23) % 27)}px` }} />)}
                  </div>
                  <div className="mt-2 flex justify-between"><span className="mono-label text-white/30">Take {take}</span><span className="font-mono text-xs font-bold text-white/35">{formatTime(recorder.durationMs)}</span></div>
                </div>
              </div>
              <audio ref={audioRef} controls preload="metadata" src={recorder.audioUrl} muted={muted} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className="mt-4 w-full" aria-label={`Playback controls for take ${take}`} />
              <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_auto]">
                <button onClick={submit} className="button-primary min-h-14"><Check className="size-5" /> Judge this take</button>
                <button onClick={retake} className="button-secondary min-h-14"><RotateCcw className="size-4" /> Retake</button>
              </div>
              <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-white/50"><Headphones className="size-3.5" /> Quick headphone check recommended. Ego check optional.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
