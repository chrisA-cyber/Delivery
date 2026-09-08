"use client";

import { CONTENT_LABELS } from "@/components/content/content-control";
import type { SwitchPhrase } from "@/lib/switch/phrases";
import type { SwitchChallenge } from "@/lib/switch/types";
import { cn } from "@/lib/utils";

export function SwitchModePicker({ phrase, selectedId, onChoose, disabled = false }: {
  phrase: SwitchPhrase; selectedId?: string; onChoose: (challenge: SwitchChallenge) => void; disabled?: boolean;
}) {
  return <div className="segmented-control grid-cols-2" style={{ display: "grid" }} role="group" aria-label={`How to play: ${phrase.text}`}>
    {(["emotion", "speed"] as const).map((kind) => {
      const challenge = phrase.variants[kind];
      return <button key={kind} type="button" className={cn("min-h-11", kind === "emotion" ? "!text-hot aria-pressed:!bg-hot aria-pressed:!text-ink" : "!text-electric aria-pressed:!bg-electric aria-pressed:!text-ink")} disabled={disabled || !challenge} aria-label={`${kind === "emotion" ? "Emoji" : "Speed"}: ${phrase.text}`} aria-pressed={selectedId ? selectedId === challenge?.id : undefined} onClick={() => { if (challenge && selectedId !== challenge.id) onChoose(challenge); }}>
        <span aria-hidden="true" className="mr-2">{kind === "emotion" ? "🎭" : "⚡"}</span>{kind === "emotion" ? "Emoji" : "Speed"}
      </button>;
    })}
  </div>;
}

export function SwitchPhraseCard({ phrase, selectedId, onChoose, disabled = false, compact = false, featured = false }: {
  phrase: SwitchPhrase; selectedId?: string; onChoose: (challenge: SwitchChallenge) => void; disabled?: boolean; compact?: boolean; featured?: boolean;
}) {
  const representative = phrase.variants.emotion ?? phrase.variants.speed!;
  const selected = Object.values(phrase.variants).some((item) => item.id === selectedId);
  if (featured) return <article aria-label={`Phrase: ${phrase.text}`} className="relative mb-6 overflow-hidden rounded-2xl border border-mint/25 bg-mint/[.065] p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-bold text-mint">Start here</span><span className="text-white/55">{representative.duration} seconds · {representative.cues.length} cues</span></div>
    <div className="mt-4 grid items-end gap-5 sm:grid-cols-[1fr_15rem]">
      <div><h2 className="display-type text-5xl leading-none sm:text-6xl">“{phrase.text}”</h2><div className="mt-4 flex items-center gap-2 sm:gap-3" role="img" aria-label={`Try these emotions: ${representative.cues.map((cue) => cue.directionLabel).join(", ")}`}>{representative.cues.map((cue) => <span key={cue.id} aria-hidden="true" className="grid size-10 place-items-center rounded-xl border border-white/10 bg-black/15 text-2xl">{cue.emoji}</span>)}</div></div>
      <div><p className="mb-2 text-xs text-white/65">Pick your switch. Then hit record.</p><SwitchModePicker phrase={phrase} selectedId={selectedId} onChoose={onChoose} disabled={disabled} /></div>
    </div>
  </article>;
  if (compact) return <article aria-label={`Phrase: ${phrase.text}`} className={cn("grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-2 rounded-xl border bg-[var(--ink-soft)] p-3 transition-colors hover:border-white/30 sm:gap-4 sm:p-4", selected ? "border-mint bg-mint/5" : "border-white/10")}>
    <div className="min-w-0"><h3 className="break-words text-base font-bold leading-snug tracking-tight sm:text-lg">“{phrase.text}”</h3><p className="mt-1 text-[11px] text-white/45">{representative.duration}s · {CONTENT_LABELS[representative.rating]}</p></div>
    <div className="min-w-0 [&_button]:!px-1.5 [&_button_span]:!mr-1"><SwitchModePicker phrase={phrase} selectedId={selectedId} onChoose={onChoose} disabled={disabled} /></div>
  </article>;
  return <article aria-label={`Phrase: ${phrase.text}`} className={cn("flex flex-col rounded-2xl border bg-[var(--ink-soft)] p-5 sm:p-6", selected ? "border-hot bg-hot/5" : "border-white/15")}>
    <div className="flex items-center justify-between gap-3 text-xs text-white/55"><span>{CONTENT_LABELS[representative.rating]}</span><span>{representative.duration}s</span></div>
    <h3 className="mb-5 mt-4 flex-1 text-2xl font-bold leading-snug tracking-tight">“{phrase.text}”</h3>
    <div className="mb-5 flex items-center gap-3 text-2xl" role="img" aria-label={`${representative.kind === "emotion" ? "Emoji" : "Speed"} cues: ${representative.cues.map((cue) => cue.directionLabel).join(", ")}`}>{representative.cues.map((cue) => <span key={cue.id} aria-hidden="true">{cue.emoji}</span>)}</div>
    <SwitchModePicker phrase={phrase} selectedId={selectedId} onChoose={onChoose} disabled={disabled} />
  </article>;
}
