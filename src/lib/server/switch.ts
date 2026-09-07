import { cameraResponse } from "@/lib/server/camera-media";
import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { User } from "@supabase/supabase-js";
import { SWITCH_SCORING_VERSION, SWITCH_RUBRIC_VERSION, type SwitchAttempt, type SwitchChallenge, type SwitchInvitation, type SwitchScore } from "@/lib/switch/types";
import { getSwitchChallenge as findCatalogChallenge, snapshotSwitchChallenge } from "@/lib/switch/catalog";
import { switchChallengeSchema } from "@/lib/switch/schema";
import { getPublicAssignment } from "@/lib/server/public-assignments";
import { judgeSwitch } from "@/lib/server/switch-judge";
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

export type SwitchAttemptRow = Record<string, unknown>;
type Row = SwitchAttemptRow;
export const SWITCH_AUDIO_BUCKET = "delivery-audio";
export const SWITCH_ATTEMPT_COLUMNS = "*";
export type SwitchRating = "everyone" | "teen" | "mature";
export interface SwitchViewer { user: User | null; guest: GuestIdentity | null; ownerKey: string; setCookie?: string }
const notFound = () => new AppError("SWITCH_ATTEMPT_NOT_FOUND", "That take is private, expired, or unavailable. Sign in to the account that recorded it.", 404);
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const checked = (error: unknown) => { if (error) throw new ExternalServiceError("Supabase Switch", { cause: error }); };

export async function getSwitchViewer(request: Request, attemptKey?: string): Promise<SwitchViewer> {
  const user = await getOptionalUser();
  if (user) await assertAccountNotDeleting(user.id);
  const guest = getGuestIdentity(request, attemptKey);
  return { user, guest, ownerKey: user ? `user:${user.id}` : `guest:${guest.idempotencyScope}`, setCookie: guest.setCookie };
}

function challengeSnapshot(value: unknown): SwitchChallenge {
  // Snapshots only enter through a validated catalog or an authorized round.
  // Never rebuild an existing take from the current mutable catalog selection.
  return switchChallengeSchema.parse(value);
}

function owns(row: Row, viewer: SwitchViewer): boolean { return row.owner_key === viewer.ownerKey; }
function expired(row: Row): boolean { return Boolean(row.expires_at && new Date(String(row.expires_at)).getTime() <= Date.now()); }

async function assertParticipantAvailable(userId: string, viewer?: SwitchViewer): Promise<void> {
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

async function findChallenge(token: string, viewer: SwitchViewer): Promise<Row> {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) throw new AppError("SWITCH_CHALLENGE_NOT_FOUND", "That challenge link is unavailable.", 404);
  const result = await createSupabaseAdminClient().from("switch_challenges").select("*").eq("token_hash", digest(token)).maybeSingle();
  checked(result.error);
  const row = result.data;
  if (!row || row.revoked_at || expired(row)) throw new AppError("SWITCH_CHALLENGE_NOT_FOUND", "That challenge has ended. Ask your friend for a rematch.", 404);
  await assertParticipantAvailable(String(row.created_by), viewer);
  if (viewer.user) await assertParticipantAvailable(viewer.user.id);
  return row;
}

async function loadAttempt(id: string): Promise<Row> {
  const result = await createSupabaseAdminClient().from("switch_attempts").select("*").eq("id", id).maybeSingle();
  checked(result.error);
  if (!result.data || expired(result.data)) throw notFound();
  return result.data;
}

export async function getSwitchAttemptRow(id: string, viewer: SwitchViewer, challengeToken?: string): Promise<Row> {
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

export function presentSwitchAttempt(row: Row, viewer: SwitchViewer, challengeToken?: string): SwitchAttempt {
  const query = !owns(row, viewer) && challengeToken ? `?challengeToken=${encodeURIComponent(challengeToken)}` : "";
  return {
    id: String(row.id), mode: "switch", challenge: challengeSnapshot(row.challenge_snapshot),
    status: row.status as SwitchAttempt["status"], score: row.score as SwitchScore | null,
    audioUrl: `/api/switch/attempts/${row.id}/audio${query}`,
    audioExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), durationMs: Number(row.duration_ms), recordingOffsetMs: Number(row.recording_offset_ms),
    scoringVersion: String(row.scoring_version), createdAt: String(row.created_at), saved: Boolean(row.user_id), owned: owns(row, viewer), challengeId: row.challenge_id ? String(row.challenge_id) : null,
    ...(row.status === "failed" ? { warning: "Your take is safe. Judging was unavailable; retry scoring when you’re ready." } : {}),
    ...(!row.user_id ? { warning: "Guest takes stay on this browser for 24 hours. Sign in to keep this take in your history." } : {}),
  };
}

