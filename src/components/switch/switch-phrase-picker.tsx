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
      return <button key={kind} type="button" className="min-h-11" disabled={disabled || !challenge} aria-label={`${kind === "emotion" ? "Emoji" : "Speed"}: ${phrase.text}`} aria-pressed={selectedId ? selectedId === challenge?.id : undefined} onClick={() => { if (challenge && selectedId !== challenge.id) onChoose(challenge); }}>
        <span aria-hidden="true" className="mr-2">{kind === "emotion" ? "🎭" : "⚡"}</span>{kind === "emotion" ? "Emoji" : "Speed"}
      </button>;
    })}
  </div>;
}

export function SwitchPhraseCard({ phrase, selectedId, onChoose, disabled = false }: {
  phrase: SwitchPhrase; selectedId?: string; onChoose: (challenge: SwitchChallenge) => void; disabled?: boolean;
}) {
  const representative = phrase.variants.emotion ?? phrase.variants.speed!;
  const selected = Object.values(phrase.variants).some((item) => item.id === selectedId);
  return <article aria-label={`Phrase: ${phrase.text}`} className={cn("flex flex-col rounded-2xl border bg-[var(--ink-soft)] p-5 sm:p-6", selected ? "border-hot bg-hot/5" : "border-white/15")}>
    <div className="flex items-center justify-between gap-3 text-xs text-white/55"><span>{CONTENT_LABELS[representative.rating]}</span><span>{representative.duration}s</span></div>
    <h3 className="mb-5 mt-4 flex-1 text-2xl font-bold leading-snug tracking-tight">“{phrase.text}”</h3>
    <div className="mb-5 flex items-center gap-3 text-2xl" role="img" aria-label={`${representative.kind === "emotion" ? "Emoji" : "Speed"} cues: ${representative.cues.map((cue) => cue.directionLabel).join(", ")}`}>{representative.cues.map((cue) => <span key={cue.id} aria-hidden="true">{cue.emoji}</span>)}</div>
    <SwitchModePicker phrase={phrase} selectedId={selectedId} onChoose={onChoose} disabled={disabled} />
  </article>;
}
