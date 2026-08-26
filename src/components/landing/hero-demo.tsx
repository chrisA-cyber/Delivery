"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, RotateCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const samples = [
  {
    line: "I did not miss the exit. I selected the scenic route.",
    energy: "Like the GPS personally betrayed you",
    tag: "DELUSIONAL CONFIDENCE",
  },
  {
    line: "Respectfully, that sounds like a tomorrow problem.",
    energy: "Like a CEO ending the quarterly call",
    tag: "CORPORATE MENACE",
  },
  {
    line: "This meeting could have been a voice note.",
    energy: "Whisper it like forbidden knowledge",
    tag: "OFFICE LORE",
  },
];

export function HeroDemo() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % samples.length), 4500);
    return () => window.clearInterval(timer);
  }, []);

  const sample = samples[index] ?? samples[0]!;

  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="absolute -inset-14 -z-10 rounded-full bg-electric/15 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 22, rotate: 1.5 }}
        animate={{ opacity: 1, y: 0, rotate: -1.4 }}
        transition={{ duration: 0.55, delay: 0.15 }}
        className="panel-solid relative overflow-hidden p-5 shadow-2xl sm:p-7"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-electric via-acid to-hot" />
        <div className="flex items-center justify-between">
          <span className="mono-label rounded-full bg-acid px-2.5 py-1.5 text-black">Your line</span>
          <button
            onClick={() => setIndex((current) => (current + 1) % samples.length)}
            className="grid size-9 place-items-center rounded-full border border-white/10 text-white/50 transition hover:rotate-90 hover:bg-white/10 hover:text-white"
            aria-label="Show another prompt"
          >
            <RotateCw className="size-4" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={sample.line}
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
            transition={{ duration: 0.28 }}
            className="min-h-[220px] py-8 sm:min-h-[250px]"
          >
            <p className="text-balance text-[1.8rem] font-black leading-[1.06] tracking-[-0.045em] text-white sm:text-[2.35rem]">
              “{sample.line}”
            </p>
            <div className="mt-7 flex items-start gap-3 rounded-2xl border border-hot/20 bg-hot/10 p-3.5">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-hot" />
              <div>
                <p className="mono-label text-hot">Energy</p>
                <p className="mt-1 text-sm font-bold text-white/80">{sample.energy}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="mono-label text-white/25">{sample.tag}</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="mt-5 flex items-center justify-center">
          <div className="relative grid size-20 place-items-center rounded-full bg-acid text-black shadow-acid">
            <span className="absolute inset-0 animate-pulseRing rounded-full border border-acid" />
            <AudioLines className="size-7" />
          </div>
        </div>
        <p className="mono-label mt-4 text-center text-white/40">Tap and commit</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.85, rotate: 8 }}
        animate={{ opacity: 1, scale: 1, rotate: 5 }}
        transition={{ type: "spring", delay: 0.55 }}
        className="absolute -bottom-8 -right-2 rounded-2xl border border-white/10 bg-hot px-4 py-3 text-black shadow-hot sm:-right-8"
      >
        <p className="mono-label">Live verdict</p>
        <p className="display-type mt-1 text-2xl tracking-[-0.05em]">91 · CINEMA</p>
      </motion.div>
    </div>
  );
}
