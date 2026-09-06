"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock3, Headphones, LoaderCircle, Mic, RotateCcw, Shuffle, Users, X } from "lucide-react";
import { ContentControl, CONTENT_LABELS } from "@/components/content/content-control";
import { useApp } from "@/components/providers/app-provider";
import { VideoExport } from "@/components/exports/video-export";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { isRatingAllowed } from "@/data/content";
import { switchCueAt } from "@/lib/switch/catalog";
import type { GroupAssignment } from "@/lib/groups/types";
import type { SwitchAttempt, SwitchChallenge, SwitchScore, SwitchInvitation } from "@/lib/switch/types";
import { cn } from "@/lib/utils";
import { SwitchPlayer, type SwitchPlayerHandle } from "./switch-player";

export async function switchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 65000);
  try {
    const response = await fetch(path, { cache: "no-store", ...init, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok || !body.data) throw new Error(body?.error?.message ?? "That request did not finish. Your take is still here; retry to recover it.");
    return body.data as T;
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") throw new Error("That request took too long. Your take is still here. Retry to recover its result.");
    throw cause;
  } finally { clearTimeout(timer); }
}

type Invitation = SwitchInvitation;
export type SwitchRoundContext = { token: string; returnPath: string; challenge: SwitchChallenge };

function ScorePanel({ challenge, score, jump }: { challenge: SwitchChallenge; score: SwitchScore; jump: (time: number) => void }) {
  return <section className="overflow-hidden rounded-2xl bg-paper text-ink" aria-label="Your Switch result"><div className="p-6 sm:p-8"><p className="mono-label text-ink/55">Switch · beta judge · unranked</p><div className="mt-4 flex flex-wrap items-center gap-5"><p className="display-type text-8xl">{score.overall == null ? "—" : Math.round(score.overall)}<span className="font-sans text-base font-bold tracking-normal text-ink/50">{score.overall == null ? "" : "/100"}</span></p><div className="min-w-0 flex-1"><h2 className="text-2xl font-bold">{score.overall == null ? "Here’s what we could hear." : score.overall >= 75 ? "You made the switch." : "There’s another gear in there."}</h2><p className="mt-2 text-sm leading-6 text-ink/75">{score.coachNote}</p></div></div><div className="mt-6 grid grid-cols-3 gap-3 border-y border-ink/15 py-4">{[{name:"Words",value:score.words},{name:"Directions",value:score.delivery},{name:"Switches",value:score.transitions}].map((item) => <div key={item.name}><p className="text-xs font-bold text-ink/60">{item.name}</p><p className="mt-1 text-2xl font-bold">{item.value == null ? "—" : Math.round(item.value)}</p></div>)}</div><p className="mt-4 text-sm leading-6 text-ink/75">{score.transitionFeedback}</p><div className="mt-5 space-y-2">{score.segments.map((segment) => { const cue = challenge.cues.find((item) => item.id === segment.cueId); return <button type="button" key={segment.cueId} className="flex w-full items-start gap-3 rounded-xl border border-ink/15 p-4 text-left hover:bg-ink/5" onClick={() => jump(cue?.start ?? 0)}><Headphones className="mt-0.5 size-4 shrink-0" /><span><span className="block text-sm font-bold">{cue?.directionLabel} <span className="font-normal text-ink/50">· {cue?.start}s · listen</span></span><span className="mt-1 block text-sm leading-5 text-ink/70">{segment.feedback}</span></span></button>; })}</div><details className="mt-5 text-xs leading-6 text-ink/65"><summary className="cursor-pointer py-2 font-bold">How this beta score works</summary><p>One judge listens to the full audio with the phrase and cue timeline. Quiet acting can score well. This is a casual assessment, with no ranked leaderboard entry.</p>{score.limitations.map((note, index) => <p className="mt-2" key={index}>{note}</p>)}<p className="mt-2">Only compare the same challenge, timing, and scoring version. No voice is sped up, shifted, or edited.</p><p className="mt-2 break-words">{score.version} · {score.rubricVersion}</p><p className="mt-3 font-bold">Heard dialogue</p><p>{score.transcript || "No reliable transcript."}</p></details></div></section>;
}

