"use client";

import { ArrowLeft, Clapperboard, LoaderCircle, LockKeyhole, Mic, RefreshCw, Shuffle } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { SwitchPlayer, type SwitchPlayerHandle } from "@/components/switch/switch-player";
import type { SwitchScore } from "@/lib/switch/types";
import { ContentControl, CONTENT_LABELS } from "@/components/content/content-control";
import { useApp } from "@/components/providers/app-provider";
import { SavedAudio } from "@/components/game/saved-audio";
import { DubPlayer } from "@/components/say-it-back/dub-player";
import type { GroupAssignment, GroupPerformance } from "@/lib/groups/types";
import type { SayScore } from "@/lib/say-it-back/types";
import type { DeliveryJudgment } from "@/lib/types";
import type { RoundApiError } from "./round-api";

export function RoundUnavailable({ error, loading, retry }: { error: RoundApiError | null; loading: boolean; retry: () => void }) {
  const { contentRating, updatePreferences } = useApp();
  const restricted = error?.code === "CONTENT_OPT_IN_REQUIRED";
  return <main className="min-h-screen px-4 pb-28 pt-32"><section className="panel-solid mx-auto max-w-xl p-6 sm:p-8"><Link href="/rounds" className="mb-6 inline-flex min-h-10 items-center gap-2 text-xs text-white/65"><ArrowLeft className="size-4" />Friend rounds</Link>{loading ? <p role="status" className="flex items-center gap-3 py-12 text-sm text-white/65"><LoaderCircle className="size-5 animate-spin" />Opening your round…</p> : <><LockKeyhole className="size-9 text-hot" /><h1 className="mt-5 text-3xl font-bold">{restricted ? "Check your content setting." : "We couldn’t open this round."}</h1><p role={restricted ? "status" : "alert"} className="my-5 text-sm leading-7 text-white/70">{error?.message ?? "The invitation may have expired or been revoked. Ask your friend for their next-round link."}</p>{restricted && <ContentControl value={contentRating} onChange={(rating) => updatePreferences({ contentRating: rating })} allowMature={false} />}<button type="button" onClick={retry} className="button-secondary mt-5"><RefreshCw className="size-4" />Try again</button></>}</section></main>;
}

export function AssignmentCard({ assignment, compact = false }: { assignment: GroupAssignment; compact?: boolean }) {
  return <section className="overflow-hidden rounded-2xl border border-white/15 bg-[#20201d]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 p-4 sm:px-5"><p className="mono-label flex items-center gap-2 text-hot">{assignment.mode === "switch" ? <Shuffle className="size-4" /> : assignment.mode === "say-it-back" ? <Clapperboard className="size-4" /> : <Mic className="size-4" />}{assignment.mode === "switch" ? "Switch · Beta" : assignment.mode === "say-it-back" ? "Say It Back" : "Classic"} · Everyone’s assignment</p><span className="text-[10px] text-white/60">{CONTENT_LABELS[assignment.rating]}</span></div>
    {assignment.mode === "switch" ? <div className="p-5 sm:p-7"><p className="mono-label mb-2 text-hot">{assignment.challenge.kind === "speed" ? "Speaking speed" : "Emotions"}</p><h2 className="text-2xl font-bold">{assignment.challenge.title}</h2><p className="mt-2 text-sm leading-6 text-white/65">{assignment.challenge.description}</p><p className="mt-5 text-xs font-bold text-hot">Keep repeating this phrase</p><p className="mt-2 text-2xl font-bold leading-8">“{assignment.challenge.cues[0]?.text}”</p><ol className="mt-5 space-y-4">{assignment.challenge.cues.map((cue) => <li key={cue.id} className="flex items-start gap-3"><span className="text-3xl" aria-hidden="true">{cue.emoji}</span><div><p className="text-sm font-bold text-hot">{cue.directionLabel}<span className="ml-2 text-xs font-normal text-white/50">{cue.start}–{cue.end}s</span></p>{!compact && <p className="mt-1 text-xs leading-6 text-white/60">{cue.direction}</p>}</div></li>)}</ol><p className="mt-5 text-xs leading-6 text-white/50">{assignment.challenge.duration} seconds · one uninterrupted take · full-take retries. Same phrase and cue sequence for everyone. Switch beta scores are casual and unranked.</p></div> : assignment.mode === "classic" ? <div className="p-5 sm:p-7"><p className="text-xl font-bold leading-8 sm:text-2xl">“{assignment.promptText}”</p><p className="mt-5 border-l-2 border-acid pl-4 text-sm leading-6 text-white/70">{assignment.energy}</p><p className="mt-5 text-xs leading-5 text-white/50">One funny line, your interpretation. No camera. Up to 20 seconds.</p></div> : <div className="p-4 sm:p-5"><h2 className="text-xl font-bold">{assignment.clip.title}</h2><p className="mt-1 text-xs text-white/60">{assignment.clip.source.title} · {Math.round(assignment.clip.duration)} sec · You play {assignment.clip.roles.find((role) => role.id === assignment.roleId)?.name}</p>{!compact && <div className="mt-4"><DubPlayer clip={assignment.clip} role={assignment.clip.roles.find((role) => role.id === assignment.roleId)!} /></div>}<p className="mt-4 text-sm leading-6 text-white/65">{assignment.clip.description}</p><p className="mt-3 text-xs text-white/50">{assignment.clip.cues.filter((cue) => cue.roleId === assignment.roleId).length} recording lines · {assignment.clip.difficulty}</p></div>}
  </section>;
}

