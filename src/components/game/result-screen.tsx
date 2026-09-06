"use client";

import {
  ArrowRight,
  Download,
  Globe2,
  Headphones,
  Link2,
  LoaderCircle,
  RotateCcw,
  Share2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import {
  ENERGY_MODIFIERS,
  getEnergyModifierById,
  getPromptById,
  isActivePrompt,
} from "@/data/content";
import { createResultCard, downloadBlob } from "@/lib/share-card";
import type {
  DeliveryReference,
  GameMode,
  JudgeResult,
  Prompt,
} from "@/types/game";

const dimensions = [
  ["commitment", "Commitment", "How clearly you sold the direction"],
  ["comedy", "Comic timing", "Pacing, contrast, and the landing"],
  ["accuracy", "Line accuracy", "The words in the accuracy transcript"],
  ["chaos", "Controlled chaos", "The absurdity you made believable"],
] as const;

export function ResultScreen({
  prompt,
  result,
  delivery,
  audioBlob,
  audioUrl,
  warning,
  onNext,
  onRetry,
  canRetry = true,
  nextLabel = "One more round",
  cleanStage = false,
  nextLoading = false,
  nextError,
  mode = "classic",
}: {
  mode?: GameMode;
  prompt: Prompt;
  result: JudgeResult;
  delivery: DeliveryReference | null;
  audioBlob: Blob | null;
  audioUrl?: string | null;
  warning?: string;
  onNext: () => void | Promise<void>;
  onRetry: () => void;
  canRetry?: boolean;
  nextLabel?: string;
  cleanStage?: boolean;
  nextLoading?: boolean;
  nextError?: string;
}) {
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [visibility, setVisibility] = useState(
    delivery?.visibility ?? "private",
  );
  const [dailyPosition, setDailyPosition] = useState({
    rank: delivery?.dailyRank,
    participants: delivery?.dailyParticipants,
  });
  const heading = useRef<HTMLHeadingElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { muted, refreshAccount } = useApp();
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [result.id]);
  useEffect(() => {
    if (!delivery?.dailyRanked || visibility !== "public" || dailyPosition.rank)
      return;
    const controller = new AbortController();
    void fetch("/api/leaderboard?period=daily&metric=overall&market=global", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          viewer?: { rank?: unknown; participant_count?: unknown } | null;
        };
        if (!response.ok || !body.viewer) return;
        const rank = Number(body.viewer.rank),
          participants = Number(body.viewer.participant_count);
        if (
          Number.isInteger(rank) &&
          rank > 0 &&
          Number.isInteger(participants) &&
          participants >= rank
        )
          setDailyPosition({ rank, participants });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [dailyPosition.rank, delivery?.dailyRanked, visibility]);
  const fixture = result.source === "fallback";
  const dailyStanding =
    delivery?.dailyRanked && dailyPosition.rank
      ? `#${dailyPosition.rank}${dailyPosition.participants ? ` of ${dailyPosition.participants}` : ""} on today’s Daily`
      : null;
  const energyId =
    prompt.energyId ??
    ENERGY_MODIFIERS.find((item) => item.instruction === prompt.energy)?.id;
  const playableParams = new URLSearchParams({ prompt: prompt.id });
  if (energyId) playableParams.set("energy", energyId);
  const retired =
    Boolean(getPromptById(prompt.id)) &&
    (!isActivePrompt(prompt.id) ||
      !ENERGY_MODIFIERS.some((item) => item.id === energyId));
  const challengePath =
    mode === "daily" ? "/daily" : retired ? "/play" : `/play?${playableParams}`;
  const playableLabel =
    mode === "daily"
      ? "Copy Daily link"
      : retired
        ? "Copy Classic link"
        : "Copy playable line";
  const inviteParams = new URLSearchParams({ prompt: prompt.id });
  if (energyId) inviteParams.set("energy", energyId);
  const resultPath =
    delivery?.persisted && delivery.id && visibility === "public"
      ? `/d/${delivery.id}`
      : null;
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}${resultPath ?? challengePath}`;
  const shareText = fixture
    ? `A local practice card from Delivery. Try ${mode === "daily" ? "the Daily" : retired ? "Classic" : "this line"} yourself.`
    : dailyStanding
      ? `I landed ${dailyStanding} with ${result.scores.overall} on Delivery. Your mic next.`
      : `I scored ${result.scores.overall} on Delivery. Same line, your interpretation?`;

  async function publishResult() {
    if (!delivery?.persisted || !delivery.id || publishing) return;
    setPublishing(true);
    setActionError("");
    try {
      const response = await fetch(
        `/api/deliveries/${encodeURIComponent(delivery.id)}/visibility`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility: "public" }),
        },
      );
      const body = (await response.json()) as {
        data?: { visibility?: string };
        error?: { message?: string };
      };
      if (!response.ok || body.data?.visibility !== "public")
        throw new Error(
          body.error?.message ?? "This result could not be published.",
        );
      setVisibility("public");
      setNotice("Published. Your score and recording are now public.");
      await refreshAccount();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Publishing failed. Your take remains private.",
      );
    } finally {
      setPublishing(false);
    }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setNotice(
        resultPath
          ? "Score link copied"
          : mode === "daily"
            ? "Daily link copied. It always opens the current global assignment."
            : retired
              ? "Classic link copied. The original line remains in this receipt."
              : "Playable line copied. Your recording stays private.",
      );
    } catch {
      setActionError(
        "Clipboard access is unavailable. Use the playable link below.",
      );
    }
  }
  async function saveCard() {
    setSharing(true);
    setActionError("");
    try {
      downloadBlob(
        await createResultCard(prompt, result),
        `delivery-score-${result.scores.overall}.png`,
      );
      setNotice("Result card downloaded");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not create your card.",
      );
    } finally {
      setSharing(false);
    }
  }
  async function nativeShare() {
    if (sharing) return;
    setSharing(true);
    setActionError("");
    try {
      const card = await createResultCard(prompt, result);
      const files = [
        new File([card], `delivery-${result.id}.png`, { type: "image/png" }),
      ];
      if (navigator.share) {
        if (navigator.canShare?.({ files }))
          await navigator.share({
            title: "Delivery result card",
            text: shareText,
            url: shareUrl,
            files,
          });
        else
          await navigator.share({
            title: "Delivery",
            text: shareText,
            url: shareUrl,
          });
      } else {
        downloadBlob(card, `delivery-score-${result.scores.overall}.png`);
        setNotice(
          "Sharing is unavailable here. Your card was downloaded; copy the playable link to invite someone.",
        );
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setActionError(
          "Could not share the card. Try Save card or Copy playable line.",
        );
    } finally {
      setSharing(false);
    }
  }
  function playWord(start: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = start;
    void audio
      .play()
      .catch(() =>
        setActionError(
          "Playback is unavailable. Download your original take instead.",
        ),
      );
  }

  return (
    <section className="game-experience pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="mono-label text-electric">
          {delivery?.dailyRanked === true
            ? (dailyStanding ?? "Ranked Daily · first score locked")
            : delivery?.dailyRanked === false
              ? "Daily practice · first score stays locked"
              : "Judgment delivered"}
        </p>
        <span className="mono-label text-white/60">
          {fixture
            ? "Local fixture · not a live score"
            : visibility === "public"
              ? "Public result"
              : "Private result"}
        </span>
      </div>
      {fixture && (
        <div
          className="mb-4 rounded-xl border border-hot/30 bg-hot/10 px-4 py-3 text-xs leading-5 text-paper"
          role="note"
        >
          Practice judge: this is a deterministic local fixture. It checks the
          flow, not how your performance sounded. It is not a ranked score.
        </div>
      )}
      <div className="result-main">
        <div className="grid gap-7 sm:grid-cols-[.52fr_1fr] sm:items-center">
          <div>
            <p className="mono-label mb-4 text-ink/70">
              {fixture ? "Fixture score" : "Delivery score"}
            </p>
            <p className="result-score">
              {result.scores.overall}
              <span className="ml-2 text-xl font-normal text-ink/60">/100</span>
            </p>
            <span className="mono-label mt-5 inline-block rounded-md bg-ink px-3 py-2 text-paper">
              {result.title}
            </span>
          </div>
          <div>
            <h1
              ref={heading}
              tabIndex={-1}
              aria-label={`Score ${result.scores.overall} out of 100. ${result.title}. ${result.verdict}`}
              className="result-verdict outline-none"
            >
              {result.verdict}
            </h1>
            {result.moment && (
              <p className="mt-5 border-l-2 border-ink/30 pl-4 text-sm leading-6 text-ink/75">
                {result.moment}
              </p>
            )}
          </div>
        </div>
      </div>

      {!cleanStage && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            onClick={() => void onNext()}
            disabled={nextLoading}
            className="button-primary min-h-14"
          >
            {nextLoading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            {nextLoading ? "Drawing your next line…" : nextLabel}
          </button>
          {audioUrl && (
            <button
              onClick={() => playWord(0)}
              className="button-secondary min-h-14"
              aria-label="Replay take"
            >
              <Headphones className="size-4" /> Replay take
              {muted ? " · muted" : ""}
            </button>
          )}
          {canRetry && (
            <button
              onClick={onRetry}
              disabled={nextLoading}
              className="button-secondary min-h-14"
            >
              <RotateCcw className="size-4" />
              Retry same direction
            </button>
          )}
          {!retired && prompt.rating !== "mature" && (
            <Link
              href={`/rounds?mode=classic&${inviteParams}`}
              className="button-secondary min-h-14"
            >
              <Users className="size-4" />
              Start a group round
            </Link>
          )}
        </div>
      )}
      {audioUrl && (
        <div className="panel-solid mt-4 px-5 pb-5 pt-1">
          {audioUrl && (
            <>
              <p className="mb-2 mt-5 flex items-center gap-2 text-xs font-bold text-white/70">
                <Headphones className="size-4" />
                Replay your take{muted ? " · Playback muted in Settings" : ""}
              </p>
              <audio
                ref={audioRef}
                controls
                preload="metadata"
                src={audioUrl}
                muted={muted}
                aria-label="Replay your judged take"
              />
            </>
          )}
        </div>
      )}
      {result.coachNote && (
        <div className="mt-4 grid gap-3 rounded-xl bg-electric p-5 text-ink sm:grid-cols-[160px_1fr]">
          <p className="mono-label">
            Director’s note
            <br />
            <span className="normal-case tracking-normal">
              For your next take
            </span>
          </p>
          <p className="text-sm font-medium leading-6">{result.coachNote}</p>
        </div>
      )}
      <details className="result-breakdown mt-4 rounded-xl bg-paper px-5 py-4 text-ink">
        <summary className="cursor-pointer text-sm font-bold">
          Score breakdown · four dimensions
        </summary>
        <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {dimensions.map(([key, label, description]) => (
            <div className="result-dimension" key={key}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold">{label}</p>
                <span className="text-xl font-bold tabular-nums">
                  {result.scores[key]}
                </span>
              </div>
              <div className="my-2 h-1 overflow-hidden rounded-full bg-ink/10">
                <div
                  className="h-full bg-ink"
                  style={{ width: `${result.scores[key]}%` }}
                />
              </div>
              <p className="text-[11px] leading-4 text-ink/65">{description}</p>
            </div>
          ))}
        </div>
      </details>
      {retired && (
        <p className="mt-4 text-xs leading-6 text-white/65">
          This original assignment is preserved in your receipt and existing
          challenges. It has retired from new Classic draws and new friend
          challenges.
        </p>
      )}
      {nextError && (
        <p role="alert" className="game-error mt-3">
          {nextError}
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="panel-solid p-5">
          <p className="mono-label text-white/60">The assignment</p>
          <p className="mt-3 text-lg font-bold leading-6 tracking-tight">
            “{prompt.line}”
          </p>
          <p className="mt-3 text-xs leading-5 text-electric">
            {getEnergyModifierById(energyId ?? "")?.shortLabel ?? "Direction"} ·{" "}
            {prompt.energy}
          </p>
        </div>
        <div className="panel-solid p-5">
          <p className="mono-label text-white/60">Your receipt</p>
          {result.transcription ? (
            <>
              <p className="mt-3 text-sm font-bold">Scribe v2 transcript</p>
              <p className="mt-1 text-xs leading-5 text-white/60">
                {audioUrl ? "Tap a word to replay that moment. " : ""}
                Transcription is separate from the performance score.
              </p>
              <p className="mt-3 text-sm leading-7">
                {result.transcription.words.length && audioUrl
                  ? result.transcription.words.map((word, index) => (
                      <button
                        className="mr-1 inline-flex min-h-11 items-center rounded bg-white/5 px-1.5 hover:bg-electric/15"
                        key={index}
                        onClick={() => playWord(word.start)}
                        aria-label={`Replay ${word.text}`}
                      >
                        {word.text}
                      </button>
                    ))
                  : result.transcription.text}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-white/70">
              {result.transcript || "A transcript was not returned."}
            </p>
          )}
          <details className="mt-4 border-t border-white/10 pt-4">
            <summary className="cursor-pointer py-1 text-xs font-bold text-white/70">
              {result.transcription
                ? "Accuracy transcript & scoring details"
                : "What the judge heard & scoring details"}
            </summary>
            {result.transcription && (
              <p className="mt-3 text-sm leading-6 text-white/75">
                {result.transcript}
              </p>
            )}
            <p className="mt-3 text-xs leading-5 text-white/65">
              Accuracy uses the audio judge’s literal transcript and
              deterministic word matching. The score keeps the original 30%
              commitment, 25% comedy, 25% accuracy, and 20% chaos weighting.
              Quiet delivery is legitimate.
            </p>
            <p className="mt-2 text-[11px] text-white/55">
              {result.rubricVersion ?? "delivery-voice-v1 (legacy)"} ·{" "}
              {result.scoringVersion ?? "delivery-voice-v1"}
            </p>
          </details>
        </div>
      </div>
      {!cleanStage && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              disabled={sharing}
              onClick={() => void nativeShare()}
              className="button-secondary"
            >
              <Share2 className="size-4" />
              Share card
            </button>
            <button
              disabled={sharing}
              onClick={() => void saveCard()}
              className="button-ghost"
            >
              <Download className="size-4" />
              Save card
            </button>
            <button onClick={() => void copyLink()} className="button-ghost">
              <Link2 className="size-4" />
              {resultPath ? "Copy score link" : playableLabel}
            </button>
            {audioBlob && (
              <button
                onClick={() => downloadBlob(audioBlob, "delivery-take.wav")}
                className="button-ghost"
              >
                <Download className="size-4" />
                Save audio
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-white/60">
            Card sharing includes the line and score. Your audio stays private
            unless you publish the result or share the downloaded audio
            yourself.
          </p>
          {delivery?.persisted &&
            delivery.id &&
            visibility !== "public" &&
            prompt.rating !== "mature" &&
            !fixture && (
              <div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-xl border border-white/15 p-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-bold">
                    Make this performance public?
                  </p>
                  <p className="mt-1 max-w-lg text-xs leading-5 text-white/65">
                    Publishing exposes this recording and result on your profile
                    and the public feed after a safety check.
                  </p>
                </div>
                <button
                  disabled={publishing}
                  onClick={() => void publishResult()}
                  className="button-secondary shrink-0"
                >
                  {publishing ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Globe2 className="size-4" />
                  )}
                  {publishing ? "Checking…" : "Publish result"}
                </button>
              </div>
            )}
          {prompt.rating === "mature" && (
            <p className="mt-4 text-xs leading-5 text-white/65">
              Mature takes stay private. Public publishing for adult content
              awaits the launch audience policy.
            </p>
          )}
          {resultPath && (
            <Link href={resultPath} className="button-ghost mt-2">
              View public result <ArrowRight className="size-4" />
            </Link>
          )}
        </>
      )}
      {cleanStage && (
        <p className="mono-label mt-5 text-white/60">
          R · next line &nbsp; F · fullscreen
        </p>
      )}
      {warning && (
        <details className="mt-4 rounded-xl border border-white/15 p-4">
          <summary className="cursor-pointer text-xs font-bold text-white/65">
            Session details
          </summary>
          <p className="mt-2 text-xs leading-5 text-white/65">{warning}</p>
        </details>
      )}
      {actionError && (
        <div className="game-error mt-4" role="alert">
          <p>{actionError}</p>
          <Link href={challengePath} className="mt-2 inline-block underline">
            Open this playable line
          </Link>
        </div>
      )}
      {notice && (
        <p className="mt-4 text-sm text-electric" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
