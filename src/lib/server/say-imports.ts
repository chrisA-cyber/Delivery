import "server-only";

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import type { SayImport, SayImportCue } from "@/lib/say-it-back/import-types";
import type { SayClip, SayWord } from "@/lib/say-it-back/types";
import { sayClipSchema } from "@/lib/say-it-back/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { assertAccountNotDeleting } from "@/lib/server/account-deletion";
import { getGuestIdentity } from "@/lib/server/guest";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getServerEnv } from "@/lib/server/env";
import type { SayViewer } from "@/lib/server/say-it-back";
import { validateSourceUrl, createImportedBacking } from "@/lib/server/say-import-media";

export const SAY_IMPORT_BUCKET = "delivery-scenes";
export const SAY_IMPORT_MAX_BYTES = 80 * 1024 * 1024;
export const SAY_IMPORT_ASSETS = ["source", "video", "poster", "reference", "backing"] as const;
export type SayImportAsset = typeof SAY_IMPORT_ASSETS[number];
export interface SayImportRow {
  id: string; owner_key: string; user_id: string | null; request_key: string;
  status: SayImport["status"]; source_url: string | null; title: string; creator: string;
  source_duration: number | null; source_mime: string; media_key: string;
  excerpt_start: number; excerpt_end: number; cues: SayImportCue[];
  assets: Partial<Record<SayImportAsset, string>>; integrity: Record<string, string>;
  error_message: string | null; published_clip_id: string | null; created_at: string;
  expires_at: string | null; deleted_at: string | null; job_kind: "fetch" | "prepare" | null;
  lease_token: string | null; lease_expires_at: string | null; job_attempts: number;
}
export function checkSayImport(error: unknown): void {
  if (error) throw new ExternalServiceError("Scene storage", { cause: error });
}
const missing = () => new AppError("SCENE_NOT_FOUND", "That custom scene is unavailable or belongs to another player.", 404);
const expired = (row: SayImportRow) => Boolean(row.deleted_at || row.expires_at && Date.parse(row.expires_at) <= Date.now());
export const sayImportMediaUrl = (row: Pick<SayImportRow, "id" | "media_key">, asset: SayImportAsset) => `/api/say-it-back/imports/${row.id}/media/${asset}?key=${row.media_key}`;

export async function loadSayImport(id: string, viewer?: SayViewer): Promise<SayImportRow> {
  z.string().uuid().parse(id);
  const result = await createSupabaseAdminClient().from("say_imports").select("*").eq("id", id).maybeSingle();
  checkSayImport(result.error);
  const row = result.data as unknown as SayImportRow | null;
  if (!row || expired(row) || viewer && row.owner_key !== viewer.ownerKey) throw missing();
  if (row.user_id) await assertAccountNotDeleting(row.user_id);
  return row;
}

export async function presentSayImport(row: SayImportRow): Promise<SayImport> {
  let clip: SayClip | undefined;
  if (row.published_clip_id) {
    const result = await createSupabaseAdminClient().from("say_clip_versions").select("manifest,enabled").eq("id", row.published_clip_id).maybeSingle();
    checkSayImport(result.error);
    if (result.data?.enabled) clip = sayClipSchema.parse(result.data.manifest);
  }
  return { id: row.id, requestId: row.request_key, status: row.status, title: row.title, sourceUrl: row.source_url,
    sourceDuration: row.source_duration, sourceVideoUrl: row.assets.source ? sayImportMediaUrl(row, "source") : null,
    start: row.excerpt_start, end: row.excerpt_end, error: row.error_message,
    cues: row.cues ?? [], ...(clip ? { clip } : {}), createdAt: row.created_at };
}

