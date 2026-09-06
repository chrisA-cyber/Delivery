import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import type { GroupViewer } from "@/lib/server/group-rounds";
import { SWITCH_CHALLENGES, snapshotSwitchChallenge } from "@/lib/switch/catalog";
import type { SwitchScore } from "@/lib/switch/types";
import type { SayScore } from "@/lib/say-it-back/types";
const state = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]>, signed: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  from: (table: string) => {
    const filters: ((row: Record<string, unknown>) => boolean)[] = [];
    const execute = () => ({ data: (state.tables[table] ?? []).filter((row) => filters.every((predicate) => predicate(row))), error: null });
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
      not: (key: string, _operator: string, value: unknown) => { filters.push((row) => row[key] !== value); return query; },
      in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return query; },
      order: () => query, limit: () => query,
      maybeSingle: async () => { const result = execute(); return { ...result, data: result.data[0] ?? null }; },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
    };
    return query;
  },
  rpc: async (_name: string, input: Record<string, unknown>) => ({ data: state.tables.challenges?.find((row) => row.id === input.p_challenge_id), error: null }),
  storage: { from: () => ({ createSignedUrl: state.signed }) },
}) }));
import { getGroupRound, groupAudioResponse, groupScoreGroup, ownsGroupMember, ownsGroupSaySource, validGroupStoragePath, matchesGroupSwitchAssignment } from "@/lib/server/group-rounds";
const token = "a".repeat(43);
const roundId = "00000000-0000-4000-8000-000000000001";
const memberId = "00000000-0000-4000-8000-000000000002";
const rivalId = "00000000-0000-4000-8000-000000000003";
const takeId = "00000000-0000-4000-8000-000000000004";
const guestHash = "a".repeat(64);
const guest: GroupViewer = { user: null, guest: { idempotencyScope: guestHash, scope: `${guestHash}.${"c".repeat(64)}` } };
const account: GroupViewer = { ...guest, user: { id: "account-one" } as User };
beforeEach(() => {
  vi.clearAllMocks();
  state.tables = {
    challenges: [{ id: roundId, group_token_hash: createHash("sha256").update(token).digest("hex"), group_mode: "classic", group_name: "Friends", state: "open", created_at: new Date().toISOString(), group_closes_at: new Date(Date.now() + 3600000).toISOString(), group_replay_until: new Date(Date.now() + 86400000).toISOString(), group_host_member_id: memberId, group_assignment: { mode: "classic", rating: "everyone", promptText: "A clean fictional line", energy: "Surprised", scoringVersion: "delivery-voice-v1", rubricVersion: "delivery-voice-v1.2" } }],
    challenge_group_members: [{ id: memberId, challenge_id: roundId, user_id: null, guest_owner_hash: guestHash, display_name: "You", joined_at: new Date().toISOString() }, { id: rivalId, challenge_id: roundId, user_id: null, guest_owner_hash: "b".repeat(64), display_name: "Friend", joined_at: new Date().toISOString(), submitted_take_id: takeId }],
    challenge_group_takes: [{ id: takeId, member_id: rivalId, challenge_id: roundId, mode: "classic", score: { secret: "never leak before reveal" }, moderation_state: "unreviewed", recording_path: `guests/${"b".repeat(64)}/rounds/${roundId}/${takeId}.wav`, duration_ms: 1000, expires_at: new Date(Date.now() + 86400000).toISOString() }],
  };
});
describe("group capability and reveal boundary", () => {
  it("returns progress without another player's score, take identifier or recording before reveal", async () => {
    const round = await getGroupRound(token, guest, "https://delivery.test");
    expect(round.submittedCount).toBe(1);
    expect(round.members.find((member) => member.id === rivalId)?.performance).toBeNull();
    expect(JSON.stringify(round)).not.toContain(takeId);
    expect(JSON.stringify(round)).not.toContain("never leak");
    expect(state.signed).not.toHaveBeenCalled();
  });
  it("denies direct pre-reveal audio even to a joined host", async () => {
    await expect(groupAudioResponse(token, guest, new Request("https://delivery.test/audio"), { memberId: rivalId }, "everyone")).rejects.toMatchObject({ status: 404 });
    expect(state.signed).not.toHaveBeenCalled();
  });
  it("does not authorize a holder of a revealed invite to play member recordings without joining", async () => {
    state.tables.challenges![0]!.state = "completed";
    const stranger = { ...guest, guest: { ...guest.guest, idempotencyScope: "d".repeat(64) } };
    const round = await getGroupRound(token, stranger, "https://delivery.test");
    expect(round.members.every((member) => member.performance === null)).toBe(true);
    await expect(groupAudioResponse(token, stranger, new Request("https://delivery.test/audio"), { memberId: rivalId }, "everyone")).rejects.toMatchObject({ status: 404 });
  });
  it("checks explicit content preference before disclosing scene or membership", async () => {
    (state.tables.challenges![0]!.group_assignment as Record<string, unknown>).rating = "teen";
    await expect(getGroupRound(token, guest, "https://delivery.test")).rejects.toMatchObject({ code: "CONTENT_OPT_IN_REQUIRED", status: 403, details: { rating: "teen" } });
  });
});
describe("stable participant claims and stored recordings", () => {
  it("requires the account after a guest membership is claimed", () => {
    const member = { user_id: "account-one", guest_owner_hash: guestHash };
    expect(ownsGroupMember(member, account)).toBe(true);
    expect(ownsGroupMember(member, guest)).toBe(false);
    expect(ownsGroupMember(member, { ...account, user: { id: "other-account" } as User })).toBe(false);
    expect(ownsGroupMember({ user_id: null, guest_owner_hash: guestHash }, account)).toBe(true);
  });
  it("retains only the original unclaimed guest Say source under the claimed member", () => {
    const member = { user_id: "account-one", guest_owner_hash: guestHash };
    expect(ownsGroupSaySource(member, { user_id: null, guest_owner_hash: guestHash })).toBe(true);
    expect(ownsGroupSaySource(member, { user_id: "account-one", guest_owner_hash: null })).toBe(true);
    expect(ownsGroupSaySource(member, { user_id: "other-account", guest_owner_hash: guestHash })).toBe(false);
    expect(ownsGroupSaySource(member, { user_id: null, guest_owner_hash: "other-browser" })).toBe(false);
  });
  it("rejects foreign, traversed and cross-round storage paths while retaining claimed guest paths", () => {
    const member = { user_id: "account-one", guest_owner_hash: guestHash };
    const path = `guests/${guestHash}/rounds/${roundId}/${takeId}.wav`;
    expect(validGroupStoragePath(path, member, roundId)).toBe(true);
    expect(validGroupStoragePath(path.replace(guestHash, "d".repeat(64)), member, roundId)).toBe(false);
    expect(validGroupStoragePath(path.replace("/rounds/", "/../rounds/"), member, roundId)).toBe(false);
    expect(validGroupStoragePath(path, member, memberId)).toBe(false);
  });
  it("keeps words-only matching out of full matching rankings", () => {
    const score = { timing: null, rhythm: null, weights: { words: 1, timing: 0, rhythm: 0 } } as SayScore;
    expect(groupScoreGroup("say-it-back", score)).toBe("words-only");
    expect(groupScoreGroup("say-it-back", { ...score, timing: 80, rhythm: 75, weights: { words: .5, timing: .3, rhythm: .2, delivery: 0 } })).toBe("full-match");
    expect(groupScoreGroup("classic", null)).toBe("unscored");
  });
});

