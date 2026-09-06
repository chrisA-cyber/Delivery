"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, AudioLines, Check, CheckCircle2, Clapperboard, Clock3, Copy, ExternalLink, Film, Headphones, Link2, LoaderCircle, LockKeyhole, Mic, RotateCcw, ShieldCheck, Sparkles, Square, Trophy, Users, X } from "lucide-react";
import { ContentControl, CONTENT_LABELS } from "@/components/content/content-control";
import { useApp } from "@/components/providers/app-provider";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { lineRecordingWindows, useLineTakes, type LineWindow } from "@/hooks/use-line-takes";
import { isRatingAllowed } from "@/data/content";
import { cn } from "@/lib/utils";
import { SAY_SCORING_VERSION, type SayAttempt, type SayChallenge, type SayClip, type SayScore } from "@/lib/say-it-back/types";
import { DubPlayer, type DubPlayerHandle } from "./dub-player";
import { TakeWaveform } from "./take-waveform";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 95_000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal, ...init });
    const body = await response.json().catch(() => null) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
    if (!response.ok || !body?.ok || !body.data) throw new Error(body?.error?.message ?? "Something interrupted that request. Your take is still here; please try again.");
    return body.data;
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") throw new Error("That request took too long. Your take is still here. Retry this submission to recover its result.");
    throw cause;
  } finally { clearTimeout(timeout); }
}

function durationLabel(duration: number) { return `${Math.round(duration)} sec`; }
const difficultyLabels = { easy: "Easy", medium: "A little acting", hard: "Bring your A-game" };

