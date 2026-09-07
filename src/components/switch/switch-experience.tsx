"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Headphones, LoaderCircle, Mic, Shuffle, Users, X } from "lucide-react";
import { ContentControl } from "@/components/content/content-control";
import { useApp } from "@/components/providers/app-provider";
import { VideoExport } from "@/components/exports/video-export";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { isRatingAllowed } from "@/data/content";
import { switchCueAt } from "@/lib/switch/catalog";
import { switchPhraseSource } from "@/lib/switch/sources";
import { groupSwitchPhrases } from "@/lib/switch/phrases";
import type { GroupAssignment } from "@/lib/groups/types";
import type { SwitchAttempt, SwitchChallenge, SwitchScore, SwitchInvitation } from "@/lib/switch/types";
import { cn } from "@/lib/utils";
import { SwitchPlayer, type SwitchPlayerHandle } from "./switch-player";
import { PerformerAvatar } from "@/components/avatars/performer-avatar";
import { SwitchModePicker, SwitchPhraseCard } from "./switch-phrase-picker";

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
  const phraseSource = challenge ? switchPhraseSource(challenge.id) : undefined;
  const phrases = groupSwitchPhrases(catalog.filter((item) => isRatingAllowed(item.rating, contentRating)));
  const selectedPhrase = challenge ? phrases.find((phrase) => Object.values(phrase.variants).some((item) => item.id === challenge.id && item.version === challenge.version)) : undefined;

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

  return <main className="min-h-screen px-4 pb-24 pt-24 sm:pt-28"><div className="mx-auto max-w-6xl"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><Link href={roundContext?.returnPath ?? "/"} className="button-ghost -ml-3 min-h-11 min-w-11 px-3 text-xs"><ArrowLeft className="size-4" /><span className="sr-only sm:not-sr-only">{roundContext ? "Back to round" : "All modes"}</span></Link><ContentControl value={contentRating} onChange={(value) => updatePreferences({contentRating:value})} disabled={captureBusy || !!busy} compact /></div>
    {loading ? <div className="panel-solid p-8 text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-acid" /><p className="mt-4">Getting Switch ready…</p></div> : loadError ? <div className="panel-solid p-8"><h1 className="text-2xl font-bold">Couldn’t open Switch.</h1><p role="alert" className="mt-4 text-white/65">{loadError}</p><button className="button-primary mt-5" onClick={() => void load()}>Try again</button></div> : !challenge ? <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="display-type text-4xl sm:text-5xl">Switch.</h1><p className="mt-1 text-sm text-white/60">One phrase. Change the emoji or speed.</p></div><Link href="/rounds?mode=switch" className="button-ghost min-h-11 px-2 text-xs"><Users className="size-4" /><span className="sm:hidden">Friends</span><span className="hidden sm:inline">Play with friends</span></Link></header>
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-bold">Choose a phrase</h2><p className="text-xs text-white/45" role="status">{phrases.length} {phrases.length === 1 ? "phrase" : "phrases"}</p></div>
      <div className="grid gap-2 lg:grid-cols-2">{phrases.map((phrase) => <SwitchPhraseCard compact key={phrase.key} phrase={phrase} onChoose={choose} />)}</div>{phrases.length === 0 && <p className="rounded-xl border border-white/15 p-5 text-sm text-white/65">No phrases match this content setting.</p>}
    </> : !allowed ? <div className="panel-solid p-8"><h1 className="text-2xl font-bold">This Switch needs a different content setting.</h1><p className="mt-3 text-white/65">Use the content control above to open the assignment.</p></div> : <>
      <header className={cn("mb-4 flex flex-wrap items-center justify-between gap-3", (!audioUrl || captureBusy) && "mx-auto max-w-3xl")}><div className="flex items-baseline gap-3"><h1 className="display-type text-3xl sm:text-4xl">Switch.</h1><span className="text-xs tabular-nums text-white/45">{challenge.duration}s · {challenge.cues.length} cues</span></div><div className="flex flex-wrap items-center gap-2">{selectedPhrase && !roundContext && !publicAssignment && !invitation && !audioUrl && <div className="w-44"><SwitchModePicker phrase={selectedPhrase} selectedId={challenge.id} onChoose={choose} disabled={captureBusy || !!busy} /></div>}{!roundContext && !publicAssignment && !invitation && <button className="button-ghost min-h-11 px-2 text-xs" aria-label="Choose another Switch" disabled={captureBusy || !!busy} onClick={() => choose(null)}>Change phrase</button>}</div></header>
      {invitation && <div className="mb-4 flex items-center gap-2 rounded-xl border border-acid/25 bg-acid/5 px-4 py-3 text-xs"><Users className="size-4 shrink-0 text-acid" />Your friend’s Switch · same phrase, cues and timing.</div>}
      <div className={cn("grid items-start gap-4", audioUrl && !captureBusy ? "lg:grid-cols-[1.1fr_1fr]" : "mx-auto max-w-3xl")}>
        <section ref={stage} className="scroll-mt-20 overflow-hidden rounded-2xl border border-white/15 bg-[var(--ink-soft)]" aria-label="Switch recording stage">
          {audioUrl && !captureBusy ? <SwitchPlayer performerAvatar ref={player} key={audioUrl} challenge={challenge} audioUrl={audioUrl} className="!rounded-none !border-0 !bg-transparent" /> : <div className="p-4 sm:p-5">
            <div className="rounded-xl border border-acid/20 bg-acid/[.045] px-3 py-3" aria-label="Current Switch direction">
              <div className="flex items-center gap-3"><span className={cn("shrink-0 font-black leading-none text-acid", challenge.kind === "speed" ? "text-4xl tabular-nums" : "text-5xl")} aria-hidden="true">{challenge.kind === "speed" ? `${cue?.speed ?? 1}×` : cue?.emoji}</span><div className="min-w-0 flex-1"><h2 className="text-xl font-black text-paper sm:text-2xl" aria-label={cue?.directionLabel} aria-live={recording ? "polite" : "off"}>{cue?.directionLabel.replace(cue.emoji, "").trim()}</h2><p className="mt-1 text-[11px] text-white/50">{recording ? "Say the line now" : "Repeat the line when each cue changes"}</p></div><div className="shrink-0 text-right">{countdown != null && countdown > 0 ? <p className="display-type text-5xl text-acid" role="status">{countdown}</p> : <><p className={cn("text-xs font-bold", recording ? "text-hot" : "text-white/45")}>{recording ? "● REC" : preparing ? "Starting mic…" : "Start with"}</p>{recording && <p className="mt-1 text-xs tabular-nums text-white/60">{Math.max(0, challenge.duration - currentTime).toFixed(1)}s</p>}</>}</div></div>
            </div>
            <ol className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${challenge.cues.length}, minmax(0, 1fr))` }} aria-label="Switch cue order">{challenge.cues.map((item) => <li key={item.id} title={`${item.directionLabel} · ${item.start}–${item.end}s`} aria-current={cue?.id === item.id ? "step" : undefined} className={cn("flex min-h-11 items-center justify-center rounded-lg border text-lg font-bold", cue?.id === item.id ? "border-acid/35 bg-acid/10 text-acid" : "border-transparent text-white/45")}><span aria-hidden="true">{challenge.kind === "speed" ? `${item.speed ?? 1}×` : item.emoji}</span><span className="sr-only">{item.directionLabel}, {item.start} to {item.end} seconds</span></li>)}</ol>
            <div className="flex min-h-40 items-center gap-4 py-4 sm:gap-6"><PerformerAvatar size={128} level={recording ? recorder.voiceLevel : 0} editable={!captureBusy} /><p className="min-w-0 flex-1 text-2xl font-black leading-snug tracking-tight text-paper sm:text-3xl">“{cue?.text}”</p></div>
            <div className="flex items-center gap-3"><p className="min-w-0 flex-1 truncate text-xs text-white/50">{nextCue ? `Next: ${challenge.kind === "speed" ? `${nextCue.speed ?? 1}×` : nextCue.emoji} ${nextCue.directionLabel.replace(nextCue.emoji, "").trim()}` : "Final cue"}</p>{recording && <div role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(recorder.level * 100)} className="flex w-24 shrink-0 gap-0.5">{Array.from({ length: 16 }, (_, index) => <span key={index} className={cn("h-3 flex-1 rounded-sm", index / 16 < recorder.level ? "bg-acid" : "bg-white/10")} />)}</div>}</div>
            {captureBusy && <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-acid" style={{ width: `${Math.min(100, currentTime / challenge.duration * 100)}%` }} /></div>}
          </div>}
          <div className="border-t border-white/10 px-4 py-3 sm:px-5">
            {captureBusy ? <div className="flex flex-wrap gap-2"><button className="button-secondary min-h-11" onClick={cancel}><X className="size-4" />Cancel take</button>{recording && <button className="button-ghost min-h-11" onClick={stop}>Stop early</button>}</div> : <button type="button" className={cn("min-h-11 w-full", audioUrl ? "button-secondary" : "button-primary")} disabled={!!busy && busy !== "judge"} onClick={() => void begin()}><Mic className="size-4" />{audioUrl ? "Retry full take" : "Record Switch"}</button>}
            {!captureBusy && <div className="mt-2 flex flex-wrap items-start justify-between gap-x-3 text-[11px] leading-5 text-white/45">{!audioUrl && <p>3-second countdown · microphone only</p>}<details className="max-w-sm"><summary className="min-h-11 cursor-pointer py-3 text-white/60">How it works</summary><p className="mt-2">{challenge.kind === "speed" ? "Say the same line at each requested pace. Your recording stays at its original speed." : "Say the same line in each emotion. Follow the next cue when it changes."} Replay and retry as often as you like.</p><p className="mt-2">The optional beta judge listens for words, directions and transitions. Results are casual and unranked.</p>{phraseSource && <a href={phraseSource} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 text-white/60 hover:text-paper">Phrase inspiration <ArrowUpRight className="size-3" /></a>}</details></div>}
            {recorder.error && <p role="alert" className="mt-2 text-sm text-hot">{recorder.error}</p>}
          </div>
        </section>
      <div className="space-y-4 empty:hidden">{audioUrl && !captureBusy ? <>{!canSubmit && <p className="rounded-xl bg-hot/10 p-4 text-sm text-hot">{recorder.qualityMessage} Finish the full take before sending it.</p>}{recorder.quality === "quiet" && !attempt && <p className="text-sm text-white/60">Quiet delivery is welcome. Check that the words are audible in replay.</p>}{recorder.warning && recorder.stopReason !== "limit" && <p className="text-sm text-hot">{recorder.warning}</p>}{attempt?.warning && <p className="text-xs leading-5 text-white/55">{attempt.warning}</p>}{invitation && !attempt && <label className="flex items-start gap-3 rounded-xl border border-white/15 p-4 text-sm leading-6 text-white/70"><input className="mt-1 size-4 accent-acid" type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} />Let my friend hear this response and compare our beta results.</label>}<div className="flex flex-wrap gap-2"><button className="button-primary" disabled={!!busy || !canSubmit || attempt?.status === "scored"} onClick={()=>void performAction("judge")}>{busy === "judge" || busy === "upload" ? <LoaderCircle className="size-4 animate-spin" /> : <Shuffle className="size-4" />}{busy === "judge" ? "Listening to your switches…" : attempt?.status === "scored" ? "Scored" : attempt?.status === "failed" ? "Retry scoring" : "Judge my Switch"}</button><button className="button-ghost" disabled={!!busy || !canSubmit} onClick={()=>void performAction(authenticated ? "save" : "signin")}>{authenticated ? <Check className="size-4" /> : <ArrowRight className="size-4" />}{authenticated ? attempt?.saved ? "Saved privately" : "Save take" : "Sign in & keep take"}</button>{roundContext && <button className="button-ghost" disabled={!!busy || !canSubmit} onClick={()=>void performAction("round")}><Users className="size-4" />Use this take in round</button>}</div>{busy === "judge" && <p role="status" className="text-sm leading-6 text-white/60">Replay or retry while the judge listens. This result stays with its original take.</p>}{remaining !== null && <p className="text-xs text-white/45">{remaining} judged plays left today · replay and full-take practice are free.</p>}{(!attempt || attempt.owned) && <VideoExport compact key={`export:${audioUrl}`} mode="switch" attemptId={attempt?.id} prepareAttempt={prepareVideoExport} hasScore={attempt?.score?.overall != null} disabled={!!busy || !canSubmit} />}{attempt?.score && <ScorePanel challenge={challenge} score={attempt.score} jump={(time)=>{player.current?.seek(time); void player.current?.play();}} />}{!roundContext && !invitation && attempt?.score && authenticated && <div className="rounded-xl border border-white/15 p-5"><h2 className="font-bold">Make a friend do this.</h2><label className="mt-3 flex items-start gap-3 text-sm leading-6 text-white/60"><input type="checkbox" className="mt-1 size-4 accent-acid" checked={consent} onChange={(event)=>setConsent(event.target.checked)} />Share this take with people who open my invitation.</label><button className="button-ghost mt-3" disabled={!!busy || !consent} onClick={()=>void performAction("share")}><Users className="size-4" />Create friend challenge</button>{createdLink && <div className="mt-3"><input className="input-field w-full text-xs" aria-label="Friend challenge link" value={createdLink} readOnly onFocus={(event)=>event.target.select()} /><button className="button-ghost mt-2" onClick={()=>void navigator.clipboard.writeText(createdLink).then(()=>setNotice("Invitation copied.")).catch(()=>setNotice("Select and copy the invitation above."))}>Copy link</button></div>}</div>}</> : null}{error && <p role="alert" className="rounded-xl border border-hot/25 bg-hot/10 p-4 text-sm leading-6 text-hot">{error}</p>}{notice && <p role="status" className="rounded-xl border border-acid/20 bg-acid/5 p-4 text-sm leading-6 text-white/75">{notice}</p>}</div></div>
      {invitation && <section className="mt-8 space-y-4"><h2 className="text-xl font-bold">Friend performances · casual comparison</h2>{[invitation.challengerAttempt, ...(invitation.recipientAttempts ?? [])].filter((item): item is SwitchAttempt => !!item).map((item)=><div key={item.id} className="max-w-xl"><SwitchPlayer challenge={item.challenge} audioUrl={item.audioUrl} takeLabel={item.owned ? "Your response" : "Friend’s take"} />{item.score && <p className="mt-2 text-sm text-white/60">Beta result: {item.score.overall ?? "Uncertain"}{item.score.overall != null ? "/100" : ""}</p>}</div>)}</section>}
    </>}
  </div></main>;
}