/** The signed device cookie proves guest ownership when a player signs in. */
export async function claimSayImports(request: Request, viewer: SayViewer): Promise<void> {
  if (!viewer.user) return;
  const guest = getGuestIdentity(request);
  if (guest.setCookie) return;
  const oldOwner = `guest:${guest.idempotencyScope}`;
  const admin = createSupabaseAdminClient();
  const found = await admin.from("say_imports").select("id,status").eq("owner_key", oldOwner).is("deleted_at", null).gt("expires_at", new Date().toISOString());
  checkSayImport(found.error);
  for (const row of found.data ?? []) {
    const updated = await admin.from("say_imports").update({ owner_key: viewer.ownerKey, user_id: viewer.user.id,
      expires_at: row.status === "published" ? null : new Date(Date.now() + 7 * 86400_000).toISOString() }).eq("id", String(row.id)).eq("owner_key", oldOwner).is("deleted_at", null);
    checkSayImport(updated.error);
    const clips = await admin.from("say_clip_versions").update({ owner_key: viewer.ownerKey }).eq("custom_import_id", String(row.id)).eq("owner_key", oldOwner);
    checkSayImport(clips.error);
  }
}

export async function listSayImports(viewer: SayViewer): Promise<SayImport[]> {
  const result = await createSupabaseAdminClient().from("say_imports").select("*").eq("owner_key", viewer.ownerKey).is("deleted_at", null).order("created_at", { ascending: false }).limit(50);
  checkSayImport(result.error);
  return Promise.all((result.data as unknown as SayImportRow[] ?? []).filter(row => !expired(row)).map(presentSayImport));
}

export async function createSayImport(input: { url?: string; file?: File; requestId: string }, viewer: SayViewer): Promise<SayImport> {
  z.string().uuid().parse(input.requestId);
  const url = input.url ? validateSourceUrl(input.url) : null;
  if (!url && !input.file) throw new AppError("SCENE_SOURCE_REQUIRED", "Paste a clip link or choose a video.", 422);
  if (url && input.file) throw new AppError("SCENE_SOURCE_INVALID", "Choose one video source.", 422);
  if (input.file && (!input.file.size || input.file.size > SAY_IMPORT_MAX_BYTES || !/^(video\/|application\/octet-stream$)/.test(input.file.type))) throw new AppError("SCENE_FILE_INVALID", "Choose a video under 80 MB.", 422);
  const sourceHash = input.file ? createHash("sha256").update(Buffer.from(await input.file.arrayBuffer())).digest("hex") : null;
  const admin = createSupabaseAdminClient();
  const previous = await admin.from("say_imports").select("*").eq("owner_key", viewer.ownerKey).eq("request_key", input.requestId).maybeSingle();
  checkSayImport(previous.error);
  if (previous.data) {
    const row = previous.data as unknown as SayImportRow;
    if (row.source_url !== url || expired(row) || sourceHash && (row.integrity.source !== sourceHash || row.source_mime !== input.file!.type)) throw new AppError("IMPORT_RETRY_CONFLICT", "Start a new import for this video.", 409);
    if (row.status === "failed") {
      await enforceRateLimit(`say-import-retry:${viewer.ownerKey}`, { limit: 8, windowMs: 3600_000 });
      const retried = await admin.from("say_imports").update({ status: "queued", job_kind: "fetch", error_message: null, job_attempts: 0, lease_token: null, lease_expires_at: null }).eq("id", row.id).eq("owner_key", viewer.ownerKey).eq("status", "failed").is("deleted_at", null).select("*").maybeSingle();
      checkSayImport(retried.error); return presentSayImport(retried.data as unknown as SayImportRow ?? await loadSayImport(row.id, viewer));
    }
    return presentSayImport(row);
  }
  await enforceRateLimit(`say-import-create:${viewer.ownerKey}`, { limit: viewer.user ? 12 : 3, windowMs: 86400_000 });
  const id = randomUUID();
  const sourcePath = `${id}/source`;
  if (input.file) {
    const upload = await admin.storage.from(SAY_IMPORT_BUCKET).upload(sourcePath, input.file, { contentType: input.file.type, cacheControl: "0", upsert: false });
    checkSayImport(upload.error);
  }
  const insert = await admin.from("say_imports").insert({ id, owner_key: viewer.ownerKey, user_id: viewer.user?.id ?? null,
    request_key: input.requestId, source_url: url, title: input.file?.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Your custom scene",
    creator: input.file ? "Uploaded by player" : "Original creator", source_mime: input.file?.type || "video/mp4",
    media_key: randomBytes(24).toString("hex"), assets: input.file ? { source: sourcePath } : {}, integrity: sourceHash ? { source: sourceHash } : {},
    expires_at: new Date(Date.now() + (viewer.user ? 7 : 1) * 86400_000).toISOString() }).select("*").single();
  if (insert.error) {
    if (input.file) await admin.storage.from(SAY_IMPORT_BUCKET).remove([sourcePath]);
    // Concurrent retries share the same owner/request key.
    if (insert.error.code === "23505") return createSayImport(input, viewer);
    checkSayImport(insert.error);
  }
  return presentSayImport(insert.data as unknown as SayImportRow);
}