export async function getSwitchAttempt(id: string, viewer: SwitchViewer, challengeToken?: string): Promise<SwitchAttempt> {
  const row = await getSwitchAttemptRow(id, viewer, challengeToken);
  const attempt = presentSwitchAttempt(row, viewer, challengeToken);
  if (owns(row, viewer)) {
    attempt.previousBest = null;
    // An unjudged upload has no comparable result yet. Keep save/replay off
    // the history-query round trip; load comparisons after judging finishes.
    if (!attempt.score) return attempt;
    const previous = await createSupabaseAdminClient().from("switch_attempts").select("score,challenge_snapshot").eq("owner_key", viewer.ownerKey).eq("challenge_version_id", String(row.challenge_version_id)).eq("scoring_version", String(row.scoring_version)).eq("status", "scored").lt("created_at", String(row.created_at)).limit(100);
    checked(previous.error);
    const scores = (previous.data ?? []).filter((item) => {
      const score = item.score as SwitchScore | null;
      return score && score.overall !== null && score.rubricVersion === attempt.challenge.rubricVersion &&
        isDeepStrictEqual(challengeSnapshot(item.challenge_snapshot), attempt.challenge);
    }).map((item) => Number((item.score as SwitchScore).overall)).filter(Number.isFinite);
    attempt.previousBest = scores.length ? Math.max(...scores) : null;
  }
  return attempt;
}

export async function getSwitchHistory(userId: string, maxRating: SwitchRating = "mature"): Promise<SwitchAttempt[]> {
  await assertAccountNotDeleting(userId);
  const result = await createSupabaseAdminClient().from("switch_attempts").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  checked(result.error);
  const viewer = { user: { id: userId } as User, guest: null, ownerKey: `user:${userId}` };
  return (result.data ?? []).flatMap((row) => {
    try { const attempt = presentSwitchAttempt(row, viewer); assertContentRating(attempt.challenge.rating, maxRating); return [attempt]; } catch (error) { if (error instanceof AppError && error.status === 403) return []; throw error; }
  });
}

export interface CreateSwitchAttempt {
  audio: File; challengeId: string; challengeVersion: string; durationMs: number;
  recordingOffsetMs?: number; attemptId: string; maxRating: SwitchRating;
  challengeToken?: string; roundToken?: string; assignmentCode?: string; shareAudio: boolean;
}

