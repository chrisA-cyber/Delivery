import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SWITCH_CHALLENGES, snapshotSwitchChallenge } from "@/lib/switch/catalog";
import { SAY_CLIPS } from "@/lib/say-it-back/catalog";
import type { SwitchViewer } from "@/lib/server/switch";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));
const mocks = vi.hoisted(() => ({ account: vi.fn(), invitation: vi.fn() }));
vi.mock("@/lib/server/account-deletion", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/server/account-deletion")>(), assertAccountNotDeleting: mocks.account }));
vi.mock("@/lib/server/public-assignments", () => ({ ensurePublicAssignment: mocks.invitation }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  from: (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    const execute = () => ({ data: (state.tables[table] ?? []).filter((row) => filters.every((filter) => filter(row))), error: null });
    const query = { select: () => query, eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return query; },
      maybeSingle: async () => { const result = execute(); return { ...result, data: result.data[0] ?? null }; },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
    }; return query;
  },
}) }));

import { resolveExportSource } from "@/lib/server/video-export-sources";

const userId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const groupId = "33333333-3333-4333-8333-333333333333";
const memberId = "44444444-4444-4444-8444-444444444444";
const guestHash = "a".repeat(64);
const owner: SwitchViewer = { user: { id: userId } as User, guest: null, ownerKey: `user:${userId}` };
const guest: SwitchViewer = { user: null, guest: { scope: `${guestHash}.network`, idempotencyScope: guestHash }, ownerKey: `guest:${guestHash}` };
const assignment = { mode: "classic", promptId: "prompt-one", promptSlug: "line-one", promptText: "The exact saved phrase.", energyId: "energy-one", energySlug: "dramatic", energy: "With maximum drama.", category: "original", difficulty: 1, rating: "everyone", scoringVersion: "classic-v1", rubricVersion: "rubric-v1" };
function classic() { return { id: attemptId, user_id: userId, owner_key: owner.ownerKey, recording_path: `${userId}/classic/${attemptId}.wav`, audio_hash: "b".repeat(64), duration_ms: 5000, assignment_snapshot: assignment }; }
function switchRow() { const challenge = snapshotSwitchChallenge(SWITCH_CHALLENGES[0]!); return { id: attemptId, user_id: userId, owner_key: owner.ownerKey, recording_path: `${userId}/switch/${attemptId}.wav`, duration_ms: 20_000, audio_hash: "b".repeat(64), challenge_snapshot: challenge, scoring_version: challenge.scoringVersion, status: "ready", score: null }; }
function group(claimed = false) {
  state.tables.challenge_group_takes = [{ id: attemptId, member_id: memberId, challenge_id: groupId, mode: "classic", moderation_state: "unreviewed", recording_path: `guests/${guestHash}/rounds/${groupId}/${attemptId}.wav`, duration_ms: 5000, expires_at: "2099-01-01T00:00:00Z" }];
  state.tables.challenge_group_members = [{ id: memberId, challenge_id: groupId, user_id: claimed ? userId : null, guest_owner_hash: guestHash, display_name: "Round player" }];
  state.tables.challenges = [{ id: groupId, group_assignment: assignment, group_replay_until: "2099-01-01T00:00:00Z", group_host_member_id: "another-member", token_hash: "private-token-hash", group_display_token_hash: "private-broadcast" }];
}
beforeEach(() => {
  vi.clearAllMocks(); state.tables = {}; mocks.account.mockResolvedValue(undefined);
  mocks.invitation.mockResolvedValue({ code: "a123456789ab", url: "https://deliverygame.netlify.app/a/a123456789ab" });
});