export function SwitchExperience({ initialChallengeId, initialAttemptId, initialClaimId, challengeToken, roundContext, publicAssignment }: { initialChallengeId?: string; initialAttemptId?: string; initialClaimId?: string; challengeToken?: string; roundContext?: SwitchRoundContext; publicAssignment?: { code: string; assignment: Extract<GroupAssignment, { mode: "switch" }> } }) {
  const router = useRouter();
  const { authenticated, authReady, contentRating, refreshAccount, updatePreferences } = useApp();
  const recorder = useAudioRecorder();
  const { reset, start, stop, cancelCapture, commitCapture, requestPermission, primeAudioContext } = recorder;
  const [catalog, setCatalog] = useState<SwitchChallenge[]>([]);
  const [challenge, setChallenge] = useState<SwitchChallenge | null>(roundContext?.challenge ?? publicAssignment?.assignment.challenge ?? null);
  const [attempt, setAttempt] = useState<SwitchAttempt | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [createdLink, setCreatedLink] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"upload" | "judge" | "share" | "signin" | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const player = useRef<SwitchPlayerHandle>(null);
  const stage = useRef<HTMLElement>(null);
  const mounted = useRef(true);
  const countdownRun = useRef(0);
  const operation = useRef(0);
  const inFlight = useRef(false);
  const attemptKey = useRef("");
  const pendingCapture = useRef<{ previousBlob: Blob | null } | null>(null);
  const recording = recorder.status === "recording";
  const captureBusy = recording || preparing || countdown != null;
  const audioUrl = recorder.audioUrl ?? attempt?.audioUrl;
  const canSubmit = !!attempt || (recorder.canSubmit && recorder.durationMs >= (challenge?.duration ?? 20) * 1000 - 250);
  const allowed = !challenge || isRatingAllowed(challenge.rating, contentRating);
  const currentTime = recording ? recorder.durationMs / 1000 : 0;
  const cue = challenge ? switchCueAt(challenge, currentTime) : undefined;
  const nextCue = challenge && cue ? challenge.cues[challenge.cues.indexOf(cue) + 1] : undefined;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const choose = useCallback((item: SwitchChallenge | null) => {
    countdownRun.current++; operation.current++; inFlight.current = false; pendingCapture.current = null;
    player.current?.pause(); reset(); setChallenge(item); setAttempt(null); setBusy(null); setCountdown(null); setPreparing(false); setError(""); setNotice(""); setCreatedLink(""); setConsent(false); attemptKey.current = "";
  }, [reset]);
  const load = useCallback(async () => {
    if (!authReady) return;
    setLoading(true); setLoadError("");
    const run = ++operation.current;
    try {
      const data = await switchApi<{ challenges: SwitchChallenge[] }>(`/api/switch/catalog?maxRating=${contentRating}`);
      if (!mounted.current || run !== operation.current) return;
      setCatalog(data.challenges);
      let selected = roundContext?.challenge ?? publicAssignment?.assignment.challenge ?? data.challenges.find((item) => item.id === initialChallengeId) ?? null;
      let restored: SwitchAttempt | null = null;
      const id = initialClaimId ?? initialAttemptId;
      if (id) {
        const claiming = !!initialClaimId && authenticated;
        restored = (await switchApi<{ attempt: SwitchAttempt }>(`/api/switch/attempts/${encodeURIComponent(id)}${claiming ? "/claim" : ""}?maxRating=${contentRating}`, claiming ? { method: "POST" } : undefined)).attempt;
        if (roundContext && (restored.challenge.id !== roundContext.challenge.id || restored.challenge.version !== roundContext.challenge.version || restored.scoringVersion !== roundContext.challenge.scoringVersion)) throw new Error("That take belongs to a different assignment. Return to the round to record its exact Switch.");
        if (publicAssignment && (restored.challenge.id !== publicAssignment.assignment.challenge.id || restored.challenge.version !== publicAssignment.assignment.challenge.version || restored.scoringVersion !== publicAssignment.assignment.scoringVersion)) throw new Error("That take belongs to another assignment.");
        selected = restored.challenge;
      }
      if (challengeToken) {
        const found = (await switchApi<{ challenge: Invitation }>(`/api/switch/challenges/${encodeURIComponent(challengeToken)}?maxRating=${contentRating}`)).challenge;
        if (restored && (restored.challenge.id !== found.challenge.id || restored.challenge.version !== found.challenge.version)) throw new Error("That saved take does not match this invitation.");
        if (!mounted.current || run !== operation.current) return;
        setInvitation(found); selected = found.challenge;
      }
      if (!mounted.current || run !== operation.current) return;
      setChallenge(selected); setAttempt(restored);
      if (restored && initialClaimId) setNotice(authenticated ? "Your guest take is now saved privately to your account." : "Your guest take is here. Sign in on this browser to keep it.");
    } catch (cause) { if (mounted.current && run === operation.current) setLoadError(cause instanceof Error ? cause.message : "Switch could not load."); }
    finally { if (mounted.current && run === operation.current) setLoading(false); }
  }, [authReady, authenticated, contentRating, initialChallengeId, initialAttemptId, initialClaimId, challengeToken, roundContext, publicAssignment]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (recorder.status !== "stopped" || !pendingCapture.current) return;
    if (recorder.audioBlob && recorder.audioBlob !== pendingCapture.current.previousBlob) {
      setAttempt(null); attemptKey.current = crypto.randomUUID(); setCreatedLink(""); setConsent(false);
      commitCapture(); setNotice(recorder.stopReason === "limit" ? "Take complete. Play it back, then see how you switched." : "This take stopped early. Replay it, then retry the full take.");
    }
    pendingCapture.current = null;
  }, [recorder.status, recorder.audioBlob, recorder.stopReason, commitCapture]);
  useEffect(() => {
    const cancelHidden = () => { if (document.visibilityState === "hidden" && !recording) { countdownRun.current++; setCountdown(null); setPreparing(false); inFlight.current = false; cancelCapture(); } };
    document.addEventListener("visibilitychange", cancelHidden);
    return () => document.removeEventListener("visibilitychange", cancelHidden);
  }, [recording, cancelCapture]);
  useEffect(() => {
    if (!recorder.audioBlob || attempt) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [recorder.audioBlob, attempt]);

  const begin = async () => {
    if (!challenge || captureBusy || (inFlight.current && busy !== "judge") || (busy && busy !== "judge") || !allowed) return;
    operation.current++; inFlight.current = true; setBusy(null); setPreparing(true); setError(""); setNotice("");
    const run = ++countdownRun.current;
    player.current?.pause(); primeAudioContext();
    try {
      if (!await requestPermission()) { cancelCapture(); return; }
      if (run !== countdownRun.current || !mounted.current) return;
      stage.current?.scrollIntoView({ block: "start", behavior: "instant" });
      for (let count = 3; count > 0; count--) {
        if (run !== countdownRun.current || !mounted.current) return;
        setCountdown(count); await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (run !== countdownRun.current || !mounted.current) return;
      setCountdown(0); pendingCapture.current = { previousBlob: recorder.audioBlob };
      const started = await start({ preservePreviousTake: true, maxDurationMs: challenge.duration * 1000 });
      if (run !== countdownRun.current || !mounted.current || !started) { pendingCapture.current = null; cancelCapture(); }
    } catch (cause) { pendingCapture.current = null; cancelCapture(); setError(cause instanceof Error ? cause.message : "Recording could not start."); }
    finally { if (run === countdownRun.current) { setCountdown(null); setPreparing(false); inFlight.current = false; } }
  };
  const cancel = () => { countdownRun.current++; pendingCapture.current = null; cancelCapture(); setCountdown(null); setPreparing(false); inFlight.current = false; setNotice("Cancelled. Your previous take is still here."); };
  const upload = async (run: number): Promise<SwitchAttempt> => {
    if (attempt) return attempt;
    if (!challenge || !recorder.audioBlob || !canSubmit) throw new Error("Finish every cue before saving this take.");
    if (invitation && !consent) throw new Error("Confirm sharing with your friend before sending your response.");
    const form = new FormData();
    form.set("audio", recorder.audioBlob, "switch.wav"); form.set("challengeId", challenge.id); form.set("challengeVersion", challenge.version);
    form.set("durationMs", String(recorder.durationMs)); form.set("recordingOffsetMs", "0");
    form.set("attemptId", attemptKey.current || (attemptKey.current = crypto.randomUUID())); form.set("maxRating", contentRating);
    if (publicAssignment) form.set("assignmentCode", publicAssignment.code);
    if (roundContext) form.set("roundToken", roundContext.token);
    if (invitation) { form.set("challengeToken", invitation.token); form.set("shareAudio", "true"); }
    const saved = (await switchApi<{ attempt: SwitchAttempt }>("/api/switch/attempts", { method: "POST", body: form })).attempt;
    if (mounted.current && run === operation.current) setAttempt(saved);
    return saved;
  };
  const prepareVideoExport = async () => {
    if (inFlight.current || captureBusy) throw new Error("Finish the current recording or save, then create your video.");
    inFlight.current = true; const run = ++operation.current; setBusy("upload");
    try { return (await upload(run)).id; }
    finally { if (run === operation.current) { inFlight.current = false; if (mounted.current) setBusy(null); } }
  };
  const performAction = async (action: "judge" | "save" | "signin" | "round" | "share") => {
    if (inFlight.current || captureBusy || !allowed) return;
    if (action === "share" && !consent) { setError("Confirm sharing your audio before creating an invitation."); return; }
    inFlight.current = true; const run = ++operation.current; setBusy(action === "share" ? "share" : action === "signin" ? "signin" : "upload"); setError("");
    try {
      let saved = await upload(run);
      if (!mounted.current || run !== operation.current) return;
      if (action === "judge") {
        setBusy("judge");
        const result = await switchApi<{ attempt: SwitchAttempt; usage?: { remaining: number | null } }>(`/api/switch/attempts/${saved.id}/judge`, { method: "POST" });
        if (!mounted.current || run !== operation.current) return;
        saved = result.attempt; setAttempt(saved); if (result.usage) setRemaining(result.usage.remaining); void refreshAccount();
        setNotice("Your beta result is ready. Tap a segment below to hear it again.");
      } else if (action === "signin") {
        const query = new URLSearchParams({ [saved.saved ? "attempt" : "claim"]: saved.id });
        if (invitation) query.set("challenge", invitation.token);
        const path = roundContext ? `/rounds/${encodeURIComponent(roundContext.token)}/record` : publicAssignment ? `/a/${publicAssignment.code}` : "/switch";
        router.push(`/login?next=${encodeURIComponent(`${path}?${query}`)}`);
      } else if (action === "round" && roundContext) router.push(`${roundContext.returnPath}?attempt=${encodeURIComponent(saved.id)}`);
      else if (action === "share") {
        const result = await switchApi<{ challenge: Invitation }>("/api/switch/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptId: saved.id, shareAudio: true, maxRating: contentRating }) });
        if (mounted.current && run === operation.current) setCreatedLink(result.challenge.url);
      } else {
        if (authenticated && !saved.saved) saved = (await switchApi<{ attempt: SwitchAttempt }>(`/api/switch/attempts/${saved.id}/claim`, { method: "POST" })).attempt;
        if (mounted.current && run === operation.current) { setAttempt(saved); setNotice(saved.saved ? "Saved privately in your Switch history." : "Kept on this browser for 24 hours. Sign in to save it to your history."); }
      }
    } catch (cause) { if (mounted.current && run === operation.current) setError(cause instanceof Error ? cause.message : "That request did not finish. Your take is still here."); }
    finally { if (run === operation.current) { inFlight.current = false; if (mounted.current) setBusy(null); } }
  };
  useEffect(() => {
    if (authenticated || !audioUrl) return;
    const beforeLogin = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin || url.pathname !== "/login") return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (captureBusy) setNotice("Finish your take before signing in.");
      else void performAction("signin");
    };
    document.addEventListener("click", beforeLogin, true);
    return () => document.removeEventListener("click", beforeLogin, true);
  });

  return <main className="min-h-screen px-4 pb-28 pt-28 sm:pt-32"><div className="mx-auto max-w-6xl"><div className="mb-7 flex flex-wrap items-center justify-between gap-3"><Link href={roundContext?.returnPath ?? "/play"} className="button-ghost -ml-3 px-3"><ArrowLeft className="size-4" />{roundContext ? "Back to round" : "All modes"}</Link><ContentControl value={contentRating} onChange={(value) => updatePreferences({contentRating:value})} disabled={captureBusy || !!busy} compact /></div>
    {loading ? <div className="panel-solid p-8 text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-acid" /><p className="mt-4">Getting Switch ready…</p></div> : loadError ? <div className="panel-solid p-8"><h1 className="text-2xl font-bold">Couldn’t open Switch.</h1><p role="alert" className="mt-4 text-white/65">{loadError}</p><button className="button-primary mt-5" onClick={() => void load()}>Try again</button></div> : !challenge ? <><header className="mb-9 max-w-3xl"><p className="mono-label flex items-center gap-2 text-acid"><Shuffle className="size-4" />New mode · beta · unranked</p><h1 className="display-type mt-4 text-7xl sm:text-9xl">SWITCH.</h1><p className="mt-4 max-w-xl text-xl leading-relaxed text-white/70">One phrase. Keep switching.</p><p className="mt-3 text-sm leading-6 text-white/50">Repeat the same phrase with different emotions or speeds. Follow the cues. No camera.</p></header><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{catalog.map((item, index) => <button key={item.id} type="button" onClick={() => choose(item)} className="group flex flex-col rounded-2xl border border-white/15 bg-[#20201d] p-6 text-left transition-colors hover:border-acid/60"><div className="flex items-center justify-between"><span className="display-type text-5xl text-white/20">0{index + 1}</span><span className="mono-label text-white/45">{item.duration} sec</span></div><h2 className="mt-5 text-2xl font-bold tracking-tight">{item.title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-white/60">{item.description}</p><div className="mt-5 flex flex-wrap gap-1.5">{item.cues.map((cue) => <span className="rounded-md bg-white/5 px-2 py-1 text-[11px] font-semibold text-acid/85" key={cue.id}>{cue.emoji} {cue.directionLabel}</span>)}</div><div className="mt-6 flex items-center justify-between text-xs text-white/45"><span>{CONTENT_LABELS[item.rating]}</span><span className="flex items-center gap-2 text-paper">Try this Switch <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span></div></button>)}</div><Link href="/rounds?mode=switch" className="button-ghost mt-6"><Users className="size-4" />Play Switch with friends</Link></> : !allowed ? <div className="panel-solid p-8"><h1 className="text-2xl font-bold">This Switch needs a different content setting.</h1><p className="mt-3 text-white/65">Use the content control above to open the assignment.</p></div> : <>
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="mono-label text-acid">Switch · beta · unranked</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{challenge.title}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-white/60">{challenge.description}</p></div>{!roundContext && !publicAssignment && !invitation && <button className="button-ghost" disabled={captureBusy || !!busy} onClick={() => choose(null)}>Choose another Switch</button>}</header>
      {invitation && <div className="mb-6 rounded-xl border border-acid/25 bg-acid/5 p-4 text-sm leading-6"><Users className="mb-2 size-5 text-acid" />You’re playing your friend’s exact Switch. Same script, directions, and timings. Comparisons are casual beta results.</div>}
      <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]"><section ref={stage} className="scroll-mt-24 overflow-hidden rounded-2xl border border-white/15 bg-[#20201d]" aria-label="Switch recording stage"><div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><p className="mono-label flex items-center gap-2 text-white/60"><Clock3 className="size-4" />{challenge.duration} seconds · one take</p><p className="text-xs text-white/45">{challenge.cues.length} cues</p></div>{captureBusy ? <div className="p-6 sm:p-8"><div className="flex items-center justify-between"><span className="mono-label text-hot">{recording ? "● Recording" : "Get ready"}</span><span className="text-sm tabular-nums text-white/60">{recording ? `${(challenge.duration - currentTime).toFixed(1)}s left` : countdown === 0 ? "Starting mic…" : ""}</span></div>{countdown != null && countdown > 0 ? <p className="display-type py-6 text-center text-9xl text-acid" role="status">{countdown}</p> : null}<p className="mono-label mt-7 text-white/45">{recording ? "Direction now" : "Start with"}</p><h2 className="mt-2 text-4xl font-black text-acid sm:text-5xl" aria-live="polite"><span className="mb-4 block text-7xl" aria-hidden="true">{cue?.emoji}</span>{cue?.directionLabel}</h2><p className="mt-4 text-2xl font-semibold leading-relaxed">{cue?.text}</p><div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-acid" style={{ width: `${Math.min(100,currentTime/challenge.duration*100)}%` }} /></div><div className="mt-5 rounded-xl bg-white/5 p-4"><p className="mono-label text-white/40">{nextCue ? `Next · at ${nextCue.start}s` : "Final direction"}</p><p className="mt-1 text-lg font-bold text-white/80">{nextCue ? `${nextCue.emoji} ${nextCue.directionLabel}` : "Bring it home."}</p></div><div className="mt-4 flex gap-1" aria-label="Microphone level">{Array.from({length:24},(_,i)=><span key={i} className={cn("h-5 flex-1 rounded-sm",i/24<recorder.level ? "bg-acid" : "bg-white/10")} />)}</div></div> : <div className="p-5 sm:p-7"><h2 className="text-xl font-bold">Same phrase. Every cue.</h2><p className="mt-4 text-3xl font-black leading-snug text-paper">“{challenge.cues[0]?.text}”</p><p className="mt-3 text-sm leading-6 text-white/55">{challenge.kind === "speed" ? "Say it once at each speed. Slow it down or speed it up yourself, then wait for the next cue." : "Say it once for each emoji. Change your emotion, then wait for the next cue."}</p><ol className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">{challenge.cues.map((item)=><li key={item.id} className="rounded-xl border border-white/10 p-3"><p className="text-3xl" aria-hidden="true">{item.emoji}</p><p className="mt-2 text-sm font-bold leading-5 text-acid">{item.directionLabel}</p><p className="mt-1 text-[11px] tabular-nums text-white/40">{item.start}–{item.end}s</p></li>)}</ol></div>}<div className="border-t border-white/10 p-5 sm:px-7">{captureBusy ? <div className="flex flex-wrap gap-2"><button className="button-ghost" onClick={cancel}><X className="size-4" />Cancel take</button>{recording && <button className="button-ghost" onClick={stop}>Stop early</button>}</div> : <button type="button" className="button-primary w-full" disabled={!!busy && busy !== "judge"} onClick={() => void begin()}><Mic className="size-4" />{audioUrl ? "Retry full take" : "Ready · start countdown"}</button>}<p className="mt-3 text-center text-xs leading-5 text-white/45">Microphone only. No camera. No partial retakes.</p>{recorder.error && <p role="alert" className="mt-3 text-sm text-hot">{recorder.error}</p>}</div></section>
      <div className="space-y-5">{audioUrl && !captureBusy ? <><SwitchPlayer ref={player} key={audioUrl} challenge={challenge} audioUrl={audioUrl} />{!canSubmit && <p className="rounded-xl bg-hot/10 p-4 text-sm text-hot">{recorder.qualityMessage} Finish the full take before sending it.</p>}{recorder.quality === "quiet" && !attempt && <p className="text-sm text-white/60">Quiet delivery is welcome. Check that the words are audible in replay.</p>}{recorder.warning && recorder.stopReason !== "limit" && <p className="text-sm text-hot">{recorder.warning}</p>}{attempt?.warning && <p className="text-xs leading-5 text-white/55">{attempt.warning}</p>}{invitation && !attempt && <label className="flex items-start gap-3 rounded-xl border border-white/15 p-4 text-sm leading-6 text-white/70"><input className="mt-1 size-4 accent-acid" type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} />Let my friend hear this response and compare our beta results.</label>}<div className="flex flex-wrap gap-2"><button className="button-primary" disabled={!!busy || !canSubmit || attempt?.status === "scored"} onClick={()=>void performAction("judge")}>{busy === "judge" || busy === "upload" ? <LoaderCircle className="size-4 animate-spin" /> : <Shuffle className="size-4" />}{busy === "judge" ? "Listening to your switches…" : attempt?.status === "scored" ? "Scored" : attempt?.status === "failed" ? "Retry scoring" : "Judge my Switch"}</button><button className="button-ghost" disabled={!!busy || !canSubmit} onClick={()=>void performAction(authenticated ? "save" : "signin")}>{authenticated ? <Check className="size-4" /> : <ArrowRight className="size-4" />}{authenticated ? attempt?.saved ? "Saved privately" : "Save take" : "Sign in & keep take"}</button>{roundContext && <button className="button-ghost" disabled={!!busy || !canSubmit} onClick={()=>void performAction("round")}><Users className="size-4" />Use this take in round</button>}</div>{busy === "judge" && <p role="status" className="text-sm leading-6 text-white/60">Replay stays available while the judge listens. You can retry the full take now; this result stays with its original recording.</p>}{remaining !== null && <p className="text-xs text-white/45">{remaining} judged plays left today · replay and full-take practice are free.</p>}{(!attempt || attempt.owned) && <VideoExport key={`export:${audioUrl}`} mode="switch" attemptId={attempt?.id} prepareAttempt={prepareVideoExport} hasScore={attempt?.score?.overall != null} disabled={!!busy || !canSubmit} />}{attempt?.score && <ScorePanel challenge={challenge} score={attempt.score} jump={(time)=>{player.current?.seek(time); void player.current?.play();}} />}{!roundContext && !invitation && attempt?.score && authenticated && <div className="rounded-xl border border-white/15 p-5"><h2 className="font-bold">Make a friend do this.</h2><label className="mt-3 flex items-start gap-3 text-sm leading-6 text-white/60"><input type="checkbox" className="mt-1 size-4 accent-acid" checked={consent} onChange={(event)=>setConsent(event.target.checked)} />Share this take with people who open my invitation.</label><button className="button-ghost mt-3" disabled={!!busy || !consent} onClick={()=>void performAction("share")}><Users className="size-4" />Create friend challenge</button>{createdLink && <div className="mt-3"><input className="input-field w-full text-xs" aria-label="Friend challenge link" value={createdLink} readOnly onFocus={(event)=>event.target.select()} /><button className="button-ghost mt-2" onClick={()=>void navigator.clipboard.writeText(createdLink).then(()=>setNotice("Invitation copied.")).catch(()=>setNotice("Select and copy the invitation above."))}>Copy link</button></div>}</div>}</> : <div className="rounded-2xl border border-dashed border-white/20 p-7 sm:p-9"><Shuffle className="size-8 text-acid" /><h2 className="mt-5 text-2xl font-bold">The switch is the joke.</h2><p className="mt-3 text-sm leading-7 text-white/60">{challenge.kind === "speed" ? "Normal. Slow. Ridiculously slow. Fast. Turbo. Keep the same words and change how quickly you say them. The multipliers are playful targets, not a precision test." : "Same words. Completely different energy. Follow the emoji and commit to the bit. Angry can be quiet; an alien can sound however you imagine."}</p><div className="mt-7 flex gap-3 text-sm text-white/50"><RotateCcw className="size-5 shrink-0" /><p>Replay instantly. Retry the whole performance as often as you like.</p></div><p className="mt-7 text-xs leading-6 text-white/40">The beta judge listens for the words, each direction, and the changes between them. It may be uncertain; its feedback will say so.</p></div>}{error && <p role="alert" className="rounded-xl border border-hot/25 bg-hot/10 p-4 text-sm leading-6 text-hot">{error}</p>}{notice && <p role="status" className="rounded-xl border border-acid/20 bg-acid/5 p-4 text-sm leading-6 text-white/75">{notice}</p>}</div></div>
      {invitation && <section className="mt-8 space-y-4"><h2 className="text-xl font-bold">Friend performances · casual comparison</h2>{[invitation.challengerAttempt, ...(invitation.recipientAttempts ?? [])].filter((item): item is SwitchAttempt => !!item).map((item)=><div key={item.id} className="max-w-xl"><SwitchPlayer challenge={item.challenge} audioUrl={item.audioUrl} takeLabel={item.owned ? "Your response" : "Friend’s take"} />{item.score && <p className="mt-2 text-sm text-white/60">Beta result: {item.score.overall ?? "Uncertain"}{item.score.overall != null ? "/100" : ""}</p>}</div>)}</section>}
    </>}
  </div></main>;
}
