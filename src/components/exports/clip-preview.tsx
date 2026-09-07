"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { measuredSpeechLevels } from "@/hooks/use-media-speech-level";
import { useApp } from "@/components/providers/app-provider";
import { CameraPlayback } from "@/components/recording/camera-playback";
import type { CameraSegment } from "@/lib/camera";
import { Move, Pause, Play, RotateCcw } from "lucide-react";
import { DubPlayer, type DubPlayerHandle } from "@/components/say-it-back/dub-player";
import { audioLevelAt, avatarFrame, compositionSvg, sceneFrame, type ClipEditSettings, type CompositionScene } from "@/lib/video-composition";

export interface ClipEditorSource {
  camera?: CameraSegment[];
  recordingUrl: string;
  recordingOffsetMs: number;
  duration: number;
  scene: CompositionScene;
}

const bound = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export function clipTime(seconds: number) {
  return `${Math.floor(Math.max(0, seconds) / 60)}:${(Math.max(0, seconds) % 60).toFixed(1).padStart(4, "0")}`;
}

/** Shared artwork, original media clock, and the existing unaltered dub playback. */
export function ClipPreview({ source, settings, onChange, disabled = false }: {
  source: ClipEditorSource;
  settings: ClipEditSettings;
  onChange: (patch: Partial<ClipEditSettings>) => void;
  disabled?: boolean;
}) {
  const { reducedMotion: appReducedMotion } = useApp();
  const [time, setTime] = useState(settings.trimStart);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [levels, setLevels] = useState<number[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const dub = useRef<DubPlayerHandle>(null);
  const sceneClock = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const resizing = useRef<{ id: number; x: number; size: number } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; centerX: number; centerY: number } | null>(null);
  const duration = source.duration;
  const end = Math.min(duration, settings.trimEnd ?? duration);
  const start = settings.trimStart;
  const isSay = source.scene.mode === "say-it-back";
  const pause = useCallback(() => { audio.current?.pause(); dub.current?.pause(); setPlaying(false); }, []);
  const seek = useCallback((value: number) => {
    pause();
    const next = bound(value, start, end);
    if (isSay) dub.current?.seek(next);
    else if (audio.current) audio.current.currentTime = next;
    setTime(next);
  }, [pause, start, end, isSay]);

  useEffect(() => {
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!preference) return;
    const update = () => setReducedMotion(preference.matches);
    update(); preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    setLevels([]);
    void (async () => {
      const response = await fetch(source.recordingUrl, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Voice animation could not load. Close and reopen the editor to refresh your recording.");
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 12 * 1024 * 1024) throw new Error("This recording is too large to preview voice animation here.");
      const measured = await measuredSpeechLevels(bytes);
      if (active) {
        setLevels(measured);
        if (!measured.length) setError("This browser cannot preview voice animation. Your finished video will still include it.");
      }
    })().catch((cause) => { if (active && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Voice animation could not load."); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [source.recordingUrl]);

  useEffect(() => { seek(start); }, [seek, start, source.recordingUrl]);
  useEffect(() => {
    const stopHidden = () => { if (document.visibilityState === "hidden") pause(); };
    const currentAudio = audio.current;
    const currentDub = dub.current;
    document.addEventListener("visibilitychange", stopHidden);
    return () => { document.removeEventListener("visibilitychange", stopHidden); currentAudio?.pause(); currentDub?.pause(); };
  }, [pause]);
  useEffect(() => {
    if (!playing || isSay) return;
    let request = 0;
    let last = 0;
    const tick = (now: number) => {
      const current = audio.current;
      if (!current) return;
      if (current.currentTime >= end) { current.pause(); current.currentTime = end; setTime(end); setPlaying(false); return; }
      if (now - last > 1000 / 30) { setTime(current.currentTime); last = now; }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, isSay, end]);

  async function toggle() {
    if (playing) { pause(); return; }
    setError("");
    const position = time < start || time >= end - 0.04 ? start : time;
    try {
      if (isSay) {
        if (!dub.current) throw new Error("The scene is still loading.");
        await dub.current.previewRange(position, end, "dub");
      } else if (audio.current) {
        audio.current.currentTime = position;
        await audio.current.play();
      }
      setTime(position);
    } catch (cause) { pause(); setError(cause instanceof Error ? cause.message : "Playback could not start. Tap play to retry."); }
  }

  const clock = bound(time, start, end);
  const level = audioLevelAt(levels, clock + (isSay ? source.recordingOffsetMs / 1000 : 0));
  const base = useMemo(() => compositionSvg(source.scene, settings, { time: 0, layer: "base" }), [source.scene, settings]);
  const motionReduced = reducedMotion || appReducedMotion || settings.reducedMotion;
  const content = useMemo(() => compositionSvg(source.scene, settings, { time: clock, layer: "content" }), [source.scene, settings, clock]);
  const avatar = useMemo(() => compositionSvg(source.scene, settings, { time: clock, level, reducedMotion: motionReduced, layer: "avatar" }), [source.scene, settings, clock, level, motionReduced]);
  const audioOffset = isSay ? source.recordingOffsetMs / 1000 : 0;
  const waveform = useMemo(() => compositionSvg(source.scene, settings, { time: clock, audioLevels: levels, audioOffset, reducedMotion: motionReduced, layer: "waveform" }), [source.scene, settings, clock, levels, audioOffset, motionReduced]);
  const rectangle = sceneFrame(settings);
  const avatarBounds = avatarFrame(settings);
  const centerX = (avatarBounds.x + avatarBounds.width / 2) / 1080;
  const centerY = (avatarBounds.y + avatarBounds.height / 2) / 1920;
  const cameraMirrored = settings.cameraMirror ?? source.camera?.find(s => clock >= s.start && clock < s.end)?.mirror ?? true;
  const sayScene = source.scene.mode === "say-it-back" ? source.scene.say : null;
  const move = (x: number, y: number) => onChange(cropMode && settings.performer === "camera" ? { cameraCropX: bound(x,0,1), cameraCropY: bound(y,0,1) } : { avatarX: bound(x, settings.avatarSize / 2, 1 - settings.avatarSize / 2), avatarY: bound(y, settings.avatarSize * 1080 / 1920 / 2, 1 - settings.avatarSize * 1080 / 1920 / 2) });

  return <div className="flex h-full min-h-0 w-full flex-col items-center gap-2">
    <style>{'@font-face{font-family:"DejaVu Sans";src:url("/clip-assets/delivery-video-regular.ttf") format("truetype");font-weight:400;font-display:block;}@font-face{font-family:"DejaVu Sans";src:url("/clip-assets/delivery-video-bold.ttf") format("truetype");font-weight:700;font-display:block;}.clip-artwork > svg{display:block;width:100%;height:100%}'}</style>
    <div className="flex min-h-0 w-full flex-1 items-center justify-center">
      <div ref={frame} className="relative isolate aspect-[9/16] h-full max-h-full max-w-full overflow-hidden rounded-xl bg-black shadow-2xl" style={{ width: "auto" }} aria-label="Editable clip preview">
        <div className="clip-artwork pointer-events-none absolute inset-0" dangerouslySetInnerHTML={{ __html: base }} />
        {sayScene && <div className="absolute overflow-hidden bg-black" style={{ left: `${rectangle.x / 1080 * 100}%`, top: `${rectangle.y / 1920 * 100}%`, width: `${rectangle.width / 1080 * 100}%`, height: `${rectangle.height / 1920 * 100}%` }}>
          <DubPlayer mediaRef={sceneClock} ref={dub} presentationOnly clip={sayScene.clip} role={sayScene.clip.roles.find((role) => role.id === sayScene.roleId)!} takeUrl={source.recordingUrl} recordingOffsetMs={source.recordingOffsetMs} onTime={setTime} onPlayingChange={setPlaying} />
        </div>}
        <div className="clip-artwork pointer-events-none absolute inset-0" dangerouslySetInnerHTML={{ __html: content }} />
        <div className="clip-artwork pointer-events-none absolute inset-0" aria-label="Recorded audio waveform" dangerouslySetInnerHTML={{ __html: waveform }} />
        <div className="clip-artwork pointer-events-none absolute inset-0" dangerouslySetInnerHTML={{ __html: avatar }} />
        {settings.performer === "camera" && settings.avatarVisible && source.camera?.length ? <div className="absolute" style={{ left: `${avatarBounds.x / 1080 * 100}%`, top: `${avatarBounds.y / 1920 * 100}%`, width: `${avatarBounds.width / 1080 * 100}%`, height: `${avatarBounds.height / 1920 * 100}%` }}><CameraPlayback clockRef={isSay ? sceneClock : audio} segments={source.camera} time={clock} playing={playing} settings={settings} className="size-full overflow-hidden" onError={pause} /></div> : null}
        {settings.avatarVisible && <button type="button" aria-label={settings.performer === "camera" ? cropMode ? "Crop camera. Drag, or use arrow keys." : "Move camera. Drag, or use arrow keys." : "Move avatar. Drag, or use arrow keys."} disabled={disabled} className={`absolute touch-none rounded-full border-2 outline-none focus-visible:border-electric ${dragging ? "cursor-grabbing border-electric" : "cursor-grab border-transparent hover:border-white/60"}`} style={{ left: `${centerX * 100}%`, top: `${centerY * 100}%`, width: `${settings.avatarSize * 100}%`, aspectRatio: "1", transform: "translate(-50%, -50%)" }}
          onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, centerX: cropMode ? settings.cameraCropX : centerX, centerY: cropMode ? settings.cameraCropY : centerY }; setDragging(true); }}
          onPointerMove={(event) => { const current = drag.current; const bounds = frame.current?.getBoundingClientRect(); if (!current || current.id !== event.pointerId || !bounds?.width || !bounds.height) return; move(current.centerX + (event.clientX - current.x) / bounds.width * (cropMode ? cameraMirrored ? 2 : -2 : 1), current.centerY + (event.clientY - current.y) / bounds.height * (cropMode ? -2 : 1)); }}
          onPointerUp={() => { drag.current = null; setDragging(false); }} onPointerCancel={() => { drag.current = null; setDragging(false); }}
          onKeyDown={(event) => { const step = event.shiftKey ? 0.05 : 0.01; const directions: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }; const delta = directions[event.key]; if (delta) { event.preventDefault(); move((cropMode ? settings.cameraCropX : centerX) + delta[0] * (cropMode && !cameraMirrored ? -1 : 1), (cropMode ? settings.cameraCropY : centerY) + delta[1] * (cropMode ? -1 : 1)); } }}>
          {dragging && <Move className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded bg-black/65 text-white" />}
        </button>}
        {settings.avatarVisible && <button type="button" disabled={disabled} aria-label="Resize performer. Drag, or use arrow keys." className="absolute z-10 size-7 touch-none rounded-full border-2 border-white/70 bg-ink/80 focus-visible:outline focus-visible:outline-electric" style={{ left: `${(avatarBounds.x + avatarBounds.width) / 1080 * 100}%`, top: `${(avatarBounds.y + avatarBounds.height) / 1920 * 100}%`, transform: "translate(-50%,-50%)" }}
          onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); resizing.current = { id: e.pointerId, x: e.clientX, size: settings.avatarSize }; }}
          onPointerMove={e => { const resize = resizing.current, bounds = frame.current?.getBoundingClientRect(); if (resize && resize.id === e.pointerId && bounds?.width) onChange({ avatarSize: bound(resize.size + (e.clientX - resize.x) * 2 / bounds.width, 0.14, 0.7) }); }}
          onPointerUp={() => { resizing.current = null; }} onPointerCancel={() => { resizing.current = null; }}
          onKeyDown={e => { if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(e.key)) { e.preventDefault(); onChange({ avatarSize: bound(settings.avatarSize + (["ArrowUp", "ArrowRight"].includes(e.key) ? 0.01 : -0.01), 0.14, 0.7) }); } }}>↔</button>}
      </div>
    </div>
    {settings.performer === "camera" && <div className="flex shrink-0 gap-2 text-xs"><button type="button" className="button-ghost min-h-9 px-3" aria-pressed={!cropMode} onClick={() => setCropMode(false)}>Move frame</button><button type="button" className="button-ghost min-h-9 px-3" aria-pressed={cropMode} onClick={() => setCropMode(true)}>Crop image</button></div>}
    {!isSay && <audio ref={audio} src={source.recordingUrl} preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onLoadedMetadata={() => { if (audio.current) audio.current.currentTime = start; }} onError={() => { pause(); setError("Your recording could not load. Close and reopen this editor to retry."); }} onTimeUpdate={() => { if (audio.current && audio.current.currentTime >= end) { pause(); audio.current.currentTime = end; setTime(end); } }} />}
    <div className="flex w-full max-w-md shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-black/25 px-2">
      <button type="button" className="icon-button shrink-0 border-transparent" aria-label={playing ? "Pause clip preview" : "Play clip preview"} onClick={() => void toggle()}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</button>
      <button type="button" className="icon-button shrink-0 border-transparent" aria-label="Rewind clip preview" onClick={() => seek(start)}><RotateCcw className="size-3.5" /></button>
      <input type="range" aria-label="Clip playback position" min={start} max={end} step={0.01} value={clock} onChange={(event) => seek(Number(event.target.value))} className="min-w-0 flex-1 accent-electric" />
      <span className="min-w-[4.6rem] text-right text-[10px] tabular-nums text-white/70">{clipTime(clock - start)} / {clipTime(end - start)}</span>
    </div>
    {error && <p role="alert" className="max-w-md text-xs text-orange-200">{error}</p>}
  </div>;
}
