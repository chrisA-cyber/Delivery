import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { SAY_SCORING_VERSION, type SayAttempt, type SayChallenge, type SayClip, type SayScore } from "@/lib/say-it-back/types";
import { sayClipSchema } from "@/lib/say-it-back/schema";
import { scoreSayAttempt } from "@/lib/say-it-back/scoring";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertAccountNotDeleting, isOwnerStoragePath } from "@/lib/server/account-deletion";
import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { validateAudio } from "@/lib/server/audio";
import { assertContentRating, challengeHasActiveProfileContainment } from "@/lib/server/content";
import { reserveJudgedPlay, releaseJudgedPlay, type JudgingUsage } from "@/lib/server/entitlements";
import { getGuestIdentity, type GuestIdentity } from "@/lib/server/guest";
import { createRequestFingerprint, runIdempotent } from "@/lib/server/idempotency";
import { moderateLine } from "@/lib/server/moderation";
import { getOptionalUser } from "@/lib/supabase/auth";
import { transcribeSayAudio } from "@/lib/server/say-it-back-transcription";

type Row = Record<string, unknown>;
export type SayRating = "everyone" | "teen" | "mature";
export interface SayViewer { user: User | null; guest: GuestIdentity | null; ownerKey: string; setCookie?: string }
const notFound = () => new AppError("SAY_ATTEMPT_NOT_FOUND", "That take is private, expired, or unavailable. Sign in to the account that recorded it.", 404);
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const checked = (error: unknown) => { if (error) throw new ExternalServiceError("Supabase Say It Back", { cause: error }); };

export async function getSayViewer(request: Request, attemptKey?: string): Promise<SayViewer> {
  const user = await getOptionalUser();
  if (user) {
    await assertAccountNotDeleting(user.id);
    return { user, guest: null, ownerKey: `user:${user.id}` };
  }
  const guest = getGuestIdentity(request, attemptKey);
  return { user: null, guest, ownerKey: `guest:${guest.idempotencyScope}`, setCookie: guest.setCookie };
}

export async function getSayClips(maxRating: SayRating): Promise<SayClip[]> {
  const result = await createSupabaseAdminClient().from("say_clip_versions").select("manifest").eq("enabled", true).order("created_at", { ascending: false }).limit(100);
  checked(result.error);
  const seen = new Set<string>();
  return (result.data ?? []).flatMap((row) => {
    const parsed = sayClipSchema.safeParse(row.manifest);
    if (!parsed.success || seen.has(parsed.data.id)) return [];
    seen.add(parsed.data.id);
    try { assertContentRating(parsed.data.rating, maxRating); } catch { return []; }
    return [parsed.data];
  });
}

async function clipVersion(id: string, version: string, maxRating: SayRating): Promise<SayClip> {
  const result = await createSupabaseAdminClient().from("say_clip_versions").select("manifest,enabled").eq("id", `${id}:${version}`).maybeSingle();
  checked(result.error);
  if (!result.data?.enabled) throw new AppError("SAY_CLIP_NOT_FOUND", "That scene is unavailable. Choose another clip.", 404);
  const clip = sayClipSchema.parse(result.data.manifest);
  assertContentRating(clip.rating, maxRating);
  return clip;
}

function owns(row: Row, viewer: SayViewer): boolean { return row.owner_key === viewer.ownerKey; }
function expired(row: Row): boolean { return Boolean(row.expires_at && new Date(String(row.expires_at)).getTime() <= Date.now()); }

