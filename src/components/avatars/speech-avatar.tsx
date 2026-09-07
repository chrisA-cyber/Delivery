"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { BUILTIN_AVATARS, type ClipAvatar } from "@/lib/video-composition";
import { cn } from "@/lib/utils";

/** Movement comes only from measured voice. Reduced motion retains a static talking indicator. */
export function SpeechAvatar({ avatar, level = 0, size = 104, className, label = "Your performance avatar" }: {
  avatar: ClipAvatar; level?: number; size?: number; className?: string; label?: string;
}) {
  const { reducedMotion } = useApp();
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(query.matches);
    update(); query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  const voice = Math.max(0, Math.min(1, level || 0));
  const still = reducedMotion || systemReduced;
  const source = useMemo(() => avatar.kind === "upload" ? avatar.dataUrl : (BUILTIN_AVATARS.find((item) => item.id === avatar.id) ?? BUILTIN_AVATARS[0]).imageUrl, [avatar]);
  return <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} data-speaking={voice > 0} aria-label={label} role="img">
    <div className="absolute inset-0 rounded-full border-2 border-acid" style={{ opacity: voice > 0 ? 0.6 + voice * 0.4 : 0.16, transform: still ? undefined : `scale(${1 + voice * 0.07})` }} />
    <div className={cn("absolute inset-[5%] rounded-full bg-[var(--ink-soft)]", avatar.kind === "upload" && "overflow-hidden")} style={{ transform: still ? undefined : `translateY(${-voice * 2}px) scale(${1 + voice * 0.025})` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source} alt="" className={cn("h-full w-full", avatar.kind === "upload" ? "object-cover" : "object-contain")} draggable={false} />
    </div>
    <span className={cn("absolute bottom-0 right-1 size-3.5 rounded-full border-[3px] border-surface", voice > 0 ? "bg-acid" : "bg-white/25")} />
  </div>;
}
