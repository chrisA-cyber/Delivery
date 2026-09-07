"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CAMERA_MAX_BYTES, type CameraCapture } from "@/lib/camera";

type Active = { recorder: MediaRecorder; chunks: Blob[]; bytes: number; origin: number; offset: number; mirror: boolean; width: number; height: number; done: Promise<CameraCapture | null>; resolve: (take: CameraCapture | null) => void; timer?: ReturnType<typeof setTimeout> };
export function useCameraCapture() {
  const [mode, setModeState] = useState<"avatar" | "camera">("avatar");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [mirror, setMirrorState] = useState(true);
  const mirrorRef = useRef(true);
  const setMirror = useCallback((value: boolean) => { mirrorRef.current = value; setMirrorState(value); }, []);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null), active = useRef<Active | null>(null);
  const generation = useRef(0), mounted = useRef(true), modeRef = useRef(mode), facing = useRef<"user" | "environment">("user");
  const release = useCallback(() => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; if (mounted.current) setStream(null); }, []);
  const close = useCallback(() => { generation.current++; release(); if (mounted.current) setOpening(false); }, [release]);
  useEffect(() => { const sessionGeneration = generation; mounted.current = true; try { if (localStorage.getItem("delivery.recordingMode") === "camera") { modeRef.current = "camera"; setModeState("camera"); } } catch { /* Preferences are optional. */ } return () => { mounted.current = false; sessionGeneration.current++; const a = active.current; active.current = null; if (a) { clearTimeout(a.timer); if (a.recorder.state !== "inactive") a.recorder.stop(); a.resolve(null); } release(); }; }, [release]);
  const open = useCallback(async (id?: string, flip = false): Promise<boolean> => {
    if (active.current) return false;
    if (streamRef.current?.getVideoTracks().some(t => t.readyState === "live") && id === undefined && !flip) return true;
    const token = ++generation.current;
    release(); setOpening(true); setError("");
    if (flip) facing.current = facing.current === "user" ? "environment" : "user";
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("unsupported");
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 }, ...(id ? { deviceId: { exact: id } } : { facingMode: { ideal: facing.current } }) } });
      if (!mounted.current || token !== generation.current) { media.getTracks().forEach(t => t.stop()); return false; }
      const track = media.getVideoTracks()[0]; if (!track || track.readyState !== "live") { media.getTracks().forEach(t => t.stop()); throw new Error("missing"); }
      streamRef.current = media; setStream(media);
      const settings = track.getSettings(); setDeviceId(settings.deviceId ?? id ?? "");
      facing.current = settings.facingMode === "environment" ? "environment" : "user"; setMirror(facing.current === "user");
      setDevices((await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput"));
      return true;
    } catch (cause) {
      if (mounted.current && token === generation.current) { release(); const name = (cause as { name?: string })?.name; setError(name === "NotAllowedError" ? "Camera access is blocked. Allow it in browser settings, or choose Avatar." : "Camera unavailable. Close other camera apps and retry, or choose Avatar."); }
      return false;
    } finally { if (mounted.current && token === generation.current) setOpening(false); }
  }, [release, setMirror]);
  const select = useCallback((value: "avatar" | "camera") => { if (active.current) return; modeRef.current = value; setModeState(value); setError(""); try { localStorage.setItem("delivery.recordingMode", value); } catch { /* Optional. */ } if (value === "camera") void open(); else close(); }, [open, close]);
  const prepare = useCallback(async () => modeRef.current !== "camera" || await open(), [open]);
  const begin = useCallback((microphone: MediaStream, onInterrupt: () => void) => {
    if (modeRef.current !== "camera") return;
    const video = streamRef.current?.getVideoTracks()[0];
    if (!video || video.readyState !== "live") throw new Error("Camera unavailable");
    const types = ["video/webm;codecs=vp8,opus", "video/mp4", "video/webm"];
    const mimeType = types.find(t => MediaRecorder.isTypeSupported(t));
    // The same microphone is observed by the original PCM recorder. This muxed
    // audio is never used for playback, mixing or judging.
    const recorder = new MediaRecorder(new MediaStream([video, ...microphone.getAudioTracks()]), { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
    let resolve!: Active["resolve"];
    const done = new Promise<CameraCapture | null>(r => { resolve = r; });
    const settings = video.getSettings();
    const a: Active = { recorder, chunks: [], bytes: 0, origin: performance.now(), offset: 0, mirror: mirrorRef.current, width: settings.width ?? 1280, height: settings.height ?? 720, done, resolve };
    active.current = a;
    recorder.ondataavailable = e => { if (e.data.size) { a.chunks.push(e.data); a.bytes += e.data.size; if (a.bytes >= CAMERA_MAX_BYTES) onInterrupt(); } };
    recorder.onerror = () => { if (mounted.current) setError("Camera recording was interrupted. Replay the captured take before saving."); onInterrupt(); };
    const interrupted = () => onInterrupt(); video.addEventListener("ended", interrupted); video.addEventListener("mute", interrupted);
    recorder.onstop = () => { clearTimeout(a.timer); video.removeEventListener("ended", interrupted); video.removeEventListener("mute", interrupted); const blob = new Blob(a.chunks, { type: recorder.mimeType }); a.resolve(blob.size && blob.size <= CAMERA_MAX_BYTES ? { blob, offset: a.offset, mirror: a.mirror, width: a.width, height: a.height } : null); };
    recorder.start(500);
  }, []);
  const anchor = useCallback((pcmOrigin: number) => { const a = active.current; if (a) a.offset = Math.max(0, (pcmOrigin - a.origin) / 1000); }, []);
  const finish = useCallback((): Promise<CameraCapture | null> | null => {
    const a = active.current; if (!a) { close(); return null; }
    active.current = null;
    if (a.recorder.state !== "inactive") a.recorder.stop();
    a.timer = setTimeout(() => { a.resolve(null); if (mounted.current) setError("Camera could not finish. Your voice is preserved; choose Avatar or record again."); }, 8000);
    return a.done.then(take => { clearTimeout(a.timer); close(); return take; });
  }, [close]);
  const cancel = useCallback(() => { const a = active.current; active.current = null; if (a) { clearTimeout(a.timer); if (a.recorder.state !== "inactive") a.recorder.stop(); a.resolve(null); } close(); }, [close]);
  useEffect(() => { const hidden = () => { if (!active.current && document.visibilityState === "hidden") close(); }; document.addEventListener("visibilitychange", hidden); return () => document.removeEventListener("visibilitychange", hidden); }, [close]);
  return { mode, stream, devices, deviceId, mirror, opening, error, select, open, prepare, begin, anchor, finish, cancel, close, setMirror };
}
