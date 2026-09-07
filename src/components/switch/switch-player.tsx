"use client";

import { forwardRef, useId, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AudioLines, Pause, Play, RotateCcw } from "lucide-react";
import type { SwitchChallenge } from "@/lib/switch/types";
import { cn } from "@/lib/utils";
import { PerformerAvatar } from "@/components/avatars/performer-avatar";
import { useMediaSpeechLevel } from "@/hooks/use-media-speech-level";

export interface SwitchPlayerHandle { play(): Promise<void>; pause(): void; seek(seconds: number): void; replay(): Promise<void> }
export const SwitchPlayer = forwardRef<SwitchPlayerHandle, {
  challenge: SwitchChallenge; audioUrl: string; className?: string; takeLabel?: string; performerAvatar?: boolean;
  externalCommand?: { revision: number; command: "play" | "pause" | "replay" };
  onPlaybackError?: () => void | Promise<void>;
}>(function SwitchPlayer({ challenge, audioUrl, className, takeLabel = "Your take", performerAvatar = false, externalCommand, onPlaybackError }, ref) {
  const audio = useRef<HTMLAudioElement>(null);
  const voiceLevel = useMediaSpeechLevel(audio, performerAvatar ? audioUrl : null);
  const seekId = useId();
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [buffering, setBuffering] = useState(false);
  const lastCommand = useRef<string | null>(null);
  const cue = challenge.cues.find((item) => time >= item.start && time < item.end) ?? challenge.cues[time >= challenge.duration ? challenge.cues.length - 1 : 0]!;
  const next = challenge.cues[challenge.cues.indexOf(cue) + 1];
  const pause = useCallback(() => { audio.current?.pause(); setPlaying(false); }, []);
  const seek = useCallback((seconds: number) => {
    if (!audio.current) return;
    audio.current.currentTime = Math.max(0, Math.min(seconds, Number.isFinite(audio.current.duration) ? audio.current.duration : challenge.duration));
    setTime(audio.current.currentTime);
  }, [challenge.duration]);
  const play = useCallback(async () => {
    if (!audio.current) return;
    setError("");
    try { await audio.current.play(); }
    catch { setPlaying(false); setError("Playback needs a tap or more time to load. Press play to try again."); }
  }, []);
  const replay = useCallback(async () => { seek(0); await play(); }, [seek, play]);
  useImperativeHandle(ref, () => ({ play, pause, seek, replay }), [play, pause, seek, replay]);
  useEffect(() => { setTime(0); setPlaying(false); setError(""); lastCommand.current = null; }, [audioUrl]);
  useEffect(() => {
    if (!playing) return;
    let frame: number;
    const tick = () => { if (audio.current) setTime(audio.current.currentTime); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => {
    if (!externalCommand) return;
    const key = `${audioUrl}:${externalCommand.revision}:${externalCommand.command}`;
    if (lastCommand.current === key) return;
    lastCommand.current = key;
    if (externalCommand.command === "pause") pause();
    else if (externalCommand.command === "replay") void replay();
    else void play();
  }, [externalCommand, audioUrl, play, pause, replay]);
  return <section className={cn("overflow-hidden rounded-2xl border border-white/15 bg-surface", className)} aria-label={`${takeLabel} with Switch cues`}>
    <audio ref={audio} src={audioUrl} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={() => setTime(audio.current?.currentTime ?? 0)} onSeeked={() => setTime(audio.current?.currentTime ?? 0)} onEnded={() => { setPlaying(false); setTime(audio.current?.currentTime ?? challenge.duration); }} onWaiting={() => setBuffering(true)} onPlaying={() => setBuffering(false)} onCanPlay={() => setBuffering(false)} onError={() => { setError("This take could not load. Try play again or reopen the saved take."); void onPlaybackError?.(); }} />
    <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3 sm:px-5"><span className="flex items-center gap-2 text-xs font-semibold text-white/55"><AudioLines className="size-3.5" />{takeLabel}</span><span className="text-xs tabular-nums text-white/50">{time.toFixed(1)} / {challenge.duration}s</span></div>
    <div className="px-4 pb-4 sm:px-5">
      <div className="rounded-xl border border-acid/20 bg-acid/[.045] px-3 py-2.5" aria-label="Current Switch direction">
        <div className="flex items-center gap-3"><span className={cn("shrink-0 font-black leading-none text-acid", challenge.kind === "speed" ? "text-4xl tabular-nums" : "text-5xl")} aria-hidden="true">{challenge.kind === "speed" ? `${cue.speed ?? 1}×` : cue.emoji}</span><div className="min-w-0 flex-1"><h3 className="text-xl font-black tracking-tight text-paper" aria-label={cue.directionLabel}>{cue.directionLabel.replace(cue.emoji, "").trim()}</h3><p className="mt-0.5 truncate text-[11px] text-white/50">{next ? `Next: ${challenge.kind === "speed" ? `${next.speed ?? 1}×` : next.emoji} ${next.directionLabel.replace(next.emoji, "").trim()}` : "Final cue"}</p></div><span className="shrink-0 text-xs tabular-nums text-acid/70">{challenge.cues.indexOf(cue) + 1} / {challenge.cues.length}</span></div>
      </div>
      <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${challenge.cues.length}, minmax(0, 1fr))` }} aria-label="Jump to a cue">
        {challenge.cues.map((item) => <button type="button" key={item.id} onClick={() => seek(item.start)} aria-label={`Jump to ${item.directionLabel}`} aria-current={cue.id === item.id ? "step" : undefined} title={`${item.directionLabel} · ${item.start}–${item.end}s`} className={cn("flex min-h-11 items-center justify-center rounded-lg border text-lg font-bold", cue.id === item.id ? "border-acid/35 bg-acid/10 text-acid" : "border-transparent text-white/45 hover:bg-white/5 hover:text-paper")}><span aria-hidden="true">{challenge.kind === "speed" ? `${item.speed ?? 1}×` : item.emoji}</span></button>)}
      </div>
      <div className="flex min-h-36 items-center gap-4 py-4 sm:gap-6">{performerAvatar && <PerformerAvatar size={128} level={voiceLevel} />}<p className="min-w-0 flex-1 text-2xl font-black leading-snug tracking-tight text-paper sm:text-3xl">“{cue.text}”</p></div>
    </div>
    <div className="border-t border-white/10 px-4 pb-3 pt-2 sm:px-5"><div className="flex items-center gap-2"><button type="button" className="button-primary min-h-11 shrink-0 px-4 text-xs" onClick={() => playing ? pause() : void play()}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}{playing ? "Pause" : "Play take"}</button><label className="sr-only" htmlFor={seekId}>Seek through take</label><input id={seekId} aria-label="Seek through take" type="range" min={0} max={challenge.duration} step={0.05} value={Math.min(time, challenge.duration)} onChange={(event) => seek(Number(event.target.value))} className="h-11 min-w-0 flex-1 accent-acid" /><button type="button" className="icon-button shrink-0 border-transparent" onClick={() => void replay()} aria-label="Replay from beginning"><RotateCcw className="size-4" /></button></div>{buffering && <p role="status" className="mt-2 text-xs text-white/50">Loading audio…</p>}{error && <p className="mt-2 text-sm text-hot" role="alert">{error}</p>}</div>
  </section>;
});
