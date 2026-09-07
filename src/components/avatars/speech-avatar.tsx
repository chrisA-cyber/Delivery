"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { avatarSvg, type ClipAvatar } from "@/lib/video-composition";
import { cn } from "@/lib/utils";

/** Movement comes only from measured voice. Reduced motion retains a static talking indicator. */
export function SpeechAvatar({ avatar, level = 0, size = 104, className, label = "Your performance avatar" }: {
  avatar: ClipAvatar; level?: number; size?: number; className?: string; label?: string;
}) {
  const { reducedMotion } = useApp();
  const svgId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
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
  // The recording stage, saved playback and MP4 use the same character poses.
  // Scope paint IDs so multiple avatar controls can share one page safely.
  const artwork = useMemo(() => avatarSvg(avatar, { size, level: voice, reducedMotion: still })
    .replaceAll("avatar-wash-", `avatar-wash-${svgId}-`)
    .replaceAll("avatar-crop-", `avatar-crop-${svgId}-`), [avatar, size, voice, still, svgId]);
  return <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} data-speaking={voice > 0} aria-label={label} role="img">
    <div aria-hidden="true" className="h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: artwork }} />
  </div>;
}
