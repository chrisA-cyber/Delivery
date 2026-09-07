"use client";

import { useEffect, useMemo, useState } from "react";
import { loadReferenceWaveform, measureTakeWaveform, type WaveformPoint } from "@/lib/say-it-back/audio-timeline";

interface TakeWaveformProps {
  referenceUrl?: string;
  duration: number;
  rangeStart?: number;
  rangeEnd?: number;
  playhead: number;
  /** Saved points already placed in scene time. */
  takeWaveform?: WaveformPoint[];
  takeUrl?: string | null;
  takeOffsetMs?: number;
  /** Live points in capture time; liveStart places capture zero on the scene. */
  liveWaveform?: WaveformPoint[];
  liveStart?: number;
  recording?: boolean;
  level?: number;
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

export function TakeWaveform({ referenceUrl, duration, rangeStart = 0, rangeEnd = duration, playhead, takeWaveform = [], takeUrl, takeOffsetMs = 0, liveWaveform = [], liveStart = 0, recording = false, level = 0 }: TakeWaveformProps) {
  const [reference, setReference] = useState<{ url?: string; points: WaveformPoint[]; status: "loading" | "ready" | "unavailable" }>({ points: [], status: "loading" });
  const [savedTake, setSavedTake] = useState<{ url: string; offsetMs: number; points: WaveformPoint[] } | null>(null);
  const hasLocalWaveform = takeWaveform.length > 0;
  useEffect(() => {
    if (!takeUrl || hasLocalWaveform) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    void fetch(takeUrl, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const points = await measureTakeWaveform(await response.arrayBuffer(), takeOffsetMs);
      if (!controller.signal.aborted) setSavedTake({ url: takeUrl, offsetMs: takeOffsetMs, points });
    }).catch(() => undefined).finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [takeUrl, takeOffsetMs, hasLocalWaveform]);
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
  const takePath = useMemo(() => {
    const measuredTake = hasLocalWaveform ? takeWaveform : savedTake && savedTake.url === takeUrl && savedTake.offsetMs === takeOffsetMs ? savedTake.points : [];
    return envelopePath(recording ? liveWaveform : measuredTake, start, end, recording ? liveStart : 0);
  }, [recording, liveWaveform, hasLocalWaveform, takeWaveform, savedTake, takeUrl, takeOffsetMs, start, end, liveStart]);
  const position = Math.max(0, Math.min(1, (playhead - start) / (end - start))) * 1_000;
  const status = !referenceUrl ? "unavailable" : current?.status ?? "loading";
  return <div className="say-waveform rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 sm:px-4" aria-label="Original and your voice waveforms">
    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide">
      <div className="flex items-center gap-4"><span className="flex items-center gap-1.5 text-white/65"><span className="h-0.5 w-3 bg-white/60" />Original audio</span><span className="flex items-center gap-1.5 text-acid"><span className="h-0.5 w-3 bg-acid" />{recording ? "Your voice · live" : "Your voice"}</span></div>
      <span className="font-mono text-white/60">{Math.max(0, Math.min(end - start, playhead - start)).toFixed(1)} / {(end - start).toFixed(1)}s</span>
    </div>
    <svg viewBox="0 0 1000 96" preserveAspectRatio="none" className="say-waveform-graph mt-2 h-28 w-full overflow-hidden" role="img" aria-label={recording ? "Your microphone waveform overlaid on the original audio" : "Original audio and recorded voice on the same timeline"}>
      <path d="M0,48H1000" stroke="currentColor" className="text-white/10" strokeWidth="1" />
      <path d={originalPath} stroke="currentColor" className="text-white/35" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path d={takePath} stroke="currentColor" className="text-acid" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      <path d={`M${position},2V94`} stroke="currentColor" className={recording ? "text-red-400" : "text-white/70"} strokeWidth="2" />
    </svg>
    <div className="flex min-h-4 items-center justify-between gap-3 text-[10px] leading-4 text-white/60">
      <span>{recording ? "Mic live · scene muted" : status === "loading" ? "Loading original waveform…" : status === "unavailable" ? "Original waveform unavailable · listen to the scene" : "Match the starts and pauses"}</span>
      {recording && <div role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-acid" style={{ width: `${Math.min(100, Math.sqrt(Math.max(0, level)) * 100)}%` }} /></div>}
    </div>
  </div>;
}
