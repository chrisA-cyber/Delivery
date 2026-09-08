"use client";
import { useEffect, useRef } from "react";
import { Camera, RefreshCw, UserRound } from "lucide-react";
import { PerformerAvatar } from "@/components/avatars/performer-avatar";
import type { useCameraCapture } from "@/hooks/use-camera-capture";
export type CameraController = ReturnType<typeof useCameraCapture>;

export function CameraControls({ camera, disabled = false }: { camera?: CameraController; disabled?: boolean }) {
  if (!camera) return null;
  return <div className="space-y-1.5">
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl border border-white/15 bg-black/15 p-1" role="group" aria-label="Recording appearance">
        {(["avatar", "camera"] as const).map(mode => <button key={mode} type="button" disabled={disabled || (camera.opening && mode === "camera")} aria-pressed={camera.mode === mode} onClick={() => camera.select(mode)} className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-bold ${camera.mode === mode ? "bg-mint text-ink" : "text-white/65"}`}>{mode === "camera" ? <Camera className="size-4" /> : <UserRound className="size-4" />}{mode === "camera" ? "Camera" : "Avatar"}</button>)}
      </div>
      {camera.mode === "camera" && !camera.stream && <button type="button" disabled={disabled || camera.opening} className="button-ghost min-h-10 px-2 text-xs" onClick={() => void camera.open()}>{camera.opening ? "Opening…" : "Enable camera"}</button>}
      {camera.mode === "camera" && camera.stream && <>
        {camera.devices.length > 1 && <select aria-label="Camera device" value={camera.deviceId} disabled={disabled} onChange={e => void camera.open(e.target.value)} className="min-h-10 max-w-36 rounded-lg border border-white/20 bg-surface px-2 text-xs">{camera.devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}</select>}
        <button type="button" disabled={disabled} aria-label="Switch front or back camera" className="icon-button min-h-10" onClick={() => void camera.open(undefined, true)}><RefreshCw className="size-4" /></button>
        <label className="flex min-h-10 items-center gap-1.5 text-xs text-white/65"><input type="checkbox" disabled={disabled} checked={camera.mirror} onChange={e => camera.setMirror(e.target.checked)} className="accent-electric" />Mirror</label>
      </>}
    </div>
    {camera.error && <p role="alert" className="text-xs text-orange-200">{camera.error}</p>}
    {camera.mode === "camera" && camera.stream && <p className="text-[10px] text-white/50">{camera.mirror ? "Mirrored" : "Natural"} · vertical preview · private until you share</p>}
  </div>;
}
export function CameraMonitor({ camera, level = 0, size = 128, editable = true }: { camera?: CameraController; level?: number; size?: number; editable?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { const node = video.current; if (!node || !camera?.stream) return; node.srcObject = camera.stream; void node.play().catch(() => undefined); return () => { node.srcObject = null; }; }, [camera?.stream]);
  if (camera?.mode !== "camera") return <PerformerAvatar size={size} level={level} editable={editable} />;
  return <div className="relative shrink-0 overflow-hidden rounded-xl border border-white/20 bg-black" style={{ width: size * 9 / 16, height: size }}>
    <video ref={video} muted playsInline autoPlay aria-label="Live camera framing" className="size-full object-cover" style={{ transform: camera.mirror ? "scaleX(-1)" : undefined }} />
    {!camera.stream && <div className="absolute inset-0 grid place-items-center text-white/40"><Camera className="size-7" /></div>}
  </div>;
}
