"use client";
import Link from "next/link";
import { ArrowRight, RotateCw } from "lucide-react";
import { useState } from "react";
import { getPromptById, getEnergyModifierById } from "@/data/content";
const samples = [
  ["v2-favorite-child", "v2-confidence-tears"],
  ["v2-mirror-argument", "v2-deadpan-evidence"],
  ["v3-ref-this-is-fine", "v2-sincere-confession"],
] as const;
export function HeroDemo() {
  const [index, setIndex] = useState(0);
  const [promptId, energyId] = samples[index]!;
  const prompt = getPromptById(promptId)!;
  const energy = getEnergyModifierById(energyId)!;
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="hero-cue">
        <div className="hero-cue-line">
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="mono-label">Your next Classic line</p>
            <button
              type="button"
              onClick={() => setIndex((value) => (value + 1) % samples.length)}
              className="group/refresh grid size-11 shrink-0 place-items-center rounded-lg border border-ink/20 transition-colors hover:bg-ink/5"
              aria-label="Show another prompt"
            >
              <RotateCw className="size-4 transition-transform duration-300 group-hover/refresh:rotate-90" />
            </button>
          </div>
          <blockquote aria-live="polite">“{prompt.line}”</blockquote>
        </div>
        <div className="hero-direction">
          <p className="mono-label mb-2">The direction</p>
          <p className="text-xl font-bold tracking-tight">
            {energy.shortLabel}
          </p>
          <p className="mt-2 text-sm leading-6">{energy.instruction}</p>
        </div>
        <Link
          href={`/play?prompt=${promptId}&energy=${energyId}`}
          className="group flex min-h-14 items-center justify-between gap-3 px-7 text-sm font-bold transition-colors hover:bg-ink/5"
        >
          Play this line
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
