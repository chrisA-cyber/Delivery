"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, LoaderCircle, RotateCcw, Upload, X } from "lucide-react";
import { BUILTIN_AVATARS, type ClipAvatar } from "@/lib/video-composition";
import { cn } from "@/lib/utils";

type CropSource = { url: string; width: number; height: number; name: string };
type Crop = { zoom: number; x: number; y: number };
const INITIAL_CROP: Crop = { zoom: 1, x: 0, y: 0 };
const clamp = (value: number, bound: number) => Math.max(-bound, Math.min(bound, value));

/** Coordinates are in square-preview units, shared exactly by CSS and canvas export. */
export function avatarCropGeometry(width: number, height: number, crop: Crop) {
  const scale = crop.zoom / Math.min(width, height);
  const displayedWidth = width * scale;
  const displayedHeight = height * scale;
  return { width: displayedWidth, height: displayedHeight, x: clamp(crop.x, (displayedWidth - 1) / 2), y: clamp(crop.y, (displayedHeight - 1) / 2) };
}

export function AvatarPicker({ value, onChange, compact = false, label = "Choose avatar", disabled = false }: {
  value: ClipAvatar;
  onChange: (avatar: ClipAvatar) => void | Promise<void>;
  compact?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<CropSource | null>(null);
  const operation = useRef(0);
  const drag = useRef<{ pointerId: number; x: number; y: number; initial: Crop } | null>(null);
  const [source, setSource] = useState<CropSource | null>(null);
  const [crop, setCrop] = useState<Crop>(INITIAL_CROP);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const geometry = source ? avatarCropGeometry(source.width, source.height, crop) : null;
  const busy = disabled || loading || uploading;

  useEffect(() => () => { operation.current += 1; if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url); }, []);
  function closeCrop() {
    operation.current += 1;
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
    sourceRef.current = null;
    setSource(null);
    setLoading(false);
    setCrop(INITIAL_CROP);
  }
  async function chooseFile(file?: File) {
    if (!file) return;
    setError("");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setError("Choose a JPG, PNG, or WebP image."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Choose an image smaller than 5 MB."); return; }
    const request = ++operation.current;
    setLoading(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (request !== operation.current) { URL.revokeObjectURL(url); return; }
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error("Choose an image smaller than 40 megapixels.");
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
      const next = { url, width: image.naturalWidth, height: image.naturalHeight, name: file.name };
      sourceRef.current = next;
      setSource(next);
      setCrop(INITIAL_CROP);
    } catch (cause) { URL.revokeObjectURL(url); if (request === operation.current) setError(cause instanceof Error && cause.message.includes("megapixels") ? cause.message : "That image could not open. Try a JPG, PNG, or WebP."); }
    finally { if (request === operation.current) setLoading(false); }
  }
  async function applyCrop() {
    if (!source || !geometry || busy) return;
    const request = operation.current;
    setUploading(true);
    setError("");
    try {
      const image = new Image();
      image.src = source.url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image cropping is unavailable in this browser.");
      context.drawImage(image, (0.5 - geometry.width / 2 + geometry.x) * 512, (0.5 - geometry.height / 2 + geometry.y) * 512, geometry.width * 512, geometry.height * 512);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("That crop could not be prepared.")), "image/png"));
      const form = new FormData();
      form.set("image", blob, "avatar.png");
      const response = await fetch("/api/avatars", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Your image could not upload. Try again.");
      const avatar = body.data?.avatar ?? body.avatar;
      if (avatar?.kind !== "upload" || !avatar.dataUrl) throw new Error("The uploaded avatar could not be read.");
      if (request !== operation.current) return;
      await onChange(avatar);
      closeCrop();
    } catch (cause) { if (request === operation.current) setError(cause instanceof Error ? cause.message : "Your image could not upload. Try again."); }
    finally { setUploading(false); }
  }
  return <div className="min-w-0" aria-label={label}>
    <div className={cn("grid grid-cols-3 gap-2", !compact && "sm:grid-cols-6")}>
      {BUILTIN_AVATARS.map((avatar) => <button key={avatar.id} type="button" disabled={busy} aria-label={avatar.name} aria-pressed={value.kind === "builtin" && value.id === avatar.id} onClick={() => { closeCrop(); setError(""); void onChange({ kind: "builtin", id: avatar.id }); }} className={cn("relative min-h-11 rounded-xl border p-1.5 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-acid disabled:opacity-50", value.kind === "builtin" && value.id === avatar.id ? "border-acid bg-acid/10" : "border-white/15 hover:border-white/40")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar.imageUrl} alt="" className="mx-auto aspect-square w-full max-w-24 rounded-lg object-contain" />
        <span className="mt-1 block text-[10px] font-bold">{avatar.name}</span>
        {value.kind === "builtin" && value.id === avatar.id && <Check className="absolute right-1 top-1 size-3 text-acid" />}
      </button>)}
    </div>
    <div className="mt-3 flex items-center gap-3">
      {value.kind === "upload" && <div className="size-11 overflow-hidden rounded-full border border-acid" aria-label="Selected uploaded avatar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value.dataUrl} alt="Your avatar" className="h-full w-full object-cover" />
      </div>}
      <button type="button" disabled={busy} className="button-secondary min-h-11 px-3 text-xs" onClick={() => fileInput.current?.click()}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}{value.kind === "upload" ? "Change image" : "Upload image"}</button>
      <span className="text-[10px] leading-4 text-white/55">JPG, PNG, WebP<br />Up to 5 MB</span>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload avatar image" className="sr-only" tabIndex={-1} disabled={busy} onChange={(event) => { void chooseFile(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
    {source && geometry && <div className="mt-3 rounded-xl border border-white/20 bg-black/20 p-3" aria-label="Crop avatar image">
      <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-bold">Frame your avatar</p><button type="button" disabled={uploading} className="icon-button size-9" aria-label="Cancel avatar crop" onClick={closeCrop}><X className="size-4" /></button></div>
      <div ref={preview} tabIndex={0} role="group" aria-label="Reposition avatar image. Drag or use arrow keys." className="relative mx-auto aspect-square w-full max-w-60 touch-none overflow-hidden rounded-full border-2 border-acid bg-[var(--ink-soft)] outline-none focus-visible:ring-2 focus-visible:ring-paper" onPointerDown={(event) => { if (busy) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, initial: { ...crop, x: geometry.x, y: geometry.y } }; }} onPointerMove={(event) => { const active = drag.current; if (!active || active.pointerId !== event.pointerId || !preview.current) return; const width = preview.current.getBoundingClientRect().width; const next = { ...active.initial, x: active.initial.x + (event.clientX - active.x) / width, y: active.initial.y + (event.clientY - active.y) / width }; const bounded = avatarCropGeometry(source.width, source.height, next); setCrop({ zoom: next.zoom, x: bounded.x, y: bounded.y }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={(event) => { if (busy || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); const delta = event.shiftKey ? 0.05 : 0.015; const next = { ...crop, x: geometry.x + (event.key === "ArrowLeft" ? -delta : event.key === "ArrowRight" ? delta : 0), y: geometry.y + (event.key === "ArrowUp" ? -delta : event.key === "ArrowDown" ? delta : 0) }; const bounded = avatarCropGeometry(source.width, source.height, next); setCrop({ zoom: next.zoom, x: bounded.x, y: bounded.y }); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source.url} alt="Avatar crop preview" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ width: `${geometry.width * 100}%`, height: `${geometry.height * 100}%`, left: `${(0.5 - geometry.width / 2 + geometry.x) * 100}%`, top: `${(0.5 - geometry.height / 2 + geometry.y) * 100}%` }} />
      </div>
      <p className="mt-2 text-center text-[10px] text-white/60">Drag to position · arrow keys also work</p>
      <label htmlFor={`${id}-zoom`} className="mt-3 flex items-center gap-3 text-xs font-bold">Zoom<input id={`${id}-zoom`} aria-label="Avatar crop zoom" className="h-9 min-w-0 flex-1 accent-acid" disabled={uploading} type="range" min={1} max={3} step={0.01} value={crop.zoom} onChange={(event) => { const next = { ...crop, zoom: Number(event.target.value) }; const bounded = avatarCropGeometry(source.width, source.height, next); setCrop({ zoom: next.zoom, x: bounded.x, y: bounded.y }); }} /><span className="w-8 text-right tabular-nums text-white/65">{crop.zoom.toFixed(1)}×</span></label>
      <div className="mt-3 flex gap-2"><button type="button" disabled={busy} className="button-primary min-h-11 flex-1 px-3 text-xs" onClick={() => void applyCrop()}>{uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{uploading ? "Preparing…" : "Use image"}</button><button type="button" disabled={uploading} className="button-ghost min-h-11 px-3" aria-label="Reset avatar crop" onClick={() => setCrop(INITIAL_CROP)}><RotateCcw className="size-4" /></button></div>
    </div>}
    {error && <p className="mt-2 text-xs leading-5 text-hot" role="alert">{error}</p>}
  </div>;
}
