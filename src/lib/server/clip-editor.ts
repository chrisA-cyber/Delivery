import "server-only";
// Sharp 0.35 ships declarations but omits them from its ESM export map.
// @ts-expect-error Upstream package export map; runtime import is supported.
import sharp from "sharp";
import { z } from "zod";
import { clipEditSettingsSchema, clipAvatarSchema, defaultClipEditSettings, type ClipAvatar, type ClipEditSettings } from "@/lib/video-composition";
import type { ContentRating } from "@/lib/content/types";
import type { SwitchViewer } from "@/lib/server/switch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/server/api-error";
import { assertAccountNotDeleting } from "@/lib/server/account-deletion";
import { checkedExport, exportUnavailable, resolveExportSource, type ExportMode, type ExportSource } from "@/lib/server/video-export-sources";

export const CLIP_REQUEST_BYTES = 280_000;
export const AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024;
const AVATAR_BYTES = 180_000;
const avatarSchema = clipAvatarSchema;
export const clipSourceSchema = z.object({ mode: z.enum(["classic", "switch", "say-it-back"]), attemptId: z.string().uuid(), maxRating: z.enum(["everyone", "teen", "mature"]).default("everyone") });
const minClipLength = (duration: number) => Math.min(0.5, duration);
const invalidAvatar = () => new AppError("AVATAR_INVALID", "Choose a PNG, JPEG, or WebP image under 5 MB.", 400);

/** Content-Length is optional; cap actual bytes before JSON or multipart parsing. */
export async function readBoundedClipBody(request: Request, max: number): Promise<Buffer> {
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader(), parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.length;
      if (size > max) { await reader.cancel(); throw new AppError("PAYLOAD_TOO_LARGE", "Choose a smaller avatar image.", 413); }
      parts.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(parts);
}

/** Fully decode bounded raster bytes; SVG, animated images and pixel bombs never reach a renderer. */
export async function normalizeAvatarUpload(bytes: Buffer, mime: string): Promise<ClipAvatar> {
  if (!bytes.length || bytes.length > AVATAR_UPLOAD_BYTES || !["image/png", "image/jpeg", "image/webp"].includes(mime)) throw invalidAvatar();
  try {
    const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: "error", animated: false });
    const meta = await image.metadata();
    if (!meta.width || !meta.height || (meta.pages ?? 1) > 1 || `image/${meta.format === "jpeg" ? "jpeg" : meta.format}` !== mime) throw invalidAvatar();
    const output = await image.rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
    if (output.length > AVATAR_BYTES) throw invalidAvatar();
    return { kind: "upload", dataUrl: `data:image/webp;base64,${output.toString("base64")}` };
  } catch { throw invalidAvatar(); }
}

