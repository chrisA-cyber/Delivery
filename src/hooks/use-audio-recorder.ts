"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "requesting" | "ready" | "recording" | "stopped" | "error";

type RecorderSession = {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  silentGain: GainNode;
  frames: Float32Array[];
  sampleCount: number;
};

function encodeMonoWav(frames: Float32Array[], sampleCount: number, sampleRate: number) {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + sampleCount * bytesPerSample);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * bytesPerSample, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * bytesPerSample, true);

  let offset = 44;
  for (const frame of frames) {
    for (let index = 0; index < frame.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, frame[index] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function useAudioRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<RecorderSession | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const permissionRequestRef = useRef(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const disposeSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    session.processor.onaudioprocess = null;
    session.source.disconnect();
    session.processor.disconnect();
    session.silentGain.disconnect();
    sessionRef.current = null;
    if (session.context.state !== "closed") await session.context.close().catch(() => undefined);
    if (mountedRef.current) setLevel(0);
  }, []);

  const requestPermission = useCallback(async () => {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !AudioContextClass) {
      setError("This browser cannot record audio. Try the latest Chrome, Safari, Edge, or Firefox.");
      setStatus("error");
      return false;
    }
    setStatus("requesting");
    setError(null);
    const requestToken = ++permissionRequestRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48_000,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      if (!mountedRef.current || permissionRequestRef.current !== requestToken) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      streamRef.current = stream;
      setStatus("ready");
      return true;
    } catch (cause) {
      if (!mountedRef.current || permissionRequestRef.current !== requestToken) return false;
      const name = cause instanceof DOMException ? cause.name : "";
      setError(name === "NotAllowedError" ? "Microphone access is blocked. Allow it in your browser settings, then try again." : "We could not reach your microphone. Check that another app is not using it.");
      setStatus("error");
      return false;
    }
  }, []);

  const start = useCallback(async () => {
    let stream = streamRef.current;
    if (!stream || stream.getTracks().every((track) => track.readyState === "ended")) {
      const granted = await requestPermission();
      if (!granted) return false;
      stream = streamRef.current;
    }
    if (!stream) return false;

    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setAudioBlob(null);
    setAudioUrl(null);
    setDurationMs(0);

    try {
      const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("AudioContext unavailable");
      const context = new AudioContextClass({ latencyHint: "interactive" });
      const captureToken = permissionRequestRef.current;
      await context.resume();
      if (!mountedRef.current || permissionRequestRef.current !== captureToken || streamRef.current !== stream) {
        await context.close().catch(() => undefined);
        return false;
      }
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      const session: RecorderSession = { context, source, processor, silentGain, frames: [], sampleCount: 0 };
      sessionRef.current = session;

      processor.onaudioprocess = (event) => {
        if (sessionRef.current !== session) return;
        const channel = event.inputBuffer.getChannelData(0);
        const copy = new Float32Array(channel);
        session.frames.push(copy);
        session.sampleCount += copy.length;
        let squareSum = 0;
        let peak = 0;
        for (const sample of copy) {
          squareSum += sample * sample;
          peak = Math.max(peak, Math.abs(sample));
        }
        const rms = Math.sqrt(squareSum / Math.max(1, copy.length));
        setLevel(Math.min(1, Math.max(peak, rms * 4.5)));
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);
      setStatus("recording");
      return true;
    } catch {
      await disposeSession();
      stopStream();
      setError("Recording could not start. Refresh the page and try once more.");
      setStatus("error");
      return false;
    }
  }, [disposeSession, requestPermission, stopStream]);

  const stop = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const { frames, sampleCount, context } = session;
    if (sampleCount < context.sampleRate * 0.25) return;
    const blob = encodeMonoWav(frames, sampleCount, context.sampleRate);
    const nextUrl = URL.createObjectURL(blob);
    audioUrlRef.current = nextUrl;
    setAudioBlob(blob);
    setAudioUrl(nextUrl);
    setDurationMs(Math.round(sampleCount / context.sampleRate * 1000));
    void disposeSession();
    stopStream();
    setStatus("stopped");
  }, [disposeSession, stopStream]);

  const reset = useCallback(() => {
    void disposeSession();
    permissionRequestRef.current += 1;
    stopStream();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setAudioBlob(null);
    setAudioUrl(null);
    setDurationMs(0);
    setError(null);
    setStatus("idle");
  }, [disposeSession, stopStream]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      permissionRequestRef.current += 1;
      void disposeSession();
      stopStream();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, [disposeSession, stopStream]);

  return { status, audioBlob, audioUrl, durationMs, level, error, requestPermission, start, stop, reset };
}
