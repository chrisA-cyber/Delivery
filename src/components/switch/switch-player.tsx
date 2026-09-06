"use client";

import { forwardRef, useId, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AudioLines, Pause, Play, RotateCcw } from "lucide-react";
import type { SwitchChallenge } from "@/lib/switch/types";
import { cn } from "@/lib/utils";

export interface SwitchPlayerHandle { play(): Promise<void>; pause(): void; seek(seconds: number): void; replay(): Promise<void> }
export const SwitchPlayer = forwardRef<SwitchPlayerHandle, {
  challenge: SwitchChallenge; audioUrl: string; className?: string; takeLabel?: string;
  externalCommand?: { revision: number; command: "play" | "pause" | "replay" };
  onPlaybackError?: () => void | Promise<void>;
}>(function SwitchPlayer({ challenge, audioUrl, className, takeLabel = "Your take", externalCommand, onPlaybackError }, ref) {
  const audio = useRef<HTMLAudioElement>(null);
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
  return <section className={cn("overflow-hidden rounded-2xl border border-white/15 bg-[#20201d]", className)} aria-label={`${takeLabel} with Switch cues`}>
    <audio ref={audio} src={audioUrl} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={() => setTime(audio.current?.currentTime ?? 0)} onSeeked={() => setTime(audio.current?.currentTime ?? 0)} onEnded={() => { setPlaying(false); setTime(audio.current?.currentTime ?? challenge.duration); }} onWaiting={() => setBuffering(true)} onPlaying={() => setBuffering(false)} onCanPlay={() => setBuffering(false)} onError={() => { setError("This take could not load. Try play again or reopen the saved take."); void onPlaybackError?.(); }} />
    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3"><span className="mono-label flex items-center gap-2 text-white/60"><AudioLines className="size-4" />{takeLabel}</span><span className="text-xs tabular-nums text-white/55">{time.toFixed(1)} / {challenge.duration}s</span></div>
    <div className="p-5 sm:p-7"><p className="mono-label text-acid">{time >= challenge.duration ? "Last direction" : "Direction now"}</p><h3 className="mt-2 text-3xl font-black tracking-tight text-acid sm:text-4xl"><span className="mb-3 block text-6xl" aria-hidden="true">{cue.emoji}</span>{cue.directionLabel}</h3><p className="mt-4 text-xl font-semibold leading-relaxed text-paper">{cue.text}</p><p className="mt-4 text-xs text-white/55">{next ? `Up next: ${next.emoji} ${next.directionLabel} · at ${next.start}s` : "Bring it home. This is the final switch."}</p></div>
    <div className="border-t border-white/10 p-4 sm:px-6"><label className="sr-only" htmlFor={seekId}>Seek through take</label><input id={seekId} aria-label="Seek through take" type="range" min={0} max={challenge.duration} step={0.05} value={Math.min(time, challenge.duration)} onChange={(event) => seek(Number(event.target.value))} className="h-8 w-full accent-acid" /><div className="mt-1 flex flex-wrap items-center gap-2"><button type="button" className="button-primary min-h-11 px-5" onClick={() => playing ? pause() : void play()}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}{playing ? "Pause" : "Play take"}</button><button type="button" className="button-ghost min-h-11 px-3" onClick={() => void replay()} aria-label="Replay from beginning"><RotateCcw className="size-4" /></button><span className="ml-auto text-xs text-white/50">{buffering ? "Loading audio…" : "One continuous take"}</span></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{challenge.cues.map((item, index) => <button type="button" key={item.id} onClick={() => seek(item.start)} aria-label={`Jump to ${item.directionLabel}`} className={cn("min-h-12 rounded-lg border px-2 py-2 text-left text-xs leading-4", cue.id === item.id ? "border-acid/50 bg-acid/10 text-acid" : "border-white/10 text-white/60 hover:border-white/40")}><span className="block text-[10px] opacity-60">{index + 1} · {item.start}–{item.end}s</span>{item.emoji} {item.directionLabel}</button>)}</div>{error && <p className="mt-3 text-sm text-hot" role="alert">{error}</p>}</div>
  </section>;
});