export async function createSwitchAttempt(input: CreateSwitchAttempt, viewer: SwitchViewer): Promise<{ attempt: SwitchAttempt; replayed: boolean }> {
  if ((input.recordingOffsetMs ?? 0) !== 0) throw new AppError("SWITCH_TIMELINE_INVALID", "Switch cues follow the original recording clock.", 422);
  const admin = createSupabaseAdminClient();
  const audio = await validateAudio(input.audio, input.durationMs);
  const fingerprint = createRequestFingerprint(audio.contentHash, input.challengeId, input.challengeVersion, String(input.recordingOffsetMs ?? 0), input.challengeToken ?? "", input.roundToken ?? "", input.assignmentCode ?? "", String(input.shareAudio), input.maxRating);
  const existing = await admin.from("switch_attempts").select("*").eq("owner_key", viewer.ownerKey).eq("attempt_key", input.attemptId).maybeSingle();
  checked(existing.error);
  if (existing.data) {
    if (existing.data.request_fingerprint !== fingerprint) throw new AppError("IDEMPOTENCY_CONFLICT", "That retry belongs to a different recording.", 409);
    if (expired(existing.data)) throw notFound();
    return { attempt: presentSwitchAttempt(existing.data, viewer), replayed: true };
  }
  if ([input.challengeToken, input.roundToken, input.assignmentCode].filter(Boolean).length > 1) throw new AppError("SWITCH_INVITATION_INVALID", "Use one invitation for this take.", 422);
  const result = await runIdempotent("switch-upload", viewer.ownerKey, input.attemptId, fingerprint, 15 * 60_000, async () => {
    let invitation: Row | null = null;
    let challenge: SwitchChallenge | null | undefined;
    if (input.assignmentCode) {
      const assignment = await getPublicAssignment(input.assignmentCode, input.maxRating);
      if (assignment.mode !== "switch") throw new AppError("ASSIGNMENT_MISMATCH", "Open the exact Switch assignment before recording.", 409);
      challenge = assignment.challenge;
    } else if (input.challengeToken) {
      invitation = await findChallenge(input.challengeToken, viewer);
      challenge = challengeSnapshot(invitation.challenge_snapshot);
    } else if (input.roundToken) {
      const { getGroupSwitchChallenge } = await import("@/lib/server/group-rounds");
      if (!viewer.guest) throw notFound();
      challenge = await getGroupSwitchChallenge(input.roundToken, { user: viewer.user, guest: viewer.guest }, input.maxRating);
    } else {
      challenge = findCatalogChallenge(input.challengeId, input.challengeVersion);
    }
    if (!challenge) throw new AppError("SWITCH_CHALLENGE_NOT_FOUND", "Choose an available Switch challenge.", 404);
    if (challenge.id !== input.challengeId || challenge.version !== input.challengeVersion) throw new AppError("SWITCH_CHALLENGE_MISMATCH", "Record the exact script and directions from your invitation.", 409);
    assertContentRating(challenge.rating, input.maxRating);
    // A full take has a complete media timeline. A little capture startup or
    // tail latency is tolerated; neither recording nor speech is time-warped.
    if (audio.durationMs < challenge.duration * 1000 - 1000 || audio.durationMs > challenge.duration * 1000 + 2000) throw new AppError("SWITCH_TAKE_INCOMPLETE", "Record one complete take through every direction. Your local replay is still available.", 422);
    const snapshot = snapshotSwitchChallenge(challenge);
    const id = randomUUID();
    const path = viewer.user ? `${viewer.user.id}/switch/${id}.${audio.container}` : `guests/${viewer.guest!.idempotencyScope}/switch/${id}.${audio.container}`;
    const upload = await admin.storage.from("delivery-audio").upload(path, input.audio, { contentType: input.audio.type, cacheControl: "0", upsert: false });
    checked(upload.error);
    const insert = await admin.from("switch_attempts").insert({
      id, user_id: viewer.user?.id ?? null, guest_owner_hash: viewer.user ? null : viewer.guest!.idempotencyScope,
      owner_key: viewer.ownerKey, attempt_key: input.attemptId, request_fingerprint: fingerprint,
      challenge_version_id: `${snapshot.id}:${snapshot.version}`, challenge_snapshot: snapshot, scoring_version: snapshot.scoringVersion,
      recording_path: path, audio_mime: input.audio.type, audio_hash: audio.contentHash, duration_ms: audio.durationMs, recording_offset_ms: input.recordingOffsetMs ?? 0,
      challenge_id: invitation?.id ?? null, shared_with_challenge: Boolean(invitation && input.shareAudio),
      expires_at: viewer.user ? null : new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    }).select("*").single();
    if (insert.error) { await admin.storage.from("delivery-audio").remove([path]); checked(insert.error); }
    return String(insert.data!.id);
  });
  return { attempt: await getSwitchAttempt(result.value, viewer), replayed: result.replayed };
}

function assertRecordingPath(row: Row): string {
  const path = String(row.recording_path);
  const valid = row.user_id ? isOwnerStoragePath(path, String(row.user_id)) : /^guests\/[a-f0-9]{64}\/switch\/[a-f0-9-]{36}\.(wav|mp3)$/.test(path) && path.split("/")[1] === row.guest_owner_hash;
  if (!valid) throw notFound();
  return path;
}

