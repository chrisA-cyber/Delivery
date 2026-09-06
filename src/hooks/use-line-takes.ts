"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { composeLineTakes, type LineCapture } from "@/lib/say-it-back/audio-timeline";
import type { SayCue } from "@/lib/say-it-back/types";

export type LineWindow = { cue: SayCue; start: number; end: number };

/** Partitions at pauses, never by detecting or moving the player's words. */
export function lineRecordingWindows(cues: SayCue[], duration: number): LineWindow[] {
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  return sorted.map((cue, index) => ({
    cue,
    start: index === 0 ? 0 : Math.max(0, (sorted[index - 1]!.end + cue.start) / 2),
    end: index === sorted.length - 1 ? duration : Math.min(duration, (cue.end + sorted[index + 1]!.start) / 2),
  }));
}

type NamedLine = LineCapture & { cueId: string };
type AssembledTake = Awaited<ReturnType<typeof composeLineTakes>> & { audioUrl: string };

/** A failed/cancelled redo cannot replace previously accepted line audio. */
export function useLineTakes() {
  const [lines, setLines] = useState<NamedLine[]>([]);
  const [take, setTake] = useState<AssembledTake | null>(null);
  const [assembling, setAssembling] = useState(false);
  const linesRef = useRef<NamedLine[]>([]);
  const urlRef = useRef<string | null>(null);
  const operation = useRef(0);

  const reset = useCallback(() => {
    operation.current += 1;
    linesRef.current = [];
    setLines([]); setTake(null); setAssembling(false);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  const accept = useCallback(async (line: NamedLine, duration: number) => {
    const token = ++operation.current;
    const next = [...linesRef.current.filter((item) => item.cueId !== line.cueId), line].sort((a, b) => a.sceneStart - b.sceneStart);
    setAssembling(true);
    try {
      const assembled = await composeLineTakes(next, duration);
      if (token !== operation.current) return false;
      const url = URL.createObjectURL(assembled.blob);
      const oldUrl = urlRef.current;
      urlRef.current = url;
      linesRef.current = next;
      setLines(next); setTake({ ...assembled, audioUrl: url });
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      return true;
    } finally { if (token === operation.current) setAssembling(false); }
  }, []);

  const seed = useCallback((base: Blob, windows: LineWindow[], offsetMs: number) => {
    if (linesRef.current.length) return;
    const next = windows.map((window) => ({ cueId: window.cue.id, blob: base, sceneStart: window.start, sceneEnd: window.end, recordingOffsetMs: offsetMs + window.start * 1000 }));
    linesRef.current = next;
    setLines(next);
  }, []);

  useEffect(() => () => {
    operation.current += 1;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  return { lines, take, assembling, reset, accept, seed };
}
