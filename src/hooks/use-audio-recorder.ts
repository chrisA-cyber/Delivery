"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WAVEFORM_BIN_SECONDS, type WaveformPoint } from "@/lib/say-it-back/audio-timeline";
import { encodeMonoWav, inspectTake, MAX_RECORDING_BYTES, MAX_RECORDING_MS, type TakeQuality } from "@/lib/audio-capture";

export type RecorderStatus = "idle" | "requesting" | "ready" | "recording" | "stopped" | "error";
export type RecordingStopReason = "user" | "limit" | "size-limit" | "interrupted" | "hidden";

type RecorderSession = {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  silentGain: GainNode;
  frames: Float32Array[];
  sampleCount: number;
  lastFrameAt: number | null;
  waveform: WaveformPoint[];
  waveformBinSamples: number;
  waveformBinPeak: number;
  cleanup: () => void;
};

type PreservedTake = {
  blob: Blob | null;
  url: string | null;
  durationMs: number;
  waveform: WaveformPoint[];
  quality: TakeQuality;
  qualityMessage: string | null;
  warning: string | null;
  stopReason: RecordingStopReason | null;
};

function audioContextClass() {
  return window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function microphoneError(cause: unknown) {
  const name = cause && typeof cause === "object" && "name" in cause ? cause.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access is blocked. Allow it in your browser settings, then try again.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No microphone was found. Connect a microphone, then try again.";
  if (name === "NotReadableError" || name === "TrackStartError") return "Your microphone is unavailable. Check your device and close any app that is holding it, then try again.";
  return "We could not open your microphone. Check your input device and try again.";
}

export function useAudioRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [waveform, setWaveform] = useState<WaveformPoint[]>([]);
  const [isClipping, setIsClipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [quality, setQuality] = useState<TakeQuality>("empty");
  const [qualityMessage, setQualityMessage] = useState<string | null>(null);
  const [stopReason, setStopReason] = useState<RecordingStopReason | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<RecorderSession | null>(null);
  const pendingContextRef = useRef<AudioContext | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const captureBackupRef = useRef<PreservedTake | null>(null);
  const mountedRef = useRef(true);
  const permissionRequestRef = useRef(0);
  const permissionPromiseRef = useRef<Promise<boolean> | null>(null);
  const operationRef = useRef(0);
  const startPendingRef = useRef(false);
  const stopRef = useRef<(reason?: RecordingStopReason) => void>(() => undefined);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const closePendingContext = useCallback(() => {
    const context = pendingContextRef.current;
    pendingContextRef.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }, []);

  const disposeSession = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    session.cleanup();
    session.processor.onaudioprocess = null;
    for (const node of [session.source, session.processor, session.silentGain]) {
      try { node.disconnect(); } catch { /* Already released by the browser. */ }
    }
    if (session.context.state !== "closed") void session.context.close().catch(() => undefined);
    if (mountedRef.current) {
      setLevel(0);
      setIsClipping(false);
    }
  }, []);

  const requestPermission = useCallback((): Promise<boolean> => {
    if (streamRef.current?.getAudioTracks().some((track) => track.readyState === "live")) return Promise.resolve(true);
    if (permissionPromiseRef.current) return permissionPromiseRef.current;
    if (!navigator.mediaDevices?.getUserMedia || !audioContextClass()) {
      setError("This browser cannot record audio. Try the latest Chrome, Safari, Edge, or Firefox on a secure page.");
      setStatus("error");
      return Promise.resolve(false);
    }
    setStatus("requesting");
    setError(null);
    const requestToken = ++permissionRequestRef.current;
    const pending = (async () => {
      // Keep even synchronous browser exceptions behind the promise reference.
      await Promise.resolve();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, sampleRate: 48_000, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          video: false,
        });
        if (!mountedRef.current || permissionRequestRef.current !== requestToken) {
          stream.getTracks().forEach((track) => track.stop());
          return false;
        }
        if (!stream.getAudioTracks().some((track) => track.readyState === "live")) {
          stream.getTracks().forEach((track) => track.stop());
          throw new DOMException("No live audio track", "NotFoundError");
        }
        stopStream();
        streamRef.current = stream;
        setStatus("ready");
        return true;
      } catch (cause) {
        if (!mountedRef.current || permissionRequestRef.current !== requestToken) return false;
        setError(microphoneError(cause));
        setStatus("error");
        return false;
      } finally {
        if (permissionRequestRef.current === requestToken) permissionPromiseRef.current = null;
      }
    })();
    permissionPromiseRef.current = pending;
    return pending;
  }, [stopStream]);

  const finish = useCallback((reason: RecordingStopReason = "user") => {
    operationRef.current += 1;
    permissionRequestRef.current += 1;
    permissionPromiseRef.current = null;
    startPendingRef.current = false;
    const session = sessionRef.current;
    // Always release capture, even before the first audio frame.
    disposeSession();
    closePendingContext();
    stopStream();
    if (!mountedRef.current) return;
    if (!session) {
      setStatus(audioUrlRef.current ? "stopped" : "idle");
      return;
    }
    setStopReason(reason);
    setWarning(reason === "interrupted" ? "Your microphone was interrupted. The captured audio is saved here; replay it before submitting." : reason === "hidden" ? "Recording stopped when you left the page. Your captured audio is saved here." : reason === "limit" ? "The 20-second limit is up. Your take is ready to review." : reason === "size-limit" ? "The recording reached its file-size limit. Your take is saved here." : null);
    const checked = inspectTake(session.frames, session.sampleCount, session.context.sampleRate);
    if (session.sampleCount === 0) {
      setWarning(null);
      // A connected graph is not proof that the device delivered any input.
      // Keep the previous playable take if startup failed before its first frame.
      if (audioUrlRef.current) {
        setError(`${checked.message} Your previous take is still here.`);
        setStatus("stopped");
      } else {
        setQuality(checked.quality);
        setQualityMessage(checked.message);
        setDurationMs(0);
        setError(checked.message);
        setStatus("error");
      }
      return;
    }
    setQuality(checked.quality);
    setQualityMessage(checked.message);
    setDurationMs(Math.round(session.sampleCount / session.context.sampleRate * 1_000));
    try {
      const blob = encodeMonoWav(session.frames, session.sampleCount, session.context.sampleRate);
      const nextUrl = URL.createObjectURL(blob);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = nextUrl;
      setAudioBlob(blob);
      setAudioUrl(nextUrl);
      setStatus("stopped");
    } catch {
      setError("The browser could not prepare playback. Please record another take.");
      setStatus("error");
    }
  }, [closePendingContext, disposeSession, stopStream]);

  useEffect(() => { stopRef.current = finish; }, [finish]);

  const commitCapture = useCallback(() => {
    const backup = captureBackupRef.current;
    captureBackupRef.current = null;
    if (backup?.url && backup.url !== audioUrlRef.current) URL.revokeObjectURL(backup.url);
  }, []);

  const start = useCallback(async (options?: { preservePreviousTake?: boolean; maxDurationMs?: number }) => {
    // Catch clicks arriving before React rerenders.
    if (startPendingRef.current || sessionRef.current) return false;
    startPendingRef.current = true;
    commitCapture();
    if (options?.preservePreviousTake) captureBackupRef.current = { blob: audioBlob, url: audioUrlRef.current, durationMs, waveform, quality, qualityMessage, warning, stopReason };
    const operationToken = ++operationRef.current;
    let context: AudioContext | null = null;
    try {
      const granted = await requestPermission();
      if (!granted || !mountedRef.current || operationRef.current !== operationToken) return false;
      const stream = streamRef.current;
      if (!stream) return false;
      const AudioContextClass = audioContextClass();
      if (!AudioContextClass) throw new Error("AudioContext unavailable");
      context = pendingContextRef.current?.state !== "closed" && pendingContextRef.current
        ? pendingContextRef.current
        : new AudioContextClass({ latencyHint: "interactive" });
      pendingContextRef.current = context;
      await context.resume();
      if (pendingContextRef.current === context) pendingContextRef.current = null;
      if (!mountedRef.current || operationRef.current !== operationToken || streamRef.current !== stream) {
        if (context.state !== "closed") void context.close().catch(() => undefined);
        return false;
      }
      if (context.state !== "running" || stream.getAudioTracks().every((track) => track.readyState !== "live")) throw new Error("Microphone interrupted before recording");
      const source = context.createMediaStreamSource(stream);
      // A 1024-sample block reduces capture startup and the unflushed tail at
      // an explicit line boundary (about 21 ms at 48 kHz, previously 85 ms).
      // This changes capture granularity, never an offset applied to speech.
      const processor = context.createScriptProcessor(1024, 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      const session: RecorderSession = { context, source, processor, silentGain, frames: [], sampleCount: 0, lastFrameAt: null, waveform: [], waveformBinSamples: 0, waveformBinPeak: 0, cleanup: () => undefined };
      sessionRef.current = session;
      const captureLimitMs = Math.min(MAX_RECORDING_MS, Math.max(250, options?.maxDurationMs ?? MAX_RECORDING_MS));
      const durationSamples = Math.floor(context.sampleRate * captureLimitMs / 1_000);
      const sizeSamples = Math.floor((MAX_RECORDING_BYTES - 44) / 2);
      const maxSamples = Math.min(durationSamples, sizeSamples);
      processor.onaudioprocess = (event) => {
        if (sessionRef.current !== session) return;
        const channel = event.inputBuffer.getChannelData(0);
        const copy = new Float32Array(channel.subarray(0, maxSamples - session.sampleCount));
        if (copy.length === 0) return;
        if (session.sampleCount === 0) {
          if (audioUrlRef.current && audioUrlRef.current !== captureBackupRef.current?.url) URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
          setAudioBlob(null);
          setAudioUrl(null);
          setQuality("empty");
          setQualityMessage(null);
        }
        session.frames.push(copy);
        session.sampleCount += copy.length;
        session.lastFrameAt = performance.now();
        let squareSum = 0;
        let peak = 0;
        const waveformBinSize = Math.max(1, Math.round(session.context.sampleRate * WAVEFORM_BIN_SECONDS));
        for (const sample of copy) {
          const amplitude = Number.isFinite(sample) ? Math.min(1, Math.abs(sample)) : 0;
          squareSum += amplitude * amplitude;
          peak = Math.max(peak, amplitude);
          session.waveformBinPeak = Math.max(session.waveformBinPeak, amplitude);
          session.waveformBinSamples += 1;
          if (session.waveformBinSamples === waveformBinSize) {
            session.waveform.push({ time: session.waveform.length * waveformBinSize / session.context.sampleRate, peak: session.waveformBinPeak });
            session.waveformBinSamples = 0;
            session.waveformBinPeak = 0;
          }
        }
        setWaveform(session.waveformBinSamples
          ? [...session.waveform, { time: session.waveform.length * waveformBinSize / session.context.sampleRate, peak: session.waveformBinPeak }]
          : [...session.waveform]);
        const rms = Math.sqrt(squareSum / Math.max(1, copy.length));
        setLevel(Math.min(1, Math.max(peak, rms * 4.5)));
        setIsClipping(peak >= 0.99);
        setDurationMs(Math.round(session.sampleCount / session.context.sampleRate * 1_000));
        if (session.sampleCount >= maxSamples) stopRef.current(sizeSamples < durationSamples ? "size-limit" : "limit");
      };
      const interrupted = () => stopRef.current("interrupted");
      let muteTimer: ReturnType<typeof setTimeout> | undefined;
      const unmuted = () => { clearTimeout(muteTimer); muteTimer = undefined; };
      // Allow a brief device glitch to recover without capturing a dead input
      // indefinitely after a persistent OS-level mute.
      const muted = () => {
        if (muteTimer === undefined) muteTimer = setTimeout(interrupted, 1_000);
      };
      const contextChanged = () => { if (session.context.state !== "running") interrupted(); };
      const visibilityChanged = () => { if (document.visibilityState === "hidden") stopRef.current("hidden"); };
      const pageHidden = () => stopRef.current("hidden");
      // Sample count ends timed modes exactly. This watchdog only catches a
      // device that stops delivering input; it must not cut off startup latency.
      const hardStop = options?.maxDurationMs
        ? setTimeout(() => stopRef.current("interrupted"), MAX_RECORDING_MS + 2000)
        : setTimeout(() => stopRef.current("limit"), MAX_RECORDING_MS);
      const tracks = stream.getAudioTracks();
      for (const track of tracks) {
        track.addEventListener("ended", interrupted);
        track.addEventListener("mute", muted);
        track.addEventListener("unmute", unmuted);
      }
      context.addEventListener("statechange", contextChanged);
      document.addEventListener("visibilitychange", visibilityChanged);
      window.addEventListener("pagehide", pageHidden);
      session.cleanup = () => {
        clearTimeout(hardStop);
        unmuted();
        for (const track of tracks) {
          track.removeEventListener("ended", interrupted);
          track.removeEventListener("mute", muted);
          track.removeEventListener("unmute", unmuted);
        }
        session.context.removeEventListener("statechange", contextChanged);
        document.removeEventListener("visibilitychange", visibilityChanged);
        window.removeEventListener("pagehide", pageHidden);
      };
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);
      // Discard the previous take only once actual input begins arriving.
      setLevel(0);
      setIsClipping(false);
      setWarning(null);
      setStopReason(null);
      setError(null);
      setStatus("recording");
      if (tracks.some((track) => track.muted)) muted();
      return true;
    } catch {
      if (pendingContextRef.current === context) pendingContextRef.current = null;
      if (operationRef.current !== operationToken || !mountedRef.current) {
        if (context && context.state !== "closed") void context.close().catch(() => undefined);
        return false;
      }
      const contextOwnedBySession = sessionRef.current?.context === context;
      disposeSession();
      if (!contextOwnedBySession && context && context.state !== "closed") void context.close().catch(() => undefined);
      stopStream();
      setError("Recording could not start. Check your microphone and try again.");
      setStatus("error");
      return false;
    } finally {
      if (operationRef.current === operationToken) startPendingRef.current = false;
    }
  }, [audioBlob, durationMs, waveform, quality, qualityMessage, warning, stopReason, commitCapture, disposeSession, requestPermission, stopStream]);

  const stop = useCallback(() => finish("user"), [finish]);
  const cancelCapture = useCallback(() => {
    operationRef.current += 1;
    permissionRequestRef.current += 1;
    permissionPromiseRef.current = null;
    startPendingRef.current = false;
    disposeSession();
    closePendingContext();
    stopStream();
    const backup = captureBackupRef.current;
    captureBackupRef.current = null;
    if (backup) {
      if (audioUrlRef.current && audioUrlRef.current !== backup.url) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = backup.url;
      setAudioBlob(backup.blob);
      setAudioUrl(backup.url);
      setDurationMs(backup.durationMs);
      setWaveform(backup.waveform);
      setQuality(backup.quality);
      setQualityMessage(backup.qualityMessage);
      setWarning(backup.warning);
      setStopReason(backup.stopReason);
    }
    setStatus(audioUrlRef.current ? "stopped" : "idle");
  }, [closePendingContext, disposeSession, stopStream]);

  const reset = useCallback(() => {
    operationRef.current += 1;
    permissionRequestRef.current += 1;
    permissionPromiseRef.current = null;
    startPendingRef.current = false;
    disposeSession();
    closePendingContext();
    stopStream();
    commitCapture();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setAudioBlob(null);
    setAudioUrl(null);
    setDurationMs(0);
    setWaveform([]);
    setLevel(0);
    setIsClipping(false);
    setError(null);
    setWarning(null);
    setQuality("empty");
    setQualityMessage(null);
    setStopReason(null);
    setStatus("idle");
  }, [closePendingContext, commitCapture, disposeSession, stopStream]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
      permissionRequestRef.current += 1;
      permissionPromiseRef.current = null;
      disposeSession();
      closePendingContext();
      stopStream();
      commitCapture();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, [closePendingContext, commitCapture, disposeSession, stopStream]);

  const canSubmit = Boolean(audioBlob) && (quality === "ready" || quality === "quiet");
  // The capture timeline lets a scene player measure its startup pre-roll. This
  // never aligns speech or edits performance timing. One input block remains
  // the browser-dependent precision limit; physical input latency is unmeasured.
  const getCapturePositionMs = useCallback((): number | null => {
    const session = sessionRef.current;
    if (!session || session.lastFrameAt === null) return null;
    return session.sampleCount / session.context.sampleRate * 1_000
      + Math.min(100, Math.max(0, performance.now() - session.lastFrameAt));
  }, []);
  // Countdown flows call this directly in the user's tap. Safari may require
  // the context to resume inside that gesture, before an asynchronous countdown.
  const primeAudioContext = useCallback(() => {
    const AudioContextClass = audioContextClass();
    if (!AudioContextClass || sessionRef.current) return;
    try {
      if (!pendingContextRef.current || pendingContextRef.current.state === "closed") pendingContextRef.current = new AudioContextClass({ latencyHint: "interactive" });
      void pendingContextRef.current.resume().catch(() => undefined);
    } catch { /* start() owns the visible unsupported-device error. */ }
  }, []);
  return { status, audioBlob, audioUrl, durationMs, waveform, level, isClipping, error, warning, quality, qualityMessage, canSubmit, stopReason, requestPermission, start, stop, reset, cancelCapture, commitCapture, getCapturePositionMs, primeAudioContext };
}