async function assertParticipantAvailable(userId: string, viewer?: SayViewer): Promise<void> {
  const admin = createSupabaseAdminClient();
  await assertAccountNotDeleting(userId);
  const restrictions = await admin.from("account_restrictions").select("user_id,kind,starts_at,ends_at").eq("user_id", userId).in("kind", ["profile-limit", "profile-remove"]);
  checked(restrictions.error);
  if (challengeHasActiveProfileContainment((restrictions.data ?? []) as { user_id: string; kind: string; starts_at: string; ends_at: string | null }[], [userId])) throw notFound();
  if (viewer?.user && viewer.user.id !== userId) {
    const block = await admin.from("blocks").select("blocker_id").or(`and(blocker_id.eq.${userId},blocked_id.eq.${viewer.user.id}),and(blocker_id.eq.${viewer.user.id},blocked_id.eq.${userId})`).limit(1);
    checked(block.error);
    if (block.data?.length) throw notFound();
  }
}

async function findChallenge(token: string, viewer: SayViewer): Promise<Row> {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) throw new AppError("SAY_CHALLENGE_NOT_FOUND", "That challenge link is unavailable.", 404);
  const result = await createSupabaseAdminClient().from("say_challenges").select("*").eq("token_hash", digest(token)).maybeSingle();
  checked(result.error);
  const row = result.data;
  if (!row || row.revoked_at || expired(row)) throw new AppError("SAY_CHALLENGE_NOT_FOUND", "That challenge has ended. Ask your friend for a rematch.", 404);
  await assertParticipantAvailable(String(row.created_by), viewer);
  if (viewer.user) await assertParticipantAvailable(viewer.user.id);
  return row;
}

async function loadAttempt(id: string): Promise<Row> {
  const result = await createSupabaseAdminClient().from("say_attempts").select("*").eq("id", id).maybeSingle();
  checked(result.error);
  if (!result.data || expired(result.data)) throw notFound();
  return result.data;
}

export async function getSayAttemptRow(id: string, viewer: SayViewer, challengeToken?: string): Promise<Row> {
  const row = await loadAttempt(id);
  if (row.user_id) await assertAccountNotDeleting(String(row.user_id));
  if (owns(row, viewer)) return row;
  if (!challengeToken) throw notFound();
  const challenge = await findChallenge(challengeToken, viewer);
  const original = challenge.attempt_id === row.id;
  const entrant = row.challenge_id === challenge.id && row.shared_with_challenge === true;
  // A token permits the creator's opted-in take. Recipient audio is available
  // only to the creator or that recipient, never every holder of the link.
  if ((!original && !(entrant && viewer.user?.id === challenge.created_by)) || row.status !== "scored" || row.moderation_state !== "approved") throw notFound();
  if (row.user_id) await assertParticipantAvailable(String(row.user_id), viewer);
  return row;
}

function presentAttempt(row: Row, viewer: SayViewer, challengeToken?: string): SayAttempt {
  const query = !owns(row, viewer) && challengeToken ? `?challengeToken=${encodeURIComponent(challengeToken)}` : "";
  return {
    id: String(row.id), mode: "say-it-back", clip: sayClipSchema.parse(row.clip_snapshot), roleId: String(row.role_id),
    status: row.status as SayAttempt["status"], score: row.score as SayScore | null,
    audioUrl: `/api/say-it-back/attempts/${row.id}/audio${query}`,
    audioExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), durationMs: Number(row.duration_ms), recordingOffsetMs: Number(row.recording_offset_ms),
    scoringVersion: String(row.scoring_version), createdAt: String(row.created_at), saved: Boolean(row.user_id), owned: owns(row, viewer), challengeId: row.challenge_id ? String(row.challenge_id) : null,
    ...(row.status === "failed" ? { warning: "Your dub is safe. Matching was unavailable; retry scoring when you’re ready." } : {}),
    ...(!row.user_id ? { warning: "Guest takes stay on this browser for 24 hours. Sign in to keep this take in your history." } : {}),
  };
}

