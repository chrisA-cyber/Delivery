import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { getEnergyModifierById, getPromptById } from "@/data/content";
import type { ContentRating } from "@/lib/content/types";
import type { CreateGroupRoundInput, GroupAssignment, GroupMember, GroupPerformance, GroupRound } from "@/lib/groups/types";
import { RUBRIC_VERSION, SCORING_VERSION } from "@/lib/judging/rubric";
import { sayClipSchema } from "@/lib/say-it-back/schema";
import { SAY_SCORING_VERSION, type SayAttempt, type SayScore } from "@/lib/say-it-back/types";
import type { DeliveryJudgment } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/supabase/auth";
import { assertAccountNotDeleting, isOwnerStoragePath } from "@/lib/server/account-deletion";
import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { validateAudio } from "@/lib/server/audio";
import { assertContentRating, challengeHasActiveProfileContainment, resolveCanonicalDeliveryContent, type CanonicalDeliveryContent } from "@/lib/server/content";
import { getServerEnv } from "@/lib/server/env";
import { getGuestIdentity, type GuestIdentity } from "@/lib/server/guest";
import { createRequestFingerprint, runIdempotent } from "@/lib/server/idempotency";
import { moderateLine } from "@/lib/server/moderation";
import { approveSaySharing } from "@/lib/server/say-it-back";

type Row = Record<string, unknown>;
export interface GroupViewer { user: User | null; guest: GuestIdentity; setCookie?: string }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const notFound = () => new AppError("ROUND_NOT_FOUND", "This invitation is unavailable or has been revoked. Ask your friend for a new round link.", 404);
const now = () => new Date().toISOString();
const isExpired = (value: unknown) => Boolean(value && new Date(String(value)).getTime() <= Date.now());
function checked(error: unknown): void {
  if (!error) return;
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  const errors: Record<string, [string, number]> = {
    ROUND_TAKE_SUPERSEDED: ["That take was replaced. Choose a fresh performance; the latest submission is safe.", 409],
    ROUND_TAKE_LIMIT: ["You have saved 20 takes for this round. Choose one of them or start a rematch.", 429],
    ROUND_INVITE_REVOKED: ["This invitation was revoked. Existing players can still finish the round.", 404],
    ROUND_EXPIRED: ["This round's replay window has ended. Start another round.", 410],
    ROUND_ASSIGNMENT_INVALID: ["Choose an available scene or Classic assignment.", 422],
    ROUND_ASSIGNMENT_IMMUTABLE: ["A round's assignment cannot change. Start a rematch instead.", 409],
    ROUND_ACTION_INVALID: ["That action is unavailable for this round.", 422],
    ROUND_CLOSED: ["This round has closed. Your private take is still available; start a rematch.", 409],
    ROUND_FULL: ["This round already has 12 players. Ask your host to start another round.", 409],
    ROUND_FORBIDDEN: ["Only the host can do that.", 403],
    ROUND_NOT_FOUND: ["This invitation is unavailable or has been revoked.", 404],
    ROUND_NOT_MEMBER: ["Join this round before submitting or watching performances.", 403],
    ROUND_CLAIM_CONFLICT: ["This account already joined as a different player. Keep using the original participant.", 409],
    ROUND_TAKE_INVALID: ["Choose your own matching, approved performance for this round.", 409],
    ROUND_VOTE_INVALID: ["Vote once for another player's submitted performance after reveal.", 409],
    ROUND_IDEMPOTENCY_CONFLICT: ["That retry belongs to a different round.", 409],
  };
  for (const [code, [text, status]] of Object.entries(errors)) if (message.includes(code)) throw new AppError(code, text, status);
  throw new ExternalServiceError("Group rounds", { cause: error });
}

export async function getGroupViewer(request: Request, requestKey?: string): Promise<GroupViewer> {
  const user = await getOptionalUser();
  if (user) await assertAccountNotDeleting(user.id);
  const guest = getGuestIdentity(request, requestKey);
  return { user, guest, setCookie: guest.setCookie };
}

export const getRoundViewer = getGroupViewer;

export function ownsGroupMember(member: Row, viewer: GroupViewer): boolean {
  // A claimed membership is account-only. Possession of the browser cookie
  // must never let a later signed-out visitor impersonate its account owner.
  return member.user_id ? member.user_id === viewer.user?.id : member.guest_owner_hash === viewer.guest.idempotencyScope;
}

