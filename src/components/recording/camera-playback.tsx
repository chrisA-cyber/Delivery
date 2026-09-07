"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { cameraQuery, type CameraSegment } from "@/lib/camera";
import { cameraCrop, type ClipEditSettings } from "@/lib/video-composition";

const EMPTY: CameraSegment[] = [];
export function useCameraSegments(audioUrl?: string | null, local?: CameraSegment[]) {
  const [saved, setSaved] = useState<CameraSegment[]>(EMPTY);
  useEffect(() => {
    setSaved(EMPTY);
    if (local !== undefined || !audioUrl || !audioUrl.startsWith("/api/")) return;
    const controller = new AbortController();
    void fetch(cameraQuery(audioUrl), { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const body = await response.json(); if (!controller.signal.aborted && Array.isArray(body.segments)) setSaved(body.segments);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [audioUrl, local]);
  return local ?? saved;
}

/** Silent camera follows the existing audio/scene clock, including seek/retakes. */
export function CameraPlayback({ segments, time = 0, playing = false, clockRef, offset = 0, settings, className = "aspect-square w-32 shrink-0 overflow-hidden rounded-xl", onError }: {
  segments: CameraSegment[]; time?: number; playing?: boolean; clockRef?: RefObject<HTMLMediaElement | null>; offset?: number; settings?: ClipEditSettings; className?: string; onError?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [clock, setClock] = useState({ time, playing });
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [failed, setFailed] = useState(false);
  const [urls, setUrls] = useState(new Map<Blob, string>());
  useEffect(() => {
    const map = new Map<Blob, string>();
    for (const s of segments) if (s.blob && !map.has(s.blob)) map.set(s.blob, URL.createObjectURL(s.blob));
    setUrls(map);
    return () => { for (const url of map.values()) URL.revokeObjectURL(url); };
  }, [segments]);
  useEffect(() => {
    if (!clockRef) return;
    let frame = 0;
    const tick = () => { const node = clockRef.current; if (node) setClock({ time: node.currentTime + offset, playing: !node.paused && !node.ended }); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [clockRef, offset]);
  const position = clockRef ? clock.time : time, running = clockRef ? clock.playing : playing;
  const part = segments.find(s => position >= s.start && position < s.end) ?? (position >= (segments.at(-1)?.end ?? Infinity) && Math.abs(position - segments.at(-1)!.end) < 0.12 ? segments.at(-1) : undefined);
  const src = part?.blob ? urls.get(part.blob) : part?.url;
  const target = part ? Math.max(0, part.sourceStart + Math.min(position, part.end) - part.start) : 0;
  const sync = () => {
    const node = video.current; if (!node || !part) return;
    const seek = Number.isFinite(node.duration) ? Math.min(target, Math.max(0, node.duration - 0.001)) : target;
    if ((!running || node.paused || Math.abs(node.currentTime - seek) > 0.08) && Math.abs(node.currentTime - seek) > 0.018) { try { node.currentTime = seek; } catch { /* Metadata is still arriving. */ } }
    if (running && node.paused) void node.play().catch(() => { setFailed(true); onError?.(); });
    else if (!running) node.pause();
  };
  useEffect(sync, [src, target, running]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFailed(false); }, [src]);
  const crop = cameraCrop(dimensions.width, dimensions.height, settings);
  return <div className={`relative bg-black ${className}`} aria-label="Recorded camera performance" style={{ visibility: part ? "visible" : "hidden" }}>
    <div className="absolute inset-0 overflow-hidden" style={{ transform: (settings?.cameraMirror ?? part?.mirror) ? "scaleX(-1)" : undefined }}>
      <video ref={video} src={src} muted playsInline preload="auto" onLoadedMetadata={() => { const node = video.current!; setDimensions({ width: node.videoWidth || 1, height: node.videoHeight || 1 }); sync(); }} onError={() => { setFailed(true); onError?.(); }} className="absolute max-w-none" style={{ width: `${dimensions.width / crop.width * 100}%`, height: `${dimensions.height / crop.height * 100}%`, left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%` }} />
    </div>
    {failed && <button type="button" onClick={() => { setFailed(false); video.current?.load(); }} className="absolute inset-0 bg-black/70 p-2 text-xs text-white">Reload camera</button>}
  </div>;
}
