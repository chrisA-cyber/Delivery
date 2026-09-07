import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/server/api-error";
import { cameraManifestSchema, cameraQuery, CAMERA_MAX_BYTES, type CameraSegment } from "@/lib/camera";
import type { ExportSource, ExportSourceKind } from "@/lib/server/video-export-sources";

export const CAMERA_BUCKET = "delivery-camera";
type Row = Record<string, unknown>;
export const validCameraPath = (path: string) => /^camera\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/\d{1,2}\.(webm|mp4)$/.test(path);
const unavailable = () => new AppError("CAMERA_UNAVAILABLE", "Camera footage is private, expired, or unavailable. Your original audio is unchanged.", 404);
function checked(error: unknown) { if (error) throw new AppError("CAMERA_STORAGE", "Camera upload could not finish. Your take is still here; retry saving it.", 503); }

/** Never send remote URLs or unbounded decoder output to FFprobe. */
async function inspectCamera(bytes: Buffer, extension: string): Promise<number> {
  const dir = await mkdtemp(join(tmpdir(), "delivery-camera-"));
  try {
    const file = join(dir, `capture.${extension}`); await writeFile(file, bytes);
    const data = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-protocol_whitelist", "file,pipe", "-read_intervals", "%+47", "-select_streams", "v:0", "-show_packets", "-show_streams", "-show_format", "-show_entries", "packet=pts_time,duration_time:stream=codec_type,codec_name,width,height,duration:format=duration", "-of", "json", file], { stdio: ["ignore", "pipe", "ignore"] });
      let output = "";
      const timer = setTimeout(() => { child.kill("SIGKILL"); reject(unavailable()); }, 12000);
      child.stdout.on("data", chunk => { output += chunk.toString(); if (output.length > 256000) { child.kill("SIGKILL"); reject(unavailable()); } });
      child.on("error", () => { clearTimeout(timer); reject(unavailable()); });
      child.on("close", code => { clearTimeout(timer); if (code === 0) resolve(output); else reject(unavailable()); });
    });
    const media = JSON.parse(data), streams = media.streams as Row[];
    const video = streams.find(s => s.codec_type === "video");
    const packets = media.packets as { pts_time?: string; duration_time?: string }[];
    const last = packets?.at(-1);
    const duration = Number(media.format?.duration ?? video?.duration ?? (Number(last?.pts_time) + Number(last?.duration_time ?? 0)));
    if (!video || !["h264", "vp8", "vp9", "hevc", "av1"].includes(String(video.codec_name)) || Number(video.width) < 16 || Number(video.height) < 16 || Number(video.width) * Number(video.height) > 3840 * 2160 || !Number.isFinite(duration) || duration <= 0 || duration > 46) throw unavailable();
    // Packet timestamps also bound browser WebM without container duration.
    return duration;
  } finally { await rm(dir, { recursive: true, force: true }); }
}

export async function loadCamera(kind: ExportSourceKind, id: string): Promise<CameraSegment[]> {
  const result = await createSupabaseAdminClient().from("performance_camera_media").select("manifest,ready,expires_at").eq("source_kind", kind).eq("attempt_id", id).maybeSingle();
  checked(result.error);
  if (!result.data?.ready || result.data.expires_at && new Date(String(result.data.expires_at)).getTime() <= Date.now()) return [];
  const segments = result.data.manifest as unknown as CameraSegment[];
  if (!Array.isArray(segments) || segments.some(s => !s.path || !validCameraPath(s.path) || !s.path.startsWith(`camera/${id}/`))) throw unavailable();
  return segments;
}