async function participantAvailable(userId: string | null, viewer: GroupViewer): Promise<boolean> {
  if (!userId) return true;
  const admin = createSupabaseAdminClient();
  const [deletion, restrictions, blocks] = await Promise.all([
    admin.from("account_deletion_jobs").select("user_id").eq("user_id", userId).limit(1),
    admin.from("account_restrictions").select("user_id,kind,starts_at,ends_at").eq("user_id", userId).in("kind", ["profile-limit", "profile-remove"]),
    viewer.user && viewer.user.id !== userId ? admin.from("blocks").select("blocker_id").or(`and(blocker_id.eq.${userId},blocked_id.eq.${viewer.user.id}),and(blocker_id.eq.${viewer.user.id},blocked_id.eq.${userId})`).limit(1) : Promise.resolve({ data: [], error: null }),
  ]);
  checked(deletion.error); checked(restrictions.error); checked(blocks.error);
  return !deletion.data?.length && !blocks.data?.length && !challengeHasActiveProfileContainment((restrictions.data ?? []) as { user_id: string; kind: string; starts_at: string; ends_at: string | null }[], [userId]);
}

async function assertViewerAvailable(viewer: GroupViewer) {
  if (viewer.user && !(await participantAvailable(viewer.user.id, viewer))) throw notFound();
}

async function rpcAction(row: Row, viewer: GroupViewer, action: string, payload: Row = {}): Promise<Row> {
  const result = await createSupabaseAdminClient().rpc("group_round_action", {
    p_challenge_id: row.id, p_owner_user: viewer.user?.id ?? null,
    p_guest_hash: viewer.guest.idempotencyScope, p_action: action, p_payload: payload,
  });
  checked(result.error);
  return result.data as Row;
}

async function loadRound(token: string, viewer: GroupViewer, maxRating: ContentRating): Promise<{ row: Row; members: Row[]; member: Row | null }> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw notFound();
  await assertViewerAvailable(viewer);
  const admin = createSupabaseAdminClient();
  const found = await admin.from("challenges").select("*").eq("group_token_hash", hash(token)).not("group_mode", "is", null).maybeSingle();
  checked(found.error);
  if (!found.data) throw notFound();
  const assignment = found.data.group_assignment as GroupAssignment;
  // Preferences are separate from membership eligibility, applied before any
  // title, dialogue, participant list, or media is returned.
  assertContentRating(assignment.rating, maxRating);
  if (assignment.rating === "mature") throw notFound();
  const result = await admin.from("challenge_group_members").select("*").eq("challenge_id", String(found.data.id)).order("joined_at");
  checked(result.error);
  const members = result.data ?? [];
  const member = (viewer.user ? members.find((candidate) => candidate.user_id === viewer.user!.id) : null) ?? members.find((candidate) => ownsGroupMember(candidate, viewer)) ?? null;
  if (found.data.group_invite_revoked_at && !member) throw notFound();
  const hostId = found.data.group_host_member_id;
  const host = members.find((candidate) => candidate.id === hostId);
  if (host && !(await participantAvailable(host.user_id ? String(host.user_id) : null, viewer))) throw notFound();
  const row = await rpcAction(found.data, viewer, "refresh");
  return { row, members, member };
}

function assertOpen(row: Row): void {
  if (row.state !== "open" || isExpired(row.group_closes_at) || isExpired(row.group_replay_until)) throw new AppError("ROUND_CLOSED", "The round has closed. Your private take is safe; start a rematch to play again.", 409);
}

async function assignmentFor(input: CreateGroupRoundInput, viewer: GroupViewer): Promise<GroupAssignment> {
  if (input.mode === "say-it-back") {
    const found = await createSupabaseAdminClient().from("say_clip_versions").select("manifest,enabled").eq("id", `${input.clipId}:${input.clipVersion}`).maybeSingle();
    checked(found.error);
    if (!found.data?.enabled) throw new AppError("SAY_CLIP_NOT_FOUND", "Choose an available scene.", 404);
    const clip = sayClipSchema.parse(found.data.manifest);
    assertContentRating(clip.rating, input.maxRating);
    if (clip.rating === "mature") throw new AppError("GROUP_MATURE_PRIVATE", "Mature scenes stay private. Choose a Clean or Spicy scene for friends.", 403);
    if (!clip.roles.some((role) => role.id === input.roleId)) throw new AppError("SAY_ROLE_INVALID", "Choose a role in this scene.", 422);
    return { mode: "say-it-back", clip, roleId: input.roleId!, rating: clip.rating, scoringVersion: SAY_SCORING_VERSION };
  }
  const prompt = getPromptById(input.promptId ?? "");
  const energy = getEnergyModifierById(input.energyId ?? "");
  if (!prompt || !energy) throw new AppError("ROUND_ASSIGNMENT_INVALID", "Choose a current Classic line and direction.", 422);
  const canonical = await resolveCanonicalDeliveryContent({ promptId: prompt.id, promptText: prompt.line, energy: energy.instruction, mode: "classic", maxRating: input.maxRating, user: viewer.user, usage: { tier: "free", used: null, limit: null, remaining: null, resetAt: null, tracked: false } });
  if (canonical.rating === "mature") throw new AppError("GROUP_MATURE_PRIVATE", "Mature lines stay private. Choose a Clean or Spicy line for friends.", 403);
  return { mode: "classic", promptId: canonical.promptId, promptSlug: canonical.promptSlug, promptText: canonical.promptText, energyId: canonical.energyId, energySlug: canonical.energySlug, energy: canonical.energy, category: canonical.category, difficulty: canonical.difficulty, rating: canonical.rating, scoringVersion: SCORING_VERSION, rubricVersion: RUBRIC_VERSION };
}