export async function prepareSayImport(id: string, input: unknown, viewer: SayViewer): Promise<SayImport> {
  const { start, end } = z.object({ start: z.number().finite().min(0), end: z.number().finite().positive() }).parse(input);
  const row = await loadSayImport(id, viewer);
  if (!row.assets.source || !row.source_duration) throw new AppError("SCENE_SOURCE_PENDING", "Wait for your video to finish importing.", 409);
  if (row.published_clip_id) throw new AppError("SCENE_ALREADY_CREATED", "This scene is ready to play. Import again to make another version.", 409);
  if (end - start < 1 || end - start > 45 || end > row.source_duration + 0.05) throw new AppError("SCENE_TRIM_INVALID", "Select between 1 and 45 seconds inside your video.", 422);
  if (row.status === "processing" || row.status === "publishing") return presentSayImport(row);
  await enforceRateLimit(`say-import-prepare:${viewer.ownerKey}`, { limit: viewer.user ? 24 : 6, windowMs: 86400_000 });
  const result = await createSupabaseAdminClient().from("say_imports").update({ status: "processing", job_kind: "prepare", excerpt_start: start, excerpt_end: end,
    cues: [], error_message: null, job_attempts: 0, lease_token: null, lease_expires_at: null }).eq("id", id).eq("owner_key", viewer.ownerKey).is("deleted_at", null).in("status", ["source-ready", "ready", "failed"]).select("*").maybeSingle();
  checkSayImport(result.error);
  return presentSayImport(result.data as unknown as SayImportRow ?? await loadSayImport(id, viewer));
}

export const publishSayImportSchema = z.object({ title: z.string().trim().min(2).max(100), rating: z.enum(["everyone", "teen", "mature"]),
  cues: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,80}$/), text: z.string().trim().min(1).max(500), start: z.number().finite().min(0), end: z.number().finite().positive().max(45), selected: z.boolean() })).min(1).max(40),
});

export function validateImportCues(cues: SayImportCue[], duration: number): void {
  if (!Number.isFinite(duration) || duration < 1 || duration > 45) throw new AppError("SCENE_TRIM_INVALID", "Select between 1 and 45 seconds inside your video.", 422);
  if (!cues.some(cue => cue.selected)) throw new AppError("SCENE_ROLE_REQUIRED", "Choose at least one line to perform.", 422);
  if (new Set(cues.map(cue => cue.id)).size !== cues.length) throw new AppError("SCENE_CUES_INVALID", "Each line needs its own ID.", 422);
  for (const [index, cue] of cues.entries()) {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start || cue.end > duration || index > 0 && cue.start < cues[index - 1]!.end) throw new AppError("SCENE_CUES_INVALID", "Keep lines in order, inside the selected clip, without overlapping.", 422);
  }
}

/** Draft ASR segmentation; the player can correct every word and boundary. */
export function importCuesFromWords(text: string, words: SayWord[], duration: number): SayImportCue[] {
  const valid = words.filter(word => word.end > word.start && word.start >= 0 && word.end <= duration + 0.1);
  if (!valid.length) return text.trim() ? [{ id: "line-1", text: text.trim().slice(0, 500), start: 0, end: duration, selected: true }] : [];
  const groups: SayWord[][] = []; let group: SayWord[] = [];
  for (const word of valid) {
    const last = group.at(-1);
    if (group.length && (group.length >= 12 || word.start - group[0]!.start > 5 || last && word.start - last.end > 0.7 || last && /[.!?]$/.test(last.text))) { groups.push(group); group = []; }
    group.push(word);
  }
  if (group.length) groups.push(group);
  return groups.slice(0, 40).map((part, i) => ({ id: `line-${i + 1}`, text: part.map(word => word.text).join(" "), start: Math.max(0, part[0]!.start), end: Math.min(duration, part.at(-1)!.end), selected: true }));
}

