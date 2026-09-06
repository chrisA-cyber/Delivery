"use client";

import { ArrowLeft, Clapperboard, LoaderCircle, LockKeyhole, Mic, RefreshCw } from "lucide-react";
import Link from "next/link";
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 p-4 sm:px-5"><p className="mono-label flex items-center gap-2 text-hot">{assignment.mode === "say-it-back" ? <Clapperboard className="size-4" /> : <Mic className="size-4" />}{assignment.mode === "say-it-back" ? "Say It Back" : "Classic"} · Everyone’s assignment</p><span className="text-[10px] text-white/60">{CONTENT_LABELS[assignment.rating]}</span></div>
    {assignment.mode === "classic" ? <div className="p-5 sm:p-7"><p className="text-xl font-bold leading-8 sm:text-2xl">“{assignment.promptText}”</p><p className="mt-5 border-l-2 border-acid pl-4 text-sm leading-6 text-white/70">{assignment.energy}</p><p className="mt-5 text-xs leading-5 text-white/50">One funny line, your interpretation. No camera. Up to 20 seconds.</p></div> : <div className="p-4 sm:p-5"><h2 className="text-xl font-bold">{assignment.clip.title}</h2><p className="mt-1 text-xs text-white/60">{assignment.clip.source.title} · {Math.round(assignment.clip.duration)} sec · You play {assignment.clip.roles.find((role) => role.id === assignment.roleId)?.name}</p>{!compact && <div className="mt-4"><DubPlayer clip={assignment.clip} role={assignment.clip.roles.find((role) => role.id === assignment.roleId)!} /></div>}<p className="mt-4 text-sm leading-6 text-white/65">{assignment.clip.description}</p><p className="mt-3 text-xs text-white/50">{assignment.clip.cues.filter((cue) => cue.roleId === assignment.roleId).length} recording lines · {assignment.clip.difficulty}</p></div>}
  </section>;
}

export function GroupPlayback({ performance, assignment, label, refresh }: { performance: GroupPerformance; assignment: GroupAssignment; label: string; refresh: () => Promise<void> }) {
  if (performance.mode === "say-it-back" && assignment.mode === "say-it-back") return <DubPlayer key={performance.takeId} clip={assignment.clip} role={assignment.clip.roles.find((role) => role.id === assignment.roleId)!} takeLabel={label} takeUrl={performance.audioUrl} recordingOffsetMs={performance.sayAttempt?.recordingOffsetMs ?? 0} onAudioError={refresh} />;
  return <div className="rounded-xl border border-electric/20 bg-electric/5 p-4 sm:p-6"><p className="mb-4 flex items-center gap-2 text-sm font-bold"><Mic className="size-4 text-electric" />{label}</p><SavedAudio key={`${performance.takeId}:${performance.audioUrl}`} url={performance.audioUrl} label={label} reloadOnRetry /></div>;
}

export function performanceScore(performance: GroupPerformance | null): number | null {
  if (!performance?.score || performance.scoreGroup === "unscored") return null;
  return "scores" in performance.score ? performance.score.scores.overall : performance.score.overall;
}

export function ScoreDetails({ performance }: { performance: GroupPerformance }) {
  if (!performance.score || performance.scoreGroup === "unscored") return <p className="text-xs leading-6 text-white/60">Replay only · no comparable score. The performance is still part of the show and the audience vote.</p>;
  if (performance.mode === "classic") {
    const score = performance.score as DeliveryJudgment;
    return <div><p className="text-base font-bold leading-6">{score.verdict}</p><div className="mt-4 grid grid-cols-4 gap-2">{([['Commitment', score.scores.commitment], ['Comedy', score.scores.comedy], ['Accuracy', score.scores.accuracy], ['Chaos', score.scores.chaos]] as const).map(([label, value]) => <div key={label} className="rounded-lg bg-white/5 px-1 py-3 text-center"><p className="text-xl font-bold">{Math.round(value)}</p><p className="mt-1 text-[9px] text-white/55 sm:text-[10px]">{label}</p></div>)}</div><p className="mt-3 text-xs leading-6 text-white/60">{score.coachNote}</p></div>;
  }
  const score = performance.score as SayScore;
  return <div><div className="grid grid-cols-3 gap-3">{([['Words', score.words], ['Timing', score.timing], ['Rhythm', score.rhythm]] as const).map(([label, value]) => <div key={label}><p className="text-xs text-white/60">{label}</p><p className="mt-1 text-xl font-bold">{value == null ? "—" : Math.round(value)}</p></div>)}</div><p className="mt-4 text-xs leading-6 text-white/65">{score.coachNote}</p><p className="mt-2 text-[11px] leading-5 text-white/50">{performance.scoreGroup === "words-only" ? "Words-only: timing could not be measured. Ranked separately from full matches." : "Words 50% · timing 30% · rhythm 20%. Emotion and intonation are not scored."}</p></div>;
}