export async function uploadCamera(source: ExportSource, form: FormData) {
  const manifest = cameraManifestSchema.parse(JSON.parse(String(form.get("manifest"))));
  const duration = source.input.assignment.mode === "say-it-back" ? source.input.assignment.clip.duration : source.input.durationMs / 1000;
  let previousEnd = 0;
  for (const s of manifest.segments) {
    if (s.end <= s.start || s.start < previousEnd - 0.001 || s.end > duration + 0.1 || s.sourceStart + s.end - s.start > 46) throw new AppError("CAMERA_TIMELINE", "The camera and audio timelines do not match. Retry saving the original take.", 422);
    previousEnd = s.end;
  }
  const files = new Map<number, { bytes: Buffer; hash: string; mime: string; extension: string; duration: number }>();
  let size = 0;
  for (const index of new Set(manifest.segments.map(s => s.file))) {
    const file = form.get(`file${index}`);
    if (!(file instanceof File) || !file.size || !/^video\/(webm|mp4)(;|$)/.test(file.type)) throw new AppError("CAMERA_FORMAT", "Use a supported camera recording (MP4 or WebM).", 422);
    size += file.size; if (size > CAMERA_MAX_BYTES) throw new AppError("CAMERA_SIZE", "Keep the camera recording under 32 MB. Your local take is still here.", 413);
    const bytes = Buffer.from(await file.arrayBuffer()), extension = file.type.includes("mp4") ? "mp4" : "webm";
    files.set(index, { bytes, hash: createHash("sha256").update(bytes).digest("hex"), mime: `video/${extension}`, extension, duration: await inspectCamera(bytes, extension) });
  }
  for (const s of manifest.segments) if (s.sourceStart + s.end - s.start > files.get(s.file)!.duration + 0.35) throw new AppError("CAMERA_SHORT", "Camera footage ended before this take. Review it or record again.", 422);
  const id = String(source.row.id), upload = randomUUID();
  const fingerprint = createHash("sha256").update(JSON.stringify({ manifest, hashes: [...files].map(([i, f]) => [i, f.hash]) })).digest("hex");
  const candidate = manifest.segments.map(s => ({ start: s.start, end: s.end, sourceStart: s.sourceStart, mirror: s.mirror, path: `camera/${id}/${upload}/${s.file}.${files.get(s.file)!.extension}`, hash: files.get(s.file)!.hash }));
  const admin = createSupabaseAdminClient();
  const reservation = await admin.rpc("reserve_performance_camera", { p_source_kind: source.kind, p_attempt_id: id, p_owner_key: source.ownerKey, p_user_id: source.userId, p_fingerprint: fingerprint, p_manifest: candidate });
  if (reservation.error?.message?.includes("CAMERA_CONFLICT")) throw new AppError("CAMERA_CONFLICT", "This audio already has different camera footage. Record a new take to replace it.", 409);
  checked(reservation.error);
  const record = reservation.data as Row | null; if (!record) throw unavailable();
  if (record.ready) return;
  const paths = record.manifest as unknown as CameraSegment[];
  const uploaded = new Set<string>();
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!.path!; if (!validCameraPath(path)) throw unavailable(); if (uploaded.has(path)) continue;
    const file = files.get(manifest.segments[i]!.file)!;
    const result = await admin.storage.from(CAMERA_BUCKET).upload(path, file.bytes, { contentType: file.mime, upsert: false, cacheControl: "0" });
    // A retry may find a completed immutable, hash-addressed reservation upload.
    if (result.error && !["409", "Duplicate"].includes(String((result.error as { statusCode?: string }).statusCode)) && !/already exists|Duplicate/i.test(result.error.message)) checked(result.error);
    uploaded.add(path);
  }
  const finished = await admin.rpc("finish_performance_camera", { p_source_kind: source.kind, p_attempt_id: id, p_owner_key: source.ownerKey, p_user_id: source.userId, p_fingerprint: fingerprint });
  checked(finished.error); if (finished.data !== true) throw unavailable();
}

/** Call ONLY after the ordinary audio route has authorized this exact take. */
export async function cameraResponse(kind: ExportSourceKind, id: string, request: Request): Promise<Response | null> {
  const selector = new URL(request.url).searchParams.get("camera");
  if (selector === null) return null;
  const segments = await loadCamera(kind, id);
  if (selector === "manifest") {
    const base = new URL(request.url); base.searchParams.delete("camera");
    return Response.json({ segments: segments.map((s, index) => ({ start: s.start, end: s.end, sourceStart: s.sourceStart, mirror: s.mirror, hash: s.hash, url: cameraQuery(base.pathname + base.search, String(index)) })) }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (!/^\d{1,2}$/.test(selector) || !segments[Number(selector)]) throw unavailable();
  const part = segments[Number(selector)]!;
  const signed = await createSupabaseAdminClient().storage.from(CAMERA_BUCKET).createSignedUrl(part.path!, 60);
  checked(signed.error); if (!signed.data?.signedUrl) throw unavailable();
  const range = request.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) throw new AppError("INVALID_RANGE", "Choose a valid playback position.", 416);
  const response = await fetch(signed.data.signedUrl, { cache: "no-store", headers: range ? { Range: range } : undefined, signal: AbortSignal.timeout(30000) });
  if (!response.ok && response.status !== 206) throw unavailable();
  const headers = new Headers({ "Content-Type": part.path!.endsWith("mp4") ? "video/mp4" : "video/webm", "Cache-Control": "private, no-store", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff" });
  for (const key of ["content-length", "content-range"]) { const value = response.headers.get(key); if (value) headers.set(key, value); }
  return new Response(response.body, { status: response.status, headers });
}

export async function cleanupCamera(limit = 30) {
  const admin = createSupabaseAdminClient();
  checked((await admin.rpc("expire_performance_camera", { p_limit: limit })).error);
  const rows = await admin.from("cleanup_camera_objects").select("*").lte("delete_after", new Date().toISOString()).order("delete_after").limit(limit); checked(rows.error);
  for (const row of rows.data ?? []) {
    const path = String(row.storage_path); if (!validCameraPath(path)) continue;
    if ((await admin.storage.from(CAMERA_BUCKET).remove([path])).error) continue;
    if (new Date(String(row.retain_until)).getTime() <= Date.now()) checked((await admin.from("cleanup_camera_objects").delete().eq("storage_path", path)).error);
    else checked((await admin.from("cleanup_camera_objects").update({ delete_after: new Date(Date.now() + 600000).toISOString() }).eq("storage_path", path)).error);
  }
}