describe("private export source authorization", () => {
  it("does not treat an opted-in challenge recording as export permission for its viewer", async () => {
    state.tables.switch_attempts = [{ ...switchRow(), shared_with_challenge: true, challenge_id: "invited-challenge" }];
    await expect(resolveExportSource("switch", attemptId, guest, "everyone", { invitation: true })).rejects.toMatchObject({ code: "EXPORT_UNAVAILABLE" });
    expect(mocks.invitation).not.toHaveBeenCalled();
  });

  it("keeps unscored Classic export inputs frozen and excludes score/name unless selected", async () => {
    state.tables.classic_video_attempts = [{ ...classic(), display_name: "Private player", score: { overall: 100 } }];
    const source = await resolveExportSource("classic", attemptId, owner, "everyone", { invitation: true });
    expect(source.kind).toBe("classic_video_attempt"); expect(source.input.assignment).toEqual(assignment);
    expect(source.input.score).toBeNull(); expect(source.input.displayName).toBeNull(); expect(source.input.avatarPath).toBeNull();
    expect(mocks.invitation).toHaveBeenCalledWith(assignment, "https://deliverygame.netlify.app");
    expect(source.input.invitationUrl).not.toContain("token");
  });

  it("accepts only the owning group member and preserves claimed guest storage", async () => {
    group();
    await expect(resolveExportSource("classic", attemptId, owner, "everyone")).rejects.toMatchObject({ status: 404 });
    expect((await resolveExportSource("classic", attemptId, guest, "everyone")).kind).toBe("group_take");
    group(true);
    const claimed = await resolveExportSource("classic", attemptId, owner, "everyone", { includeName: true, invitation: true });
    expect(claimed.input.recordingPath).toContain(`guests/${guestHash}/rounds/`);
    expect(claimed.input.displayName).toBe("Round player");
    expect(JSON.stringify(claimed.input)).not.toMatch(/private-token|private-broadcast/);
    await expect(resolveExportSource("classic", attemptId, guest, "everyone")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects unsafe paths, deleted or expired takes, and active account containment", async () => {
    state.tables.classic_video_attempts = [{ ...classic(), recording_path: `${userId}/../other/audio.wav` }];
    await expect(resolveExportSource("classic", attemptId, owner, "everyone")).rejects.toMatchObject({ status: 404 });
    for (const field of [{ deleted_at: "2026-09-06T12:00:00Z" }, { expires_at: "2000-01-01T00:00:00Z" }]) {
      state.tables.classic_video_attempts = [{ ...classic(), ...field }];
      await expect(resolveExportSource("classic", attemptId, owner, "everyone")).rejects.toMatchObject({ status: 404 });
    }
    state.tables.classic_video_attempts = [classic()];
    state.tables.account_restrictions = [{ user_id: userId, kind: "profile-remove", starts_at: "2000-01-01T00:00:00Z", ends_at: null }];
    await expect(resolveExportSource("classic", attemptId, owner, "everyone")).rejects.toMatchObject({ status: 404 });
  });

  it("honors explicit Classic moderation rejection even though the score is saved", async () => {
    state.tables.deliveries = [{ ...classic(), state: "judged", moderation_labels: ["publish-rejected"] }];
    await expect(resolveExportSource("classic", attemptId, owner, "everyone", { invitation: true })).rejects.toMatchObject({ status: 404 });
    expect(mocks.invitation).not.toHaveBeenCalled();
  });

  it("uses the original Classic phrase and direction recorded in trusted score evidence", async () => {
    state.tables.deliveries = [{ ...classic(), state: "judged", prompts: { id: "prompt-one", slug: "line-one", body: "A subsequently edited catalog phrase.", category: "original", difficulty: 1, rating: "everyone", state: "published" }, energy_modifiers: { id: "energy-one", slug: "dramatic", instruction: "A changed direction." }, delivery_scores: { provider: "openai", overall: 82, rubric_version: "rubric-v1", evidence: { requested_prompt_text: assignment.promptText, requested_energy: assignment.energy, scoring_version: "classic-v1" } } }];
    const source = await resolveExportSource("classic", attemptId, owner, "everyone", { includeScore: true });
    expect(source.input.assignment).toMatchObject({ promptText: assignment.promptText, energy: assignment.energy, scoringVersion: "classic-v1", rubricVersion: "rubric-v1" });
    expect(source.input.score).toEqual({ value: 82, label: "Delivery score" });
  });

  it("preserves Switch original timeline and beta score label with independent name choice", async () => {
    state.tables.switch_attempts = [{ ...switchRow(), status: "scored", recording_offset_ms: 0, score: { overall: 84, beta: true } }];
    state.tables.profiles = [{ id: userId, display_name: "Player One", avatar_path: `${userId}/avatar.png` }];
    const source = await resolveExportSource("switch", attemptId, owner, "everyone", { includeScore: true, includeName: true });
    expect(source.input.score).toEqual({ value: 84, label: "Switch score", beta: true });
    expect(source.input.recordingOffsetMs).toBe(0); expect(source.input.displayName).toBe("Player One");
    expect(source.input.assignment).toMatchObject({ challenge: switchRow().challenge_snapshot });
    const hidden = await resolveExportSource("switch", attemptId, owner, "everyone");
    expect(hidden.input.score).toBeNull(); expect(hidden.input.displayName).toBeNull();
  });

  it("requires the exact enabled Say It Back manifest and existing export provenance", async () => {
    const clip = structuredClone(SAY_CLIPS.find((candidate) => candidate.rating === "everyone" && candidate.source.license === "CC BY 3.0")!);
    state.tables.say_attempts = [{ id: attemptId, user_id: userId, owner_key: owner.ownerKey, recording_path: `${userId}/say/${attemptId}.wav`, duration_ms: clip.duration * 1000, clip_snapshot: clip, clip_version_id: `${clip.id}:${clip.version}`, role_id: clip.roles[0]!.id, scoring_version: "say-v1", status: "ready" }];
    state.tables.say_clip_versions = [{ id: `${clip.id}:${clip.version}`, enabled: true, manifest: clip }];
    expect((await resolveExportSource("say-it-back", attemptId, owner, "everyone")).input.assignment).toMatchObject({ clip });
    state.tables.say_clip_versions[0]!.enabled = false;
    await expect(resolveExportSource("say-it-back", attemptId, owner, "everyone")).rejects.toMatchObject({ status: 404 });
    state.tables.say_clip_versions[0]!.enabled = true;
    const changed = structuredClone(clip); changed.source.license = "Unverified creator permission";
    state.tables.say_attempts[0]!.clip_snapshot = changed; state.tables.say_clip_versions[0]!.manifest = changed;
    await expect(resolveExportSource("say-it-back", attemptId, owner, "everyone")).rejects.toMatchObject({ code: "SCENE_EXPORT_UNAVAILABLE" });
    state.tables.say_attempts[0]!.clip_snapshot = clip;
    await expect(resolveExportSource("say-it-back", attemptId, owner, "everyone")).rejects.toMatchObject({ status: 404 });
  });
});
