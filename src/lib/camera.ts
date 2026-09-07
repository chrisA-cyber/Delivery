import { z } from "zod";

export const CAMERA_MAX_BYTES = 32 * 1024 * 1024;
export const CAMERA_MAX_SECONDS = 46;
export interface CameraCapture { blob: Blob; offset: number; mirror: boolean; width: number; height: number }
/** Source seconds corresponding to an interval on the accepted audio timeline. */
export interface CameraSegment { start: number; end: number; sourceStart: number; mirror: boolean; blob?: Blob; url?: string; path?: string; hash?: string }
export const cameraSegmentSchema = z.object({
  start: z.number().finite().min(0).max(45), end: z.number().finite().min(0).max(46),
  sourceStart: z.number().finite().min(0).max(46), mirror: z.boolean(), file: z.number().int().min(0).max(23),
}).strict();
export const cameraManifestSchema = z.object({ version: z.literal(1), segments: z.array(cameraSegmentSchema).min(1).max(32) }).strict();
export function cameraInterval(capture: CameraCapture | null | undefined, start: number, end: number, audioOffset = 0): CameraSegment[] {
  return capture ? [{ start, end, sourceStart: Math.max(0, capture.offset + audioOffset), mirror: capture.mirror, blob: capture.blob }] : [];
}
export function sliceCamera(segments: CameraSegment[], start: number, end: number): CameraSegment[] {
  return segments.filter(s => s.end > start && s.start < end).map(s => ({ ...s, start: Math.max(start, s.start), end: Math.min(end, s.end), sourceStart: s.sourceStart + Math.max(0, start - s.start) }));
}
export function cameraQuery(url: string, value = "manifest"): string { return `${url}${url.includes("?") ? "&" : "?"}camera=${value}`; }

const savedCameras = new WeakMap<CameraSegment[], Set<string>>();

/** Upload only after the immutable audio receipt exists; a retry uses that same receipt. */
export async function saveCamera(mode: "classic" | "switch" | "say-it-back", attemptId: string, segments: CameraSegment[], maxRating: string) {
  if (!segments.length || savedCameras.get(segments)?.has(attemptId)) return;
  const files: Blob[] = [];
  const fetched = new Map<string, Blob>();
  const entries: { start: number; end: number; sourceStart: number; mirror: boolean; file: number }[] = [];
  for (const s of segments) {
    let blob = s.blob;
    if (!blob && s.url) {
      const key = s.hash ?? s.url;
      blob = fetched.get(key);
      if (!blob) {
        const response = await fetch(s.url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error("Your previous camera take could not load. Retry before saving this retake.");
        blob = await response.blob(); fetched.set(key, blob);
      }
    }
    if (!blob) throw new Error("Camera footage is unavailable. Your audio is still saved.");
    let file = files.indexOf(blob);
    if (file < 0) { file = files.length; files.push(blob); }
    entries.push({ start: s.start, end: s.end, sourceStart: s.sourceStart, mirror: s.mirror, file });
  }
  const manifest = { version: 1, segments: entries };
  const form = new FormData();
  form.set("mode", mode); form.set("attemptId", attemptId); form.set("maxRating", maxRating); form.set("manifest", JSON.stringify(manifest));
  files.forEach((blob, index) => form.set(`file${index}`, blob, `camera-${index}.${blob.type.includes("mp4") ? "mp4" : "webm"}`));
  const response = await fetch("/api/recordings/camera", { method: "POST", body: form, signal: AbortSignal.timeout(120000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "Camera upload interrupted. Your take is still here; retry saving it.");
  const saved = savedCameras.get(segments) ?? new Set<string>(); saved.add(attemptId); savedCameras.set(segments, saved);
}
