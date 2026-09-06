"use client";

import { useEffect, useMemo, useState } from "react";
import { loadReferenceWaveform, type WaveformPoint } from "@/lib/say-it-back/audio-timeline";

interface TakeWaveformProps {
  referenceUrl?: string;
  duration: number;
  rangeStart?: number;
  rangeEnd?: number;
  playhead: number;
  /** Saved points already placed in scene time. */
  takeWaveform?: WaveformPoint[];
  /** Live points in capture time; liveStart places capture zero on the scene. */
  liveWaveform?: WaveformPoint[];
  liveStart?: number;
  recording?: boolean;
}

function envelopePath(points: WaveformPoint[], start: number, end: number, offset = 0) {
  const span = Math.max(0.001, end - start);
  return points.filter((point) => point.time + offset >= start && point.time + offset <= end).map((point) => {
    const x = (point.time + offset - start) / span * 1_000;
    // The same visual amplitude scale is used for both recordings. A square root
    // makes quiet measured input visible; it does not normalize either take.
    const height = Math.sqrt(Math.max(0, Math.min(1, point.peak))) * 37;
    return `M${x.toFixed(1)},${(48 - height).toFixed(1)}V${(48 + height).toFixed(1)}`;
  }).join("");
}

export function TakeWaveform({ referenceUrl, duration, rangeStart = 0, rangeEnd = duration, playhead, takeWaveform = [], liveWaveform = [], liveStart = 0, recording = false }: TakeWaveformProps) {
  const [reference, setReference] = useState<{ url?: string; points: WaveformPoint[]; status: "loading" | "ready" | "unavailable" }>({ points: [], status: "loading" });
  useEffect(() => {
    let active = true;
    if (!referenceUrl) return;
    void loadReferenceWaveform(referenceUrl).then((points) => {
      if (active) setReference({ url: referenceUrl, points, status: "ready" });
    }).catch(() => {
      if (active) setReference({ url: referenceUrl, points: [], status: "unavailable" });
    });
    return () => { active = false; };
  }, [referenceUrl]);
  const current = reference.url === referenceUrl ? reference : null;
  const start = Math.max(0, rangeStart);
  const end = Math.max(start + 0.001, Math.min(duration, rangeEnd));
  const originalPath = useMemo(() => envelopePath(current?.points ?? [], start, end), [current?.points, start, end]);
  const takePath = useMemo(() => envelopePath(recording ? liveWaveform : takeWaveform, start, end, recording ? liveStart : 0), [recording, liveWaveform, takeWaveform, start, end, liveStart]);
  const position = Math.max(0, Math.min(1, (playhead - start) / (end - start))) * 1_000;
  const status = !referenceUrl ? "unavailable" : current?.status ?? "loading";
  return <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 sm:px-4" aria-label="Original and your voice waveforms">
    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide">
      <div className="flex items-center gap-4"><span className="flex items-center gap-1.5 text-white/65"><span className="h-0.5 w-3 bg-white/60" />Original audio</span><span className="flex items-center gap-1.5 text-acid"><span className="h-0.5 w-3 bg-acid" />{recording ? "Your voice · live" : "Your voice"}</span></div>
      <span className="font-mono text-white/45">{start.toFixed(1)}–{end.toFixed(1)}s</span>
    </div>
    <svg viewBox="0 0 1000 96" preserveAspectRatio="none" className="mt-2 h-24 w-full overflow-hidden" role="img" aria-label={recording ? "Your microphone waveform overlaid on the original audio" : "Original audio and recorded voice on the same timeline"}>
      <path d="M0,48H1000" stroke="currentColor" className="text-white/10" strokeWidth="1" />
      <path d={originalPath} stroke="currentColor" className="text-white/40" strokeWidth="2.5" />
      <path d={takePath} stroke="currentColor" className="text-acid" strokeWidth="2" />
      <path d={`M${position},2V94`} stroke="currentColor" className={recording ? "text-red-400" : "text-white/70"} strokeWidth="2" />
    </svg>
    <p className="text-[10px] leading-4 text-white/45">{status === "loading" ? "Loading the original waveform… You can still record." : status === "unavailable" ? "Original waveform unavailable. You can still listen and record." : "Follow the phrase starts and pauses. Wave height shows audio level, not your score."}</p>
  </div>;
}
