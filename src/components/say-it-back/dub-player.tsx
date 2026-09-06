"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Captions, Headphones, LoaderCircle, Pause, Play, RotateCcw, Square, Volume2, VolumeX } from "lucide-react";
import type { SayClip, SayRole } from "@/lib/say-it-back/types";
import { cn } from "@/lib/utils";

export interface DubPlayerHandle {
  prepare: () => void;
  startScene: () => Promise<number>;
  pause: () => void;
}

function timeLabel(seconds: number) {
  return `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;
}

function isPlaybackAbort(cause: unknown) {
  return Boolean(cause && typeof cause === "object" && "name" in cause && cause.name === "AbortError");
}

/** The video is the only playback clock. The take keeps its recorded timing. */
export const DubPlayer = forwardRef<DubPlayerHandle, {
  clip: SayClip;
  role: SayRole;
  takeUrl?: string | null;
  recordingOffsetMs?: number;
  recording?: boolean;
  countdown?: number | null;
  onEnded?: () => void;
  onTime?: (time: number) => void;
  onAudioError?: () => Promise<void>;
  onInterruption?: () => void;
  onPlaybackStart?: () => void;
  onCancelCountdown?: () => void;
  takeLabel?: string;
}> (function DubPlayer({ clip, role, takeUrl, recordingOffsetMs = 0, recording = false, countdown, onEnded, onTime, onAudioError, onInterruption, onPlaybackStart, onCancelCountdown, takeLabel = "Your take" }, forwardedRef) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const voiceRef = useRef<HTMLAudioElement>(null);
  const bedRef = useRef<HTMLAudioElement>(null);
  const [kind, setKind] = useState<"original" | "dub">(takeUrl ? "dub" : "original");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [sound, setSound] = useState(true);
  const [error, setError] = useState("");
  const refreshInFlight = useRef(false);
  const refreshAttempts = useRef(0);
  const pendingPlay = useRef(new Set<HTMLAudioElement>());
  const busy = recording || countdown != null;
  const isDub = kind === "dub" && Boolean(takeUrl);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    voiceRef.current?.pause();
    bedRef.current?.pause();
    setPlaying(false);
  }, []);

  const sync = useCallback((force = false) => {
    const video = videoRef.current;
    if (!video) return;
    const voice = voiceRef.current;
    const bed = bedRef.current;
    const mutedInterval = role.muteIntervals.some((part) => video.currentTime >= part.start && video.currentTime < part.end);
    video.muted = busy || !sound || (isDub && (Boolean(role.dubAudioUrl) || mutedInterval));
    for (const [audio, offset, active] of [[voice, recordingOffsetMs / 1000, isDub], [bed, 0, isDub && Boolean(role.dubAudioUrl)]] as const) {
      if (!audio) continue;
      // Leave room for the player's voice and AAC reconstruction peaks in the
      // prepared scene track. This is playback gain only; scoring uses raw PCM.
      audio.volume = audio === bed ? 0.65 : 1;
      audio.muted = !sound || busy || !active;
      const wanted = video.currentTime + offset;
      if (Number.isFinite(audio.duration) && wanted >= audio.duration) {
        audio.pause();
        continue;
      }
      if (wanted < 0) { audio.pause(); continue; }
      if (audio.readyState > 0 && (force || Math.abs(audio.currentTime - wanted) > 0.12)) audio.currentTime = wanted;
      if (video.paused || busy || !active || video.seeking || video.readyState < 3) audio.pause();
      else if (audio.paused && audio.readyState >= 2 && !pendingPlay.current.has(audio)) {
        pendingPlay.current.add(audio);
        void audio.play().catch((cause: unknown) => {
          // Our seek/buffering/pause synchronization intentionally interrupts
          // pending audio play promises. The next frame resumes from the video
          // clock; an expected AbortError must not stop the entire scene.
          if (isPlaybackAbort(cause)) return;
          pause();
          setError("Your browser paused the dub audio. Tap play to start the scene and your voice together.");
        }).finally(() => pendingPlay.current.delete(audio));
      }
    }
  }, [role, recordingOffsetMs, busy, sound, isDub, pause]);

  const playCompanions = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused || busy || !isDub) return;
    sync(true);
    for (const audio of [voiceRef.current, bedRef.current]) {
      if (audio && !audio.ended && audio.currentTime < audio.duration && (audio !== voiceRef.current || video.currentTime + recordingOffsetMs / 1000 >= 0)) {
        void audio.play().catch((cause: unknown) => {
          if (isPlaybackAbort(cause)) return;
          pause();
          setError("Your browser paused the dub audio. Tap play to start the scene and your voice together.");
        });
      }
    }
  }, [busy, isDub, pause, sync, recordingOffsetMs]);

  useEffect(() => {
    let frame = 0;
    let lastUpdate = 0;
    const tick = (now: number) => {
      sync();
      const video = videoRef.current;
      if (video && now - lastUpdate > 70) {
        setCurrentTime(video.currentTime);
        onTime?.(video.currentTime);
        lastUpdate = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [sync, onTime]);

  useEffect(() => {
    if (takeUrl) {
      pause();
      setKind("dub");
      if (videoRef.current) videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  }, [takeUrl, pause]);

  useEffect(() => {
    const stopWhenHidden = () => { if (document.visibilityState === "hidden") pause(); };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => { document.removeEventListener("visibilitychange", stopWhenHidden); };
  }, [pause]);

  useImperativeHandle(forwardedRef, () => ({
    prepare() {
      pause();
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.muted = true;
      }
      setCurrentTime(0);
      setError("");
    },
    async startScene() {
      const video = videoRef.current;
      if (!video || video.readyState < 2) throw new Error("The scene is still loading. Let it finish, then record again.");
      video.muted = true;
      await video.play();
      return video.currentTime;
    },
    pause,
  }), [pause]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video || busy) return;
    if (!video.paused) { pause(); return; }
    setError("");
    if (video.ended || video.currentTime >= clip.duration - 0.04) video.currentTime = 0;
    sync(true);
    try {
      // Start all elements in the same user gesture for Safari's audio policy.
      const requests: Promise<void>[] = [video.play()];
      if (isDub) for (const audio of [voiceRef.current, bedRef.current]) if (audio && (audio !== voiceRef.current || video.currentTime + recordingOffsetMs / 1000 >= 0)) requests.push(audio.play());
      await Promise.all(requests.map((request) => request.catch((cause: unknown) => {
        if (!isPlaybackAbort(cause)) throw cause;
      })));
    } catch {
      pause();
      setError("Playback could not start. Check your connection and tap play again.");
    }
  };

  const seek = (time: number) => {
    if (!videoRef.current || busy) return;
    videoRef.current.currentTime = Math.min(clip.duration, Math.max(0, time));
    setCurrentTime(time);
    sync(true);
  };

  const recoverAudio = async (manual = false) => {
    pause();
    if (onAudioError && !refreshInFlight.current && (manual || refreshAttempts.current === 0)) {
      refreshInFlight.current = true;
      refreshAttempts.current += 1;
      setError("Refreshing your private playback link…");
      try { await onAudioError(); voiceRef.current?.load(); setError("Playback link refreshed. Tap play to resume."); }
      catch { setError("Your recording could not load. Reopen the result or sign in again, then retry playback."); }
      finally { refreshInFlight.current = false; }
    } else setError("The audio could not load. Check your connection and reopen this take.");
  };

  const activeCues = clip.cues.filter((cue) => currentTime >= cue.start - 0.12 && currentTime <= cue.end + 0.12);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-black">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 bg-[#242421] px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className={cn("size-2 rounded-full", recording ? "animate-pulse bg-acid" : isDub ? "bg-electric" : "bg-hot")} />
          {recording ? "Recording your scene" : isDub ? (takeLabel === "Your take" ? "Your voice. Their scene." : "Your friend’s voice. Their scene.") : "The original scene"}
        </div>
        {takeUrl && !busy && <div className="flex rounded-lg border border-white/15 p-0.5" aria-label="Compare playback" role="group">
          {(["original", "dub"] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} className={cn("min-h-9 rounded-md px-3 text-xs font-bold", kind === value ? "bg-paper text-ink" : "text-white/70")} onClick={() => { pause(); setKind(value); setError(""); }}>{value === "original" ? "Original" : takeLabel}</button>)}
        </div>}
      </div>
      <div className="relative aspect-video w-full bg-black">
        <video ref={videoRef} src={clip.videoUrl} poster={clip.posterUrl} preload="auto" playsInline aria-label={`${clip.title} scene`} className="h-full w-full object-contain" disablePictureInPicture
          onLoadedData={() => setLoaded(true)} onCanPlay={() => { setLoaded(true); setBuffering(false); }}
          onPlay={() => { setPlaying(true); onPlaybackStart?.(); }} onPlaying={() => { setBuffering(false); playCompanions(); }}
          onPause={() => { setPlaying(false); voiceRef.current?.pause(); bedRef.current?.pause(); }}
          onWaiting={() => { setBuffering(true); voiceRef.current?.pause(); bedRef.current?.pause(); if (recording) onInterruption?.(); }}
          onSeeking={() => { voiceRef.current?.pause(); bedRef.current?.pause(); sync(true); }} onSeeked={() => { sync(true); playCompanions(); }}
          onEnded={() => { pause(); onEnded?.(); }} onError={() => { setError("This scene could not load. Check your connection, then try another scene or reload."); pause(); }} />
        {takeUrl && <audio ref={voiceRef} src={takeUrl} preload="auto" onError={() => void recoverAudio()} onLoadedMetadata={() => sync(true)} />}
        {role.dubAudioUrl && <audio ref={bedRef} src={role.dubAudioUrl} preload="auto" onLoadedMetadata={() => sync(true)} onError={() => { pause(); setError("The scene background could not load. Reload before playing the dub."); }} />}
        {(!loaded || buffering) && countdown == null && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/30"><LoaderCircle aria-label="Loading scene" className="size-8 animate-spin text-paper" /></div>}
        {!playing && !busy && loaded && <button type="button" onClick={() => void togglePlay()} aria-label={isDub ? (takeLabel === "Your take" ? "Play your dubbed scene" : "Play friend’s dubbed scene") : "Watch the original scene"} className="absolute inset-0 grid place-items-center bg-black/10"><span className="grid size-16 place-items-center rounded-full border border-white/50 bg-paper/95 text-ink shadow-xl sm:size-20"><Play className="ml-1 size-7 fill-current" /></span></button>}
        {countdown != null && <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/70"><span className="mono-label text-paper">Your scene starts in</span><span className="display-type mt-1 text-[5rem] text-acid sm:mt-3 sm:text-[7rem]" aria-live="assertive">{countdown || "Go"}</span>{onCancelCountdown && <button type="button" className="mt-2 min-h-9 px-4 text-xs font-bold underline" onClick={onCancelCountdown}>Cancel</button>}</div>}
        {captions && activeCues.length > 0 && countdown == null && <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-center gap-1 sm:inset-x-8 sm:bottom-5" aria-hidden="true">
          {activeCues.map((cue) => <p key={cue.id} className={cn("max-w-full rounded-md px-3 py-1.5 text-center text-sm font-bold leading-snug shadow-lg sm:text-xl", cue.roleId === role.id ? "bg-paper/95 text-ink" : "bg-black/85 text-white")}><span className="mr-1.5 text-[10px] uppercase tracking-wide opacity-60 sm:text-xs">{cue.roleId === role.id ? (takeLabel === "Your take" ? "You" : "Friend") : clip.roles.find((item) => item.id === cue.roleId)?.name ?? "Scene"}</span>{cue.text}</p>)}
        </div>}
      </div>
      <div className="bg-[#242421] px-3 pb-3 pt-2 sm:px-4">
        <input type="range" min={0} max={clip.duration} step={0.01} value={Math.min(currentTime, clip.duration)} disabled={busy || !loaded} aria-label="Scene playback position" aria-valuetext={`${timeLabel(currentTime)} of ${timeLabel(clip.duration)}`} onChange={(event) => seek(Number(event.target.value))} className="h-6 w-full cursor-pointer accent-acid" />
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0">
          <div className="flex items-center gap-1">
            {recording ? <button type="button" className="icon-button border-acid bg-acid text-ink" onClick={onEnded} aria-label="Stop recording scene"><Square className="size-4 fill-current" /></button> : <button type="button" className="icon-button border-transparent" onClick={() => void togglePlay()} disabled={busy || !loaded} aria-label={playing ? "Pause scene" : "Play scene"}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</button>}
            <button type="button" className="icon-button border-transparent" onClick={() => seek(0)} disabled={busy || !loaded} aria-label="Replay from the start"><RotateCcw className="size-4" /></button>
            <span className="ml-1 text-xs tabular-nums text-white/65">{timeLabel(currentTime)} / {timeLabel(clip.duration)}</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="icon-button border-transparent" aria-label={captions ? "Hide captions" : "Show captions"} aria-pressed={captions} onClick={() => setCaptions(!captions)}><Captions className="size-4" /></button>
            <button type="button" className="icon-button border-transparent" disabled={busy} aria-label={sound ? "Mute scene" : "Unmute scene"} aria-pressed={!sound} onClick={() => setSound(!sound)}>{sound && !busy ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</button>
          </div>
        </div>
        {busy && <p className="mt-1 flex items-center gap-2 text-xs leading-5 text-white/65"><Headphones className="size-3.5 shrink-0" />Scene audio is off while you record. Follow the captions.</p>}
        {error && <div role="alert" className="mt-2 rounded-lg bg-acid/10 p-3 text-xs leading-5 text-[#ffbcaa]"><p>{error}</p>{takeUrl && onAudioError && <button type="button" onClick={() => void recoverAudio(true)} className="mt-2 min-h-9 font-bold underline">Reload recording</button>}</div>}
      </div>
    </div>
  );
});