export async function createGroupRound(input: CreateGroupRoundInput, viewer: GroupViewer, origin: string, previousToken?: string): Promise<GroupRound> {
  await assertViewerAvailable(viewer);
  let previousId: string | null = null;
  if (previousToken) {
    const previous = await loadRound(previousToken, viewer, input.maxRating);
    if (!previous.member) throw new AppError("ROUND_NOT_MEMBER", "Join the group before creating its rematch.", 403);
    previousId = String(previous.row.id);
  }
  const assignment = await assignmentFor(input, viewer);
  const env = getServerEnv();
  const secret = env.DELIVERY_DEVICE_SECRET;
  if (!secret) throw new AppError("GROUP_NOT_CONFIGURED", "Guest rounds need the existing device signing key configured.", 503);
  // A keyed, unguessable capability is recoverable on a lost-response retry;
  // only its SHA-256 digest is stored in Postgres.
  const token = createHmac("sha256", secret).update(`delivery:round:${hash(input.requestId)}`).digest("base64url");
  const created = await createSupabaseAdminClient().rpc("create_group_round", {
    p_owner_user: viewer.user?.id ?? null, p_guest_hash: viewer.guest.idempotencyScope,
    p_token_hash: hash(token), p_name: input.name, p_assignment: assignment,
    p_closes_at: new Date(Date.now() + input.closesInHours * 3600_000).toISOString(),
    p_previous_id: previousId, p_request_id: input.requestId, p_host_name: input.displayName,
  });
  checked(created.error);
  return getGroupRound(token, viewer, origin, input.maxRating);
}

export function groupScoreGroup(mode: "classic" | "say-it-back", score: DeliveryJudgment | SayScore | null): GroupPerformance["scoreGroup"] {
  if (!score) return "unscored";
  if (mode === "classic") return "classic";
  const match = score as SayScore;
  return match.timing !== null && match.rhythm !== null && match.weights.timing > 0 && match.weights.rhythm > 0 ? "full-match" : "words-only";
}

export function ownsGroupSaySource(member: Row, attempt: Row): boolean {
  return attempt.user_id ? attempt.user_id === member.user_id : Boolean(member.guest_owner_hash && attempt.guest_owner_hash === member.guest_owner_hash);
}

function sayPerformance(attempt: Row, memberId: string, audioUrl: string, submittedAt: string | null = null): GroupPerformance {
  const score = attempt.score as SayScore | null;
  const sayAttempt: SayAttempt = {
    id: String(attempt.id), mode: "say-it-back", clip: sayClipSchema.parse(attempt.clip_snapshot), roleId: String(attempt.role_id),
    status: attempt.status as SayAttempt["status"], score, audioUrl, audioExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    durationMs: Number(attempt.duration_ms), recordingOffsetMs: Number(attempt.recording_offset_ms), scoringVersion: String(attempt.scoring_version),
    createdAt: String(attempt.created_at), saved: Boolean(attempt.user_id), owned: false,
  };
  return { takeId: String(attempt.id), memberId, mode: "say-it-back", audioUrl, durationMs: Number(attempt.duration_ms), submittedAt,
    score, scoreGroup: groupScoreGroup("say-it-back", score), sayAttempt, canSubmit: (attempt.status === "scored" && !["rejected", "review"].includes(String(attempt.moderation_state))) || (!score && attempt.moderation_state === "pending" && attempt.status !== "judging"), sharingStatus: attempt.moderation_state === "pending" && !score ? "unreviewed" : attempt.moderation_state as GroupPerformance["sharingStatus"] };
}

function classicPerformance(take: Row, audioUrl: string): GroupPerformance {
  const score = take.score as DeliveryJudgment | null;
  return { takeId: String(take.id), memberId: String(take.member_id), mode: "classic", audioUrl, durationMs: Number(take.duration_ms),
    submittedAt: take.submitted_at ? String(take.submitted_at) : null, score,
    scoreGroup: groupScoreGroup("classic", score), canSubmit: ["approved", "unreviewed"].includes(String(take.moderation_state)), sharingStatus: take.moderation_state as GroupPerformance["sharingStatus"] };
}

