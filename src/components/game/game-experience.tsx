"use client";

import {
  Bookmark,
  Check,
  ChevronLeft,
  CircleAlert,
  Download,
  Headphones,
  LoaderCircle,
  Mic,
  RotateCcw,
  Shuffle,
  Square,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import {
  ContentControl,
  CONTENT_LABELS,
} from "@/components/content/content-control";
import { JudgingLoader } from "@/components/game/judging-loader";
import { ResultScreen } from "@/components/game/result-screen";
import { VideoExport } from "@/components/exports/video-export";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { dailyGamePrompt, gamePrompt, toGamePrompt } from "@/lib/game-prompts";
import { createId } from "@/lib/utils";
import { downloadBlob } from "@/lib/share-card";
import {
  ENERGY_MODIFIERS,
  getPromptById,
  isEnergyCompatible,
  isRatingAllowed,
  type ContentRating,
  type DeliveryPrompt,
  type EnergyModifier,
} from "@/data/content";
import type {
  DeliveryHistoryItem,
  DeliveryReference,
  GameMode,
  JudgeResult,
  Prompt,
} from "@/types/game";

type GameStage = "prompt" | "recording" | "review" | "judging" | "result";
export function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `0:${String(seconds).padStart(2, "0")}`;
}

function normalizeResult(value: unknown): JudgeResult {
  const candidate = (
    value && typeof value === "object" && "result" in value
      ? (value as { result: unknown }).result
      : value
  ) as Partial<JudgeResult> | undefined;
  if (
    !candidate?.scores ||
    Object.values(candidate.scores).some(
      (score) => !Number.isFinite(score) || score < 0 || score > 100,
    ) ||
    ["overall", "commitment", "comedy", "accuracy", "chaos"].some(
      (key) =>
        typeof candidate.scores?.[key as keyof typeof candidate.scores] !==
        "number",
    )
  )
    throw new Error(
      "The judge returned an unreadable score. Your take is still here.",
    );
  if (!candidate.verdict || !candidate.title)
    throw new Error("The result was incomplete. Retry this saved take.");
  return {
    id: candidate.id ?? createId(),
    scores: candidate.scores,
    verdict: candidate.verdict,
    title: candidate.title,
    moment: candidate.moment ?? "",
    transcript: candidate.transcript ?? "",
    badge: candidate.badge,
    xp: candidate.xp ?? 35,
    source: candidate.source ?? "ai",
    coachNote: candidate.coachNote,
    highlights: candidate.highlights,
    rubricVersion: candidate.rubricVersion,
    scoringVersion: candidate.scoringVersion,
    transcription: candidate.transcription,
  };
}

