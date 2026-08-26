"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const messages = ["Checking commitment…", "Measuring unnecessary drama…", "Consulting the aura department…", "Writing something devastating…"];

export function JudgingLoader() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % messages.length), 1450);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section aria-busy="true" aria-labelledby="judging-title" className="mx-auto grid min-h-[70vh] max-w-xl place-content-center text-center">
      <div className="relative mx-auto grid size-40 place-items-center">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-dashed border-acid/45" style={{ animationDuration: "6s" }} />
        <span className="absolute inset-5 animate-spin rounded-full border-2 border-dashed border-hot/40" style={{ animationDirection: "reverse", animationDuration: "4s" }} />
        <span className="display-type text-5xl text-white">D</span>
      </div>
      <p id="judging-title" className="mono-label mt-8 text-acid">The booth is deliberating</p>
      <AnimatePresence mode="wait">
        <motion.p role="status" aria-live="polite" aria-atomic="true" key={messages[index]} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-3 min-h-7 text-lg font-black text-white/65">
          {messages[index]}
        </motion.p>
      </AnimatePresence>
      <p className="mt-8 text-xs text-white/30">Usually 5–12 seconds. Do not flee the scene.</p>
    </section>
  );
}