async function listPrivateTakes(row: Row, member: Row, viewer: GroupViewer, token: string, maxRating: ContentRating): Promise<GroupPerformance[]> {
  const admin = createSupabaseAdminClient();
  const assignment = row.group_assignment as GroupAssignment;
  if (assignment.mode === "classic") {
    const result = await admin.from("challenge_group_takes").select("*").eq("member_id", String(member.id)).eq("challenge_id", String(row.id)).eq("mode", "classic").order("created_at", { ascending: false }).limit(20);
    checked(result.error);
    return (result.data ?? []).filter((take) => !isExpired(take.expires_at)).map((take) => {
      const performance = classicPerformance(take, `/api/rounds/${token}/takes/${take.id}/audio?maxRating=${maxRating}`);
      if (take.submitted_at && take.id !== member.submitted_take_id) performance.canSubmit = false;
      return performance;
    });
  }
  const ownerKeys = [...(member.guest_owner_hash ? [`guest:${member.guest_owner_hash}`] : []), ...(viewer.user ? [`user:${viewer.user.id}`] : [])];
  const result = await admin.from("say_attempts").select("*").in("owner_key", ownerKeys).eq("clip_version_id", `${assignment.clip.id}:${assignment.clip.version}`).eq("role_id", assignment.roleId).eq("scoring_version", assignment.scoringVersion).order("created_at", { ascending: false }).limit(20);
  checked(result.error);
  return (result.data ?? []).filter((attempt) => !isExpired(attempt.expires_at)).map((attempt) => {
    const performance = sayPerformance(attempt, String(member.id), `/api/rounds/${token}/takes/${attempt.id}/audio?maxRating=${maxRating}`);
    if (performance.sayAttempt) performance.sayAttempt.owned = true;
    return performance;
  });
}

export async function getGroupRound(token: string, viewer: GroupViewer, origin: string, maxRating: ContentRating = "everyone"): Promise<GroupRound> {
  const { row, members, member } = await loadRound(token, viewer, maxRating);
  const expired = isExpired(row.group_replay_until);
  const revealed = row.state === "completed";
  const admin = createSupabaseAdminClient();
  const visibleMembers: GroupMember[] = [];
  let voteRows: Row[] = [];
  if (member && revealed && !expired) {
    const votes = await admin.from("challenge_group_votes").select("voter_member_id,target_member_id").eq("challenge_id", String(row.id));
    checked(votes.error); voteRows = votes.data ?? [];
  }
  for (const candidate of members) {
    const available = await participantAvailable(candidate.user_id ? String(candidate.user_id) : null, viewer);
    let performance: GroupPerformance | null = null;
    if (available && member && !expired && candidate.submitted_take_id && (revealed || candidate.id === member.id)) {
      const take = await admin.from("challenge_group_takes").select("*").eq("id", String(candidate.submitted_take_id)).eq("challenge_id", String(row.id)).eq("member_id", String(candidate.id)).maybeSingle();
      checked(take.error);
      if (take.data && ["approved", "unreviewed"].includes(String(take.data.moderation_state)) && !isExpired(take.data.expires_at)) {
        const audioUrl = `/api/rounds/${token}/performances/${candidate.id}/audio?maxRating=${maxRating}`;
        if (take.data.mode === "classic") performance = classicPerformance(take.data, audioUrl);
        else if (take.data.say_attempt_id) {
          const attempt = await admin.from("say_attempts").select("*").eq("id", take.data.say_attempt_id).maybeSingle();
          checked(attempt.error);
          if (attempt.data && ownsGroupSaySource(candidate, attempt.data) && !["rejected", "review"].includes(String(attempt.data.moderation_state)) && (attempt.data.moderation_state === "approved" || !attempt.data.score) && !isExpired(attempt.data.expires_at)) {
            performance = sayPerformance(attempt.data, String(candidate.id), audioUrl, String(take.data.submitted_at));
            performance.takeId = String(take.data.id);
          }
        }
      }
    }
    visibleMembers.push({ id: String(candidate.id), displayName: available ? String(candidate.display_name) : "Unavailable player", isHost: candidate.id === row.group_host_member_id, isYou: candidate.id === member?.id,
      submitted: available && Boolean(candidate.submitted_take_id), joinedAt: String(candidate.joined_at), votes: voteRows.filter((vote) => vote.target_member_id === candidate.id).length, performance });
  }
  let previousRoundUrl: string | null = null;
  if (member && row.group_previous_id) {
    const previousMembers = await admin.from("challenge_group_members").select("user_id,guest_owner_hash").eq("challenge_id", String(row.group_previous_id));
    checked(previousMembers.error);
    if ((previousMembers.data ?? []).some((entry) => ownsGroupMember(entry, viewer))) {
      const previous = await admin.from("challenges").select("group_request_hash,group_token_hash").eq("id", String(row.group_previous_id)).maybeSingle();
      checked(previous.error);
      const secret = getServerEnv().DELIVERY_DEVICE_SECRET;
      if (secret && previous.data?.group_request_hash) {
        const previousToken = createHmac("sha256", secret).update(`delivery:round:${previous.data.group_request_hash}`).digest("base64url");
        if (hash(previousToken) === previous.data.group_token_hash) previousRoundUrl = `${origin}/rounds/${previousToken}`;
      }
    }
  }
  return {
    id: String(row.id), token, name: String(row.group_name), url: `${origin}/rounds/${token}`,
    state: expired ? "expired" : revealed ? "revealed" : "open", assignment: row.group_assignment as GroupAssignment,
    createdAt: String(row.created_at), closesAt: String(row.group_closes_at), closedAt: row.completed_at ? String(row.completed_at) : null,
    replayUntil: String(row.group_replay_until), inviteRevoked: Boolean(row.group_invite_revoked_at), maxMembers: 12,
    members: visibleMembers, submittedCount: visibleMembers.filter((entry) => entry.submitted).length,
    viewerMemberId: member ? String(member.id) : null, isHost: member?.id === row.group_host_member_id, isGuest: !viewer.user,
    canJoin: !member && !revealed && !expired && !row.group_invite_revoked_at && members.length < 12,
    canClaim: Boolean(viewer.user && member && !member.user_id && !viewer.guest.setCookie),
    viewerVoteMemberId: voteRows.find((vote) => vote.voter_member_id === member?.id)?.target_member_id as string ?? null,
    previousRoundId: row.group_previous_id ? String(row.group_previous_id) : null, previousRoundUrl,
    yourTakes: member && !expired ? await listPrivateTakes(row, member, viewer, token, maxRating) : [],
  };
}