export async function getSayAttempt(id: string, viewer: SayViewer, challengeToken?: string): Promise<SayAttempt> {
  const row = await getSayAttemptRow(id, viewer, challengeToken);
  const attempt = presentAttempt(row, viewer, challengeToken);
  if (owns(row, viewer)) {
    attempt.previousBest = null;
    // An unjudged upload has no comparable result yet. Keep save/replay off
    // the history-query round trip; load comparisons after matching finishes.
    if (!attempt.score) return attempt;
    const previous = await createSupabaseAdminClient().from("say_attempts").select("score").eq("owner_key", viewer.ownerKey).eq("clip_version_id", String(row.clip_version_id)).eq("role_id", String(row.role_id)).eq("scoring_version", String(row.scoring_version)).eq("status", "scored").lt("created_at", String(row.created_at)).limit(100);
    checked(previous.error);
    const currentScore = attempt.score;
    const scores = (previous.data ?? []).filter((item) => {
      const score = item.score as SayScore | null;
      return score && currentScore && JSON.stringify(score.weights) === JSON.stringify(currentScore.weights) && (score.timing === null) === (currentScore.timing === null) && (score.rhythm === null) === (currentScore.rhythm === null);
    }).map((item) => Number((item.score as Row)?.overall)).filter(Number.isFinite);
    attempt.previousBest = scores.length ? Math.max(...scores) : null;
  }
  return attempt;
}

export async function getSayHistory(userId: string, maxRating: SayRating = "mature"): Promise<SayAttempt[]> {
  await assertAccountNotDeleting(userId);
  const result = await createSupabaseAdminClient().from("say_attempts").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  checked(result.error);
  const viewer = { user: { id: userId } as User, guest: null, ownerKey: `user:${userId}` };
  return (result.data ?? []).flatMap((row) => {
    try { const attempt = presentAttempt(row, viewer); assertContentRating(attempt.clip.rating, maxRating); return [attempt]; } catch (error) { if (error instanceof AppError && error.status === 403) return []; throw error; }
  });
}

export interface CreateSayAttempt {
  audio: File; clipId: string; clipVersion: string; roleId: string; durationMs: number;
  recordingOffsetMs: number; attemptId: string; maxRating: SayRating; challengeToken?: string; shareAudio: boolean;
}

export async function createSayAttempt(input: CreateSayAttempt, viewer: SayViewer): Promise<{ attempt: SayAttempt; replayed: boolean }> {
  const admin = createSupabaseAdminClient();
  const audio = await validateAudio(input.audio, input.durationMs);
  if (audio.durationMs > 30_000) throw new AppError("AUDIO_TOO_LONG", "Keep your take under 30 seconds.", 422);
  const fingerprint = createRequestFingerprint(audio.contentHash, input.clipId, input.clipVersion, input.roleId, String(input.recordingOffsetMs), input.challengeToken ?? "", String(input.shareAudio), input.maxRating);
  const existing = await admin.from("say_attempts").select("*").eq("owner_key", viewer.ownerKey).eq("attempt_key", input.attemptId).maybeSingle();
  checked(existing.error);
  if (existing.data) {
    if (existing.data.request_fingerprint !== fingerprint) throw new AppError("IDEMPOTENCY_CONFLICT", "That retry belongs to a different recording.", 409);
    if (expired(existing.data)) throw notFound();
    return { attempt: presentAttempt(existing.data, viewer), replayed: true };
  }
  const result = await runIdempotent("say-upload", viewer.ownerKey, input.attemptId, fingerprint, 15 * 60_000, async () => {
    const clip = await clipVersion(input.clipId, input.clipVersion, input.maxRating);
    if (!clip.roles.some((role) => role.id === input.roleId)) throw new AppError("SAY_ROLE_INVALID", "Choose a role from this scene.", 422);
    if (audio.durationMs > clip.duration * 1000 + 2000) throw new AppError("AUDIO_TOO_LONG", "This recording runs beyond the scene. Record another take with the scene cues.", 422);
    let challenge: Row | null = null;
    if (input.challengeToken) {
      challenge = await findChallenge(input.challengeToken, viewer);
      if (challenge.clip_version_id !== `${clip.id}:${clip.version}` || challenge.role_id !== input.roleId || challenge.scoring_version !== SAY_SCORING_VERSION) throw new AppError("SAY_CHALLENGE_MISMATCH", "Record the exact scene and role from the challenge link.", 409);
    }
    const id = randomUUID();
    const path = viewer.user ? `${viewer.user.id}/say/${id}.${audio.container}` : `guests/${viewer.guest!.idempotencyScope}/say/${id}.${audio.container}`;
    const upload = await admin.storage.from("delivery-audio").upload(path, input.audio, { contentType: input.audio.type, cacheControl: "0", upsert: false });
    checked(upload.error);
    const insert = await admin.from("say_attempts").insert({
      id, user_id: viewer.user?.id ?? null, guest_owner_hash: viewer.guest?.idempotencyScope ?? null,
      owner_key: viewer.ownerKey, attempt_key: input.attemptId, request_fingerprint: fingerprint,
      clip_version_id: `${clip.id}:${clip.version}`, clip_snapshot: clip, role_id: input.roleId, scoring_version: SAY_SCORING_VERSION,
      recording_path: path, audio_mime: input.audio.type, audio_hash: audio.contentHash, duration_ms: audio.durationMs, recording_offset_ms: input.recordingOffsetMs,
      challenge_id: challenge?.id ?? null, shared_with_challenge: Boolean(challenge && input.shareAudio),
      expires_at: viewer.user ? null : new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    }).select("*").single();
    if (insert.error) { await admin.storage.from("delivery-audio").remove([path]); checked(insert.error); }
    return String(insert.data!.id);
  });
  return { attempt: await getSayAttempt(result.value, viewer), replayed: result.replayed };
}

