"use client";

import Link from "next/link";
import { ArrowRight, Gauge, RotateCw, Shuffle, Smile } from "lucide-react";
import { useState } from "react";
import { getSwitchChallenge } from "@/lib/switch/catalog";
import type { SwitchChallenge } from "@/lib/switch/types";
import { cn } from "@/lib/utils";

const samples = ["literally", "not-my-problem", "im-cooked"] as const;

export function HeroDemo() {
  const [index, setIndex] = useState(0);
  const [kind, setKind] = useState<SwitchChallenge["kind"]>("emotion");
  const challenge = getSwitchChallenge(`${kind === "speed" ? "speed-" : ""}${samples[index]}`)!;
  const phrase = challenge.cues[0]!.text;
  const isEmotion = kind === "emotion";

  return (
    <div className="home-grid">
      <div>
        <p className="mono-label mb-3 flex items-center gap-2 text-mint sm:mb-4">
          <Shuffle className="size-4" />
          Meet Switch
        </p>
        <h1 className="display-type home-headline">
          Same phrase.
          <br />
          <span className="text-gradient">Different energy.</span>
        </h1>
        <p className="mt-3 max-w-md text-base leading-7 text-white/75 sm:mt-5 sm:text-lg">
          Say it again. Change the emotion or speed. See how far you can take it.
        </p>
        <p className="mt-2 text-xs leading-6 text-white/55 sm:mt-6">
          Your avatar or camera. No account needed.
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-3xl border border-mint/25 bg-surface shadow-[0_24px_72px_rgba(0,0,0,.25)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5 sm:px-6">
          <span className="flex items-center gap-2 text-sm font-bold text-mint"><Shuffle className="size-4" /> Switch</span>
          <span className="text-xs font-bold text-white/60">{challenge.cues.length} cues · {challenge.duration} seconds</span>
        </div>
        <div className="px-5 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-white/10 bg-ink/50 p-1" role="group" aria-label="Switch challenge style">
              {(["emotion", "speed"] as const).map((value) => {
                const Icon = value === "emotion" ? Smile : Gauge;
                return <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors", kind === value ? value === "emotion" ? "bg-hot text-ink" : "bg-electric text-ink" : "text-white/65 hover:text-paper")}><Icon className="size-3.5" />{value === "emotion" ? "Emotion" : "Speed"}</button>;
              })}
            </div>
            <button type="button" onClick={() => setIndex((value) => (value + 1) % samples.length)} className="icon-button shrink-0" aria-label="Try another phrase" title="Try another phrase">
              <RotateCw className="size-4" />
            </button>
          </div>
          <div aria-live="polite" aria-atomic="true">
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[.14em] text-white/50 sm:mt-5">Your phrase</p>
            <blockquote className="mb-4 mt-2 flex min-h-[60px] items-center text-[clamp(2.25rem,4vw,3.25rem)] font-bold leading-[1.08] tracking-[-.055em] text-paper sm:mb-5 sm:min-h-[110px]">
              “{phrase}”
            </blockquote>
            <p className="mb-2.5 text-xs text-white/65">{isEmotion ? "Say it with each emotion" : "Say it at each speed"}</p>
            <ol className="grid grid-cols-5 gap-1.5" aria-label="Your five cues">
              {challenge.cues.map((cue) => (
                <li key={cue.id} className={cn("flex min-w-0 flex-col items-center gap-2 rounded-xl border px-1 py-3", isEmotion ? "border-hot/20 bg-hot/[.07]" : "border-electric/20 bg-electric/[.07]")}>
                  <span className={cn(isEmotion ? "text-2xl sm:text-3xl" : "py-1 text-xl font-bold leading-6 tracking-tight text-electric")} aria-hidden="true">{isEmotion ? cue.emoji : `${cue.speed}×`}</span>
                  <span className={cn("text-center text-[10px] font-bold leading-3", isEmotion ? "text-hot" : "text-electric")}>{isEmotion ? cue.directionLabel : cue.directionLabel.split(" · ")[0]}{!isEmotion && <span className="sr-only"> · {cue.speed} times</span>}</span>
                </li>
              ))}
            </ol>
          </div>
          <Link href={`/switch?id=${challenge.id}`} className="button-primary mt-4 min-h-14 w-full justify-between px-5 sm:mt-5" aria-label={`Play Switch: ${phrase} with ${isEmotion ? "emotions" : "speeds"}`}>
            Play Switch
            <ArrowRight className="size-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