export async function mutateGroupRound(token: string, viewer: GroupViewer, origin: string, action: "join" | "close" | "revoke" | "vote" | "claim", payload: Row, maxRating: ContentRating): Promise<GroupRound> {
  const { row } = await loadRound(token, viewer, maxRating);
  if (action === "claim" && (!viewer.user || viewer.guest.setCookie)) throw new AppError("ROUND_CLAIM_REQUIRED", "Sign in from the same browser that joined this round.", 403);
  if (action === "vote") {
    const visible = await getGroupRound(token, viewer, origin, maxRating);
    const target = visible.members.find((entry) => entry.id === payload.memberId);
    if (visible.state !== "revealed" || !visible.viewerMemberId || !target?.performance || target.id === visible.viewerMemberId) throw new AppError("ROUND_VOTE_INVALID", "Vote for another player's available performance after reveal.", 409);
  }
  await rpcAction(row, viewer, action, action === "vote" ? { targetMemberId: payload.memberId } : payload);
  return getGroupRound(token, viewer, origin, maxRating);
}

export async function createClassicRoundTake(input: { token: string; audio: File; durationMs: number; attemptId: string; maxRating: ContentRating }, viewer: GroupViewer): Promise<{ id: string; replayed: boolean }> {
  const { row, member } = await loadRound(input.token, viewer, input.maxRating);
  if (!member) throw new AppError("ROUND_NOT_MEMBER", "Join the round before recording.", 403);
  if (row.group_mode !== "classic") throw new AppError("ROUND_ASSIGNMENT_INVALID", "Use the Say It Back editor for this round.", 409);
  const audio = await validateAudio(input.audio, input.durationMs);
  if (audio.durationMs > 20_000) throw new AppError("AUDIO_TOO_LONG", "Classic takes must be 20 seconds or less.", 422);
  const fingerprint = createRequestFingerprint(audio.contentHash, String(row.id), String(member.id), String(audio.durationMs));
  const admin = createSupabaseAdminClient();
  const existing = await admin.from("challenge_group_takes").select("id,request_fingerprint").eq("member_id", String(member.id)).eq("attempt_key", input.attemptId).maybeSingle();
  checked(existing.error);
  if (existing.data) {
    if (existing.data.request_fingerprint !== fingerprint) throw new AppError("IDEMPOTENCY_CONFLICT", "That retry belongs to a different take.", 409);
    return { id: String(existing.data.id), replayed: true };
  }
  assertOpen(row);
  const operation = await runIdempotent("group-take", String(member.id), input.attemptId, fingerprint, 15 * 60_000, async () => {
    const id = randomUUID();
    const prefix = member.user_id ? String(member.user_id) : `guests/${member.guest_owner_hash}`;
    const path = `${prefix}/rounds/${row.id}/${id}.${audio.container}`;
    const uploaded = await admin.storage.from("delivery-audio").upload(path, input.audio, { contentType: input.audio.type, cacheControl: "0", upsert: false });
    checked(uploaded.error);
    const inserted = await admin.from("challenge_group_takes").insert({ id, challenge_id: row.id, member_id: member.id, attempt_key: input.attemptId, request_fingerprint: fingerprint, mode: "classic", recording_path: path, audio_mime: input.audio.type, audio_hash: audio.contentHash, duration_ms: audio.durationMs, scoring_version: (row.group_assignment as GroupAssignment).scoringVersion, moderation_state: "unreviewed", expires_at: row.group_replay_until }).select("id").single();
    if (inserted.error) { await admin.storage.from("delivery-audio").remove([path]); checked(inserted.error); }
    return id;
  });
  return { id: operation.value, replayed: operation.replayed };
}