function assertRecordingPath(row: Row): string {
  const path = String(row.recording_path);
  const valid = row.user_id ? isOwnerStoragePath(path, String(row.user_id)) : /^guests\/[a-f0-9]{64}\/say\/[a-f0-9-]{36}\.(wav|mp3)$/.test(path) && path.split("/")[1] === row.guest_owner_hash;
  if (!valid) throw notFound();
  return path;
}

export async function getSayAudioResponse(id: string, viewer: SayViewer, request: Request, token?: string): Promise<Response> {
  const row = await getSayAttemptRow(id, viewer, token);
  const path = assertRecordingPath(row);
  const signed = await createSupabaseAdminClient().storage.from("delivery-audio").createSignedUrl(path, 60);
  checked(signed.error);
  if (!signed.data?.signedUrl) throw notFound();
  const range = request.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) throw new AppError("INVALID_RANGE", "Choose a valid playback position.", 416);
  const response = await fetch(signed.data.signedUrl, { headers: range ? { Range: range } : undefined, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok && response.status !== 206) throw new ExternalServiceError("Recording playback");
  const headers = new Headers({ "Content-Type": String(row.audio_mime), "Cache-Control": "private, no-store", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
  for (const name of ["content-length", "content-range"]) { const value = response.headers.get(name); if (value) headers.set(name, value); }
  return new Response(response.body, { status: response.status, headers });
}

export async function judgeSayAttempt(id: string, viewer: SayViewer): Promise<{ attempt: SayAttempt; usage?: JudgingUsage; replayed: boolean }> {
  const initial = await getSayAttemptRow(id, viewer);
  if (!owns(initial, viewer)) throw notFound();
  if (initial.status === "scored") return { attempt: await getSayAttempt(id, viewer), usage: initial.judging_usage as JudgingUsage | undefined, replayed: true };
  const operation = await runIdempotent("say-judge", viewer.ownerKey, id, String(initial.audio_hash), 24 * 60 * 60_000, async () => {
    const row = await getSayAttemptRow(id, viewer);
    if (row.status === "scored") return { score: row.score as SayScore, transcription: row.transcription, usage: row.judging_usage as JudgingUsage };
    if (row.scoring_version !== SAY_SCORING_VERSION) throw new AppError("SAY_SCORING_VERSION_UNAVAILABLE", "This take uses an older matching version. Its replay is still available.", 409);
    if (Number(row.judge_calls) >= 3) throw new AppError("SAY_RETRY_LIMIT", "Matching could not finish after three tries. Your dub is still available; record a fresh take to try again.", 429);
    const admin = createSupabaseAdminClient();
    const path = assertRecordingPath(row);
    const download = await admin.storage.from("delivery-audio").download(path);
    checked(download.error);
    if (!download.data) throw notFound();
    const audio = new File([download.data], path.split("/").pop()!, { type: String(row.audio_mime) });
    // Validate again at the paid boundary, before any quota or provider call.
    await validateAudio(audio, Number(row.duration_ms));
    const guestScope = viewer.guest?.scope ?? `signed:${viewer.user!.id}`;
    const reservation = await reserveJudgedPlay(viewer.user, `say:${id}`, guestScope);
    if (reservation.replayed) throw new AppError("SAY_SCORE_PENDING", "This take was already charged and is finishing. Reopen it shortly; recording and replay are safe.", 409);
    try {
      const started = await admin.from("say_attempts").update({ status: "judging", judge_calls: Number(row.judge_calls) + 1, judge_started_at: new Date().toISOString(), failure_code: null }).eq("id", id);
      checked(started.error);
      const transcription = await transcribeSayAudio(audio);
      const score = scoreSayAttempt({ clip: sayClipSchema.parse(row.clip_snapshot), roleId: String(row.role_id), transcript: transcription.text, words: transcription.words, recordingOffsetMs: Number(row.recording_offset_ms), audioHash: String(row.audio_hash), timingEvidence: transcription.timing });
      // Commit the paid computation to the existing 24-hour Redis receipt
      // before the database update. A failed database write can then be retried
      // using this exact result, with no second provider call or play charge.
      return { score, transcription, usage: reservation.usage };
    } catch (error) {
      await admin.from("say_attempts").update({ status: "failed", failure_code: error instanceof AppError ? error.code : "SAY_MATCHING_UNAVAILABLE" }).eq("id", id);
      await releaseJudgedPlay(reservation, viewer.user, guestScope);
      throw error;
    }
  });
  const { score, transcription, usage } = operation.value;
  const completed = await createSupabaseAdminClient().from("say_attempts").update({ status: "scored", score, transcription, judging_usage: usage, failure_code: null }).eq("id", id).eq("owner_key", viewer.ownerKey);
  checked(completed.error);
  if (initial.shared_with_challenge) {
    try { await approveSaySharing({ ...initial, status: "scored", score }); } catch { /* A sharing failure never removes the private result. */ }
  }
  return { attempt: await getSayAttempt(id, viewer), usage, replayed: operation.replayed };
}

export async function approveSaySharing(row: Row): Promise<void> {
  const score = row.score as SayScore | null;
  if (row.status !== "scored" || !score) throw new AppError("SAY_SCORE_REQUIRED", "Finish matching this take before sharing it.", 409);
  const clip = sayClipSchema.parse(row.clip_snapshot);
  if (clip.rating === "mature") throw new AppError("SAY_MATURE_PRIVATE", "Mature scenes stay private. Choose another scene for a friend challenge.", 403);
  if (row.moderation_state === "approved") return;
  // This snapshot was loaded from the trusted immutable catalog at admission.
  // An exact normalized performance inherits that script's editorial rating;
  // it is not reclassified as harassment for saying an approved fictional line.
  // Any added, substituted or omitted dialogue still receives live moderation.
  const exactScript = score.words === 100 && score.evidence.expectedWords > 0 && score.evidence.matchedWords === score.evidence.expectedWords && score.evidence.additions === 0 && score.evidence.substitutions === 0 && score.evidence.omissions === 0;
  if (exactScript) {
    const approved = await createSupabaseAdminClient().from("say_attempts").update({ moderation_state: "approved", moderation_labels: ["say-curated-script-exact"] }).eq("id", String(row.id));
    checked(approved.error);
    return;
  }
  const result = await moderateLine(score.transcript);
  const update = await createSupabaseAdminClient().from("say_attempts").update({ moderation_state: result.decision, moderation_labels: result.categories }).eq("id", String(row.id));
  checked(update.error);
  if (result.decision !== "approved") throw new AppError("SAY_SHARE_REVIEW", "Your take stays private because it did not pass sharing checks. You can still replay and retry it.", 403);
}

export async function createSayChallenge(attemptId: string, viewer: SayViewer, origin: string): Promise<SayChallenge> {
  if (!viewer.user) throw new AppError("UNAUTHORIZED", "Sign in to challenge a friend and keep your take.", 401);
  const row = await getSayAttemptRow(attemptId, viewer);
  if (!owns(row, viewer)) throw notFound();
  const score = row.score as SayScore | null;
  if (!score || score.timing === null || score.rhythm === null) throw new AppError("SAY_FULL_MATCH_REQUIRED", "Challenges need a complete timing and rhythm match. This take’s words and replay are still available.", 409);
  if (row.scoring_version !== SAY_SCORING_VERSION) throw new AppError("SAY_CHALLENGE_VERSION_UNAVAILABLE", "This take uses an older matching version. Record a fresh take to start a challenge; your saved replay remains available.", 409);
  await assertParticipantAvailable(viewer.user.id);
  await approveSaySharing(row);
  const operation = await runIdempotent("say-challenge", viewer.ownerKey, attemptId, String(row.audio_hash), 24 * 60 * 60_000, async () => {
    const token = randomBytes(32).toString("base64url");
    const result = await createSupabaseAdminClient().from("say_challenges").insert({ created_by: viewer.user!.id, attempt_id: attemptId, token_hash: digest(token), clip_version_id: row.clip_version_id, role_id: row.role_id, scoring_version: row.scoring_version }).select("id").single();
    checked(result.error);
    return token;
  });
  return getSayChallenge(operation.value, viewer, origin, "mature");
}

export async function getSayChallenge(token: string, viewer: SayViewer, origin: string, maxRating: SayRating): Promise<SayChallenge> {
  const row = await findChallenge(token, viewer);
  const original = await getSayAttemptRow(String(row.attempt_id), viewer, token);
  // The creator can always see their own take, but may not publish a revoked
  // or newly restricted take to recipients by keeping an old capability alive.
  if (original.status !== "scored" || original.moderation_state !== "approved") throw notFound();
  const clip = sayClipSchema.parse(original.clip_snapshot);
  assertContentRating(clip.rating, maxRating);
  const admin = createSupabaseAdminClient();
  const profile = await admin.from("profiles").select("display_name,handle").eq("id", String(row.created_by)).maybeSingle();
  checked(profile.error);
  let entriesQuery = admin.from("say_attempts").select("*").eq("challenge_id", String(row.id)).order("created_at", { ascending: false }).limit(20);
  if (viewer.user?.id !== row.created_by) entriesQuery = entriesQuery.eq("owner_key", viewer.ownerKey);
  const entries = await entriesQuery;
  checked(entries.error);
  const recipientAttempts: SayAttempt[] = [];
  for (const entry of entries.data ?? []) {
    if (expired(entry)) continue;
    if (!owns(entry, viewer) && (!entry.shared_with_challenge || entry.status !== "scored")) continue;
    const entryScore = entry.score as SayScore | null;
    const referenceScore = original.score as SayScore;
    if (entryScore && (entryScore.timing === null || entryScore.rhythm === null || JSON.stringify(entryScore.weights) !== JSON.stringify(referenceScore.weights))) continue;
    try {
      if (entry.user_id) await assertParticipantAvailable(String(entry.user_id), viewer);
      if (!owns(entry, viewer) && entry.moderation_state !== "approved") continue;
      recipientAttempts.push(presentAttempt(entry, viewer, token));
    } catch (error) { if (error instanceof AppError && [403, 404].includes(error.status)) continue; throw error; }
  }
  return { id: String(row.id), token, url: `${origin}/say-it-back?challenge=${token}`, clip, roleId: String(row.role_id), scoringVersion: String(row.scoring_version), expiresAt: String(row.expires_at), challengerName: String(profile.data?.display_name ?? profile.data?.handle ?? "A friend"), challengerAttempt: presentAttempt(original, viewer, token), recipientAttempts };
}

export async function deleteSayAttempt(id: string, viewer: SayViewer): Promise<void> {
  const row = await getSayAttemptRow(id, viewer);
  if (!owns(row, viewer)) throw notFound();
  const admin = createSupabaseAdminClient();
  const removed = await admin.storage.from("delivery-audio").remove([assertRecordingPath(row)]);
  checked(removed.error);
  const deleted = await admin.from("say_attempts").delete().eq("id", id).eq("owner_key", viewer.ownerKey);
  checked(deleted.error);
}

export async function claimSayAttempt(id: string, request: Request, viewer: SayViewer): Promise<SayAttempt> {
  if (!viewer.user) throw new AppError("UNAUTHORIZED", "Sign in to save this take.", 401);
  const row = await loadAttempt(id);
  if (owns(row, viewer)) return getSayAttempt(id, viewer);
  const guest = getGuestIdentity(request);
  // A newly minted device identity cannot prove ownership. The signed cookie
  // set by the successful guest upload must still be present after sign-in.
  if (guest.setCookie || row.user_id || row.guest_owner_hash !== guest.idempotencyScope || row.owner_key !== `guest:${guest.idempotencyScope}`) throw notFound();
  if (row.status === "judging") throw new AppError("SAY_CLAIM_PENDING", "Your take is still matching. Finish scoring, then save it to your account.", 409);
  await assertAccountNotDeleting(viewer.user.id);
  const result = await runIdempotent("say-claim", viewer.ownerKey, id, String(row.audio_hash), 15 * 60_000, async () => {
    const admin = createSupabaseAdminClient();
    const oldPath = assertRecordingPath(row);
    const newPath = `${viewer.user!.id}/say/${oldPath.split("/").pop()!}`;
    const moved = await admin.storage.from("delivery-audio").move(oldPath, newPath);
    checked(moved.error);
    const updated = await admin.from("say_attempts").update({ user_id: viewer.user!.id, guest_owner_hash: null, owner_key: viewer.ownerKey, recording_path: newPath, expires_at: null }).eq("id", id).eq("owner_key", `guest:${guest.idempotencyScope}`).select("id").maybeSingle();
    if (updated.error || !updated.data) {
      // Keep the guest receipt and its bytes usable if containment or a database
      // interruption stops the transfer after the private object was moved.
      const restored = await admin.storage.from("delivery-audio").move(newPath, oldPath);
      checked(restored.error);
      checked(updated.error);
      throw notFound();
    }
    return id;
  });
  return getSayAttempt(result.value, viewer);
}

/** Reuse the existing authenticated cleanup job; no new scheduler is needed. */
export async function cleanupExpiredSayGuests(limit = 100): Promise<{ deleted: number }> {
  const admin = createSupabaseAdminClient();
  const result = await admin.from("say_attempts").select("*").is("user_id", null).lt("expires_at", new Date().toISOString()).limit(Math.max(1, Math.min(100, limit)));
  checked(result.error);
  if (!result.data?.length) return { deleted: 0 };
  const rows = result.data;
  const removed = await admin.storage.from("delivery-audio").remove(rows.map(assertRecordingPath));
  checked(removed.error);
  const deleted = await admin.from("say_attempts").delete().in("id", rows.map((row) => String(row.id)));
  checked(deleted.error);
  return { deleted: rows.length };
}