/** Keep already-normalized bytes stable so reopening or saving never changes an export hash. */
export async function validateClipAvatar(value: unknown): Promise<ClipAvatar> {
  const avatar = avatarSchema.parse(value);
  if (avatar.kind === "builtin") return avatar;
  const match = /^data:image\/(png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(avatar.dataUrl);
  if (!match) throw invalidAvatar();
  const bytes = Buffer.from(match[2]!, "base64");
  if (!bytes.length || bytes.length > AVATAR_BYTES || bytes.toString("base64") !== match[2]) throw invalidAvatar();
  try {
    const image = sharp(bytes, { limitInputPixels: 512 * 512, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.width || !meta.height || meta.width > 512 || meta.height > 512 || (meta.pages ?? 1) > 1 || meta.format !== match[1]) throw invalidAvatar();
    await image.raw().toBuffer();
  } catch { throw invalidAvatar(); }
  return avatar;
}

export async function getPreferredAvatar(viewer: SwitchViewer): Promise<ClipAvatar> {
  if (viewer.user) await assertAccountNotDeleting(viewer.user.id);
  // A verified existing guest cookie proves the preference belongs to this browser.
  if (viewer.user && viewer.guest && !viewer.guest.setCookie) {
    const claim = await createSupabaseAdminClient().rpc("claim_performance_avatar", { p_user_id: viewer.user.id, p_guest_owner_key: `guest:${viewer.guest.idempotencyScope}` });
    checkedExport(claim.error);
  }
  const result = await createSupabaseAdminClient().from("performance_avatar_preferences").select("avatar,expires_at").eq("owner_key", viewer.ownerKey).maybeSingle();
  checkedExport(result.error);
  const saved = result.data && (!result.data.expires_at || new Date(String(result.data.expires_at)).getTime() > Date.now()) ? avatarSchema.safeParse(result.data.avatar) : null;
  return saved?.success ? saved.data : defaultClipEditSettings("classic").avatar;
}

export async function savePreferredAvatar(value: unknown, viewer: SwitchViewer): Promise<ClipAvatar> {
  const avatar = await validateClipAvatar(value);
  const result = await createSupabaseAdminClient().rpc("save_performance_avatar", { p_owner_key: viewer.ownerKey, p_user_id: viewer.user?.id ?? null, p_avatar: avatar });
  checkedExport(result.error);
  return avatar;
}

export function sourceDuration(source: ExportSource): number {
  return source.input.assignment.mode === "say-it-back" ? source.input.assignment.clip.duration : source.input.durationMs / 1000;
}

export async function validateClipSettings(value: unknown, source: ExportSource): Promise<ClipEditSettings> {
  const settings = clipEditSettingsSchema.parse(value);
  await validateClipAvatar(settings.avatar);
  const duration = sourceDuration(source), end = settings.trimEnd ?? duration;
  if (settings.trimStart < 0 || end > duration + 0.05 || end - settings.trimStart < minClipLength(duration) || settings.trimStart >= duration) {
    throw new AppError("CLIP_TRIM_INVALID", "Keep at least a half-second inside your original recording.", 400);
  }
  return { ...settings, trimEnd: settings.trimEnd === null ? null : Math.min(duration, settings.trimEnd) };
}

export async function loadClipSettings(source: ExportSource, avatar: ClipAvatar): Promise<ClipEditSettings> {
  const result = await createSupabaseAdminClient().from("performance_clip_edits").select("settings").eq("source_kind", source.kind).eq("attempt_id", String(source.row.id)).eq("owner_key", source.ownerKey).maybeSingle();
  checkedExport(result.error);
  const saved = clipEditSettingsSchema.safeParse(result.data?.settings);
  return saved.success ? saved.data : { ...defaultClipEditSettings(source.input.assignment.mode), avatar };
}

export async function saveClipSettings(source: ExportSource, value: unknown): Promise<ClipEditSettings> {
  const settings = await validateClipSettings(value, source);
  const result = await createSupabaseAdminClient().rpc("save_performance_clip_edits", { p_source_kind: source.kind, p_attempt_id: String(source.row.id), p_owner_key: source.ownerKey, p_user_id: source.userId, p_settings: settings });
  if (result.error?.message?.includes("EXPORT_SOURCE_UNAVAILABLE")) throw exportUnavailable();
  checkedExport(result.error);
  return settings;
}

export async function getClipEditor(mode: ExportMode, attemptId: string, maxRating: ContentRating, viewer: SwitchViewer) {
  const source = await resolveExportSource(mode, attemptId, viewer, maxRating, { includeName: true, includeScore: true, invitation: true });
  const preferredAvatar = await getPreferredAvatar(viewer);
  const settings = await loadClipSettings(source, preferredAvatar);
  const { assignment, recordingOffsetMs, displayName, score, invitationUrl } = source.input;
  const duration = sourceDuration(source);
  const scene = { mode, duration, displayName, score, invitationUrl, ...(assignment.mode === "classic" ? { classic: { phrase: assignment.promptText, direction: assignment.energy } } : assignment.mode === "switch" ? { switch: assignment.challenge } : { say: { clip: assignment.clip, roleId: assignment.roleId } }) };
  return { settings, preferredAvatar, source: { assignment, recordingOffsetMs, displayName, score, invitationUrl, duration, scene, recordingUrl: `/api/exports/editor/audio?mode=${mode}&attemptId=${attemptId}&maxRating=${maxRating}` } };
}

/** Every audio request rechecks source ownership and containment, including range seeks. */
export async function clipEditorAudioResponse(mode: ExportMode, attemptId: string, maxRating: ContentRating, viewer: SwitchViewer, request: Request): Promise<Response> {
  const source = await resolveExportSource(mode, attemptId, viewer, maxRating);
  const result = await createSupabaseAdminClient().storage.from("delivery-audio").createSignedUrl(source.input.recordingPath, 60);
  checkedExport(result.error); if (!result.data?.signedUrl) throw exportUnavailable();
  const range = request.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) throw new AppError("INVALID_RANGE", "Choose a valid playback position.", 416);
  const upstream = await fetch(result.data.signedUrl, { cache: "no-store", headers: range ? { Range: range } : undefined, signal: AbortSignal.timeout(30_000) });
  if (!upstream.ok && upstream.status !== 206) throw exportUnavailable();
  const headers = new Headers({ "Content-Type": upstream.headers.get("content-type") ?? "audio/wav", "Cache-Control": "private, no-store", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff" });
  for (const key of ["content-length", "content-range"]) { const value = upstream.headers.get(key); if (value) headers.set(key, value); }
  return new Response(upstream.body, { status: upstream.status, headers });
}