export function GameExperience({
  mode = "classic",
  initialPrompt,
  packId,
  dailyDate,
  dailyMarket,
  challengeId,
  challengeToken,
  challengeReturnPath,
  runtimeInitial = true,
  onJudged,
  cleanStage = false,
  voteEnabled = false,
  voteDelaySeconds = 5,
  initialContentRating,
  roundContext,
  assignmentCode,
}: {
  mode?: GameMode;
  initialPrompt?: Prompt;
  packId?: string;
  dailyDate?: string;
  dailyMarket?: string;
  challengeId?: string;
  challengeToken?: string;
  challengeReturnPath?: string;
  runtimeInitial?: boolean;
  onJudged?: (result: JudgeResult) => void;
  cleanStage?: boolean;
  voteEnabled?: boolean;
  voteDelaySeconds?: number;
  initialContentRating?: ContentRating;
  roundContext?: { token: string; returnPath: string };
  assignmentCode?: string;
}) {
  const router = useRouter();
  const {
    favorites,
    muted,
    reducedMotion,
    tier,
    authenticated,
    hydrated,
    contentRating,
    refreshAccount,
    toggleFavorite,
    updatePreferences,
    saveDelivery,
  } = useApp();
  const [hostRating, setHostRating] = useState<ContentRating>(
    initialContentRating === "teen" ? "teen" : "everyone",
  );
  const [hostContentReady, setHostContentReady] = useState(
    mode !== "stream" || initialContentRating !== "mature",
  );
  useEffect(() => {
    if (mode !== "stream" || initialContentRating !== "mature") return;
    try {
      if (
        sessionStorage.getItem("delivery.stream.contentRating") === "mature"
      ) {
        setHostRating("mature");
        setHostContentReady(true);
      }
    } catch {
      /* A blocked session store requires an explicit stage choice. */
    }
  }, [mode, initialContentRating]);
  const rating = mode === "stream" ? hostRating : contentRating;
  const firstPrompt = useMemo(
    () =>
      initialPrompt ??
      (mode === "daily" ? dailyGamePrompt() : gamePrompt(mode)),
    [initialPrompt, mode],
  );
  const [roundSaving, setRoundSaving] = useState(false);
  const roundTakeRef = useRef<{ blob: Blob; id: string } | null>(null);
  const exportTakeRef = useRef<{ blob: Blob; id?: string; key: string } | null>(null);
  const [prompt, setPrompt] = useState(firstPrompt);
  const [stage, setStage] = useState<GameStage>("prompt");
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [take, setTake] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitWarning, setSubmitWarning] = useState<string | undefined>();
  const [deliveryReference, setDeliveryReference] =
    useState<DeliveryReference | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [drawError, setDrawError] = useState("");
  const [voteOpen, setVoteOpen] = useState(false);
  const [voteSeconds, setVoteSeconds] = useState(voteDelaySeconds);
  const [voteOptions, setVoteOptions] = useState<EnergyModifier[]>([]);
  const [voteNotice, setVoteNotice] = useState("");
  const [rehearsal, setRehearsal] = useState(false);
  const [playbackError, setPlaybackError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const submitController = useRef<AbortController | null>(null);
  const submissionInFlight = useRef(false);
  const drawInFlight = useRef(false);
  const attemptIdRef = useRef(createId("attempt"));
  const recentIds = useRef<string[]>([firstPrompt.id]);
  const recentEnergyIds = useRef<string[]>(
    firstPrompt.energyId ? [firstPrompt.energyId] : [],
  );
  const interactionStarted = useRef(false);
  const recorder = useAudioRecorder();
  const { reset, start, stop } = recorder;
  const allowed = isRatingAllowed(prompt.rating ?? "everyone", rating);
  const isFavorite = favorites.includes(prompt.id);
  const fixedRound =
    mode === "daily" || mode === "challenge" || !runtimeInitial || Boolean(roundContext);

  useEffect(() => {
    if (recorder.status === "stopped" && stage === "recording")
      setStage("review");
    else if (recorder.status === "error" && stage === "recording")
      setStage("prompt");
  }, [recorder.status, stage]);

  // Unmount aborts the UI request, never a server-side receipt already being processed.
  useEffect(
    () => () => {
      submitController.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!recorder.audioBlob || stage === "result" || (exportTakeRef.current?.blob === recorder.audioBlob && exportTakeRef.current.id)) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [recorder.audioBlob, stage, roundSaving]);

  useEffect(() => {
    if (
      !hydrated ||
      !hostContentReady ||
      fixedRound ||
      interactionStarted.current
    )
      return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setPromptLoading(false);
      setDrawError(
        "The catalog took too long. Your displayed line is still playable, or try another draw.",
      );
    }, 12_000);
    const query = new URLSearchParams({ maxRating: rating });
    if (packId) query.set("pack", packId);
    else if (mode === "impossible") query.set("pack", "impossible-energy");
    if (tier === "pro") query.set("includePro", "true");
    setPromptLoading(true);
    setDrawError("");
    void fetch(`/api/prompts/random?${query}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          data?: {
            prompt?: DeliveryPrompt;
            energy?: EnergyModifier;
            source?: string;
          };
          error?: { message?: string };
        };
        if (!response.ok || !body.data?.prompt || !body.data.energy)
          throw new Error(
            body.error?.message ?? "Fresh lines are unavailable. Try again.",
          );
        if (controller.signal.aborted || interactionStarted.current) return;
        const fresh = toGamePrompt(body.data.prompt, body.data.energy);
        fresh.source = body.data.source === "trend" ? "trend" : "editorial";
        setPrompt(fresh);
        recentIds.current = [fresh.id];
        recentEnergyIds.current = fresh.energyId ? [fresh.energyId] : [];
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setDrawError(
            error instanceof Error
              ? error.message
              : "Could not refresh the catalog.",
          );
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!controller.signal.aborted) setPromptLoading(false);
      });
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [fixedRound, hostContentReady, hydrated, mode, packId, rating, tier]);

  const begin = useCallback(async () => {
    if (!allowed || promptLoading || submissionInFlight.current) return;
    interactionStarted.current = true;
    setSubmitError(null);
    setSubmitWarning(undefined);
    setPlaybackError("");
    audioRef.current?.pause();
    if (await start()) setStage("recording");
  }, [allowed, promptLoading, start]);

  const retake = useCallback(() => {
    if (submissionInFlight.current) return;
    audioRef.current?.pause();
    reset();
    setTake((current) => current + 1);
    setSubmitError(null);
    setPlaybackError("");
    attemptIdRef.current = createId("attempt");
    setStage("prompt");
  }, [reset]);

  const nextPrompt = useCallback(async () => {
    if (drawInFlight.current || submissionInFlight.current) return;
    drawInFlight.current = true;
    interactionStarted.current = true;
    setPromptLoading(true);
    setDrawError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const query = new URLSearchParams({
        maxRating: rating,
        exclude: recentIds.current.join(","),
        excludeEnergy: recentEnergyIds.current.join(","),
      });
      if (packId) query.set("pack", packId);
      else if (mode === "impossible") query.set("pack", "impossible-energy");
      if (tier === "pro") query.set("includePro", "true");
      let response = await fetch(`/api/prompts/random?${query}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      type DrawResponse = {
        data?: {
          prompt?: DeliveryPrompt;
          energy?: EnergyModifier;
          source?: string;
        };
        error?: { code?: string; message?: string };
      };
      let body = (await response.json()) as DrawResponse;
      let restartedDeck = false;
      // A small safe pack can exhaust before the recent-history window does.
      // Start a new deck, still excluding the current line and retaining every audience/pack gate.
      if (
        !response.ok &&
        body.error?.code === "NO_PROMPTS" &&
        recentIds.current.length > 1
      ) {
        query.set("exclude", prompt.id);
        response = await fetch(`/api/prompts/random?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        body = (await response.json()) as DrawResponse;
        restartedDeck = true;
      }
      if (!response.ok || !body.data?.prompt || !body.data.energy)
        throw new Error(
          body.error?.message ??
            "Could not draw another line. Your result is still here.",
        );
      const next = toGamePrompt(body.data.prompt, body.data.energy);
      audioRef.current?.pause();
      reset();
      setPrompt(next);
      setStage("prompt");
      setTake(1);
      setResult(null);
      setDeliveryReference(null);
      setSubmitError(null);
      setVoteNotice("");
      recentIds.current = [
        ...(restartedDeck ? [prompt.id] : recentIds.current),
        next.id,
      ].slice(-8);
      recentEnergyIds.current = [...recentEnergyIds.current, next.energyId!]
        .filter(Boolean)
        .slice(-4);
      attemptIdRef.current = createId("attempt");
      window.scrollTo({
        top: 0,
        behavior: reducedMotion ? "instant" : "smooth",
      });
    } catch (error) {
      setDrawError(
        error instanceof Error && error.name !== "AbortError"
          ? error.message
          : "The catalog took too long. Try another draw; your take is still here.",
      );
    } finally {
      clearTimeout(timeout);
      drawInFlight.current = false;
      setPromptLoading(false);
    }
  }, [mode, packId, prompt.id, rating, reducedMotion, reset, tier]);

  const continuePlaying = useCallback(() => {
    if (roundContext) { router.push(roundContext.returnPath); return; }
    if (assignmentCode) { router.push("/play"); return; }
    if (mode === "challenge" && challengeReturnPath) {
      reset();
      window.location.assign(challengeReturnPath);
      return;
    }
    if (mode === "daily" || mode === "challenge") {
      reset();
      window.location.assign("/play");
      return;
    }
    return nextPrompt();
  }, [assignmentCode, challengeReturnPath, mode, nextPrompt, reset, roundContext, router]);

  const openVote = useCallback(() => {
    if (!allowed || promptLoading) return;
    const source = getPromptById(prompt.id);
    const compatible = ENERGY_MODIFIERS.filter(
      (item) => !source || isEnergyCompatible(source, item),
    );
    const offset = Math.floor(Math.random() * compatible.length);
    setVoteOptions(
      Array.from(
        { length: Math.min(3, compatible.length) },
        (_, i) => compatible[(offset + i) % compatible.length]!,
      ),
    );
    setVoteSeconds(voteDelaySeconds);
    setVoteNotice("");
    setVoteOpen(true);
  }, [allowed, prompt.id, promptLoading, voteDelaySeconds]);
  const chooseVote = useCallback(
    (index: number) => {
      const winner = voteOptions[index];
      if (!winner) return;
      setPrompt((current) => ({
        ...current,
        energy: winner.instruction,
        energyId: winner.id,
        directionLabel: winner.shortLabel,
      }));
      setVoteNotice(`Host locked #${index + 1}: ${winner.shortLabel}`);
      setVoteOpen(false);
    },
    [voteOptions],
  );
  useEffect(() => {
    if (!voteOpen) return;
    if (voteSeconds <= 0) {
      setVoteOpen(false);
      setVoteNotice("No choice locked. The original direction stays.");
      return;
    }
    const timer = window.setTimeout(
      () => setVoteSeconds((value) => value - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [voteOpen, voteSeconds]);
  useEffect(() => {
    if (mode !== "stream") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement | null)?.closest(
          "input,textarea,select,button,a,[contenteditable='true']",
        )
      )
        return;
      if (voteOpen && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        chooseVote(Number(event.key) - 1);
      } else if (event.code === "Space") {
        event.preventDefault();
        if (stage === "prompt") void begin();
        else if (stage === "recording") stop();
      } else if (
        event.key.toLowerCase() === "r" &&
        stage !== "recording" &&
        stage !== "judging" &&
        stage !== "review"
      ) {
        event.preventDefault();
        void nextPrompt();
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void (
          document.fullscreenElement
            ? document.exitFullscreen()
            : document.documentElement.requestFullscreen()
        ).catch(() =>
          setVoteNotice("Fullscreen is unavailable in this browser."),
        );
      } else if (
        event.key.toLowerCase() === "v" &&
        voteEnabled &&
        stage === "prompt"
      ) {
        event.preventDefault();
        if (voteOpen) setVoteOpen(false);
        else openVote();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    begin,
    chooseVote,
    mode,
    nextPrompt,
    openVote,
    stage,
    stop,
    voteEnabled,
    voteOpen,
  ]);

  async function saveRoundTake(): Promise<string> {
    if (!roundContext || !recorder.audioBlob) throw new Error("Record a take first.");
    if (roundTakeRef.current?.blob === recorder.audioBlob) return roundTakeRef.current.id;
    const form = new FormData();
    form.set("audio", recorder.audioBlob, "delivery.wav");
    form.set("durationMs", String(recorder.durationMs));
    form.set("attemptId", attemptIdRef.current);
    form.set("maxRating", rating);
    const response = await fetch(`/api/rounds/${roundContext.token}/takes`, {
      method: "POST", body: form, headers: { "Idempotency-Key": attemptIdRef.current },
    });
    const body = await response.json();
    if (!response.ok || !body.data?.take?.id) throw new Error(body.error?.message ?? "Could not save this take. Your recording is still here.");
    roundTakeRef.current = { blob: recorder.audioBlob, id: body.data.take.id };
    return body.data.take.id;
  }

  async function prepareVideoExport(): Promise<string> {
    if (roundSaving || submissionInFlight.current || !recorder.audioBlob || !recorder.canSubmit) throw new Error("Finish your recording or save, then create your video.");
    if (deliveryReference?.persisted && deliveryReference.id && !roundContext) return deliveryReference.id;
    setRoundSaving(true);
    try {
      if (roundContext) return await saveRoundTake();
      if (exportTakeRef.current?.blob !== recorder.audioBlob) exportTakeRef.current = { blob: recorder.audioBlob, key: crypto.randomUUID() };
      if (exportTakeRef.current.id) return exportTakeRef.current.id;
      const savedTake = exportTakeRef.current;
      const form = new FormData();
      form.set("audio", recorder.audioBlob, "delivery.wav");
      form.set("durationMs", String(recorder.durationMs)); form.set("attemptId", savedTake.key);
      form.set("promptId", prompt.id); form.set("promptText", prompt.line); form.set("energy", prompt.energy);
      form.set("category", prompt.category); form.set("mode", mode); form.set("maxRating", rating);
      if (assignmentCode) form.set("assignmentCode", assignmentCode);
      if (mode === "daily" && dailyDate) form.set("dailyDate", dailyDate);
      if (mode === "daily" && dailyMarket) form.set("dailyMarket", dailyMarket);
      if (mode === "challenge" && challengeId) form.set("challengeId", challengeId);
      if (mode === "challenge" && challengeToken) form.set("challengeToken", challengeToken);
      const response = await fetch("/api/classic/attempts", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok || !body.data?.attempt?.id) throw new Error(body.error?.message ?? "Your take could not be saved. Retry video creation to recover it.");
      savedTake.id = body.data.attempt.id;
      return body.data.attempt.id;
    } finally { setRoundSaving(false); }
  }

  async function chooseRoundTake() {
    if (roundSaving || submissionInFlight.current || !roundContext) return;
    setRoundSaving(true); setSubmitError(null);
    try {
      const id = await saveRoundTake();
      router.push(`${roundContext.returnPath}?take=${encodeURIComponent(id)}`);
    } catch (error) { setSubmitError(error instanceof Error ? error.message : "Could not save your take."); }
    finally { setRoundSaving(false); }
  }

  async function submit() {
    if (
      !recorder.audioBlob ||
      !recorder.canSubmit ||
      !allowed ||
      submissionInFlight.current ||
      rehearsal
    )
      return;
    submissionInFlight.current = true;
    audioRef.current?.pause();
    setStage("judging");
    setSubmitError(null);
    const controller = new AbortController();
    submitController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 65_000);
    const form = new FormData();
    form.append("audio", recorder.audioBlob, "delivery.wav");
    form.append("promptId", prompt.id);
    form.append("line", prompt.line);
    form.append("energy", prompt.energy);
    form.append("category", prompt.category);
    form.append("mode", mode);
    form.append("durationMs", String(recorder.durationMs));
    form.append("attemptId", attemptIdRef.current);
    form.append("isPublic", "false");
    form.append("maxRating", rating);
    if (assignmentCode) form.append("assignmentCode", assignmentCode);
    if (mode === "daily" && dailyDate) form.append("dailyDate", dailyDate);
    if (mode === "daily" && dailyMarket)
      form.append("dailyMarket", dailyMarket);
    if (mode === "challenge" && challengeId)
      form.append("challengeId", challengeId);
    if (mode === "challenge" && challengeToken)
      form.append("challengeToken", challengeToken);
    try {
      if (roundContext) {
        form.set("roundToken", roundContext.token);
        form.set("roundTakeId", await saveRoundTake());
      }
      const response = await fetch("/api/judge", {
        method: "POST",
        body: form,
        headers: { "Idempotency-Key": attemptIdRef.current },
        signal: controller.signal,
      });
      const body = (await response.json()) as {
        result?: unknown;
        warning?: unknown;
        delivery?: Partial<DeliveryReference>;
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(
          body.error?.message ??
            "Judging is unavailable. Your recording is still here.",
        );
      const judged = normalizeResult(body);
      const delivery = body.delivery;
      const reference: DeliveryReference | null =
        delivery && typeof delivery.persisted === "boolean"
          ? {
              id: typeof delivery.id === "string" ? delivery.id : null,
              persisted: delivery.persisted,
              visibility: delivery.visibility ?? "private",
              dailyRanked: delivery.dailyRanked,
              dailyRank: delivery.dailyRank,
              dailyParticipants: delivery.dailyParticipants,
            }
          : null;
      setSubmitWarning(
        typeof body.warning === "string" ? body.warning : undefined,
      );
      setDeliveryReference(reference);
      setResult(judged);
      const historyItem: DeliveryHistoryItem = {
        ...judged,
        prompt,
        createdAt: new Date().toISOString(),
        visibility: reference?.visibility,
        dailyRanked: reference?.dailyRanked,
        dailyRank: reference?.dailyRank,
        dailyParticipants: reference?.dailyParticipants,
      };
      if (!roundContext) saveDelivery(historyItem);
      if (reference?.persisted && authenticated) void refreshAccount();
      onJudged?.(judged);
      setStage("result");
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.name !== "AbortError"
          ? error.message
          : "The request timed out. Your take is saved here. Retry uses the same receipt key, so a completed request is not scored twice.",
      );
      setStage("review");
    } finally {
      clearTimeout(timeout);
      submissionInFlight.current = false;
      submitController.current = null;
    }
  }

  function changeRating(next: ContentRating) {
    if (stage !== "prompt") return;
    interactionStarted.current = false;
    if (mode === "stream") {
      setHostRating(next);
      setHostContentReady(true);
      try {
        sessionStorage.setItem("delivery.stream.contentRating", next);
      } catch {
        /* Local choice still works. */
      }
    } else updatePreferences({ contentRating: next });
    setDrawError("");
  }
  const contentControl = (
    <ContentControl
      value={rating}
      onChange={changeRating}
      compact
      disabled={stage !== "prompt" || recorder.status === "requesting"}
    />
  );
  if (!hostContentReady)
    return (
      <section className="game-experience panel-solid p-6">
        <p className="mono-label text-acid">Host content check</p>
        <h1 className="mt-3 text-3xl font-bold">
          Choose what goes on your stage.
        </h1>
        <p className="my-5 text-sm leading-6 text-white/70">
          This link requested Mature content. Confirm the adult setting on this
          device, or choose Clean or Spicy.
        </p>
        {contentControl}
      </section>
    );
  if (stage === "judging")
    return <JudgingLoader audioBlob={recorder.audioBlob} />;
  if (stage === "result" && result)
    return (
      <div>
      {roundContext && <div className="panel-solid mb-5 p-5">
        <p className="text-sm text-white/65">Your take is private. Choose it, then confirm sharing on the round page.</p>
        <button className="button-primary mt-3" disabled={roundSaving} onClick={() => void chooseRoundTake()}>{roundSaving ? "Saving…" : "Use this take in round"}</button>
        {submitError && <p role="alert" className="mt-3 text-orange-200">{submitError}</p>}
      </div>}
      <ResultScreen
        mode={mode}
        prompt={prompt}
        result={result}
        delivery={roundContext ? null : deliveryReference}
        audioBlob={recorder.audioBlob}
        audioUrl={recorder.audioUrl}
        prepareVideoExport={prepareVideoExport}
        exportAttemptId={roundContext ? roundTakeRef.current?.id : undefined}
        exportReturnPath={roundContext?.returnPath}
        warning={submitWarning}
        onNext={continuePlaying}
        onRetry={retake}
        canRetry={mode !== "daily" && mode !== "challenge"}
        nextLabel={
          roundContext ? "Back to round" : mode === "challenge" && challengeReturnPath
            ? "View matchup"
            : mode === "daily" || mode === "challenge"
              ? "Play a fresh line"
              : "One more round"
        }
        cleanStage={cleanStage}
        nextLoading={promptLoading}
        nextError={drawError}
      />
      </div>
    );

  return (
    <section className="game-experience pb-5">
      <p className="sr-only" role="status" aria-live="polite">
        {stage === "recording"
          ? "Recording in progress"
          : stage === "review"
            ? "Recording stopped. Review your take."
            : "Ready to record"}
      </p>
      <div className="game-toolbar">
        <div className="flex min-w-0 items-center gap-3">
          {!cleanStage && (
            <Link href={roundContext?.returnPath ?? "/"} className="icon-button" aria-label={roundContext ? "Back to round" : "Exit to home"}>
              <ChevronLeft className="size-4" />
            </Link>
          )}
          <div>
            <p className="mono-label text-white/60">
              {mode === "stream"
                ? "Host stage"
                : mode === "daily"
                  ? "Daily"
                  : mode === "challenge"
                    ? "Friend challenge"
                    : mode === "impossible"
                      ? "Impossible"
                      : "Classic"}
            </p>
            <p className="text-sm font-bold">
              Take {String(take).padStart(2, "0")}
            </p>
          </div>
        </div>
        <div className="game-progress" aria-label="Round progress">
          <span data-active={stage === "prompt"}>Prepare</span>
          <span data-active={stage === "recording"}>Record</span>
          <span data-active={stage === "review"}>Review</span>
        </div>
        {!cleanStage && allowed && (
          <button
            onClick={() => toggleFavorite(prompt.id)}
            className="icon-button hidden sm:inline-grid"
            aria-label={
              isFavorite ? "Remove from favorites" : "Favorite this line"
            }
            aria-pressed={isFavorite}
          >
            <Bookmark
              className="size-4"
              fill={isFavorite ? "currentColor" : "none"}
            />
          </button>
        )}
      </div>

      {!allowed ? (
        <div className="panel-solid p-6 sm:p-10">
          <p className="mono-label text-acid">
            {prompt.rating === "mature" ? "Mature · 18+" : "Spicy content"}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            This line is behind your filter.
          </h1>
          <p className="my-5 max-w-xl text-sm leading-6 text-white/70">
            {mode === "daily"
              ? "Today’s locked Daily uses a higher content setting. Its original line stays the same."
              : "Choose a content setting before revealing this line, or play a clean round."}
          </p>
          {contentControl}
          <Link href="/play" className="button-secondary mt-5">
            Back to Classic
          </Link>
        </div>
      ) : (
        <>
          {voteOpen && (
            <div className="mb-4 rounded-xl border border-electric/30 bg-electric/10 p-5">
              <div className="flex justify-between gap-4">
                <div>
                  <p className="mono-label text-electric">
                    Host-operated direction choice · {voteSeconds}s
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/65">
                    Read your chat and lock the winner here. This screen does
                    not collect remote votes.
                  </p>
                </div>
                <button
                  onClick={() => setVoteOpen(false)}
                  className="icon-button"
                  aria-label="Close direction choices"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {voteOptions.map((option, index) => (
                  <button
                    key={option.id}
                    onClick={() => chooseVote(index)}
                    className="button-secondary justify-start text-left"
                  >
                    <span className="text-electric">{index + 1}.</span>
                    {option.shortLabel}
                  </button>
                ))}
              </div>
            </div>
          )}
          {voteNotice && (
            <p role="status" className="mb-3 text-sm text-electric">
              {voteNotice}
            </p>
          )}
          {stage === "prompt" && !cleanStage && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              {contentControl}
              {mode === "stream" && voteEnabled && (
                <button onClick={openVote} className="button-secondary text-xs">
                  Choose direction · V
                </button>
              )}
            </div>
          )}
          <div className="cue-sheet" aria-busy={promptLoading}>
            <div className="cue-grid">
              <div className="line-cue">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="mono-label">01 / Say this line</span>
                  {stage === "prompt" && !fixedRound && !cleanStage && (
                    <button
                      onClick={() => void nextPrompt()}
                      disabled={promptLoading}
                      className="button-ghost min-h-11 px-2 text-xs text-ink"
                      aria-label="Reroll"
                      title="Draw a different line and direction"
                    >
                      <Shuffle
                        className={`size-4 ${promptLoading ? "animate-spin" : ""}`}
                      />
                      New line
                    </button>
                  )}
                </div>
                <h1 className="prompt-line" data-testid="prompt-line">
                  “{prompt.line}”
                </h1>
              </div>
              <div className="direction-cue">
                <p className="mono-label mb-4">02 / Deliver it like this</p>
                <h2>{prompt.directionLabel ?? "Commit to the direction"}</h2>
                <p className="mt-3" data-testid="prompt-direction">
                  {prompt.energy}
                </p>
              </div>
            </div>
            <div className="cue-meta">
              <span>
                {prompt.pack ?? "Delivery Originals"} ·{" "}
                {CONTENT_LABELS[prompt.rating ?? "everyone"]}
              </span>
              <span className="flex items-center gap-1.5">
                <Headphones className="size-3.5" /> Voice only · 20s max
              </span>
            </div>
          </div>

          {!roundContext && prompt.rating !== "mature" && stage === "prompt" && <div className="mt-4 flex justify-end"><Link className="button-ghost text-xs" href={`/rounds?mode=classic&prompt=${encodeURIComponent(prompt.id)}&energy=${encodeURIComponent(prompt.energyId ?? "")}`}>Start a group round with this line</Link></div>}
          <div className="recording-desk">
            {recorder.error && stage === "prompt" && (
              <div className="game-error mb-5" role="alert">
                <p className="flex items-center gap-2 font-bold">
                  <CircleAlert className="size-4" />
                  Let’s get your mic back.
                </p>
                <p className="mt-1">{recorder.error}</p>
              </div>
            )}
            {stage === "prompt" && (
              <>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold">
                      <span className="inline-block size-2 rounded-full bg-white/30" />
                      {recorder.status === "requesting"
                        ? "Waiting for microphone permission"
                        : "Ready when you are."}
                    </p>
                    <p className="mt-2 max-w-md text-sm leading-6 text-white/65">

                      {rehearsal
                        ? "Practice stays on this device."
                        : "Record, listen back, then submit."}
                    </p>
                  </div>
                  <button
                    onClick={() => void begin()}
                    disabled={recorder.status === "requesting" || promptLoading}
                    className="button-primary recording-control shrink-0"
                    aria-label="Start recording"
                  >
                    {recorder.status === "requesting" ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Mic />
                    )}
                    {recorder.status === "requesting"
                      ? "Opening mic…"
                      : rehearsal
                        ? "Record rehearsal"
                        : "Record your take"}
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => setRehearsal((value) => !value)}
                    className="button-ghost min-h-10 px-0 text-xs"
                    aria-pressed={rehearsal}
                  >
                    <Headphones className="size-4" />
                    {rehearsal
                      ? "Private rehearsal on"
                      : "Private rehearsal"}
                  </button>
                  {recorder.status === "requesting" ? (
                    <button
                      onClick={reset}
                      className="button-ghost min-h-10 text-xs"
                    >
                      Cancel permission request
                    </button>
                  ) : (
                    <p className="text-xs text-white/60">
                      {rehearsal
                        ? "No upload. No score. Just practice."
                        : "Private until you share."}
                    </p>
                  )}
                </div>
              </>
            )}
            {stage === "recording" && (
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      <span className="status-dot" />
                      Recording {rehearsal ? "rehearsal" : "your take"}
                    </p>
                    <span className="recording-status text-sm">
                      {formatTime(recorder.durationMs)}{" "}
                      <span className="text-white/55">/ 0:20</span>
                    </span>
                  </div>
                  <div
                    className="mic-meter mt-2"
                    role="meter"
                    aria-label="Live microphone level"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(recorder.level * 100)}
                  >
                    {Array.from({ length: 35 }, (_, i) => (
                      <i
                        key={i}
                        style={{
                          height: Math.max(
                            3,
                            recorder.level * 52 * (0.45 + (i % 7) / 10),
                          ),
                        }}
                      />
                    ))}
                  </div>
                  <p
                    className={`text-xs ${recorder.isClipping ? "text-orange-200" : "text-white/65"}`}
                  >
                    {recorder.isClipping
                      ? "Signal is clipping. Move a little farther from the mic."
                      : recorder.level > 0.015
                        ? "Mic is receiving audio. Quiet acting counts too."
                        : "Listening for your voice…"}
                  </p>
                </div>
                <button
                  onClick={stop}
                  className="button-primary recording-control"
                  aria-label="Stop recording"
                >
                  <Square fill="currentColor" />
                  Stop recording
                </button>
              </div>
            )}
            {stage === "review" && recorder.audioUrl && (
              <>
                {submitError && (
                  <div className="game-error mb-5" role="alert">
                    <p className="font-bold">Your take is safe on this page.</p>
                    <p className="mt-1">{submitError}</p>
                    <p className="mt-2">
                      Retry sends this same take. Download it before closing the
                      page.
                    </p>
                  </div>
                )}
                {(recorder.warning || !recorder.canSubmit) && (
                  <div role="status" className="game-note mb-4">
                    {recorder.warning && <p>{recorder.warning}</p>}
                    {!recorder.canSubmit && <p>{recorder.qualityMessage}</p>}
                  </div>
                )}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold tracking-tight">
                      {rehearsal
                        ? "No audience. Just you and the bit."
                        : "Listen back. Own the delivery."}
                    </p>
                    <p className="mt-1 text-xs text-white/65">
                      Take {take} · {formatTime(recorder.durationMs)} · Stored
                      on this device
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      recorder.audioBlob &&
                      downloadBlob(
                        recorder.audioBlob,
                        `delivery-take-${take}.wav`,
                      )
                    }
                    className="button-ghost px-2 text-xs"
                  >
                    <Download className="size-4" />
                    Save take
                  </button>
                </div>
                <audio
                  ref={audioRef}
                  controls
                  preload="metadata"
                  src={recorder.audioUrl}
                  muted={muted}
                  aria-label={`Playback controls for take ${take}`}
                  onError={() =>
                    setPlaybackError(
                      "Playback failed in this browser. Save your WAV take, or record again.",
                    )
                  }
                />
                {muted && (
                  <button
                    type="button"
                    onClick={() => updatePreferences({ muted: false })}
                    className="button-ghost mt-2 px-0 text-xs"
                  >
                    <VolumeX className="size-4" />
                    Playback is muted · Unmute this device
                  </button>
                )}
                {playbackError && (
                  <p role="alert" className="mt-2 text-sm text-orange-200">
                    {playbackError}
                  </p>
                )}
                {roundContext && <div className="mt-5 rounded-xl border border-acid/30 bg-acid/5 p-4">
                  <p className="text-sm leading-6 text-white/70">Choose your performance when you’re happy with it. Sharing is confirmed on the round page; a score is optional.</p>
                  <button onClick={() => void chooseRoundTake()} disabled={!recorder.canSubmit || roundSaving} className="button-primary mt-3 w-full">{roundSaving ? "Saving your take…" : "Use this take in round"}</button>
                </div>}
                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                  {rehearsal ? (
                    <button
                      onClick={() => setRehearsal(false)}
                      disabled={!recorder.canSubmit || roundSaving}
                      className="button-primary min-h-12"
                    >
                      <Check className="size-4" />
                      Ready for judgment
                    </button>
                  ) : (
                    <button
                      onClick={() => void submit()}
                      disabled={!recorder.canSubmit || roundSaving}
                      className="button-primary min-h-12"
                    >
                      <Check className="size-4" />
                      {submitError ? "Retry judgment" : "Judge this take"}
                    </button>
                  )}
                  <button
                    onClick={retake}
                    disabled={roundSaving}
                    className="button-secondary min-h-12"
                  >
                    <RotateCcw className="size-4" />
                    Retake
                  </button>
                </div>
                <p className="mt-3 text-center text-xs leading-5 text-white/65">
                  {rehearsal
                    ? "Nothing has left your device. You can keep rehearsing."
                    : "Judge this take sends your audio for AI processing. It does not publish it."}
                </p>
                {!cleanStage && <div className="mt-5"><VideoExport key={recorder.audioUrl} mode="classic" prepareAttempt={prepareVideoExport} disabled={!recorder.canSubmit || roundSaving} reopenPath={roundContext?.returnPath} /></div>}
              </>
            )}
          </div>
        </>
      )}
      {drawError && (
        <p className="game-error mt-4" role="alert">
          {drawError}
        </p>
      )}
    </section>
  );
}
