"use client";

import { motion } from "framer-motion";
import { VISUAL_THEME } from "@/lib/visual-theme";

export function ScoreRing({ score, label = "Delivery score", size = "large" }: { score: number; label?: string; size?: "small" | "large" }) {
  const radius = size === "large" ? 76 : 42;
  const circumference = 2 * Math.PI * radius;
  const dimension = size === "large" ? 190 : 108;
  const stroke = size === "large" ? 11 : 8;

  return (
    <div className="relative" role="img" aria-label={`${label}: ${score} out of 100`} style={{ width: dimension, height: dimension }}>
      <svg width={dimension} height={dimension} className="-rotate-90" aria-hidden="true">
        <circle cx={dimension / 2} cy={dimension / 2} r={radius} fill="rgba(255,194,102,.05)" stroke={VISUAL_THEME.border} strokeWidth={stroke} />
        <motion.circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke={VISUAL_THEME.amber}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
          transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          style={{ filter: "drop-shadow(0 0 10px rgba(255,194,102,.25))" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35, type: "spring" }} className={`display-type ${size === "large" ? "text-6xl" : "text-3xl"}`}>{score}</motion.span>
        <span className="mono-label mt-1 text-[9px] text-[var(--muted)]">{label}</span>
      </div>
    </div>
  );
}