describe("community broadcast boundaries", () => {
  const audience = () => ({ ...guest, guest: { ...guest.guest, idempotencyScope: "d".repeat(64) } });
  function community(phase = "review") {
    Object.assign(state.tables.challenges![0]!, { community: true, community_phase: phase, community_limit: 25, community_voting: true, community_code: "ABC12345", state: "completed" });
    Object.assign(state.tables.challenge_group_takes![0]!, { broadcast_consent_at: new Date().toISOString() });
  }
  it("never exposes private queue identities or media on the audience surface", async () => {
    community();
    const round = await getGroupRound(token, audience(), "https://delivery.test");
    expect(round.members).toEqual([]);
    expect(round.community?.displayUrl).toBeUndefined();
    expect(JSON.stringify(round)).not.toContain(takeId);
    await expect(groupAudioResponse(token, audience(), new Request("https://delivery.test/audio"), { memberId: rivalId }, "everyone")).rejects.toMatchObject({ status: 404 });
  });
  it("shows only selected consented entries after showcase starts", async () => {
    community("showcase");
    state.tables.challenge_group_members![1]!.showcased = true;
    const round = await getGroupRound(token, audience(), "https://delivery.test");
    expect(round.members.map((m) => m.id)).toEqual([rivalId]);
    expect(round.members[0]!.performance?.takeId).toBe(takeId);
    state.tables.challenge_group_takes![0]!.broadcast_consent_at = null;
    const withdrawn = await getGroupRound(token, audience(), "https://delivery.test");
    expect(withdrawn.members[0]!.performance).toBeNull();
    await expect(groupAudioResponse(token, audience(), new Request("https://delivery.test/audio"), { memberId: rivalId }, "everyone")).rejects.toMatchObject({ status: 404 });
  });
  it("immediately removes hidden media access even after results", async () => {
    community("results");
    state.tables.challenge_group_members![1]!.showcased = false;
    await expect(groupAudioResponse(token, audience(), new Request("https://delivery.test/audio"), { memberId: rivalId }, "everyone")).rejects.toMatchObject({ status: 404 });
    expect(state.signed).not.toHaveBeenCalled();
  });
  it("cannot use a display capability to access a private draft", async () => {
    community("showcase");
    await expect(groupAudioResponse(token, { ...audience(), display: true }, new Request("https://delivery.test/audio"), { takeId }, "everyone")).rejects.toMatchObject({ status: 404 });
  });
});


