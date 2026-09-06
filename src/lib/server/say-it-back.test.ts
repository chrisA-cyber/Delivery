import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { SAY_SCORING_VERSION, type SayClip, type SayScore } from "@/lib/say-it-back/types";

const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], challenges: [] as Record<string, unknown>[], clips: [] as Record<string, unknown>[], failScoreWrite: false, failInsert: false, cache: new Map<string, unknown>() }));
const mocks = vi.hoisted(() => ({ reserve: vi.fn(), release: vi.fn(), transcribe: vi.fn(), sign: vi.fn(), download: vi.fn(), deleteCheck: vi.fn(), upload: vi.fn(), remove: vi.fn(), move: vi.fn(), moderate: vi.fn() }));
vi.mock("@/lib/server/moderation", () => ({ moderateLine: mocks.moderate }));
vi.mock("@/lib/server/account-deletion", () => ({ assertAccountNotDeleting: mocks.deleteCheck, isOwnerStoragePath: (path: string, owner: string) => path.startsWith(`${owner}/`) }));
vi.mock("@/lib/server/entitlements", () => ({ reserveJudgedPlay: mocks.reserve, releaseJudgedPlay: mocks.release }));
vi.mock("@/lib/server/say-it-back-transcription", () => ({ transcribeSayAudio: mocks.transcribe }));
vi.mock("@/lib/server/audio", () => ({ validateAudio: vi.fn(async () => ({ contentHash: "abc", durationMs: 2000, container: "wav" })) }));
vi.mock("@/lib/server/idempotency", () => ({
  createRequestFingerprint: (...parts: string[]) => parts.join("|"),
  runIdempotent: async (_namespace: string, _scope: string, id: string, _fingerprint: string, _ttl: number, run: () => Promise<unknown>) => {
    if (state.cache.has(id)) return { value: state.cache.get(id), replayed: true };
    const value = await run(); state.cache.set(id, value); return { value, replayed: false };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  from: (table: string) => {
    const filters: [string, unknown][] = []; let update: Record<string, unknown> | undefined; let inserting = false;
    const execute = () => {
      const candidates = table === "say_attempts" ? state.rows : table === "say_challenges" ? state.challenges : table === "say_clip_versions" ? state.clips : [];
      if (inserting && state.failInsert) return { data: null, error: { code: "55000", message: "Account deletion is already in progress" } };
      const rows = candidates.filter((row) => filters.every(([key, value]) => row[key] === value));
      if (update?.status === "scored" && state.failScoreWrite) return { data: null, error: { message: "transient database write failure" } };
      if (update) rows.forEach((row) => Object.assign(row, update));
      return { data: rows, error: null };
    };
    const query = {
      select: () => query, eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      update: (value: Record<string, unknown>) => { update = value; return query; },
      insert: () => { inserting = true; return query; },
      in: () => query, or: () => query, order: () => query, limit: () => query, lt: () => query,
      maybeSingle: async () => { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
      single: async () => { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
    }; return query;
  },
  storage: { from: () => ({ createSignedUrl: mocks.sign, download: mocks.download, upload: mocks.upload, remove: mocks.remove, move: mocks.move }) },
}) }));

import { approveSaySharing, claimSayAttempt, createSayAttempt, getSayAttempt, getSayAttemptRow, judgeSayAttempt, type SayViewer } from "@/lib/server/say-it-back";
import { scoreSayAttempt } from "@/lib/say-it-back/scoring";
import { getGuestIdentity } from "@/lib/server/guest";
const clip: SayClip = {
  id: "test-scene", version: "v1", title: "The scene", description: "A scene for focused verification.", duration: 2, difficulty: "easy", rating: "everyone", category: "movie", tags: [],
  videoUrl: "/media/say-it-back/test.mp4", posterUrl: "/media/say-it-back/test.jpg",
  roles: [{ id: "actor", name: "Actor", description: "The speaking role", muteIntervals: [{ start: 0.2, end: 1.8 }] }],
  cues: [{ id: "one", roleId: "actor", text: "Hello there", start: 0.2, end: 1.8 }],
  source: { title: "Test source", creator: "Test creator", url: "https://example.com/source", license: "Test fixture", licenseUrl: "https://example.com/license", attribution: "Test creator", reuseNote: "A local fixture only; never a shipped scene.", excerptStart: 0, excerptEnd: 2 },
};
const owner: SayViewer = { user: { id: "user-one" } as User, guest: null, ownerKey: "user:user-one" };
const stranger: SayViewer = { user: { id: "user-two" } as User, guest: null, ownerKey: "user:user-two" };
const anonymous: SayViewer = { user: null, guest: { scope: "guest.scope", idempotencyScope: "guest" }, ownerKey: "guest:guest" };
function row() { return { id: "attempt-one", user_id: "user-one", owner_key: owner.ownerKey, clip_snapshot: clip, role_id: "actor", clip_version_id: "test-scene:v1", scoring_version: SAY_SCORING_VERSION, audio_hash: "abc", audio_mime: "audio/wav", recording_path: "user-one/say/attempt.wav", duration_ms: 2000, recording_offset_ms: 0, status: "ready", score: null, judge_calls: 0, created_at: "2026-09-06T12:00:00.000Z", expires_at: null }; }
beforeEach(() => {
  vi.clearAllMocks(); state.rows = [row()]; state.challenges = []; state.clips = [{ id: "test-scene:v1", manifest: clip, enabled: true }]; state.failScoreWrite = false; state.failInsert = false; state.cache.clear();
  mocks.deleteCheck.mockResolvedValue(undefined);
  mocks.reserve.mockResolvedValue({ replayed: false, usage: { tier: "free", used: 1, remaining: 4, limit: 5, tracked: true, resetAt: null }, claimId: "claim", kind: "supabase" });
  mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array(1000)], { type: "audio/wav" }), error: null });
  mocks.transcribe.mockResolvedValue({ text: "Hello there", words: [{ text: "Hello", start: 0.2, end: 0.8 }, { text: "there", start: 0.9, end: 1.8 }] });
  mocks.upload.mockResolvedValue({ error: null }); mocks.remove.mockResolvedValue({ error: null });
  mocks.move.mockResolvedValue({ error: null });
  mocks.moderate.mockResolvedValue({ decision: "rejected", categories: ["harassment"] });
});
describe("Say It Back private and recoverable attempts", () => {
  it("denies another account and an anonymous visitor before creating playback capability", async () => {
    await expect(getSayAttemptRow("attempt-one", stranger)).rejects.toMatchObject({ status: 404 });
    await expect(getSayAttemptRow("attempt-one", anonymous)).rejects.toMatchObject({ status: 404 });
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("returns protected playback and exact immutable scene to its owner", async () => {
    const attempt = await getSayAttempt("attempt-one", owner);
    expect(attempt.clip).toEqual(clip);
    expect(attempt.audioUrl).toBe("/api/say-it-back/attempts/attempt-one/audio");
    expect(attempt.owned).toBe(true);
  });
  it("keeps the saved dub when transcription fails and releases the play", async () => {
    mocks.transcribe.mockRejectedValueOnce(new Error("provider down"));
    await expect(judgeSayAttempt("attempt-one", owner)).rejects.toThrow("provider down");
    expect(state.rows[0]!.status).toBe("failed");
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect((await getSayAttempt("attempt-one", owner)).audioUrl).toContain("/audio");
  });
  it("recovers a failed database score commit from the cached paid result without charging or transcribing again", async () => {
    state.failScoreWrite = true;
    await expect(judgeSayAttempt("attempt-one", owner)).rejects.toMatchObject({ status: 503 });
    expect(state.cache.has("attempt-one")).toBe(true);
    state.failScoreWrite = false;
    const result = await judgeSayAttempt("attempt-one", owner);
    expect(result.replayed).toBe(true);
    expect(result.attempt.status).toBe("scored");
    expect(mocks.reserve).toHaveBeenCalledTimes(1);
    expect(mocks.transcribe).toHaveBeenCalledTimes(1);
    expect(mocks.release).not.toHaveBeenCalled();
  });
  it("returns a durable scored result after cache loss without another charge", async () => {
    await judgeSayAttempt("attempt-one", owner); state.cache.clear();
    const replay = await judgeSayAttempt("attempt-one", owner);
    expect(replay.replayed).toBe(true);
    expect((replay.attempt.score as SayScore).words).toBe(100);
    expect(mocks.transcribe).toHaveBeenCalledTimes(1);
    expect(mocks.reserve).toHaveBeenCalledTimes(1);
  });
  it("rejects expired guest takes even when a caller knows the ID", async () => {
    Object.assign(state.rows[0]!, { user_id: null, owner_key: anonymous.ownerKey, expires_at: "2020-01-01T00:00:00Z" });
    await expect(getSayAttemptRow("attempt-one", anonymous)).rejects.toMatchObject({ status: 404 });
  });
  it("removes the uploaded object when account containment rejects its database insert", async () => {
    state.failInsert = true;
    await expect(createSayAttempt({ audio: new File([new Uint8Array(1000)], "take.wav", { type: "audio/wav" }), clipId: clip.id, clipVersion: clip.version, roleId: "actor", durationMs: 2000, recordingOffsetMs: 0, attemptId: "new-attempt", maxRating: "everyone", shareAudio: false }, owner)).rejects.toMatchObject({ status: 503 });
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledWith([expect.stringMatching(/^user-one\/say\/.*\.wav$/)]);
  });
  it("claims a guest take only with its original signed device cookie, preserving the scene and timing", async () => {
    const guest = getGuestIdentity(new Request("http://localhost/say-it-back"), "secure-original-guest-attempt-id");
    Object.assign(state.rows[0]!, { user_id: null, guest_owner_hash: guest.idempotencyScope, owner_key: `guest:${guest.idempotencyScope}`, recording_path: `guests/${guest.idempotencyScope}/say/12345678-1234-1234-1234-123456789abc.wav`, expires_at: "2099-01-01T00:00:00Z", recording_offset_ms: 123 });
    const request = new Request("http://localhost/api/say/claim", { headers: { cookie: guest.setCookie!.split(";")[0]! } });
    const attempt = await claimSayAttempt("attempt-one", request, owner);
    expect(attempt.saved).toBe(true);
    expect(attempt.owned).toBe(true);
    expect(attempt.recordingOffsetMs).toBe(123);
    expect(attempt.clip).toEqual(clip);
    expect(state.rows[0]!.guest_owner_hash).toBeNull();
    expect(mocks.move).toHaveBeenCalledWith(expect.stringContaining(`guests/${guest.idempotencyScope}/`), "user-one/say/12345678-1234-1234-1234-123456789abc.wav");
  });
  it("refuses a guest-to-account transfer without the original device cookie", async () => {
    Object.assign(state.rows[0]!, { user_id: null, guest_owner_hash: "a".repeat(64), owner_key: `guest:${"a".repeat(64)}`, expires_at: "2099-01-01T00:00:00Z" });
    await expect(claimSayAttempt("attempt-one", new Request("http://localhost/api/say/claim"), owner)).rejects.toMatchObject({ status: 404 });
    expect(mocks.move).not.toHaveBeenCalled();
  });
  it("approves an exact curated fictional insult without reclassifying the approved script", async () => {
    const scene = { ...clip, cues: [{ id: "one", roleId: "actor", text: "You're a jerk, Thom.", start: 0.2, end: 1.8 }] };
    const score = scoreSayAttempt({ clip: scene, roleId: "actor", transcript: "You're a jerk, Tom.", words: [], recordingOffsetMs: 0, audioHash: "abc" });
    Object.assign(state.rows[0]!, { clip_snapshot: scene, status: "scored", score, moderation_state: "rejected" });
    await approveSaySharing(state.rows[0]!);
    expect(mocks.moderate).not.toHaveBeenCalled();
    expect(state.rows[0]).toMatchObject({ moderation_state: "approved", moderation_labels: ["say-curated-script-exact"] });
  });
  it("still moderates and rejects abusive deviations from a curated script", async () => {
    const score = scoreSayAttempt({ clip, roleId: "actor", transcript: "Hello there. You are worthless", words: [], recordingOffsetMs: 0, audioHash: "abc" });
    Object.assign(state.rows[0]!, { status: "scored", score });
    await expect(approveSaySharing(state.rows[0]!)).rejects.toMatchObject({ code: "SAY_SHARE_REVIEW" });
    expect(mocks.moderate).toHaveBeenCalledWith("Hello there. You are worthless");
    expect(state.rows[0]!.moderation_state).toBe("rejected");
  });
  it("keeps mature scenes private even if exact or previously approved", async () => {
    const score = scoreSayAttempt({ clip, roleId: "actor", transcript: "Hello there", words: [], recordingOffsetMs: 0, audioHash: "abc" });
    Object.assign(state.rows[0]!, { clip_snapshot: { ...clip, rating: "mature" }, status: "scored", score, moderation_state: "approved" });
    await expect(approveSaySharing(state.rows[0]!)).rejects.toMatchObject({ code: "SAY_MATURE_PRIVATE" });
    expect(mocks.moderate).not.toHaveBeenCalled();
  });
});
