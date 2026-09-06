import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { SWITCH_CHALLENGES, snapshotSwitchChallenge } from "@/lib/switch/catalog";
import { SWITCH_SCORING_VERSION, type SwitchScore } from "@/lib/switch/types";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({ rows: [] as Row[], challenges: [] as Row[], failScoreWrite: false, failInsert: false, cache: new Map<string, unknown>() }));
const mocks = vi.hoisted(() => ({ reserve: vi.fn(), release: vi.fn(), judge: vi.fn(), sign: vi.fn(), download: vi.fn(), deleteCheck: vi.fn(), upload: vi.fn(), remove: vi.fn(), move: vi.fn(), moderate: vi.fn(), validate: vi.fn() }));
vi.mock("@/lib/server/moderation", () => ({ moderateLine: mocks.moderate }));
vi.mock("@/lib/server/account-deletion", () => ({ assertAccountNotDeleting: mocks.deleteCheck, isOwnerStoragePath: (path: string, owner: string) => path.startsWith(`${owner}/`) }));
vi.mock("@/lib/server/entitlements", () => ({ reserveJudgedPlay: mocks.reserve, releaseJudgedPlay: mocks.release }));
vi.mock("@/lib/server/switch-judge", () => ({ judgeSwitch: mocks.judge }));
vi.mock("@/lib/server/audio", () => ({ validateAudio: mocks.validate }));
vi.mock("@/lib/server/idempotency", () => ({
  createRequestFingerprint: (...parts: string[]) => parts.join("|"),
  runIdempotent: async (namespace: string, scope: string, id: string, _fingerprint: string, _ttl: number, run: () => Promise<unknown>) => {
    const key = `${namespace}:${scope}:${id}`;
    if (state.cache.has(key)) return { value: state.cache.get(key), replayed: true };
    const value = await run(); state.cache.set(key, value); return { value, replayed: false };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  from: (table: string) => {
    const filters: Array<(row: Row) => boolean> = []; let update: Row | undefined; let insert: Row | undefined;
    const execute = () => {
      const candidates = table === "switch_attempts" ? state.rows : table === "switch_challenges" ? state.challenges : [];
      if (insert) {
        if (state.failInsert) return { data: null, error: { message: "contained account" } };
        const row = { status: "ready", score: null, judge_calls: 0, created_at: "2026-09-06T12:00:00Z", ...insert };
        candidates.push(row); insert = undefined; return { data: [row], error: null };
      }
      const rows = candidates.filter((row) => filters.every((filter) => filter(row)));
      if (update?.status === "scored" && state.failScoreWrite) return { data: null, error: { message: "transient database write failure" } };
      if (update) rows.forEach((row) => Object.assign(row, update));
      return { data: rows, error: null };
    };
    const query = {
      select: () => query, eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
      lt: (key: string, value: string) => { filters.push((row) => String(row[key]) < value); return query; },
      update: (value: Row) => { update = value; return query; }, insert: (value: Row) => { insert = value; return query; },
      in: () => query, or: () => query, not: () => query, order: () => query, limit: () => query,
      maybeSingle: async () => { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
      single: async () => { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
    }; return query;
  },
  storage: { from: () => ({ createSignedUrl: mocks.sign, download: mocks.download, upload: mocks.upload, remove: mocks.remove, move: mocks.move }) },
}) }));

import { approveSwitchSharing, claimSwitchAttempt, createSwitchAttempt, getSwitchAttempt, getSwitchAttemptRow, judgeSwitchAttempt, type SwitchViewer } from "@/lib/server/switch";
import { getGuestIdentity } from "@/lib/server/guest";
const challenge = snapshotSwitchChallenge(SWITCH_CHALLENGES[0]!);
const owner: SwitchViewer = { user: { id: "user-one" } as User, guest: null, ownerKey: "user:user-one" };
const stranger: SwitchViewer = { user: { id: "user-two" } as User, guest: null, ownerKey: "user:user-two" };
const anonymous: SwitchViewer = { user: null, guest: { scope: "guest.scope", idempotencyScope: "guest" }, ownerKey: "guest:guest" };
const fixtureScore: SwitchScore = {
  version: SWITCH_SCORING_VERSION, rubricVersion: challenge.rubricVersion, beta: true, ranked: false, overall: 82, words: 100, delivery: 80, transitions: 70,
  transcript: challenge.cues.map((cue) => cue.text).join(" "), segments: challenge.cues.map((cue) => ({ cueId: cue.id, words: 100, delivery: 80, feedback: "Clear change." })),
  transitionFeedback: "Clear changes, approximate timing.", coachNote: "Leave a small pause before the last change.", limitations: ["Casual beta score; timing is approximate."],
  evidence: { source: "audio", audioHash: "abc", model: "test-audio-model", timing: "approximate", timingToleranceMs: 750, recordingOffsetMs: 0 },
};
function row(): Row { return { id: "attempt-one", user_id: "user-one", owner_key: owner.ownerKey, challenge_snapshot: challenge, challenge_version_id: `${challenge.id}:${challenge.version}`, scoring_version: SWITCH_SCORING_VERSION, audio_hash: "abc", audio_mime: "audio/wav", recording_path: "user-one/switch/attempt.wav", duration_ms: challenge.duration * 1000, recording_offset_ms: 0, status: "ready", score: null, judge_calls: 0, created_at: "2026-09-06T12:00:00Z", expires_at: null }; }
const audio = () => new File([new Uint8Array(1000)], "take.wav", { type: "audio/wav" });
beforeEach(() => {
  vi.clearAllMocks(); state.rows = [row()]; state.challenges = []; state.failScoreWrite = false; state.failInsert = false; state.cache.clear();
  mocks.deleteCheck.mockResolvedValue(undefined);
  mocks.reserve.mockResolvedValue({ replayed: false, usage: { tier: "free", used: 1, remaining: 4, limit: 5, tracked: true, resetAt: null }, claimId: "claim", kind: "supabase" });
  mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array(1000)], { type: "audio/wav" }), error: null });
  mocks.judge.mockResolvedValue(fixtureScore);
  mocks.validate.mockResolvedValue({ contentHash: "abc", durationMs: challenge.duration * 1000, container: "wav" });
  mocks.upload.mockResolvedValue({ error: null }); mocks.remove.mockResolvedValue({ error: null }); mocks.move.mockResolvedValue({ error: null });
  mocks.moderate.mockResolvedValue({ decision: "rejected", categories: ["harassment"] });
});