describe("Switch round snapshots and private replay", () => {
  const challenge = snapshotSwitchChallenge(SWITCH_CHALLENGES[0]!);
  const assignment = { mode: "switch" as const, challenge, rating: challenge.rating, scoringVersion: challenge.scoringVersion, rubricVersion: challenge.rubricVersion };
  const attemptId = "00000000-0000-4000-8000-000000000005";
  function switchRound() {
    Object.assign(state.tables.challenges![0]!, { group_mode: "switch", group_assignment: assignment });
    Object.assign(state.tables.challenge_group_takes![0]!, { mode: "switch", switch_attempt_id: attemptId, score: null });
    state.tables.switch_attempts = [{
      id: attemptId, challenge_version_id: `${challenge.id}:${challenge.version}`, challenge_snapshot: challenge,
      scoring_version: challenge.scoringVersion, user_id: null, guest_owner_hash: "b".repeat(64), owner_key: `guest:${"b".repeat(64)}`,
      status: "ready", score: null, moderation_state: "pending", duration_ms: 18000, recording_offset_ms: 0,
      recording_path: `guests/${"b".repeat(64)}/switch/${attemptId}.wav`, expires_at: new Date(Date.now() + 86400000).toISOString(),
    }];
  }
  it("requires matching script, directions, cue timing and rubric, independent of JSON key order", () => {
    switchRound();
    const attempt = state.tables.switch_attempts![0]!;
    expect(matchesGroupSwitchAssignment(attempt, assignment)).toBe(true);
    expect(matchesGroupSwitchAssignment({ ...attempt, challenge_snapshot: { ...Object.fromEntries(Object.entries(challenge).reverse()) } }, assignment)).toBe(true);
    for (const altered of [
      { ...challenge, rubricVersion: "another-rubric" },
      { ...challenge, cues: challenge.cues.map((cue, i) => i ? cue : { ...cue, end: 7 }) },
      { ...challenge, cues: challenge.cues.map((cue, i) => i ? cue : { ...cue, text: "A different line" }) },
      { ...challenge, cues: challenge.cues.map((cue, i) => i ? cue : { ...cue, direction: "Changed direction" }) },
    ]) expect(matchesGroupSwitchAssignment({ ...attempt, challenge_snapshot: altered }, assignment)).toBe(false);
    expect(matchesGroupSwitchAssignment({ ...attempt, scoring_version: "other" }, assignment)).toBe(false);
  });
  it("exposes synchronized snapshot only for eligible revealed or consented showcase performances", async () => {
    switchRound();
    expect((await getGroupRound(token, guest, "https://delivery.test")).members.find((m) => m.id === rivalId)?.performance).toBeNull();
    state.tables.challenges![0]!.state = "completed";
    const round = await getGroupRound(token, guest, "https://delivery.test");
    const performance = round.members.find((m) => m.id === rivalId)?.performance;
    expect(performance?.switchAttempt?.challenge).toEqual(challenge);
    expect(performance?.switchAttempt?.audioUrl).toBe(`/api/rounds/${token}/performances/${rivalId}/audio?maxRating=everyone`);
    expect(performance?.scoreGroup).toBe("unscored");
    state.tables.switch_attempts![0]!.moderation_state = "rejected";
    expect((await getGroupRound(token, guest, "https://delivery.test")).members.find((m) => m.id === rivalId)?.performance).toBeNull();
  });
  it("denies a foreign or mismatched source when requesting a private Switch draft", async () => {
    switchRound();
    await expect(groupAudioResponse(token, guest, new Request("https://delivery.test/audio"), { takeId: attemptId }, "everyone")).rejects.toMatchObject({ status: 404 });
    state.tables.switch_attempts![0]!.guest_owner_hash = guestHash;
    state.tables.switch_attempts![0]!.challenge_snapshot = { ...challenge, version: "tampered" };
    await expect(groupAudioResponse(token, guest, new Request("https://delivery.test/audio"), { takeId: attemptId }, "everyone")).rejects.toMatchObject({ status: 404 });
    expect(state.signed).not.toHaveBeenCalled();
  });
  it("keeps scored Switch takes in their own beta casual comparison group", () => {
    expect(groupScoreGroup("switch", { overall: 80, beta: true, ranked: false } as SwitchScore)).toBe("switch-beta");
    expect(groupScoreGroup("switch", null)).toBe("unscored");
  });
});
