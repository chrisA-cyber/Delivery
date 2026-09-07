"use client";

import { useEffect, useState, type RefObject } from "react";
import { readPcmWav } from "@/lib/say-it-back/audio-timeline";
import { audioLevelAt, measureAudioLevels } from "@/lib/video-composition";

/** Measure a saved recording without connecting, processing, or changing its audible playback. */
export async function measuredSpeechLevels(bytes: ArrayBuffer): Promise<number[]> {
  const pcm = readPcmWav(bytes);
  if (pcm) return measureAudioLevels(pcm.samples, pcm.sampleRate);
  const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return [];
  const context = new Context();
  try {
    const decoded = await context.decodeAudioData(bytes);
    const samples = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const input = decoded.getChannelData(channel);
      for (let i = 0; i < samples.length; i += 1) samples[i] = samples[i]! + input[i]! / decoded.numberOfChannels;
    }
    return measureAudioLevels(samples, decoded.sampleRate);
  } finally { void context.close().catch(() => undefined); }
}

export function useMediaSpeechLevel(ref: RefObject<HTMLMediaElement | null>, source?: string | null) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    const media = ref.current;
    if (!media || !source) { setLevel(0); return; }
    const controller = new AbortController();
    let levels: number[] = [];
    let frame = 0;
    let lastTick = -Infinity;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    const update = () => { setLevel(media.paused || media.ended || media.readyState < 2 ? 0 : audioLevelAt(levels, media.currentTime)); };
    const tick = (now: number) => {
      if (now - lastTick >= 1000 / 15) { lastTick = now; update(); }
      if (!media.paused && !media.ended) frame = requestAnimationFrame(tick);
    };
    const play = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(tick); };
    const pause = () => { cancelAnimationFrame(frame); setLevel(0); };
    void fetch(source, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok || Number(response.headers.get("Content-Length") ?? 0) > 12 * 1024 * 1024) return;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 12 * 1024 * 1024) return;
      const measured = await measuredSpeechLevels(bytes);
      if (!controller.signal.aborted) { levels = measured; update(); }
    }).catch(() => undefined).finally(() => clearTimeout(timeout));
    media.addEventListener("play", play);
    media.addEventListener("playing", play);
    media.addEventListener("pause", pause);
    media.addEventListener("ended", pause);
    media.addEventListener("waiting", pause);
    media.addEventListener("seeked", update);
    if (!media.paused) play();
    return () => {
      controller.abort(); clearTimeout(timeout); cancelAnimationFrame(frame);
      media.removeEventListener("play", play); media.removeEventListener("playing", play);
      media.removeEventListener("pause", pause); media.removeEventListener("ended", pause);
      media.removeEventListener("waiting", pause); media.removeEventListener("seeked", update);
    };
  }, [ref, source]);
  return level;
}
