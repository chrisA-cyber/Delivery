import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import type { GroupViewer } from "@/lib/server/group-rounds";
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
import { getGroupRound, groupAudioResponse, groupScoreGroup, ownsGroupMember, ownsGroupSaySource, validGroupStoragePath } from "@/lib/server/group-rounds";
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