export async function authorizeClassicRoundJudge(input: { token: string; takeId: string; audioHash: string; maxRating: ContentRating }, viewer: GroupViewer): Promise<CanonicalDeliveryContent> {
  const { row, member } = await loadRound(input.token, viewer, input.maxRating);
  if (!member) throw new AppError("ROUND_NOT_MEMBER", "Join this round first.", 403);
  const take = await createSupabaseAdminClient().from("challenge_group_takes").select("*").eq("id", input.takeId).eq("member_id", String(member.id)).eq("challenge_id", String(row.id)).maybeSingle();
  checked(take.error);
  if (!take.data || take.data.mode !== "classic" || take.data.audio_hash !== input.audioHash) throw new AppError("ROUND_TAKE_INVALID", "Judge the exact private take you recorded for this round.", 403);
  if (isExpired(row.group_replay_until)) throw notFound();
  const assignment = row.group_assignment as GroupAssignment;
  if (assignment.mode !== "classic" || assignment.scoringVersion !== SCORING_VERSION || assignment.rubricVersion !== RUBRIC_VERSION) throw new AppError("ROUND_VERSION_UNAVAILABLE", "This round uses an older judge. Its replay remains available.", 409);
  return { ...assignment, requiresPro: false, dailyDate: null, dailyMarket: null };
}

export async function attachClassicRoundJudge(input: { token: string; takeId: string; score: DeliveryJudgment }, viewer: GroupViewer): Promise<void> {
  if (input.score.source !== "openai") throw new AppError("ROUND_DEMO_SCORE", "Demo scores cannot enter friend rounds.", 409);
  const { row, member } = await loadRound(input.token, viewer, "mature");
  if (!member) throw notFound();
  const assignment = row.group_assignment as GroupAssignment;
  if (assignment.mode !== "classic" || input.score.scoringVersion !== assignment.scoringVersion || input.score.rubricVersion !== assignment.rubricVersion) throw new AppError("ROUND_VERSION_MISMATCH", "This result uses a different judging version.", 409);
  const admin = createSupabaseAdminClient();
  const take = await admin.from("challenge_group_takes").select("id,score,moderation_state").eq("id", input.takeId).eq("challenge_id", String(row.id)).eq("member_id", String(member.id)).maybeSingle();
  checked(take.error);
  if (!take.data) throw notFound();
  if (take.data.score && take.data.moderation_state === "approved") return;
  const saved = await admin.from("challenge_group_takes").update({ score: input.score, moderation_state: "pending" }).eq("id", input.takeId).is("score", null);
  checked(saved.error);
  // Save the expensive trusted judgment before moderation. A temporary safety
  // provider failure must leave private replay and the paid result intact.
  try {
    const moderation = await moderateLine([input.score.transcript, input.score.transcription?.text ?? "", input.score.verdict, input.score.coachNote].join("\n"));
    const updated = await admin.from("challenge_group_takes").update({ moderation_state: moderation.decision }).eq("id", input.takeId);
    checked(updated.error);
  } catch { /* Submit offers a safe moderation retry without rejudging. */ }
}