export async function getSwitchAudioResponse(id: string, viewer: SwitchViewer, request: Request, token?: string): Promise<Response> {
  const row = await getSwitchAttemptRow(id, viewer, token);
  const path = assertRecordingPath(row);
  const camera = await cameraResponse("switch_attempt", id, request); if (camera) return camera;
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

export async function judgeSwitchAttempt(id: string, viewer: SwitchViewer): Promise<{ attempt: SwitchAttempt; usage?: JudgingUsage; replayed: boolean }> {
  const initial = await getSwitchAttemptRow(id, viewer);
  if (!owns(initial, viewer)) throw notFound();
  if (initial.status === "scored") return { attempt: await getSwitchAttempt(id, viewer), usage: initial.judging_usage as JudgingUsage | undefined, replayed: true };
  const operation = await runIdempotent("switch-judge", viewer.ownerKey, id, String(initial.audio_hash), 24 * 60 * 60_000, async () => {
    const row = await getSwitchAttemptRow(id, viewer);
    if (row.status === "scored") return { score: row.score as SwitchScore, usage: row.judging_usage as JudgingUsage };
    if (row.scoring_version !== SWITCH_SCORING_VERSION || challengeSnapshot(row.challenge_snapshot).rubricVersion !== SWITCH_RUBRIC_VERSION) throw new AppError("SWITCH_SCORING_VERSION_UNAVAILABLE", "This take uses an older judging version. Its replay is still available.", 409);
    if (Number(row.judge_calls) >= 3) throw new AppError("SWITCH_RETRY_LIMIT", "Judging could not finish after three tries. Your take is still available; record a fresh take to try again.", 429);
    const admin = createSupabaseAdminClient();
    const path = assertRecordingPath(row);
    const download = await admin.storage.from("delivery-audio").download(path);
    checked(download.error);
    if (!download.data) throw notFound();
    const audio = new File([download.data], path.split("/").pop()!, { type: String(row.audio_mime) });
    // Validate again at the paid boundary, before any quota or provider call.
    await validateAudio(audio, Number(row.duration_ms));
    const guestScope = viewer.guest?.scope ?? `signed:${viewer.user!.id}`;
    const reservation = await reserveJudgedPlay(viewer.user, `switch:${id}`, guestScope);
    if (reservation.replayed) throw new AppError("SWITCH_SCORE_PENDING", "This take was already charged and is finishing. Reopen it shortly; recording and replay are safe.", 409);
    try {
      const started = await admin.from("switch_attempts").update({ status: "judging", judge_calls: Number(row.judge_calls) + 1, judge_started_at: new Date().toISOString(), failure_code: null }).eq("id", id);
      checked(started.error);
      const score = await judgeSwitch({ audio, challenge: challengeSnapshot(row.challenge_snapshot), durationMs: Number(row.duration_ms), recordingOffsetMs: Number(row.recording_offset_ms), safetyIdentifier: digest(viewer.ownerKey), requestId: id });
      // Cache the bounded paid result before its database commit. A database
      // interruption can replay this exact result without a new provider call.
      return { score, usage: reservation.usage };
    } catch (error) {
      await admin.from("switch_attempts").update({ status: "failed", failure_code: error instanceof AppError ? error.code : "SWITCH_JUDGING_UNAVAILABLE" }).eq("id", id);
      await releaseJudgedPlay(reservation, viewer.user, guestScope);
      throw error;
    }
  });
  const { score, usage } = operation.value;
  const completed = await createSupabaseAdminClient().from("switch_attempts").update({ status: "scored", score, judging_usage: usage, failure_code: null }).eq("id", id).eq("owner_key", viewer.ownerKey);
  checked(completed.error);
  // Scoring an already submitted private group take also checks its words.
  // The old challenge consent flag is kept separate: entering a group must not
  // silently authorize a previous one-to-one challenge host to hear this take.
  const groupSubmissions = await createSupabaseAdminClient().from("challenge_group_takes").select("id").eq("switch_attempt_id", id).not("submitted_at", "is", null).limit(1);
  if (initial.shared_with_challenge || (!groupSubmissions.error && groupSubmissions.data?.length)) {
    try { await approveSwitchSharing({ ...initial, status: "scored", score }); } catch { /* A sharing failure never removes the private result. */ }
  }
  return { attempt: await getSwitchAttempt(id, viewer), usage, replayed: operation.replayed };
}

export async function approveSwitchSharing(row: Row): Promise<void> {
  const score = row.score as SwitchScore | null;
  if (row.status !== "scored" || !score) throw new AppError("SWITCH_SCORE_REQUIRED", "Finish judging this take before sharing a direct challenge.", 409);
  const challenge = challengeSnapshot(row.challenge_snapshot);
  if (challenge.rating === "mature") throw new AppError("SWITCH_MATURE_PRIVATE", "Mature performances stay private.", 403);
  if (row.moderation_state === "approved") return;
  const normalized = (value: string) => value.toLowerCase().normalize("NFKC").replace(/[^a-z0-9]+/g, " ").trim();
  const exactScript = normalized(score.transcript) === normalized(challenge.cues.map((cue) => cue.text).join(" "));
  const result = exactScript
    ? { decision: "approved", categories: ["switch-curated-script-exact"] }
    : await moderateLine(score.transcript);
  const update = await createSupabaseAdminClient().from("switch_attempts").update({ moderation_state: result.decision, moderation_labels: result.categories }).eq("id", String(row.id));
  checked(update.error);
  if (result.decision !== "approved") throw new AppError("SWITCH_SHARE_REVIEW", "Your take stays private because it did not pass sharing checks. You can still replay and retry it.", 403);
}

export async function createSwitchChallenge(attemptId: string, viewer: SwitchViewer, origin: string): Promise<SwitchInvitation> {
  if (!viewer.user) throw new AppError("UNAUTHORIZED", "Sign in to challenge a friend and keep your take.", 401);
  const row = await getSwitchAttemptRow(attemptId, viewer);
  if (!owns(row, viewer)) throw notFound();
  const challenge = challengeSnapshot(row.challenge_snapshot);
  if (row.scoring_version !== SWITCH_SCORING_VERSION || challenge.rubricVersion !== SWITCH_RUBRIC_VERSION) throw new AppError("SWITCH_CHALLENGE_VERSION_UNAVAILABLE", "Record a fresh take with the current beta judge to start a challenge. Your saved replay remains available.", 409);
  await assertParticipantAvailable(viewer.user.id);
  await approveSwitchSharing(row);
  const operation = await runIdempotent("switch-challenge", viewer.ownerKey, attemptId, String(row.audio_hash), 24 * 60 * 60_000, async () => {
    const token = randomBytes(32).toString("base64url");
    const result = await createSupabaseAdminClient().from("switch_challenges").insert({ created_by: viewer.user!.id, attempt_id: attemptId, token_hash: digest(token), challenge_version_id: row.challenge_version_id, challenge_snapshot: challenge, scoring_version: row.scoring_version }).select("id").single();
    checked(result.error);
    return token;
  });
  return getSwitchChallenge(operation.value, viewer, origin, "mature");
}

export async function getSwitchChallenge(token: string, viewer: SwitchViewer, origin: string, maxRating: SwitchRating): Promise<SwitchInvitation> {
  const row = await findChallenge(token, viewer);
  const original = await getSwitchAttemptRow(String(row.attempt_id), viewer, token);
  if (original.status !== "scored" || original.moderation_state !== "approved") throw notFound();
  const challenge = challengeSnapshot(row.challenge_snapshot);
  assertContentRating(challenge.rating, maxRating);
  const admin = createSupabaseAdminClient();
  const profile = await admin.from("profiles").select("display_name,handle").eq("id", String(row.created_by)).maybeSingle();
  checked(profile.error);
  let entriesQuery = admin.from("switch_attempts").select("*").eq("challenge_id", String(row.id)).order("created_at", { ascending: false }).limit(20);
  if (viewer.user?.id !== row.created_by) entriesQuery = entriesQuery.eq("owner_key", viewer.ownerKey);
  const entries = await entriesQuery;
  checked(entries.error);
  const recipientAttempts: SwitchAttempt[] = [];
  for (const entry of entries.data ?? []) {
    if (expired(entry)) continue;
    if (!owns(entry, viewer) && (!entry.shared_with_challenge || entry.status !== "scored" || entry.moderation_state !== "approved")) continue;
    if (entry.scoring_version !== row.scoring_version || !isDeepStrictEqual(challengeSnapshot(entry.challenge_snapshot), challenge)) continue;
    try {
      if (entry.user_id) await assertParticipantAvailable(String(entry.user_id), viewer);
      recipientAttempts.push(presentSwitchAttempt(entry, viewer, token));
    } catch (error) { if (error instanceof AppError && [403, 404].includes(error.status)) continue; throw error; }
  }
  return { id: String(row.id), token, url: `${origin}/switch?challenge=${token}`, challenge, scoringVersion: String(row.scoring_version), expiresAt: String(row.expires_at), challengerName: String(profile.data?.display_name ?? profile.data?.handle ?? "A friend"), challengerAttempt: presentSwitchAttempt(original, viewer, token), recipientAttempts };
}

export async function deleteSwitchAttempt(id: string, viewer: SwitchViewer): Promise<void> {
  const row = await getSwitchAttemptRow(id, viewer);
  if (!owns(row, viewer)) throw notFound();
  const admin = createSupabaseAdminClient();
  const cancelled = await admin.rpc("cancel_video_exports", { p_source_kind: "switch_attempt", p_attempt_id: id });
  checked(cancelled.error);
  const removed = await admin.storage.from("delivery-audio").remove([assertRecordingPath(row)]);
  checked(removed.error);
  const deleted = await admin.from("switch_attempts").delete().eq("id", id).eq("owner_key", viewer.ownerKey);
  checked(deleted.error);
}

export async function claimSwitchAttempt(id: string, request: Request, viewer: SwitchViewer): Promise<SwitchAttempt> {
  if (!viewer.user) throw new AppError("UNAUTHORIZED", "Sign in to save this take.", 401);
  const row = await loadAttempt(id);
  if (owns(row, viewer)) return getSwitchAttempt(id, viewer);
  const guest = getGuestIdentity(request);
  // A newly minted device identity cannot prove ownership. The signed cookie
  // set by the successful guest upload must still be present after sign-in.
  if (guest.setCookie || row.user_id || row.guest_owner_hash !== guest.idempotencyScope || row.owner_key !== `guest:${guest.idempotencyScope}`) throw notFound();
  if (row.status === "judging") throw new AppError("SWITCH_CLAIM_PENDING", "Your take is still judging. Finish scoring, then save it to your account.", 409);
  await assertAccountNotDeleting(viewer.user.id);
  const result = await runIdempotent("switch-claim", viewer.ownerKey, id, String(row.audio_hash), 15 * 60_000, async () => {
    const admin = createSupabaseAdminClient();
    const oldPath = assertRecordingPath(row);
    const newPath = `${viewer.user!.id}/switch/${oldPath.split("/").pop()!}`;
    const moved = await admin.storage.from("delivery-audio").move(oldPath, newPath);
    checked(moved.error);
    const updated = await admin.from("switch_attempts").update({ user_id: viewer.user!.id, guest_owner_hash: null, owner_key: viewer.ownerKey, recording_path: newPath, expires_at: null }).eq("id", id).eq("owner_key", `guest:${guest.idempotencyScope}`).select("id").maybeSingle();
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
  return getSwitchAttempt(result.value, viewer);
}

/** Reuse the existing authenticated cleanup job; no new scheduler is needed. */
export async function cleanupExpiredSwitchGuests(limit = 100): Promise<{ deleted: number }> {
  const admin = createSupabaseAdminClient();
  const result = await admin.from("switch_attempts").select("*").is("user_id", null).lt("expires_at", new Date().toISOString()).limit(Math.max(1, Math.min(100, limit)));
  checked(result.error);
  if (!result.data?.length) return { deleted: 0 };
  const rows = result.data;
  const removed = await admin.storage.from("delivery-audio").remove(rows.map(assertRecordingPath));
  checked(removed.error);
  const deleted = await admin.from("switch_attempts").delete().in("id", rows.map((row) => String(row.id)));
  checked(deleted.error);
  return { deleted: rows.length };
}