export async function downloadImportAsset(row: SayImportRow, asset: SayImportAsset, file: string, signal?: AbortSignal): Promise<void> {
  const key = row.assets[asset];
  if (!key || !key.startsWith(`${row.id}/`) || key.includes("..")) throw missing();
  const signed = await createSupabaseAdminClient().storage.from(SAY_IMPORT_BUCKET).createSignedUrl(key, 120); checkSayImport(signed.error);
  if (!signed.data?.signedUrl) throw missing();
  const response = await fetch(signed.data.signedUrl, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000) });
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > SAY_IMPORT_MAX_BYTES) throw new AppError("SCENE_MEDIA_UNAVAILABLE", "The source video could not be loaded.", 503);
  const chunks: Uint8Array[] = []; let size = 0; const reader = response.body.getReader();
  for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > SAY_IMPORT_MAX_BYTES) { await reader.cancel(); throw new AppError("SCENE_TOO_LARGE", "Choose a video under 80 MB.", 422); } chunks.push(next.value); }
  const bytes = Buffer.concat(chunks);
  if (row.integrity[asset] && createHash("sha256").update(bytes).digest("hex") !== row.integrity[asset]) throw new AppError("SCENE_MEDIA_CHANGED", "The scene media changed. Import the source again.", 409);
  await writeFile(file, bytes);
}