describe("Switch private immutable take boundary", () => {
  it("denies strangers before issuing audio capabilities", async () => {
    await expect(getSwitchAttemptRow("attempt-one", stranger)).rejects.toMatchObject({ status: 404 });
    await expect(getSwitchAttemptRow("attempt-one", anonymous)).rejects.toMatchObject({ status: 404 });
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("lets invitation holders hear only the opted-in creator; replies remain limited to their owner and creator", async () => {
    const token = "a".repeat(43);
    state.challenges = [{ id: "invitation", attempt_id: "attempt-one", created_by: owner.user!.id, token_hash: createHash("sha256").update(token).digest("hex"), expires_at: "2099-01-01T00:00:00Z" }];
    Object.assign(state.rows[0]!, { status: "scored", score: fixtureScore, moderation_state: "approved" });
    expect((await getSwitchAttemptRow("attempt-one", stranger, token)).id).toBe("attempt-one");
    state.rows.push({ ...row(), id: "private-reply", user_id: "user-three", owner_key: "user:user-three", challenge_id: "invitation", shared_with_challenge: true, status: "scored", score: fixtureScore, moderation_state: "approved" });
    await expect(getSwitchAttemptRow("private-reply", stranger, token)).rejects.toMatchObject({ status: 404 });
    expect((await getSwitchAttemptRow("private-reply", owner, token)).id).toBe("private-reply");
    state.rows[1]!.shared_with_challenge = false;
    await expect(getSwitchAttemptRow("private-reply", owner, token)).rejects.toMatchObject({ status: 404 });
    state.rows[0]!.moderation_state = "rejected";
    await expect(getSwitchAttemptRow("attempt-one", stranger, token)).rejects.toMatchObject({ status: 404 });
  });
  it("reopens the exact script, direction sequence and original media clock without judging", async () => {
    const attempt = await getSwitchAttempt("attempt-one", owner);
    expect(attempt.challenge).toEqual(challenge);
    expect(attempt.recordingOffsetMs).toBe(0);
    expect(attempt.audioUrl).toBe("/api/switch/attempts/attempt-one/audio");
    expect(attempt.score).toBeNull(); expect(mocks.judge).not.toHaveBeenCalled();
  });
  it("saves a full take once and replays durable upload retries without duplicate storage", async () => {
    const input = { audio: audio(), challengeId: challenge.id, challengeVersion: challenge.version, durationMs: challenge.duration * 1000, attemptId: "new-attempt", maxRating: "everyone" as const, shareAudio: false };
    const first = await createSwitchAttempt(input, owner); state.cache.clear();
    const retry = await createSwitchAttempt(input, owner);
    expect(retry.attempt.id).toBe(first.attempt.id); expect(retry.replayed).toBe(true); expect(mocks.upload).toHaveBeenCalledTimes(1);
    mocks.validate.mockResolvedValueOnce({ contentHash: "different", durationMs: challenge.duration * 1000, container: "wav" });
    await expect(createSwitchAttempt(input, owner)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
  it("rejects partial interrupted takes and altered timeline before storage or payment", async () => {
    const input = { audio: audio(), challengeId: challenge.id, challengeVersion: challenge.version, durationMs: 3000, attemptId: "partial", maxRating: "everyone" as const, shareAudio: false };
    mocks.validate.mockResolvedValueOnce({ contentHash: "abc", durationMs: 3000, container: "wav" });
    await expect(createSwitchAttempt(input, owner)).rejects.toMatchObject({ code: "SWITCH_TAKE_INCOMPLETE" });
    await expect(createSwitchAttempt({ ...input, recordingOffsetMs: 200 }, owner)).rejects.toMatchObject({ code: "SWITCH_TIMELINE_INVALID" });
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("removes an upload if containment prevents its receipt insert", async () => {
    state.failInsert = true;
    await expect(createSwitchAttempt({ audio: audio(), challengeId: challenge.id, challengeVersion: challenge.version, durationMs: challenge.duration * 1000, attemptId: "new-attempt", maxRating: "everyone", shareAudio: false }, owner)).rejects.toMatchObject({ status: 503 });
    expect(mocks.remove).toHaveBeenCalledWith([expect.stringMatching(/^user-one\/switch\/.*\.wav$/)]);
  });
  it("keeps private replay after a judge failure and releases the reserved play", async () => {
    mocks.judge.mockRejectedValueOnce(new Error("provider down"));
    await expect(judgeSwitchAttempt("attempt-one", owner)).rejects.toThrow("provider down");
    expect(state.rows[0]!.status).toBe("failed"); expect(mocks.release).toHaveBeenCalledTimes(1);
    expect((await getSwitchAttempt("attempt-one", owner)).audioUrl).toContain("/audio");
  });
  it("recovers a paid result after a database interruption with no second call or play charge", async () => {
    state.failScoreWrite = true;
    await expect(judgeSwitchAttempt("attempt-one", owner)).rejects.toMatchObject({ status: 503 });
    state.failScoreWrite = false;
    const result = await judgeSwitchAttempt("attempt-one", owner);
    expect(result.replayed).toBe(true); expect(result.attempt.score).toEqual(fixtureScore);
    expect(mocks.judge).toHaveBeenCalledTimes(1); expect(mocks.reserve).toHaveBeenCalledTimes(1); expect(mocks.release).not.toHaveBeenCalled();
  });
  it("returns a committed score after cache expiry without any paid retry", async () => {
    await judgeSwitchAttempt("attempt-one", owner); state.cache.clear();
    const result = await judgeSwitchAttempt("attempt-one", owner);
    expect(result.replayed).toBe(true); expect(mocks.judge).toHaveBeenCalledTimes(1); expect(mocks.reserve).toHaveBeenCalledTimes(1);
  });
  it("preserves old-version replay but refuses to silently rejudge it with a new rubric", async () => {
    Object.assign(state.rows[0]!, { scoring_version: "old-beta", challenge_snapshot: { ...challenge, scoringVersion: "old-beta" } });
    await expect(judgeSwitchAttempt("attempt-one", owner)).rejects.toMatchObject({ code: "SWITCH_SCORING_VERSION_UNAVAILABLE" });
    expect((await getSwitchAttempt("attempt-one", owner)).scoringVersion).toBe("old-beta"); expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("limits failed judgment attempts before the paid boundary", async () => {
    state.rows[0]!.judge_calls = 3;
    await expect(judgeSwitchAttempt("attempt-one", owner)).rejects.toMatchObject({ code: "SWITCH_RETRY_LIMIT" });
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("claims a guest take with its signed browser cookie and keeps all cue timings", async () => {
    const guest = getGuestIdentity(new Request("http://localhost/switch"), "secure-switch-guest-attempt");
    Object.assign(state.rows[0]!, { user_id: null, guest_owner_hash: guest.idempotencyScope, owner_key: `guest:${guest.idempotencyScope}`, recording_path: `guests/${guest.idempotencyScope}/switch/12345678-1234-1234-1234-123456789abc.wav`, expires_at: "2099-01-01T00:00:00Z" });
    const request = new Request("http://localhost/api/switch/claim", { headers: { cookie: guest.setCookie!.split(";")[0]! } });
    const result = await claimSwitchAttempt("attempt-one", request, owner);
    expect(result.saved).toBe(true); expect(result.challenge).toEqual(challenge); expect(result.recordingOffsetMs).toBe(0);
    await expect(getSwitchAttemptRow("attempt-one", { user: null, guest, ownerKey: `guest:${guest.idempotencyScope}` })).rejects.toMatchObject({ status: 404 });
  });
  it("refuses guest claim without the original cookie and refuses expired replay", async () => {
    Object.assign(state.rows[0]!, { user_id: null, guest_owner_hash: "a".repeat(64), owner_key: `guest:${"a".repeat(64)}`, expires_at: "2099-01-01T00:00:00Z" });
    await expect(claimSwitchAttempt("attempt-one", new Request("http://localhost/api/switch/claim"), owner)).rejects.toMatchObject({ status: 404 });
    expect(mocks.move).not.toHaveBeenCalled(); state.rows[0]!.expires_at = "2020-01-01T00:00:00Z";
    await expect(getSwitchAttemptRow("attempt-one", anonymous)).rejects.toMatchObject({ status: 404 });
  });
  it("inherits exact curated-script moderation and reviews off-script additions", async () => {
    Object.assign(state.rows[0]!, { status: "scored", score: fixtureScore });
    await approveSwitchSharing(state.rows[0]!); expect(mocks.moderate).not.toHaveBeenCalled();
    Object.assign(state.rows[0]!, { moderation_state: "pending", score: { ...fixtureScore, transcript: `${fixtureScore.transcript} You are worthless.` } });
    await expect(approveSwitchSharing(state.rows[0]!)).rejects.toMatchObject({ code: "SWITCH_SHARE_REVIEW" }); expect(mocks.moderate).toHaveBeenCalledTimes(1);
  });
});