export async function submitGroupPerformance(token: string, viewer: GroupViewer, origin: string, input: { takeId?: string; sayAttemptId?: string; consent: true; maxRating: ContentRating }): Promise<GroupRound> {
  const { row, member } = await loadRound(token, viewer, input.maxRating);
  if (!member) throw new AppError("ROUND_NOT_MEMBER", "Join this round first.", 403);
  if (input.consent !== true) throw new AppError("GROUP_CONSENT_REQUIRED", "Confirm that you want to share this performance with the group after reveal.", 422);
  const admin = createSupabaseAdminClient();
  const assignment = row.group_assignment as GroupAssignment;
  let takeId = input.takeId;
  if (assignment.mode === "say-it-back") {
    if (!input.sayAttemptId) throw new AppError("ROUND_TAKE_INVALID", "Choose your recorded dub.", 422);
    const result = await admin.from("say_attempts").select("*").eq("id", input.sayAttemptId).maybeSingle();
    checked(result.error);
    const attempt = result.data;
    if (!attempt || isExpired(attempt.expires_at) || !(attempt.user_id ? attempt.user_id === viewer.user?.id : attempt.guest_owner_hash === member.guest_owner_hash)) throw notFound();
    if (attempt.clip_version_id !== `${assignment.clip.id}:${assignment.clip.version}` || attempt.role_id !== assignment.roleId || attempt.scoring_version !== assignment.scoringVersion) throw new AppError("ROUND_TAKE_INVALID", "Choose the exact scene, role, and scoring version for this round.", 409);
    if (["rejected", "review"].includes(String(attempt.moderation_state))) throw new AppError("ROUND_TAKE_INVALID", "This take cannot be shared because it needs a safety review. Record another take.", 403);
    if (attempt.score) await approveSaySharing(attempt);
    else if (attempt.status === "judging") throw new AppError("ROUND_SCORE_PENDING", "Matching is finishing. Wait for its safety check, then submit.", 409);
    const existing = await admin.from("challenge_group_takes").select("id").eq("member_id", String(member.id)).eq("say_attempt_id", String(attempt.id)).maybeSingle();
    checked(existing.error);
    if (existing.data) {
      takeId = String(existing.data.id);
      if (attempt.score) {
        const updated = await admin.from("challenge_group_takes").update({ score: attempt.score, moderation_state: "approved" }).eq("id", takeId);
        checked(updated.error);
      }
    }
    else {
      assertOpen(row);
      const inserted = await admin.from("challenge_group_takes").upsert({ id: randomUUID(), challenge_id: row.id, member_id: member.id, attempt_key: attempt.id, request_fingerprint: String(attempt.audio_hash), mode: "say-it-back", say_attempt_id: attempt.id, score: attempt.score, scoring_version: attempt.scoring_version, moderation_state: attempt.score ? "approved" : "unreviewed", expires_at: row.group_replay_until }, { onConflict: "member_id,attempt_key", ignoreDuplicates: true });
      checked(inserted.error);
      const saved = await admin.from("challenge_group_takes").select("id").eq("member_id", String(member.id)).eq("attempt_key", String(attempt.id)).single();
      checked(saved.error); takeId = String(saved.data!.id);
    }
  } else {
    if (!takeId) throw new AppError("ROUND_TAKE_INVALID", "Choose your recorded performance.", 422);
    const result = await admin.from("challenge_group_takes").select("*").eq("id", takeId).eq("member_id", String(member.id)).eq("challenge_id", String(row.id)).maybeSingle();
    checked(result.error);
    if (!result.data) throw notFound();
    if (!["approved", "unreviewed"].includes(String(result.data.moderation_state))) {
      if (["rejected", "review"].includes(String(result.data.moderation_state))) throw new AppError("ROUND_TAKE_INVALID", "This performance needs a safety review before it can be shared. Record another take.", 403);
      const score = result.data.score as DeliveryJudgment | null;
      if (!score || score.source !== "openai") throw new AppError("ROUND_SCORE_REQUIRED", "Judge this take before sharing so its words can pass the group safety check. Your private recording is safe.", 409);
      await attachClassicRoundJudge({ token, takeId, score }, viewer);
    }
  }
  await rpcAction(row, viewer, "submit", { takeId, consent: true });
  return getGroupRound(token, viewer, origin, input.maxRating);
}

export function validGroupStoragePath(path: string, member: Row, roundId: string): boolean {
  const prefix = member.user_id && isOwnerStoragePath(path, String(member.user_id)) ? String(member.user_id) : `guests/${member.guest_owner_hash}`;
  return (prefix !== `guests/${member.guest_owner_hash}` || /^[a-f0-9]{64}$/.test(String(member.guest_owner_hash))) && new RegExp(`^${prefix}/rounds/${roundId}/[a-f0-9-]{36}\\.(wav|mp3)$`).test(path);
}