function ScorePanel({ score, previousBest }: { score: SayScore; previousBest?: number | null }) {
  const wordsOnly = score.timing == null || score.rhythm == null;
  const title = wordsOnly ? "Here’s how the words matched." : score.overall >= 90 ? "That scene is yours." : score.overall >= 75 ? "You understood the assignment." : score.overall >= 55 ? "There’s a performance in there." : "One more take. You’ve got this.";
  const comparable = !wordsOnly && typeof previousBest === "number";
  return <section className="overflow-hidden rounded-2xl bg-paper text-ink" aria-label="Your matching result">
    <div className="grid gap-5 p-6 sm:grid-cols-[150px_1fr] sm:items-center sm:p-7">
      <div><p className="mono-label text-ink/60">{wordsOnly ? "Words-only result" : "Dialogue match"}</p><p className="display-type mt-2 text-8xl leading-none">{Math.round(score.overall)}<span className="ml-1 font-sans text-lg font-bold tracking-normal text-ink/50">/100</span></p></div>
      <div><h2 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{title}</h2><p className="mt-2 text-sm leading-6 text-ink/70">{score.coachNote}</p>{comparable && <p className="mt-3 flex items-center gap-2 text-xs font-bold"><Trophy className="size-4" />{score.overall > previousBest! ? `New best · +${Math.round(score.overall - previousBest!)} points` : `Previous best: ${Math.round(previousBest!)} · same scene, role, and scoring version`}</p>}</div>
    </div>
    <div className="grid grid-cols-3 gap-4 border-y border-ink/15 px-6 py-5 sm:px-7">
      {([{ name: "Words", value: score.words, weight: score.weights.words }, { name: "Timing", value: score.timing, weight: score.weights.timing }, { name: "Rhythm", value: score.rhythm, weight: score.weights.rhythm }]).map((part) => <div key={part.name}><p className="text-xs font-bold text-ink/65">{part.name}</p><p className="mt-1 text-2xl font-bold">{part.value == null ? "—" : Math.round(part.value)}<span className={cn("text-[10px] font-normal text-ink/55", part.value == null ? "block" : "ml-1")}>{part.value == null ? "unavailable" : "/100"}</span></p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-ink/75" style={{ width: `${part.value ?? 0}%` }} /></div></div>)}
    </div>
    <div className="px-6 py-5 sm:px-7">
      <p className="mb-3 text-xs leading-5 text-ink/65">{wordsOnly ? "Only the words could be measured. This result cannot be compared with full word, timing, and rhythm matches." : `Words ${Math.round(score.weights.words * (score.weights.words <= 1 ? 100 : 1))}% · phrase timing ${Math.round(score.weights.timing * (score.weights.timing <= 1 ? 100 : 1))}% · rhythm ${Math.round(score.weights.rhythm * (score.weights.rhythm <= 1 ? 100 : 1))}%. Emotion and intonation are not scored.`}</p>
      {score.observations.slice(0, 2).map((note, index) => <p key={index} className="mb-2 flex gap-2 text-sm leading-6 text-ink/75"><AudioLines className="mt-1 size-4 shrink-0" />{note}</p>)}
      <details className="mt-4 text-xs leading-6"><summary className="min-h-8 cursor-pointer font-bold text-ink/65">How the match is measured</summary><p className="mt-2">Words carry {Math.round(score.weights.words * (score.weights.words <= 1 ? 100 : 1))}%, phrase timing {Math.round(score.weights.timing * (score.weights.timing <= 1 ? 100 : 1))}%, and rhythm {Math.round(score.weights.rhythm * (score.weights.rhythm <= 1 ? 100 : 1))}%. Timing follows your recording; we do not move words or speed up your voice.</p><p className="mt-2">This version measures dialogue and phrase timing. It does not score your vocal identity, pitch, accent, emotional acting, or attractiveness.</p>{score.limitations.map((note, index) => <p className="mt-2" key={index}>{note}</p>)}<p className="mt-2 break-words text-ink/55">Scoring: {score.version}</p><p className="mt-3 font-bold">Heard dialogue</p><p className="mt-1">{score.transcript || "No reliable transcript available."}</p></details>
    </div>
  </section>;
}

function ClipCard({ clip, index, onSelect }: { clip: SayClip; index: number; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className="group overflow-hidden rounded-2xl border border-white/15 bg-[#20201d] text-left transition-colors hover:border-paper/50">
    <div className="relative aspect-[16/10] overflow-hidden bg-black">
      {/* Curated local/public scene posters are part of the immutable clip assets. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={clip.posterUrl} alt={`${clip.source.title} — ${clip.title}`} loading={index < 3 ? "eager" : "lazy"} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <span className="absolute left-3 top-3 rounded-md bg-ink/85 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-paper">{clip.category}</span>
      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-ink/85 px-2 py-1 text-[10px] font-bold text-paper"><Clock3 className="size-3" />{durationLabel(clip.duration)}</span>
      <span className="absolute bottom-3 left-3 rounded-md bg-paper px-2.5 py-1 text-[10px] font-bold text-ink">{difficultyLabels[clip.difficulty]}</span>
      <span className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-paper/15 text-paper backdrop-blur-sm transition-colors group-hover:bg-acid group-hover:text-ink"><ArrowRight className="size-4" /></span>
    </div>
    <div className="p-4 sm:p-5"><p className="mono-label mb-2 text-white/50">{clip.source.title}</p><h2 className="text-xl font-bold tracking-tight text-paper">{clip.title}</h2><p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-white/60">{clip.description}</p><div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] text-white/55"><span>{CONTENT_LABELS[clip.rating]}</span><span aria-hidden="true">·</span><span>{clip.roles.length === 1 ? "One role" : `${clip.roles.length} roles`}</span>{clip.tags[0] && <><span aria-hidden="true">·</span><span>{clip.tags[0]}</span></>}</div></div>
  </button>;
}

export function SayItBackExperience({ initialClipId, initialRoleId, initialAttemptId, challengeToken, initialClaimId }: { initialClipId?: string; initialRoleId?: string; initialAttemptId?: string; challengeToken?: string; initialClaimId?: string }) {
  const router = useRouter();
  const { authenticated, authReady, contentRating, tier, updatePreferences, refreshAccount } = useApp();
  const [clips, setClips] = useState<SayClip[]>([]);
  const [clip, setClip] = useState<SayClip | null>(null);
  const [roleId, setRoleId] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState<SayAttempt | null>(null);
  const [challenge, setChallenge] = useState<SayChallenge | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [offsetMs, setOffsetMs] = useState(0);
  const [time, setTime] = useState(0);
  const [busy, setBusy] = useState<"upload" | "judge" | "share" | "signin" | null>(null);
  const [remainingMatches, setRemainingMatches] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareConsent, setShareConsent] = useState(false);
  const [challengeConsent, setChallengeConsent] = useState(false);
  const [createdChallenge, setCreatedChallenge] = useState<SayChallenge | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFriend, setShowFriend] = useState(false);
  const [openResponseId, setOpenResponseId] = useState<string | null>(null);
  const [checkingResponses, setCheckingResponses] = useState(false);
  const [responseError, setResponseError] = useState("");
  const [takeNumber, setTakeNumber] = useState(1);
  const [recordingMode, setRecordingMode] = useState<"lines" | "scene">("lines");
  const [selectedLine, setSelectedLine] = useState(0);
  const [activeWindow, setActiveWindow] = useState<LineWindow | null>(null);
  const [editing, setEditing] = useState(true);
  const [matchSeconds, setMatchSeconds] = useState(0);
  const playerRef = useRef<DubPlayerHandle>(null);
  const friendPlayerRef = useRef<DubPlayerHandle>(null);
  const responsePlayerRef = useRef<DubPlayerHandle>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const recorder = useAudioRecorder();
  const lineTakes = useLineTakes();
  const resetLines = lineTakes.reset;
  const acceptLine = lineTakes.accept;
  const { reset, stop, start, cancelCapture, commitCapture, requestPermission, getCapturePositionMs, primeAudioContext } = recorder;
  const recordingRef = useRef(false);
  const countdownToken = useRef(0);
  const submissionId = useRef("");
  const actionInFlight = useRef(false);
  const submissionRun = useRef(0);
  const pendingLine = useRef<{ window: LineWindow; offsetMs: number; previousBlob: Blob | null; previousKind: "lines" | "scene"; interrupted?: boolean } | null>(null);
  const pendingScene = useRef<{ offsetMs: number; previousBlob: Blob | null; previousKind: "lines" | "scene"; interrupted?: boolean } | null>(null);
  const rawCaptureKind = useRef<"lines" | "scene">("scene");
  const initialLoadDone = useRef(false);
  const mounted = useRef(true);
  const role = clip?.roles.find((item) => item.id === roleId) ?? clip?.roles[0];
  const ownCues = useMemo(() => clip?.cues.filter((cue) => cue.roleId === role?.id) ?? [], [clip, role]);
  const lineWindows = useMemo(() => lineRecordingWindows(ownCues, clip?.duration ?? 0), [ownCues, clip]);
  const captureBusy = preparing || recording || countdown != null || lineTakes.assembling;
  const selectedAllowed = !clip || isRatingAllowed(clip.rating, contentRating);
  const localTake = lineTakes.take;
  const audioBlob = localTake?.blob ?? (rawCaptureKind.current === "scene" ? recorder.audioBlob : null);
  const localAudioUrl = localTake?.audioUrl ?? (rawCaptureKind.current === "scene" ? recorder.audioUrl : null);
  const localCanSubmit = localTake?.canSubmit ?? recorder.canSubmit;
  const localDurationMs = localTake?.durationMs ?? recorder.durationMs;
  const takeUrl = localAudioUrl ?? attempt?.audioUrl;
  const fullLineTake = lineTakes.lines.length === 0 || lineTakes.lines.length === ownCues.length;
  const currentScore = attempt?.score;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; countdownToken.current += 1; }; }, []);

  const selectClip = useCallback((next: SayClip, requestedRole?: string) => {
    countdownToken.current += 1; submissionRun.current += 1; actionInFlight.current = false; setBusy(null);
    playerRef.current?.pause();
    friendPlayerRef.current?.pause(); responsePlayerRef.current?.pause();
    setOpenResponseId(null); setShowFriend(false); setResponseError("");
    reset(); resetLines(); pendingLine.current = null; pendingScene.current = null; rawCaptureKind.current = "scene";
    setPreparing(false); setCountdown(null); setRecording(false); recordingRef.current = false;
    setSelectedLine(0); setActiveWindow(null); setEditing(true); setRecordingMode("lines");
    setClip(next);
    setRoleId(next.roles.some((item) => item.id === requestedRole) ? requestedRole! : next.roles[0]?.id ?? "");
    setAttempt(null); setOffsetMs(0); setTime(0); setError(""); setLoadError(""); setNotice(""); setTakeNumber(1); setSharing(false); setCreatedChallenge(null);
    initialLoadDone.current = true;
    submissionId.current = "";
  }, [reset, resetLines]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true); setLoadError("");
    try {
      const data = await api<{ clips: SayClip[]; scoringVersion: string }>(`/api/say-it-back/clips?maxRating=${contentRating}`);
      if (!mounted.current) return;
      setClips(data.clips);
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        let restored: SayAttempt | null = null;
        if (initialClaimId) {
          const path = `/api/say-it-back/attempts/${encodeURIComponent(initialClaimId)}`;
          const claimed = await api<{ attempt: SayAttempt }>(authenticated ? `${path}/claim` : path, authenticated ? { method: "POST" } : undefined);
          if (!mounted.current) return;
          restored = claimed.attempt;
          selectClip(restored.clip, restored.roleId); setAttempt(restored); setOffsetMs(restored.recordingOffsetMs); setEditing(false);
          setNotice(authenticated ? "Your guest take is now saved privately to your account." : "Your guest take is still here. Sign in on this browser within 24 hours to keep it.");
          if (authenticated) void refreshAccount();
        } else if (initialAttemptId) {
          const saved = await api<{ attempt: SayAttempt }>(`/api/say-it-back/attempts/${encodeURIComponent(initialAttemptId)}`);
          if (!mounted.current) return;
          restored = saved.attempt;
          selectClip(restored.clip, restored.roleId); setAttempt(restored); setOffsetMs(restored.recordingOffsetMs); setEditing(false);
        }
        if (challengeToken) {
          const loaded = await api<{ challenge: SayChallenge }>(`/api/say-it-back/challenges/${encodeURIComponent(challengeToken)}?maxRating=${contentRating}`);
          if (!mounted.current) return;
          if (!restored || (restored.clip.id === loaded.challenge.clip.id && restored.clip.version === loaded.challenge.clip.version && restored.roleId === loaded.challenge.roleId)) {
            setChallenge(loaded.challenge);
            if (!restored) {
              selectClip(loaded.challenge.clip, loaded.challenge.roleId);
              const previous = loaded.challenge.recipientAttempts.find((item) => item.owned && item.status === "scored");
              if (previous) { setAttempt(previous); setOffsetMs(previous.recordingOffsetMs); }
            }
          }
        } else if (!restored && initialClipId) {
          const chosen = data.clips.find((item) => item.id === initialClipId);
          if (chosen) selectClip(chosen, initialRoleId);
          else setLoadError("That scene is unavailable with your current content setting. Choose another scene or change the filter.");
        }
      }
    } catch (cause) { if (mounted.current) { initialLoadDone.current = false; setLoadError(cause instanceof Error ? cause.message : "The scenes could not load."); } }
    finally { if (mounted.current) setCatalogLoading(false); }
  }, [contentRating, initialAttemptId, initialClaimId, challengeToken, initialClipId, initialRoleId, selectClip, authenticated, refreshAccount]);

  useEffect(() => { if (authReady) void loadCatalog(); }, [authReady, loadCatalog]);

  useEffect(() => {
    if (!authReady || catalogLoading || loadError) return;
    const destination = new URLSearchParams();
    if (attempt) destination.set("attempt", attempt.id);
    else if (clip && role) { destination.set("clip", clip.id); destination.set("role", role.id); }
    if (challenge) destination.set("challenge", challenge.token);
    // An uploaded take can survive a refresh without keeping raw audio in
    // browser storage. Its private endpoint still checks the account/device.
    window.history.replaceState(window.history.state, "", `/say-it-back${destination.size ? `?${destination}` : ""}`);
  }, [authReady, catalogLoading, loadError, attempt, clip, role, challenge]);

  const finishRecording = useCallback(() => {
    if (!recordingRef.current) return;
    recordingRef.current = false; stop(); playerRef.current?.pause(); setRecording(false);
  }, [stop]);

  const updateSceneTime = useCallback((seconds: number) => {
    setTime(seconds);
    const pending = pendingLine.current;
    if (recordingRef.current && pending && seconds >= pending.window.end) finishRecording();
  }, [finishRecording]);

  useEffect(() => {
    const pending = pendingLine.current;
    if (!pending || !clip || recorder.status !== "stopped" || !recorder.audioBlob || recorder.audioBlob === pending.previousBlob) return;
    pendingLine.current = null;
    if (!recorder.canSubmit || pending.interrupted || recorder.stopReason === "interrupted" || recorder.stopReason === "hidden") {
      setActiveWindow(null);
      rawCaptureKind.current = pending.previousKind;
      cancelCapture();
      setError(!recorder.canSubmit ? recorder.qualityMessage || "No usable audio arrived. Try this line again." : "That line was interrupted. Your other lines are unchanged; try this line again.");
      return;
    }
    const token = countdownToken.current;
    void acceptLine({ cueId: pending.window.cue.id, blob: recorder.audioBlob, sceneStart: pending.window.start, sceneEnd: pending.window.end, recordingOffsetMs: pending.offsetMs }, clip.duration).then((accepted) => {
      if (!accepted || !mounted.current || token !== countdownToken.current) return;
      commitCapture();
      setAttempt(null); setOffsetMs(0); setCreatedChallenge(null); setSharing(false);
      submissionId.current = crypto.randomUUID();
      const index = lineWindows.findIndex((window) => window.cue.id === pending.window.cue.id);
      setSelectedLine(Math.min(lineWindows.length - 1, index + 1));
      setActiveWindow(null);
      setNotice(`Line ${index + 1} kept. ${index + 1 < lineWindows.length ? "Start the next line when you’re ready, or redo any line." : "Replay your dub, or redo any line below."}`);
    }).catch(() => { if (mounted.current && token === countdownToken.current) { rawCaptureKind.current = pending.previousKind; cancelCapture(); setError("That line could not be added. Your previous lines are still here; try again."); } });
  }, [recorder.status, recorder.audioBlob, recorder.canSubmit, recorder.qualityMessage, recorder.stopReason, clip, acceptLine, lineWindows, commitCapture, cancelCapture]);

  useEffect(() => {
    const pending = pendingScene.current;
    if (!pending || recorder.status !== "stopped" || !recorder.audioBlob || recorder.audioBlob === pending.previousBlob) return;
    pendingScene.current = null;
    if (!recorder.canSubmit || pending.interrupted || recorder.stopReason === "interrupted" || recorder.stopReason === "hidden") {
      rawCaptureKind.current = pending.previousKind;
      cancelCapture();
      setError("That recording was interrupted or unusable. Your previous take is unchanged; record again when ready.");
      return;
    }
    commitCapture(); resetLines(); rawCaptureKind.current = "scene";
    setOffsetMs(pending.offsetMs); setAttempt(null); setEditing(false);
  }, [recorder.status, recorder.audioBlob, recorder.canSubmit, recorder.stopReason, cancelCapture, commitCapture, resetLines]);

  useEffect(() => {
    if (recording && (recorder.status === "stopped" || recorder.status === "error")) {
      recordingRef.current = false; setRecording(false); playerRef.current?.pause();
    }
  }, [recording, recorder.status]);

  useEffect(() => {
    if (!audioBlob || attempt) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [audioBlob, attempt]);

  useEffect(() => {
    if (busy !== "judge") { setMatchSeconds(0); return; }
    const start = Date.now();
    const timer = setInterval(() => setMatchSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const cancelCountdown = () => {
    countdownToken.current += 1; pendingLine.current = null; pendingScene.current = null; setPreparing(false); setActiveWindow(null); setCountdown(null); cancelCapture(); playerRef.current?.pause(); actionInFlight.current = false; setNotice(takeUrl ? "Countdown cancelled. Your previous take is unchanged." : "Countdown cancelled. Start again when you’re ready.");
  };

  const beginRecording = async (window?: LineWindow) => {
    if (busy === "judge") { submissionRun.current += 1; actionInFlight.current = false; setBusy(null); }
    if (!clip || !role || actionInFlight.current || captureBusy) return;
    actionInFlight.current = true; setPreparing(true); setError(""); setNotice(""); setShowFriend(false);
    friendPlayerRef.current?.pause(); responsePlayerRef.current?.pause(); setOpenResponseId(null);
    const token = ++countdownToken.current;
    try {
      primeAudioContext();
      if (!await requestPermission()) { cancelCapture(); return; }
      if (token !== countdownToken.current || !mounted.current) { cancelCapture(); return; }
      if (window && lineTakes.lines.length === 0 && takeUrl) {
        // Re-editing a saved full take keeps the other lines too. The original
        // private playback endpoint still authorizes this download.
        let base = audioBlob;
        if (!base) {
          setNotice("Opening your previous lines so only this line changes…");
          const response = await fetch(takeUrl, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
          if (!response.ok) throw new Error("Your previous take could not load. Retry before replacing a line.");
          base = await response.blob();
        }
        if (token !== countdownToken.current || !mounted.current) { cancelCapture(); return; }
        lineTakes.seed(base, lineWindows, attempt && !localAudioUrl ? attempt.recordingOffsetMs : offsetMs);
        setNotice("");
      }
      playerRef.current?.prepare(window?.start ?? 0);
      setActiveWindow(window ?? null);
      sceneRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
      for (let count = 3; count > 0; count -= 1) {
        if (token !== countdownToken.current || !mounted.current) return;
        setCountdown(count);
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      if (token !== countdownToken.current || !mounted.current) return;
      setCountdown(0);
      if (!await start({ preservePreviousTake: true })) { cancelCapture(); playerRef.current?.pause(); setActiveWindow(null); setCountdown(null); return; }
      // Let the first input block establish the PCM origin, then measure only
      // the small technical pre-roll at scene playback startup.
      const deadline = performance.now() + 250;
      while (getCapturePositionMs() == null && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
      if (token !== countdownToken.current || !mounted.current) { cancelCapture(); playerRef.current?.pause(); return; }
      const sceneTime = await playerRef.current?.startScene();
      if (token !== countdownToken.current || !mounted.current) { cancelCapture(); playerRef.current?.pause(); return; }
      const capturePosition = getCapturePositionMs();
      if (sceneTime == null || capturePosition == null) throw new Error("The microphone could not synchronize with the scene. Please try recording again.");
      const measuredOffset = Math.round(capturePosition - (sceneTime - (window?.start ?? 0)) * 1000);
      if (Math.abs(measuredOffset) > 300) throw new Error("The scene took too long to start in sync. Let it load, then record again.");
      const previousKind = rawCaptureKind.current;
      rawCaptureKind.current = window ? "lines" : "scene";
      if (window) pendingLine.current = { window, offsetMs: measuredOffset, previousBlob: recorder.audioBlob, previousKind };
      else { pendingScene.current = { offsetMs: measuredOffset, previousBlob: recorder.audioBlob, previousKind }; pendingLine.current = null; }
      if (takeUrl) setTakeNumber((number) => number + 1);
      setCreatedChallenge(null); setSharing(false); setCountdown(null);
      setChallengeConsent(false);
      submissionId.current = crypto.randomUUID(); recordingRef.current = true; setRecording(true);
    } catch (cause) {
      pendingLine.current = null; pendingScene.current = null; setActiveWindow(null); cancelCapture(); playerRef.current?.pause(); setCountdown(null); recordingRef.current = false; setRecording(false);
      setError(cause instanceof Error ? cause.message : "Recording could not start. Please try again.");
    } finally { if (token === countdownToken.current) { actionInFlight.current = false; setPreparing(false); } }
  };

  const refreshPlayback = useCallback(async () => {
    if (!attempt) throw new Error("No saved take");
    const next = await api<{ attempt: SayAttempt }>(`/api/say-it-back/attempts/${encodeURIComponent(attempt.id)}`);
    setAttempt((current) => current?.id === next.attempt.id ? next.attempt : current);
  }, [attempt]);

  const uploadTake = useCallback(async () => {
    if (attempt) return attempt;
    if (!clip || !role || !audioBlob || !localCanSubmit) throw new Error("Record a usable take before saving it.");
    if (challenge && !challengeConsent) throw new Error("Choose the sharing checkbox below before saving this challenge response. Your take is still here.");
    const form = new FormData();
    form.set("audio", audioBlob, "say-it-back.wav");
    form.set("clipId", clip.id); form.set("clipVersion", clip.version); form.set("roleId", role.id);
    form.set("durationMs", String(localDurationMs)); form.set("recordingOffsetMs", String(offsetMs));
    form.set("attemptId", submissionId.current || (submissionId.current = crypto.randomUUID())); form.set("maxRating", contentRating);
    if (challenge) { form.set("challengeToken", challenge.token); form.set("shareAudio", "true"); }
    const uploaded = (await api<{ attempt: SayAttempt }>("/api/say-it-back/attempts", { method: "POST", body: form })).attempt;
    if (mounted.current) setAttempt(uploaded);
    return uploaded;
  }, [attempt, clip, role, audioBlob, localCanSubmit, localDurationMs, offsetMs, contentRating, challenge, challengeConsent]);

  const signInAndKeepTake = useCallback(async () => {
    if (actionInFlight.current || captureBusy) return;
    actionInFlight.current = true; setBusy("signin"); setError("");
    try {
      const retained = attempt ?? (audioBlob ? await uploadTake() : null);
      const destination = new URLSearchParams();
      if (retained) destination.set(retained.saved ? "attempt" : "claim", retained.id);
      else if (clip && role) { destination.set("clip", clip.id); destination.set("role", role.id); }
      if (challenge) destination.set("challenge", challenge.token);
      router.push(`/login?next=${encodeURIComponent(`/say-it-back${destination.size ? `?${destination}` : ""}`)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your take could not be kept yet. Please try again before signing in."); }
    finally { actionInFlight.current = false; if (mounted.current) setBusy(null); }
  }, [attempt, audioBlob, uploadTake, captureBusy, clip, role, challenge, router]);

  const saveWithoutScoring = async () => {
    if (actionInFlight.current || captureBusy) return;
    actionInFlight.current = true; setBusy("upload"); setError("");
    try {
      let saved = await uploadTake();
      if (!saved.saved) saved = (await api<{ attempt: SayAttempt }>(`/api/say-it-back/attempts/${encodeURIComponent(saved.id)}/claim`, { method: "POST" })).attempt;
      if (!mounted.current) return;
      setAttempt(saved); setNotice("Saved in your history. Replay or finish matching whenever you’re ready.");
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Your take could not be saved. It is still available above."); }
    finally { actionInFlight.current = false; if (mounted.current) setBusy(null); }
  };

  // Header sign-in is another entrance to the same save flow. Keep the selected
  // scene and guest ownership receipt even when the player uses that shortcut.
  useEffect(() => {
    if (authenticated || !clip) return;
    const keepTakeBeforeAuth = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const target = new URL(anchor.href, window.location.origin);
      if (target.origin !== window.location.origin || target.pathname !== "/login") return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (captureBusy) { setNotice("Finish this recording, then sign in to keep your take."); return; }
      void signInAndKeepTake();
    };
    document.addEventListener("click", keepTakeBeforeAuth, true);
    return () => document.removeEventListener("click", keepTakeBeforeAuth, true);
  }, [authenticated, clip, captureBusy, signInAndKeepTake]);

  const submit = async () => {
    if (!clip || !role || actionInFlight.current || captureBusy || !fullLineTake || (!attempt && (!audioBlob || !localCanSubmit))) return;
    if (challenge && !challengeConsent && !attempt) { setError("Choose whether to share this challenge take before submitting."); return; }
    actionInFlight.current = true; setError(""); setNotice("");
    const run = ++submissionRun.current;
    try {
      let current = attempt;
      if (!current) {
        setBusy("upload");
        current = await uploadTake();
        if (!mounted.current || run !== submissionRun.current) return;
        setAttempt(current);
      }
      if (current.status !== "scored") {
        setBusy("judge");
        const judged = await api<{ attempt: SayAttempt; usage?: { remaining: number | null } }>(`/api/say-it-back/attempts/${encodeURIComponent(current.id)}/judge`, { method: "POST" });
        current = judged.attempt;
        if (!mounted.current || run !== submissionRun.current) return;
        setAttempt(current);
        if (judged.usage) setRemainingMatches(judged.usage.remaining);
      }
      if (current.status === "scored") {
        setEditing(false);
        setNotice(current.saved ? "Saved privately. Find this exact scene and your take in history." : "Your guest take is ready. Sign in for your personal history.");
        void refreshAccount();
        if (challenge) void api<{ challenge: SayChallenge }>(`/api/say-it-back/challenges/${encodeURIComponent(challenge.token)}?maxRating=${contentRating}`).then((data) => setChallenge(data.challenge)).catch(() => undefined);
      }
    } catch (cause) { if (mounted.current && run === submissionRun.current) setError(cause instanceof Error ? cause.message : "Your take could not be scored. It is still available to replay."); }
    finally { if (run === submissionRun.current) { actionInFlight.current = false; if (mounted.current) setBusy(null); } }
  };

  const retake = () => {
    if (captureBusy || (busy && busy !== "judge")) return;
    // A slow score belongs to its submitted take. It must neither lock the
    // recorder nor overwrite a newer performance when its response arrives.
    submissionRun.current += 1; actionInFlight.current = false; setBusy(null);
    playerRef.current?.pause();
    setEditing(true); setError(""); setSharing(false); setCreatedChallenge(null);
    setSelectedLine(0);
    setNotice("Choose a line to redo, or record the full scene. Your previous take stays here until a replacement is ready.");
    sceneRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const previewLine = async (window: LineWindow) => {
    if (captureBusy) return;
    friendPlayerRef.current?.pause(); responsePlayerRef.current?.pause();
    setError("");
    try { await playerRef.current?.previewRange(window.start, window.end); }
    catch { setError("That line is still loading. Tap Listen again when the scene is ready."); }
  };

  const createChallenge = async () => {
    if (!attempt || !shareConsent || actionInFlight.current) return;
    actionInFlight.current = true; setBusy("share"); setError("");
    try {
      let saved = attempt;
      if (!saved.saved) {
        saved = (await api<{ attempt: SayAttempt }>(`/api/say-it-back/attempts/${encodeURIComponent(saved.id)}/claim`, { method: "POST" })).attempt;
        setAttempt(saved);
      }
      const created = await api<{ challenge: SayChallenge }>("/api/say-it-back/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptId: saved.id, shareAudio: true }) });
      setCreatedChallenge(created.challenge);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The challenge link could not be created."); }
    finally { actionInFlight.current = false; setBusy(null); }
  };

  const copyChallenge = async () => {
    if (!createdChallenge) return;
    try { await navigator.clipboard.writeText(new URL(createdChallenge.url, window.location.origin).href); setCopied(true); }
    catch { setNotice("Select and copy the challenge link below."); }
  };

  const backToScenes = () => {
    submissionRun.current += 1; countdownToken.current += 1; actionInFlight.current = false; setBusy(null);
    playerRef.current?.pause(); friendPlayerRef.current?.pause(); responsePlayerRef.current?.pause(); reset(); resetLines(); pendingLine.current = null; rawCaptureKind.current = "scene"; setClip(null); setAttempt(null); setChallenge(null); setError(""); setNotice(""); setCreatedChallenge(null); setSharing(false); setOpenResponseId(null);
    setLoadError(""); initialLoadDone.current = true;
  };

  const checkResponses = async () => {
    if (!challenge || checkingResponses) return;
    setCheckingResponses(true); setResponseError("");
    try {
      const refreshed = (await api<{ challenge: SayChallenge }>(`/api/say-it-back/challenges/${encodeURIComponent(challenge.token)}?maxRating=${contentRating}`)).challenge;
      setChallenge((current) => current?.id === refreshed.id ? refreshed : current);
    }
    catch (cause) { setResponseError(cause instanceof Error ? cause.message : "Responses could not refresh. Try again."); }
    finally { setCheckingResponses(false); }
  };

  if (!clip || !role) return <main className="min-h-screen px-4 pb-28 pt-28 sm:px-8 sm:pt-32"><div className="mx-auto max-w-[1184px]">
    <header className="mb-9 grid gap-7 border-b border-white/15 pb-8 lg:grid-cols-[1.15fr_1fr] lg:items-end">
      <div><p className="mono-label mb-4 flex items-center gap-2 text-hot"><Clapperboard className="size-4" />A scene. A mic. Your moment.</p><h1 className="display-type text-[clamp(4.2rem,10vw,7.5rem)] leading-[.86]">SAY IT <span className="text-hot">BACK.</span></h1></div>
      <div><p className="max-w-lg text-lg leading-7 text-white/75">Watch a real scene. Step into a role. Hear your voice take over the screen.</p><div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-white/55"><span className="flex items-center gap-1.5"><Mic className="size-4 text-acid" />Mic only. No camera.</span><span className="flex items-center gap-1.5"><Users className="size-4 text-electric" />Solo or against a friend.</span></div></div>
    </header>
    <div className="mb-8 grid grid-cols-3 overflow-hidden rounded-xl border border-white/15 bg-[#20201d]">
      {([{ icon: Film, label: "Watch the scene", sub: "Catch the words and timing" }, { icon: Mic, label: "Make it yours", sub: "Record and redo each line" }, { icon: Headphones, label: "Watch your dub", sub: "Get a match. Go again." }]).map((step, index) => <div key={step.label} className={cn("flex min-w-0 flex-col gap-2 px-3 py-4 sm:flex-row sm:items-center sm:gap-3 sm:p-5", index > 0 && "border-l border-white/15")}><step.icon className="size-5 shrink-0 text-hot" /><div><p className="text-xs font-bold sm:text-sm">{step.label}</p><p className="mt-1 hidden text-xs text-white/50 sm:block">{step.sub}</p></div></div>)}
    </div>
    <p className="mb-6 text-xs leading-6 text-white/60">{tier === "pro" ? "Record, replay, and match your scenes with your Pro allowance." : "5 scored plays per day, shared with Classic. Recording and replaying are free. Resets at midnight UTC."}{!authenticated && " Start as a guest; sign in to keep a take in your history or create a challenge."}</p>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">Choose your scene</h2><p className="mt-1 text-xs leading-5 text-white/55">Longer scenes first. Record their dialogue one line at a time.</p></div><ContentControl compact value={contentRating} onChange={(rating) => updatePreferences({ contentRating: rating })} /></div>
    {loadError && <div className="game-error mb-6" role="alert">{loadError}{initialClaimId && !authenticated && <Link className="ml-3 underline" href={`/login?next=${encodeURIComponent(`/say-it-back?claim=${initialClaimId}`)}`}>Sign in</Link>}<button type="button" onClick={() => void loadCatalog()} className="ml-3 underline">Try again</button></div>}
    {catalogLoading && clips.length === 0 ? <div role="status" className="flex min-h-56 items-center justify-center gap-3 text-sm text-white/60"><LoaderCircle className="size-5 animate-spin" />Opening the scene collection…</div> : clips.length === 0 ? <div className="panel p-8 text-center"><p className="font-bold">No scenes are available with this filter yet.</p><p className="mt-2 text-sm text-white/60">Try another content setting or check back when the collection is ready.</p></div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[...clips].sort((a, b) => b.duration - a.duration).map((item, index) => <ClipCard key={`${item.id}:${item.version}`} clip={item} index={index} onSelect={() => selectClip(item)} />)}</div>}
    <p className="mt-8 flex items-start gap-2 text-xs leading-6 text-white/50"><ShieldCheck className="mt-1 size-4 shrink-0" />Curated real footage with source credits in every scene. Your recordings stay private unless you choose to share a challenge.</p>
  </div></main>;

  const friendScore = challenge?.challengerAttempt.score;
  const challengeOwner = Boolean(challenge?.challengerAttempt.owned);
  const friendResponses = challengeOwner ? (challenge?.recipientAttempts ?? []).filter((response) => !response.owned && response.status === "scored" && response.score != null && response.score.version === challenge?.scoringVersion && response.score.timing != null && response.score.rhythm != null) : [];
  const comparableChallenge = currentScore && friendScore && currentScore.timing != null && currentScore.rhythm != null && friendScore.timing != null && friendScore.rhythm != null && currentScore.version === friendScore.version;
  const canTryAgain = (!busy || busy === "judge") && !captureBusy;

  return <main className="min-h-screen px-4 pb-16 pt-[96px] sm:px-8 sm:pt-28"><div className="mx-auto max-w-[1184px]">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><button type="button" className="button-ghost -ml-3 px-3" disabled={!canTryAgain} onClick={backToScenes}><ArrowLeft className="size-4" />All scenes</button><div className="flex items-center gap-3"><Link href="/play" className="text-xs text-white/55 hover:text-white">Classic</Link><span className="h-4 w-px bg-white/20" /><span className="mono-label text-hot">Say It Back</span></div></div>
    {loadError && <div className="game-error mb-5" role="alert">{loadError}<button type="button" disabled={Boolean(busy) || captureBusy} onClick={() => void loadCatalog()} className="ml-3 underline">Try again</button></div>}
    {challenge && selectedAllowed && <section className="mb-5 rounded-xl border border-hot/35 bg-hot/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="mono-label text-hot">Friend challenge</p><h2 className="mt-1 text-lg font-bold">{challengeOwner ? "You set the scene." : `${challenge.challengerName} set the scene.`}{friendScore ? (challengeOwner ? ` Your ${Math.round(friendScore.overall)} is the score to beat.` : ` Can you beat ${Math.round(friendScore.overall)}?`) : " Your turn."}</h2><p className="mt-1 text-xs leading-5 text-white/60">{challengeOwner ? "Share this page’s link to invite a friend to this scene and role." : `Watch the original, then record ${role.name}’s lines. Score and share your take with ${challenge.challengerName} to compare words, timing, and rhythm.`}</p>{!challengeOwner && !authenticated && <p className="mt-1 text-xs leading-5 text-white/60">You can respond as a guest. Sign in afterward to keep your take.</p>}</div>
        <button type="button" className="button-secondary" onClick={() => { playerRef.current?.pause(); responsePlayerRef.current?.pause(); setShowFriend(!showFriend); }} disabled={captureBusy}>{challengeOwner ? (showFriend ? "Close your take" : "Watch your challenge take") : (showFriend ? "Close friend’s take" : "Watch friend’s take")}<Headphones className="size-4" /></button>
      </div>
      {showFriend && <div className="mt-4 max-w-xl"><DubPlayer takeLabel={challengeOwner ? "Your take" : "Friend’s take"} ref={friendPlayerRef} onPlaybackStart={() => { playerRef.current?.pause(); responsePlayerRef.current?.pause(); }} clip={challenge.clip} role={challenge.clip.roles.find((item) => item.id === challenge.roleId)!} takeUrl={challenge.challengerAttempt.audioUrl} recordingOffsetMs={challenge.challengerAttempt.recordingOffsetMs} /></div>}
      {challengeOwner && <div className="mt-5 border-t border-hot/20 pt-4" aria-label="Friend responses">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">Friend responses{friendResponses.length > 0 ? ` · ${friendResponses.length}` : ""}</h3><button type="button" className="button-ghost min-h-10 px-2 text-xs" disabled={captureBusy || checkingResponses} onClick={() => void checkResponses()}>{checkingResponses ? <LoaderCircle className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}Check responses</button></div>
        {friendResponses.length === 0 ? <p className="mt-1 text-xs leading-6 text-white/60">Your friends’ shared, scored takes will appear here. Send them the challenge link to get started.</p> : <div className="mt-2 space-y-3">{friendResponses.map((response, index) => {
          const score = response.score!;
          const difference = friendScore ? Math.round(score.overall - friendScore.overall) : null;
          const responseRole = response.clip.roles.find((item) => item.id === response.roleId)!;
          return <div key={response.id} className="rounded-xl border border-white/15 bg-ink/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-white/60">Response {index + 1}</p><p className="mt-1 flex items-baseline gap-2"><span className="text-3xl font-bold">{Math.round(score.overall)}</span><span className="text-xs text-white/60">/100{difference === 0 ? " · Tied with your take" : difference == null ? "" : difference > 0 ? ` · ${difference} ahead of your take` : ` · ${Math.abs(difference)} behind your take`}</span></p></div><button type="button" className="button-secondary" disabled={captureBusy} onClick={() => { playerRef.current?.pause(); friendPlayerRef.current?.pause(); responsePlayerRef.current?.pause(); setOpenResponseId(openResponseId === response.id ? null : response.id); }}><Headphones className="size-4" />{openResponseId === response.id ? "Close response" : "Listen"}</button></div>
            {openResponseId === response.id && <div className="mt-4 max-w-xl"><DubPlayer ref={responsePlayerRef} takeLabel="Friend’s take" clip={response.clip} role={responseRole} takeUrl={response.audioUrl} recordingOffsetMs={response.recordingOffsetMs} onPlaybackStart={() => { playerRef.current?.pause(); friendPlayerRef.current?.pause(); }} /></div>}
          </div>;
        })}</div>}
        {responseError && <p role="alert" className="mt-3 text-xs leading-5 text-[#ffbcaa]">{responseError}</p>}
      </div>}
    </section>}
    {!selectedAllowed ? <section className="panel p-7"><h1 className="text-2xl font-bold">This scene is outside your content setting.</h1><p className="my-4 text-sm text-white/65">It is classified {CONTENT_LABELS[clip.rating]}. Choose the appropriate setting to open the scene and its recordings.</p><ContentControl value={contentRating} onChange={(rating) => updatePreferences({ contentRating: rating })} /></section> : <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="mono-label mb-2 text-white/50">{clip.source.title}</p><h1 className="text-[clamp(1.7rem,4vw,2.7rem)] font-bold leading-tight tracking-tight">{clip.title}</h1></div><div className="flex flex-wrap items-center gap-2 text-xs text-white/65"><span className="rounded-md border border-white/15 px-2.5 py-1.5">{durationLabel(clip.duration)}</span><span className="rounded-md border border-white/15 px-2.5 py-1.5">{difficultyLabels[clip.difficulty]}</span><span className="rounded-md border border-white/15 px-2.5 py-1.5">{CONTENT_LABELS[clip.rating]}</span></div></div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(285px,1fr)]">
        <div ref={sceneRef} className="min-w-0 scroll-mt-24 space-y-5">
          {!takeUrl && !captureBusy && <div className="rounded-xl border border-hot/25 bg-hot/[0.07] px-4 py-3 text-sm leading-6"><p className="font-bold">You’re playing {role.name}.</p><p className="mt-1 text-white/65">Listen to the scene, then record one line at a time. Each line waits for you. You can redo a line without starting over.</p></div>}
          <DubPlayer key={`${clip.id}:${clip.version}:${role.id}`} ref={playerRef} clip={clip} role={role} takeUrl={takeUrl} recordingOffsetMs={attempt && !localAudioUrl ? attempt.recordingOffsetMs : offsetMs} recording={recording} countdown={countdown} onCancelCountdown={cancelCountdown} onEnded={finishRecording} onTime={updateSceneTime} onPlaybackStart={() => { friendPlayerRef.current?.pause(); responsePlayerRef.current?.pause(); }} onAudioError={refreshPlayback} onInterruption={() => { if (pendingLine.current) pendingLine.current.interrupted = true; if (pendingScene.current) pendingScene.current.interrupted = true; finishRecording(); setError("Scene playback was interrupted, so recording stopped to preserve timing. Replay your partial take, or let the scene load and retake."); }} />
          <section className="rounded-2xl border border-white/15 bg-[#20201d] p-4 sm:p-5" aria-label="Recording controls">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><p className="mono-label text-white/50">Your recording · take {takeNumber}</p><h2 className="mt-1 text-lg font-bold">{captureBusy ? activeWindow ? `Recording line ${lineWindows.findIndex((item) => item.cue.id === activeWindow.cue.id) + 1}` : "Recording the scene" : editing ? "Take your time. One line at a time." : "Ready for another go?"}</h2></div>
              {!captureBusy && <div className="flex rounded-lg border border-white/15 p-1" role="group" aria-label="Recording approach">{(["lines", "scene"] as const).map((mode) => <button key={mode} type="button" aria-pressed={recordingMode === mode} disabled={Boolean(busy && busy !== "judge")} onClick={() => { setRecordingMode(mode); setEditing(true); }} className={cn("min-h-10 rounded-md px-3 text-xs font-bold", recordingMode === mode ? "bg-paper text-ink" : "text-white/60")}>{mode === "lines" ? "Line by line" : "Full scene"}</button>)}</div>}
            </div>
            {(editing || captureBusy) && <>
              <TakeWaveform referenceUrl={clip.referenceAudioUrl} duration={clip.duration} rangeStart={recordingMode === "lines" ? (activeWindow ?? lineWindows[selectedLine])?.start : 0} rangeEnd={recordingMode === "lines" ? (activeWindow ?? lineWindows[selectedLine])?.end : clip.duration} playhead={time} takeWaveform={localTake?.waveform ?? (recorder.waveform ?? []).map((point) => ({ ...point, time: point.time - offsetMs / 1000 }))} liveWaveform={recorder.waveform} liveStart={(activeWindow?.start ?? 0) - (pendingLine.current?.offsetMs ?? pendingScene.current?.offsetMs ?? offsetMs) / 1000} recording={recording} />
              {recordingMode === "lines" && <div className="mb-4 mt-4 space-y-2" aria-label="Record individual lines">{lineWindows.map((window, index) => {
                if (captureBusy && activeWindow && activeWindow.cue.id !== window.cue.id) return null;
                const kept = lineTakes.lines.some((item) => item.cueId === window.cue.id);
                const selected = (activeWindow?.cue.id ?? lineWindows[selectedLine]?.cue.id) === window.cue.id;
                return <div key={window.cue.id} className={cn("rounded-xl border p-3", selected ? "border-acid/60 bg-acid/5" : "border-white/10 bg-black/10")}>
                  <button type="button" disabled={captureBusy} onClick={() => setSelectedLine(index)} className="w-full text-left"><span className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-white/50"><span>Line {index + 1} · {window.cue.start.toFixed(1)}s</span>{kept && <span className="flex items-center gap-1 text-acid"><Check className="size-3" />Kept</span>}</span><span className="mt-1 block text-sm font-bold leading-6">{window.cue.text}</span></button>
                  <div className="mt-2 flex flex-wrap gap-2"><button type="button" className="button-secondary min-h-10 px-3 py-2 text-xs" disabled={captureBusy} onClick={() => { setSelectedLine(index); void previewLine(window); }} aria-label={`Listen to original line ${index + 1}`}><Headphones className="size-3.5" />Listen</button><button type="button" className="button-primary min-h-10 px-3 py-2 text-xs" disabled={captureBusy || Boolean(busy && busy !== "judge") || recorder.status === "requesting"} onClick={() => { setSelectedLine(index); void beginRecording(window); }} aria-label={`${kept ? "Redo" : "Record"} line ${index + 1}`}><Mic className="size-3.5" />{kept ? "Redo line" : "Record line"}</button></div>
                </div>;
              })}</div>}
              {recorder.isClipping && <p className="mt-2 text-xs text-acid" role="status">Your input is clipping. Move a little farther from the microphone.</p>}
              {captureBusy ? <div className="mt-4">{lineTakes.assembling ? <p role="status" className="flex items-center gap-2 text-sm"><LoaderCircle className="size-4 animate-spin" />Preparing your local preview…</p> : (countdown != null || preparing) ? <button type="button" className="button-secondary w-full" onClick={cancelCountdown}><X className="size-4" />Cancel countdown</button> : <button type="button" className="button-primary w-full" onClick={finishRecording}><Square className="size-4 fill-current" />{activeWindow ? "Finish this line" : "Stop recording"}</button>}</div> : recordingMode === "scene" ? <button type="button" className="button-primary mt-4 min-h-12 w-full" disabled={Boolean(busy && busy !== "judge") || recorder.status === "requesting"} onClick={() => void beginRecording()}><Mic className="size-4" />{recorder.status === "requesting" ? "Opening microphone…" : "Record full scene"}</button> : <p className="mt-3 text-xs leading-5 text-white/60">{lineTakes.lines.length > 0 ? `${lineTakes.lines.length} of ${ownCues.length} lines kept. ` : ""}Press Record for any line. You get a 3-second countdown, and we wait for you before the next line. Redo only what you want to change.</p>}
              <p className="mt-3 text-[11px] leading-5 text-white/45">Scene audio is muted during capture. Follow the original waveform and captions; your voice is never sped up or aligned to improve the match.</p>
            </>}
            {takeUrl && !captureBusy && <div className="mt-4 border-t border-white/10 pt-4">
              {!currentScore && <>{challenge && !attempt && <label className="mb-4 flex cursor-pointer gap-2.5 text-xs leading-5 text-white/75"><input type="checkbox" checked={challengeConsent} onChange={(event) => setChallengeConsent(event.target.checked)} className="mt-1 size-4 shrink-0 accent-acid" />Share this take with the friend who created this challenge so we can compare our dubs.</label>}<button type="button" className="button-primary min-h-12 w-full" disabled={Boolean(busy) || !fullLineTake || (!attempt && !localCanSubmit) || Boolean(challenge && !attempt && !challengeConsent)} onClick={() => void submit()}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{busy === "upload" ? "Saving your take…" : busy === "judge" ? `Checking your match… ${matchSeconds}s` : !fullLineTake ? "Record the remaining lines to match" : attempt?.status === "failed" || error ? "Retry this take" : challenge ? "Score & share my take" : "Get my match"}</button><p className="mt-2 text-xs leading-5 text-white/55">{busy === "judge" ? "Your dub is ready to play now. You can also start another take while this result finishes." : attempt ? "This take is already uploaded. Retrying uses the same submission." : "Your voice plays from this device without an upload wait. Getting a match uses one scored play."}</p></>}
              <button type="button" className="button-secondary mt-3 w-full" onClick={retake} disabled={!canTryAgain}><RotateCcw className="size-4" />Record another take</button>
              {currentScore && <><button type="button" className="button-primary mt-3 w-full" disabled={!canTryAgain || currentScore.timing == null || currentScore.rhythm == null} onClick={() => { setSharing(!sharing); setShareConsent(false); }}><Users className="size-4" />Challenge a friend</button>{(currentScore.timing == null || currentScore.rhythm == null) && <p className="mt-2 text-xs leading-5 text-white/60">A words-only result cannot enter a matching challenge. Record again for a complete match.</p>}<button type="button" className="button-ghost mt-2 w-full" disabled={!canTryAgain} onClick={() => { const next = clips.findIndex((item) => item.id === clip.id); const nextClip = clips[(next + 1) % clips.length]; if (nextClip) { setChallenge(null); selectClip(nextClip); } else backToScenes(); }}>Next scene<ArrowRight className="size-3.5" /></button></>}
            </div>}
            {recorder.status === "requesting" && <p role="status" className="mt-3 flex items-center gap-2 text-xs"><LoaderCircle className="size-4 animate-spin" />Opening microphone… Allow access in your browser.</p>}
            {recorder.error && <p className="mt-3 text-xs leading-5 text-[#ffbcaa]" role="alert">{recorder.error}</p>}{recorder.warning && <p className="mt-3 text-xs leading-5 text-[#ffd4a3]" role="status">{recorder.warning}</p>}{audioBlob && !localCanSubmit && <p className="mt-3 text-xs leading-5 text-[#ffbcaa]" role="alert">{localTake?.qualityMessage ?? recorder.qualityMessage} Record another take to get a match.</p>}
          </section>
          {takeUrl && <section className="rounded-xl border border-electric/25 bg-electric/[0.07] px-5 py-4"><div className="flex items-start gap-3"><Headphones className="mt-0.5 size-5 shrink-0 text-electric" /><div><h2 className="font-bold">{fullLineTake ? "Your dub is ready." : `Preview your dub · ${lineTakes.lines.length}/${ownCues.length} lines`}</h2><p className="mt-1 text-sm leading-6 text-white/65">Tap play above. Switch between Original and Your take to hear the difference. Your recorded lines keep their original timing.{busy === "judge" ? " Keep watching while we check your match." : ""}</p></div></div></section>}
          {currentScore && <ScorePanel score={currentScore} previousBest={attempt?.previousBest} />}
          {comparableChallenge && <section className="rounded-2xl border border-hot/40 bg-hot/10 p-6"><p className="mono-label text-hot">Head to head</p><h2 className="mt-2 text-2xl font-bold">{currentScore.overall > friendScore.overall ? "You took the scene." : currentScore.overall === friendScore.overall ? "A scene-stealing tie." : "They’ve got you. For now."}</h2><div className="mt-5 grid grid-cols-2 gap-4"><div className="rounded-xl bg-paper p-4 text-ink"><p className="text-xs font-bold">You</p><p className="mt-1 text-4xl font-bold">{Math.round(currentScore.overall)}</p></div><div className="rounded-xl border border-white/20 p-4"><p className="text-xs font-bold">{challenge?.challengerName}</p><p className="mt-1 text-4xl font-bold">{Math.round(friendScore.overall)}</p></div></div><button type="button" className="button-secondary mt-5" disabled={!canTryAgain} onClick={retake}><RotateCcw className="size-4" />Rematch this scene</button></section>}
          <details className="rounded-xl border border-white/15 px-5 py-4 text-xs leading-6 text-white/60"><summary className="cursor-pointer font-bold text-white/70">Scene credits & playback notes</summary><p className="mt-3">{clip.source.attribution}</p><p className="mt-2">{clip.source.reuseNote}</p><p className="mt-2">{role.dubAudioUrl ? "This role has a prepared scene track with its original dialogue removed. Other dialogue and scene sound remain where available." : "The original soundtrack is muted over this role’s dialogue, then returns between lines. Background sound drops during those intervals."}</p><p className="mt-2">The recording starts just before the scene. We preserve your spoken timing and only account for that measured startup offset. Your device’s microphone latency is not separately calibrated.</p><div className="mt-3 flex flex-wrap gap-4"><a href={clip.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Original source <ExternalLink className="size-3" /></a><a href={clip.source.licenseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">{clip.source.license} <ExternalLink className="size-3" /></a></div><p className="mt-3 break-all text-[10px] text-white/45">Scene {clip.id} · {clip.version} · {attempt?.scoringVersion ?? challenge?.scoringVersion ?? SAY_SCORING_VERSION}</p></details>
        </div>
        <aside className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-2xl bg-paper text-ink"><div className="border-b border-ink/15 bg-hot px-5 py-4"><p className="mono-label text-ink/60">Your role</p>{clip.roles.length > 1 && !challenge && !attempt && !audioBlob ? <label className="mt-1 block"><span className="sr-only">Choose your role</span><select value={role.id} disabled={captureBusy || Boolean(busy)} onChange={(event) => { reset(); setRoleId(event.target.value); setTime(0); }} className="w-full rounded-lg border border-ink/20 bg-transparent py-2 pr-8 text-xl font-bold text-ink [color-scheme:light]">{clip.roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <h2 className="mt-1 text-xl font-bold">{role.name}</h2>}<p className="mt-1 text-xs leading-5 text-ink/65">{role.description}</p></div>
            <div className="px-5 py-4"><p className="mono-label mb-3 text-ink/50">Your dialogue</p><div className="space-y-3">{ownCues.map((cue) => <div key={cue.id} className={cn("rounded-lg border-l-[3px] py-1 pl-3 transition-colors", time >= cue.start - 0.3 && time <= cue.end + 0.12 ? "border-acid bg-acid/10" : "border-ink/15")}><p className="text-[10px] font-bold tabular-nums text-ink/45">{cue.start.toFixed(1)}s</p><p className="mt-1 text-base font-bold leading-snug">{cue.text}</p></div>)}</div></div>
          </section>
          <p className="px-1 text-xs leading-5 text-white/55">{tier === "pro" ? "Scored plays use your Pro allowance." : remainingMatches == null ? "5 scored plays per day, shared with Classic. Resets at midnight UTC." : `${remainingMatches} scored ${remainingMatches === 1 ? "play" : "plays"} left today, shared with Classic. Resets at midnight UTC.`} Recording, replay, and saving do not use a scored play.</p>
          {takeUrl && !attempt?.saved && <section className="rounded-xl border border-electric/25 bg-electric/5 p-5" aria-label="Keep your take"><h2 className="flex items-center gap-2 text-sm font-bold"><LockKeyhole className="size-4 text-electric" />Keep this take</h2><p className="mt-2 text-xs leading-5 text-white/65">{authenticated ? "Save your dub to history, even before getting a match." : "Sign in on this browser to keep this take in your personal history. We’ll bring you back here with your recording."}</p><button type="button" className="button-secondary mt-4 w-full" disabled={Boolean(busy) || captureBusy || (!attempt && !localCanSubmit)} onClick={() => void (authenticated ? saveWithoutScoring() : signInAndKeepTake())}>{busy === "signin" || busy === "upload" ? <LoaderCircle className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}{busy === "signin" || busy === "upload" ? "Keeping your take…" : authenticated ? "Save without scoring" : "Sign in & keep this take"}</button></section>}
          {attempt?.warning && <p role="status" className="game-note">{attempt.warning}</p>}{error && <div role="alert" className="game-error">{error}{takeUrl && <p className="mt-2">Your dub is still available above.</p>}</div>}
          {notice && <p role="status" className="flex gap-2 rounded-xl border border-electric/25 bg-electric/5 p-4 text-xs leading-5 text-electric"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />{notice}</p>}
          {attempt?.saved && <Link href="/profile" className="flex min-h-11 items-center justify-center gap-2 text-xs font-bold text-white/65"><LockKeyhole className="size-3.5" />Saved in your history<ArrowRight className="size-3.5" /></Link>}
          {sharing && <section className="rounded-xl border border-hot/35 bg-hot/5 p-5"><h2 className="flex items-center gap-2 font-bold"><Link2 className="size-4 text-hot" />Same scene. Your friend’s turn.</h2>{!authenticated ? <><p className="mt-3 text-xs leading-6 text-white/65">Sign in to keep your performances and create a friend challenge.</p><button type="button" disabled={Boolean(busy)} onClick={() => void signInAndKeepTake()} className="button-primary mt-4 w-full">{busy === "signin" ? "Keeping your take…" : "Sign in to challenge"}</button></> : createdChallenge ? <><p className="mt-3 text-xs leading-6 text-white/65">Anyone with this link can hear this take and submit their own. Other private recordings stay private.</p><input readOnly aria-label="Challenge link" value={typeof window === "undefined" ? createdChallenge.url : new URL(createdChallenge.url, window.location.origin).href} onFocus={(event) => event.target.select()} className="mt-3 w-full rounded-lg border border-white/20 bg-ink px-3 py-3 text-xs text-paper" /><button type="button" className="button-primary mt-3 w-full" onClick={() => void copyChallenge()}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Link copied" : "Copy challenge link"}</button></> : <><label className="mt-3 flex cursor-pointer gap-2.5 text-xs leading-6 text-white/70"><input type="checkbox" checked={shareConsent} onChange={(event) => setShareConsent(event.target.checked)} className="mt-1.5 size-4 shrink-0 accent-acid" />Allow anyone with this challenge link to hear this take. This does not publish it to the feed.</label><button type="button" className="button-primary mt-4 w-full" disabled={!shareConsent || Boolean(busy)} onClick={() => void createChallenge()}>{busy === "share" ? <LoaderCircle className="size-4 animate-spin" /> : <Link2 className="size-4" />}Create challenge link</button></>}</section>}
          <p className="flex items-start gap-2 px-1 text-[11px] leading-5 text-white/50"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" />Your voice stays yours. Matching checks the performance, not whether you sound like the actor.</p>
        </aside>
      </div>
    </>}
  </div></main>;
}