export async function publishSayImport(id: string, input: unknown, viewer: SayViewer): Promise<SayClip> {
  const values = publishSayImportSchema.parse(input);
  const row = await loadSayImport(id, viewer);
  if (row.published_clip_id) { const existing = await presentSayImport(row); if (existing.clip) return existing.clip; }
  if (row.status !== "ready" || !row.assets.video || !row.assets.reference) throw new AppError("SCENE_NOT_READY", "Finish preparing the clip first.", 409);
  const duration = row.excerpt_end - row.excerpt_start;
  validateImportCues(values.cues, duration);
  const admin = createSupabaseAdminClient();
  const lease = randomUUID();
  const locked = await admin.from("say_imports").update({ status: "publishing", lease_token: lease, lease_expires_at: new Date(Date.now() + 120000).toISOString() }).eq("id", id).eq("owner_key", viewer.ownerKey).eq("status", "ready").is("deleted_at", null).select("id").maybeSingle();
  checkSayImport(locked.error);
  if (!locked.data) throw new AppError("SCENE_PUBLISH_PENDING", "Your scene is being created. Reopen it in a moment.", 409);
  const dir = await mkdtemp(path.join(tmpdir(), "delivery-publish-"));
  let uploadedBacking: string | null = null;
  let committed = false;
  try {
    const video = path.join(dir, "video.mp4"); await downloadImportAsset(row, "video", video);
    const intervals = values.cues.filter(cue => cue.selected).map(cue => ({ start: Math.max(0, cue.start - 0.04), end: Math.min(duration, cue.end + 0.04) }));
    const backing = await createImportedBacking(video, path.join(dir, "backing.m4a"), intervals, AbortSignal.timeout(90000));
    const bytes = await readFile(backing);
    const backingHash = createHash("sha256").update(bytes).digest("hex");
    // A retry can never overwrite the audio referenced by a published manifest.
    const backingKey = `${id}/backing-${lease}-${backingHash}.m4a`;
    const upload = await admin.storage.from(SAY_IMPORT_BUCKET).upload(backingKey, bytes, { contentType: "audio/mp4", cacheControl: "0", upsert: false }); checkSayImport(upload.error);
    uploadedBacking = backingKey;
    row.assets = { ...row.assets, backing: backingKey }; row.integrity = { ...row.integrity, backing: backingHash };
    const clipId = `custom-${id}`, version = "v1";
    const sourceUrl = row.source_url || `${getServerEnv().NEXT_PUBLIC_APP_URL || "https://delivery-production-0577.up.railway.app"}/say-it-back?clip=${clipId}`;
    const clip = sayClipSchema.parse({ id: clipId, version, title: values.title, description: "Your clip. Your delivery.", duration,
      difficulty: duration > 30 ? "hard" : duration > 15 ? "medium" : "easy", rating: values.rating, category: "Your scenes", tags: ["custom"],
      videoUrl: sayImportMediaUrl(row, "video"), posterUrl: sayImportMediaUrl(row, "poster"), referenceAudioUrl: sayImportMediaUrl(row, "reference"),
      assetIntegrity: Object.fromEntries((["video", "poster", "reference", "backing"] as const).map(asset => [sayImportMediaUrl(row, asset), row.integrity[asset]])),
      roles: [{ id: "you", name: "Your lines", description: "Perform the lines you selected.", muteIntervals: intervals, dubAudioUrl: sayImportMediaUrl(row, "backing") }],
      cues: values.cues.map(cue => ({ id: cue.id, roleId: cue.selected ? "you" : "other", text: cue.text, start: cue.start, end: cue.end })),
      source: { title: row.title, creator: row.creator, url: sourceUrl, license: row.source_url ? "Owner-selected public clip" : "User-supplied media", licenseUrl: sourceUrl,
        attribution: `${row.creator} — ${row.title}. Edited and dubbed in Delivery.`, reuseNote: "Source selected by the player for a custom dubbed scene. No independent creator license is claimed.", excerptStart: row.excerpt_start, excerptEnd: row.excerpt_end, exportAllowed: true },
    });
    const published = await admin.rpc("publish_say_import", { p_id: id, p_owner_key: viewer.ownerKey, p_lease_token: lease,
      p_manifest: clip, p_assets: row.assets, p_integrity: row.integrity, p_cues: values.cues });
    if (published.error?.message === "SCENE_NOT_FOUND") throw missing();
    if (published.error?.message === "SCENE_PUBLISH_LEASE_LOST") throw new AppError("SCENE_PUBLISH_PENDING", "This preparation expired. Reopen your scene and try again.", 409);
    checkSayImport(published.error);
    if (!published.data) throw missing();
    committed = true;
    // The database returns the canonical immutable manifest, including on retries.
    return sayClipSchema.parse(published.data);
  } catch (error) {
    // A response can be lost after the transaction committed. Recover that exact scene.
    const recovered = await admin.from("say_imports").select("*").eq("id", id).maybeSingle();
    if (!recovered.error && recovered.data) {
      const current = recovered.data as unknown as SayImportRow;
      if (current.published_clip_id && !expired(current) && current.owner_key === viewer.ownerKey) {
        const existing = await presentSayImport(current);
        if (existing.clip) { committed = current.assets.backing === uploadedBacking; return existing.clip; }
      }
    }
    await admin.from("say_imports").update({ status: "ready", lease_token: null, lease_expires_at: null }).eq("id", id).eq("lease_token", lease).eq("status", "publishing").is("deleted_at", null);
    throw error;
  } finally {
    // If another retry won, only this request's uniquely named orphan is removed.
    if (uploadedBacking && !committed) {
      const current = await admin.from("say_imports").select("assets,deleted_at").eq("id", id).maybeSingle();
      const assets = current.data?.assets as Record<string, unknown> | undefined;
      if (!current.error && (current.data?.deleted_at || assets?.backing !== uploadedBacking)) await admin.storage.from(SAY_IMPORT_BUCKET).remove([uploadedBacking]);
    }
    await rm(dir, { recursive: true, force: true });
  }
}