async function streamAudio(path: string, mime: string, request: Request): Promise<Response> {
  const signed = await createSupabaseAdminClient().storage.from("delivery-audio").createSignedUrl(path, 60);
  checked(signed.error);
  if (!signed.data?.signedUrl) throw notFound();
  const range = request.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) throw new AppError("INVALID_RANGE", "Choose a valid playback position.", 416);
  const response = await fetch(signed.data.signedUrl, { headers: range ? { Range: range } : undefined, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok && response.status !== 206) throw new ExternalServiceError("Recording playback");
  const headers = new Headers({ "Content-Type": mime, "Cache-Control": "private, no-store", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
  for (const name of ["content-length", "content-range"]) { const value = response.headers.get(name); if (value) headers.set(name, value); }
  return new Response(response.body, { status: response.status, headers });
}

export async function groupAudioResponse(token: string, viewer: GroupViewer, request: Request, selector: { takeId?: string; memberId?: string }, maxRating: ContentRating): Promise<Response> {
  const { row, members, member } = await loadRound(token, viewer, maxRating);
  if (!member || isExpired(row.group_replay_until)) throw notFound();
  const target = selector.memberId ? members.find((entry) => entry.id === selector.memberId) : member;
  if (!target || !(await participantAvailable(target.user_id ? String(target.user_id) : null, viewer))) throw notFound();
  if (selector.memberId && target.id !== member.id && row.state !== "completed") throw notFound();
  const admin = createSupabaseAdminClient();
  const assignment = row.group_assignment as GroupAssignment;
  if (assignment.mode === "say-it-back" && selector.takeId) {
    const result = await admin.from("say_attempts").select("*").eq("id", selector.takeId).maybeSingle();
    checked(result.error);
    const attempt = result.data;
    if (!attempt || isExpired(attempt.expires_at) || !(attempt.user_id ? attempt.user_id === viewer.user?.id : attempt.guest_owner_hash === member.guest_owner_hash) || attempt.clip_version_id !== `${assignment.clip.id}:${assignment.clip.version}` || attempt.role_id !== assignment.roleId) throw notFound();
    return streamSayRow(attempt, request);
  }
  const id = selector.memberId ? target.submitted_take_id : selector.takeId;
  if (!id) throw notFound();
  const result = await admin.from("challenge_group_takes").select("*").eq("id", id).eq("challenge_id", String(row.id)).eq("member_id", String(target.id)).maybeSingle();
  checked(result.error);
  const take = result.data;
  if (!take || isExpired(take.expires_at) || (selector.memberId && !["approved", "unreviewed"].includes(String(take.moderation_state)))) throw notFound();
  if (take.mode === "classic") {
    if (!validGroupStoragePath(String(take.recording_path), target, String(row.id))) throw notFound();
    return streamAudio(String(take.recording_path), String(take.audio_mime), request);
  }
  const attempt = await admin.from("say_attempts").select("*").eq("id", String(take.say_attempt_id)).maybeSingle();
  checked(attempt.error);
  if (!attempt.data || !ownsGroupSaySource(target, attempt.data) || isExpired(attempt.data.expires_at) || (["rejected", "review"].includes(String(attempt.data.moderation_state)) || (attempt.data.score && attempt.data.moderation_state !== "approved"))) throw notFound();
  return streamSayRow(attempt.data, request);
}

function streamSayRow(attempt: Row, request: Request): Promise<Response> {
  const path = String(attempt.recording_path);
  const valid = attempt.user_id ? isOwnerStoragePath(path, String(attempt.user_id)) : /^guests\/[a-f0-9]{64}\/say\/[a-f0-9-]{36}\.(wav|mp3)$/.test(path) && path.split("/")[1] === attempt.guest_owner_hash;
  if (!valid) throw notFound();
  return streamAudio(path, String(attempt.audio_mime), request);
}

/** Existing cleanup worker remains the only scheduler. */
export async function cleanupExpiredGroupTakes(limit = 100): Promise<{ deleted: number }> {
  const admin = createSupabaseAdminClient();
  const result = await admin.from("challenge_group_takes").select("*").lte("expires_at", now()).limit(Math.max(1, Math.min(limit, 100)));
  checked(result.error);
  for (const take of result.data ?? []) {
    if (take.recording_path) {
      const member = await admin.from("challenge_group_members").select("*").eq("id", String(take.member_id)).single();
      checked(member.error);
      if (!validGroupStoragePath(String(take.recording_path), member.data!, String(take.challenge_id))) throw new AppError("GROUP_MEDIA_PATH_INVALID", "A group recording path needs operator review.", 503);
      const removed = await admin.storage.from("delivery-audio").remove([String(take.recording_path)]); checked(removed.error);
    }
    const deleted = await admin.from("challenge_group_takes").delete().eq("id", String(take.id)); checked(deleted.error);
  }
  return { deleted: result.data?.length ?? 0 };
}

export async function deleteGroupAccountMedia(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  let afterId: string | null = null;
  for (;;) {
    let query = admin.from("challenge_group_members").select("*").eq("user_id", userId).order("id").limit(100);
    if (afterId) query = query.gt("id", afterId);
    const memberships = await query; checked(memberships.error);
    if (!memberships.data?.length) break;
    for (const member of memberships.data) {
      const takes = await admin.from("challenge_group_takes").select("*").eq("member_id", String(member.id));
      checked(takes.error);
      const paths = (takes.data ?? []).filter((take) => take.recording_path).map((take) => {
        const path = String(take.recording_path);
        if (!validGroupStoragePath(path, member, String(take.challenge_id))) throw new AppError("GROUP_MEDIA_PATH_INVALID", "A group recording path needs operator review.", 503);
        return path;
      });
      const sayIds = (takes.data ?? []).filter((take) => take.say_attempt_id).map((take) => String(take.say_attempt_id));
      if (sayIds.length && member.guest_owner_hash) {
        const sources = await admin.from("say_attempts").select("*").in("id", sayIds).is("user_id", null).eq("guest_owner_hash", String(member.guest_owner_hash));
        checked(sources.error);
        for (const source of sources.data ?? []) {
          const path = String(source.recording_path);
          if (!/^guests\/[a-f0-9]{64}\/say\/[a-f0-9-]{36}\.(wav|mp3)$/.test(path) || path.split("/")[1] !== member.guest_owner_hash) throw new AppError("GROUP_MEDIA_PATH_INVALID", "A group recording path needs operator review.", 503);
          const removed = await admin.storage.from("delivery-audio").remove([path]); checked(removed.error);
          const deleted = await admin.from("say_attempts").delete().eq("id", String(source.id)); checked(deleted.error);
        }
      }
      for (let i = 0; i < paths.length; i += 100) { const removed = await admin.storage.from("delivery-audio").remove(paths.slice(i, i + 100)); checked(removed.error); }
    }
    afterId = String(memberships.data.at(-1)!.id);
    if (memberships.data.length < 100) break;
  }
}