export function GroupPlayback({ performance, assignment, label, refresh }: { performance: GroupPerformance; assignment: GroupAssignment; label: string; refresh: () => Promise<void> }) {
  const switchPlayer = useRef<SwitchPlayerHandle>(null);
  if (performance.mode === "switch" && assignment.mode === "switch") return <div><SwitchPlayer ref={switchPlayer} key={performance.takeId} challenge={assignment.challenge} audioUrl={performance.audioUrl} takeLabel={label} onPlaybackError={refresh} /><div className="mt-4"><ScoreDetails performance={performance} onSeek={(seconds) => switchPlayer.current?.seek(seconds)} /></div></div>;
  if (performance.mode === "say-it-back" && assignment.mode === "say-it-back") return <DubPlayer key={performance.takeId} clip={assignment.clip} role={assignment.clip.roles.find((role) => role.id === assignment.roleId)!} takeLabel={label} takeUrl={performance.audioUrl} recordingOffsetMs={performance.sayAttempt?.recordingOffsetMs ?? 0} onAudioError={refresh} />;
  return <div className="rounded-xl border border-electric/20 bg-electric/5 p-4 sm:p-6"><p className="mb-4 flex items-center gap-2 text-sm font-bold"><Mic className="size-4 text-electric" />{label}</p><SavedAudio key={`${performance.takeId}:${performance.audioUrl}`} url={performance.audioUrl} label={label} reloadOnRetry /></div>;
}

export function performanceScore(performance: GroupPerformance | null): number | null {
  if (!performance?.score || performance.scoreGroup === "unscored") return null;
  const score = "scores" in performance.score ? performance.score.scores.overall : performance.score.overall;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

export function ScoreDetails({ performance, onSeek }: { performance: GroupPerformance; onSeek?: (seconds: number) => void }) {
  if (performance.mode === "switch" && !onSeek) return null;
  if (!performance.score || (performance.scoreGroup === "unscored" && performance.mode !== "switch")) return <p className="text-xs leading-6 text-white/60">Replay only · no comparable score. The performance is still part of the show and the audience vote.</p>;
  if (performance.mode === "switch") {
    const score = performance.score as SwitchScore;
    return <div><p className="mono-label text-hot">Switch beta · casual feedback</p>{score.overall == null && <p className="mt-3 text-xs leading-6 text-orange-200">Judgment is uncertain. This take stays in the show without a comparison score.</p>}<div className="mt-4 grid grid-cols-3 gap-3">{([["Words", score.words], ["Delivery", score.delivery], ["Switches", score.transitions]] as const).map(([label, value]) => <div key={label}><p className="text-xs text-white/60">{label}</p><p className="mt-1 text-xl font-bold">{value == null ? "—" : Math.round(value)}</p></div>)}</div><div className="mt-4 space-y-2">{score.segments.map((segment, index) => { const cue = performance.switchAttempt?.challenge.cues.find((item) => item.id === segment.cueId); return <button key={segment.cueId} type="button" disabled={!cue} onClick={() => { if (cue) onSeek?.(cue.start); }} className="block min-h-11 w-full rounded-lg border border-white/15 px-3 py-3 text-left hover:border-hot/50"><span className="text-xs font-bold text-hot">{cue?.emoji} {cue?.directionLabel ?? `Segment ${index + 1}`}{cue ? ` · Jump to ${cue.start}s` : ""}</span><span className="mt-1 block text-xs leading-6 text-white/70">{segment.feedback}</span></button>; })}</div><p className="mt-4 text-sm leading-6 text-white/75">{score.coachNote}</p>{score.transitionFeedback && <p className="mt-2 text-xs leading-6 text-white/60">{score.transitionFeedback}</p>}{score.limitations.map((limitation) => <p key={limitation} className="mt-2 text-xs leading-6 text-orange-200">{limitation}</p>)}<p className="mt-3 text-[11px] leading-5 text-white/50">Audio-based beta feedback. Timing is approximate; ordinary device latency is allowed. Compare only this challenge and scoring version. No ranked leaderboard impact.</p></div>;
  }
  if (performance.mode === "classic") {
    const score = performance.score as DeliveryJudgment;
    return <div><p className="text-base font-bold leading-6">{score.verdict}</p><div className="mt-4 grid grid-cols-4 gap-2">{([['Commitment', score.scores.commitment], ['Comedy', score.scores.comedy], ['Accuracy', score.scores.accuracy], ['Chaos', score.scores.chaos]] as const).map(([label, value]) => <div key={label} className="rounded-lg bg-white/5 px-1 py-3 text-center"><p className="text-xl font-bold">{Math.round(value)}</p><p className="mt-1 text-[9px] text-white/55 sm:text-[10px]">{label}</p></div>)}</div><p className="mt-3 text-xs leading-6 text-white/60">{score.coachNote}</p></div>;
  }
  const score = performance.score as SayScore;
  return <div><div className="grid grid-cols-3 gap-3">{([['Words', score.words], ['Timing', score.timing], ['Rhythm', score.rhythm]] as const).map(([label, value]) => <div key={label}><p className="text-xs text-white/60">{label}</p><p className="mt-1 text-xl font-bold">{value == null ? "—" : Math.round(value)}</p></div>)}</div><p className="mt-4 text-xs leading-6 text-white/65">{score.coachNote}</p><p className="mt-2 text-[11px] leading-5 text-white/50">{performance.scoreGroup === "words-only" ? "Words-only: timing could not be measured. Ranked separately from full matches." : "Words 50% · timing 30% · rhythm 20%. Emotion and intonation are not scored."}</p></div>;
}