export async function getSayImportMedia(id: string, assetName: string, request: Request): Promise<Response> {
  const asset = z.enum(SAY_IMPORT_ASSETS).parse(assetName); const row = await loadSayImport(id);
  // A shared excerpt must never grant access to the rest of its original upload.
  if (asset === "source") {
    const { getSayViewer } = await import("@/lib/server/say-it-back");
    if ((await getSayViewer(request)).ownerKey !== row.owner_key) throw missing();
  }
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!/^[a-f0-9]{48}$/.test(key) || !timingSafeEqual(Buffer.from(key), Buffer.from(row.media_key))) throw missing();
  const storageKey = row.assets[asset]; if (!storageKey || !storageKey.startsWith(`${id}/`) || storageKey.includes("..")) throw missing();
  const signed = await createSupabaseAdminClient().storage.from(SAY_IMPORT_BUCKET).createSignedUrl(storageKey, 120); checkSayImport(signed.error);
  if (!signed.data?.signedUrl) throw missing();
  const range = request.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) throw new AppError("INVALID_RANGE", "Choose a valid playback position.", 416);
  const response = await fetch(signed.data.signedUrl, { headers: range ? { Range: range } : undefined, cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!response.ok && response.status !== 206) throw missing();
  const mime = asset === "source" ? row.source_mime : asset === "poster" ? "image/jpeg" : asset === "reference" ? "audio/wav" : asset === "backing" ? "audio/mp4" : "video/mp4";
  const headers = new Headers({ "Content-Type": mime, "Cache-Control": asset === "source" ? "private, no-store" : "private, max-age=60", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
  for (const name of ["content-length", "content-range"]) { const value = response.headers.get(name); if (value) headers.set(name, value); }
  return new Response(response.body, { status: response.status, headers });
}

async function removeImportRow(row: SayImportRow): Promise<void> {
  const admin = createSupabaseAdminClient();
  // Revoke playback before deleting bytes; active workers can no longer publish.
  const revoked = await admin.from("say_imports").update({ deleted_at: new Date().toISOString(), job_kind: null, lease_token: null, lease_expires_at: null }).eq("id", row.id); checkSayImport(revoked.error);
  const disabled = await admin.from("say_clip_versions").update({ enabled: false }).eq("custom_import_id", row.id); checkSayImport(disabled.error);
  for (;;) {
    const listed = await admin.storage.from(SAY_IMPORT_BUCKET).list(row.id, { limit: 100 }); checkSayImport(listed.error);
    const keys = (listed.data ?? []).filter(file => !file.name.includes("/") && !file.name.includes("..")).map(file => `${row.id}/${file.name}`);
    if (!keys.length) break;
    const result = await admin.storage.from(SAY_IMPORT_BUCKET).remove(keys); checkSayImport(result.error);
    if ((listed.data?.length ?? 0) < 100) break;
  }
}
export async function deleteSayImport(id: string, viewer: SayViewer): Promise<void> { await removeImportRow(await loadSayImport(id, viewer)); }
export async function deleteOwnerSayImports(userId: string): Promise<void> {
  let afterId: string | undefined;
  for (;;) {
    let query = createSupabaseAdminClient().from("say_imports").select("*").eq("user_id", userId).order("id", { ascending: true }).limit(500);
    if (afterId) query = query.gt("id", afterId);
    const result = await query; checkSayImport(result.error);
    const rows = result.data as unknown as SayImportRow[] ?? [];
    for (const row of rows) await removeImportRow(row);
    if (rows.length < 500) break;
    afterId = rows.at(-1)!.id;
  }
}
export async function cleanupSayImports(limit = 20): Promise<void> {
  const admin = createSupabaseAdminClient();
  const result = await admin.from("say_imports").select("*").lt("expires_at", new Date().toISOString()).is("deleted_at", null).limit(limit); checkSayImport(result.error);
  for (const row of result.data as unknown as SayImportRow[] ?? []) await removeImportRow(row);
  // A crashed request must not strand a draft on the publishing screen.
  const reset = await admin.from("say_imports").update({ status: "ready", lease_token: null, lease_expires_at: null }).eq("status", "publishing").lt("lease_expires_at", new Date().toISOString()).is("published_clip_id", null).is("deleted_at", null); checkSayImport(reset.error);
}
