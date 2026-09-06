import "server-only";

import { randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import type { ContentRating } from "@/lib/content/types";
import type { GroupAssignment } from "@/lib/groups/types";
import { RUBRIC_VERSION, SCORING_VERSION } from "@/lib/judging/rubric";
import type { DeliveryMode } from "@/lib/types";
import { assertAccountNotDeleting, isOwnerStoragePath } from "@/lib/server/account-deletion";
import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { validateAudio } from "@/lib/server/audio";
import { assertContentRating, resolveCanonicalDeliveryContent } from "@/lib/server/content";
import { preflightJudgingUsage } from "@/lib/server/entitlements";
import { getGuestIdentity, type GuestIdentity } from "@/lib/server/guest";
import { createRequestFingerprint, runIdempotent } from "@/lib/server/idempotency";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/supabase/auth";

export type ClassicExportAttemptRow = Record<string, unknown>;
type ClassicAssignment = Extract<GroupAssignment, { mode: "classic" }>;
export interface ClassicExportViewer { user: User | null; guest: GuestIdentity | null; ownerKey: string; setCookie?: string }
export interface ClassicExportAttempt {
  id: string; mode: "classic"; assignment: ClassicAssignment; audioUrl: string;
  durationMs: number; displayName: string | null; createdAt: string; expiresAt: string | null;
  saved: boolean; owned: true; score: null;
}
export interface CreateClassicExportAttempt {
  audio: File; durationMs: number; attemptId: string; promptId: string; promptText: string;
  energy: string; mode: DeliveryMode; maxRating: ContentRating; category?: string;
  challengeId?: string; challengeToken?: string; dailyDate?: string; dailyMarket?: string;
  assignmentCode?: string; displayName?: string;
}
const notFound = () => new AppError("CLASSIC_ATTEMPT_NOT_FOUND", "That take is private, expired, or unavailable. Open it in the browser or account that recorded it.", 404);
const checked = (error: unknown) => { if (error) throw new ExternalServiceError("Recording storage", { cause: error }); };
const unavailable = (row: ClassicExportAttemptRow) => Boolean(row.deleted_at || (row.expires_at && new Date(String(row.expires_at)).getTime() <= Date.now()));

export async function getClassicExportViewer(request: Request, attemptKey?: string): Promise<ClassicExportViewer> {
  const user = await getOptionalUser();
  if (user) await assertAccountNotDeleting(user.id);
  const guest = getGuestIdentity(request, attemptKey);
  return { user, guest, ownerKey: user ? `user:${user.id}` : `guest:${guest.idempotencyScope}`, setCookie: guest.setCookie };
}

export function assertClassicRecordingPath(row: ClassicExportAttemptRow): string {
  const path = String(row.recording_path);
  const valid = row.user_id
    ? isOwnerStoragePath(path, String(row.user_id)) && path === `${row.user_id}/classic/${row.id}.${row.audio_mime === "audio/mpeg" || row.audio_mime === "audio/mp3" ? "mp3" : "wav"}`
    : /^guests\/[a-f0-9]{64}\/classic\/[a-f0-9-]{36}\.(wav|mp3)$/.test(path) && path.split("/")[1] === row.guest_owner_hash && path.split("/")[3]?.split(".")[0] === row.id;
  if (!valid) throw notFound();
  return path;
}

export async function getClassicExportAttemptRow(id: string, viewer: ClassicExportViewer): Promise<ClassicExportAttemptRow> {
  const found = await createSupabaseAdminClient().from("classic_video_attempts").select("*").eq("id", id).eq("owner_key", viewer.ownerKey).maybeSingle();
  checked(found.error);
  if (!found.data || unavailable(found.data)) throw notFound();
  if (found.data.user_id) await assertAccountNotDeleting(String(found.data.user_id));
  assertClassicRecordingPath(found.data);
  return found.data;
}

export function presentClassicExportAttempt(row: ClassicExportAttemptRow): ClassicExportAttempt {
  return { id: String(row.id), mode: "classic", assignment: row.assignment_snapshot as ClassicAssignment,
    audioUrl: `/api/classic/attempts/${row.id}/audio`, durationMs: Number(row.duration_ms),
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    createdAt: String(row.created_at), expiresAt: row.expires_at ? String(row.expires_at) : null,
    saved: Boolean(row.user_id), owned: true, score: null };
}

export async function getClassicExportAttempt(id: string, viewer: ClassicExportViewer): Promise<ClassicExportAttempt> {
  return presentClassicExportAttempt(await getClassicExportAttemptRow(id, viewer));
}

export async function getClassicExportHistory(viewer: ClassicExportViewer, maxRating: ContentRating): Promise<ClassicExportAttempt[]> {
  const found = await createSupabaseAdminClient().from("classic_video_attempts").select("*").eq("owner_key", viewer.ownerKey).is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  checked(found.error);
  return (found.data ?? []).flatMap((row) => {
    if (unavailable(row)) return [];
    const attempt = presentClassicExportAttempt(row);
    try { assertContentRating(attempt.assignment.rating, maxRating); } catch (error) { if (error instanceof AppError && error.status === 403) return []; throw error; }
    return [attempt];
  });
}

async function resolveAssignment(input: CreateClassicExportAttempt, viewer: ClassicExportViewer): Promise<ClassicAssignment> {
  const usage = await preflightJudgingUsage(viewer.user);
  if (input.assignmentCode) {
    if (input.challengeId || input.challengeToken || input.dailyDate || input.dailyMarket || input.mode !== "classic") throw new AppError("ASSIGNMENT_CONTEXT_INVALID", "Use one assignment for this take.", 422);
    const { getPublicAssignmentDetails } = await import("@/lib/server/public-assignments");
    const { assignment, requiresPro } = await getPublicAssignmentDetails(input.assignmentCode, input.maxRating);
    if (requiresPro && usage.tier !== "pro") throw new AppError("PRO_REQUIRED", "This assignment belongs to a Pro pack.", 403);
    if (assignment.mode !== "classic" || assignment.promptId !== input.promptId || assignment.promptText !== input.promptText || assignment.energy !== input.energy) throw new AppError("ASSIGNMENT_MISMATCH", "Record the exact line and direction from this assignment.", 409);
    return assignment;
  }
  const canonical = await resolveCanonicalDeliveryContent({ ...input, user: viewer.user, usage });
  return { mode: "classic", promptId: canonical.promptId, promptSlug: canonical.promptSlug,
    promptText: canonical.promptText, energyId: canonical.energyId, energySlug: canonical.energySlug,
    energy: canonical.energy, category: canonical.category, difficulty: canonical.difficulty,
    rating: canonical.rating, scoringVersion: SCORING_VERSION, rubricVersion: RUBRIC_VERSION };
}

/** Upload-only: canonical text and byte-derived duration; no judging or moderation provider calls. */
export async function createClassicExportAttempt(input: CreateClassicExportAttempt, viewer: ClassicExportViewer): Promise<{ attempt: ClassicExportAttempt; replayed: boolean }> {
  const audio = await validateAudio(input.audio, input.durationMs);
  if (audio.durationMs > 20_000) throw new AppError("AUDIO_DURATION_INVALID", "Keep Classic recordings to 20 seconds or less.", 422);
  const fingerprint = createRequestFingerprint(audio.contentHash, input.promptId, input.promptText, input.energy,
    input.mode, input.category ?? "", input.challengeId ?? "", input.challengeToken ?? "", input.dailyDate ?? "",
    input.dailyMarket ?? "", input.assignmentCode ?? "", input.maxRating, input.displayName ?? "");
  const admin = createSupabaseAdminClient();
  const findExisting = async () => {
    const found = await admin.from("classic_video_attempts").select("*").eq("owner_key", viewer.ownerKey).eq("attempt_key", input.attemptId).maybeSingle();
    checked(found.error);
    if (!found.data) return null;
    if (unavailable(found.data)) throw notFound();
    if (found.data.request_fingerprint !== fingerprint) throw new AppError("IDEMPOTENCY_CONFLICT", "That retry belongs to a different recording or assignment.", 409);
    return found.data;
  };
  const existing = await findExisting();
  if (existing) return { attempt: presentClassicExportAttempt(existing), replayed: true };
  const result = await runIdempotent("classic-video-upload", viewer.ownerKey, input.attemptId, fingerprint, 15 * 60_000, async () => {
    const saved = await findExisting();
    if (saved) return String(saved.id);
    const assignment = await resolveAssignment(input, viewer);
    const id = randomUUID();
    const path = viewer.user ? `${viewer.user.id}/classic/${id}.${audio.container}` : `guests/${viewer.guest!.idempotencyScope}/classic/${id}.${audio.container}`;
    const upload = await admin.storage.from("delivery-audio").upload(path, input.audio, { contentType: input.audio.type, cacheControl: "0", upsert: false });
    checked(upload.error);
    try {
      if (viewer.user) await assertAccountNotDeleting(viewer.user.id);
      const inserted = await admin.from("classic_video_attempts").insert({ id, user_id: viewer.user?.id ?? null,
        guest_owner_hash: viewer.user ? null : viewer.guest!.idempotencyScope, owner_key: viewer.ownerKey,
        attempt_key: input.attemptId, request_fingerprint: fingerprint, recording_path: path, audio_mime: input.audio.type.toLowerCase().split(";")[0],
        audio_hash: audio.contentHash, duration_ms: audio.durationMs, assignment_snapshot: assignment,
        display_name: input.displayName ?? null, expires_at: viewer.user ? null : new Date(Date.now() + 24 * 3600_000).toISOString(),
      }).select("id").single();
      checked(inserted.error);
      return String(inserted.data!.id);
    } catch (error) {
      const removed = await admin.storage.from("delivery-audio").remove([path]);
      if (removed.error) console.error("Classic upload rollback failed", { attemptId: id });
      throw error;
    }
  });
  return { attempt: await getClassicExportAttempt(result.value, viewer), replayed: result.replayed };
}

export async function getClassicExportAudioResponse(id: string, viewer: ClassicExportViewer, request: Request): Promise<Response> {
  const row = await getClassicExportAttemptRow(id, viewer);
  const signed = await createSupabaseAdminClient().storage.from("delivery-audio").createSignedUrl(assertClassicRecordingPath(row), 60);
  checked(signed.error);
  if (!signed.data?.signedUrl) throw notFound();
  const range = request.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) throw new AppError("INVALID_RANGE", "Choose a valid playback position.", 416);
  const response = await fetch(signed.data.signedUrl, { headers: range ? { Range: range } : undefined, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok && response.status !== 206) throw new ExternalServiceError("Recording playback");
  const headers = new Headers({ "Content-Type": String(row.audio_mime), "Cache-Control": "private, no-store", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
  for (const name of ["content-length", "content-range"]) { const value = response.headers.get(name); if (value) headers.set(name, value); }
  return new Response(response.body, { status: response.status, headers });
}

export async function deleteClassicExportAttempt(id: string, viewer: ClassicExportViewer): Promise<void> {
  const admin = createSupabaseAdminClient();
  const found = await admin.from("classic_video_attempts").select("*").eq("id", id).eq("owner_key", viewer.ownerKey).maybeSingle();
  checked(found.error);
  if (!found.data) throw notFound();
  // Keep the tombstone: a late upload retry must never recreate deleted media.
  const cancelled = await admin.from("classic_video_attempts").update({ deleted_at: found.data.deleted_at ?? new Date().toISOString() }).eq("id", id).eq("owner_key", viewer.ownerKey);
  checked(cancelled.error);
  const removed = await admin.storage.from("delivery-audio").remove([assertClassicRecordingPath(found.data)]);
  checked(removed.error);
  const cleaned = await admin.from("classic_video_attempts").update({ recording_deleted_at: new Date().toISOString() }).eq("id", id).eq("owner_key", viewer.ownerKey);
  checked(cleaned.error);
}

export async function claimClassicExportAttempt(id: string, request: Request, viewer: ClassicExportViewer): Promise<ClassicExportAttempt> {
  if (!viewer.user) throw new AppError("UNAUTHORIZED", "Sign in to keep this take.", 401);
  const admin = createSupabaseAdminClient();
  const found = await admin.from("classic_video_attempts").select("*").eq("id", id).maybeSingle();
  checked(found.error);
  const row = found.data;
  if (!row || unavailable(row)) throw notFound();
  if (row.owner_key === viewer.ownerKey) return getClassicExportAttempt(id, viewer);
  const guest = getGuestIdentity(request);
  if (guest.setCookie || row.user_id || row.guest_owner_hash !== guest.idempotencyScope || row.owner_key !== `guest:${guest.idempotencyScope}`) throw notFound();
  await assertAccountNotDeleting(viewer.user.id);
  const result = await runIdempotent("classic-video-claim", viewer.ownerKey, id, String(row.audio_hash), 15 * 60_000, async () => {
    const oldPath = assertClassicRecordingPath(row);
    const newPath = `${viewer.user!.id}/classic/${oldPath.split("/").pop()!}`;
    const moved = await admin.storage.from("delivery-audio").move(oldPath, newPath);
    checked(moved.error);
    const updated = await admin.from("classic_video_attempts").update({ user_id: viewer.user!.id, guest_owner_hash: null, owner_key: viewer.ownerKey, recording_path: newPath, expires_at: null }).eq("id", id).eq("owner_key", `guest:${guest.idempotencyScope}`).is("deleted_at", null).select("id").maybeSingle();
    if (updated.error || !updated.data) {
      const latest = await admin.from("classic_video_attempts").select("deleted_at").eq("id", id).maybeSingle();
      checked(latest.error);
      if (!latest.data || latest.data.deleted_at) {
        const removed = await admin.storage.from("delivery-audio").remove([oldPath, newPath]);
        checked(removed.error); throw notFound();
      }
      const restored = await admin.storage.from("delivery-audio").move(newPath, oldPath);
      checked(restored.error); checked(updated.error); throw notFound();
    }
    return id;
  });
  return getClassicExportAttempt(result.value, viewer);
}
