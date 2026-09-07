// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addMember, createRoom } from "@/lib/roast/engine";
import { ROAST_LIMITS, type RoastResult } from "@/lib/roast/types";
import type { RoastLease, StoredRoastRoom } from "@/lib/server/roast-store";

const mocks = vi.hoisted(() => ({
  active: vi.fn(), load: vi.fn(), forget: vi.fn(), withLease: vi.fn(), alive: vi.fn(),
  configured: vi.fn(), list: vi.fn(), reconcile: vi.fn(), remove: vi.fn(), deleteRoom: vi.fn(),
  assert: vi.fn(), save: vi.fn(), upsert: vi.fn(), deleteHistory: vi.fn(), olderThan: vi.fn(), redis: vi.fn(),
}));
vi.mock("@/lib/server/roast-store", async (original) => ({
  ...await original<typeof import("@/lib/server/roast-store")>(),
  activeRoastRooms: mocks.active, loadRoastRoom: mocks.load, forgetRoastRoom: mocks.forget,
  withRoastLease: mocks.withLease, markRoastWorkerAlive: mocks.alive,
}));
vi.mock("@/lib/server/roast-media", () => ({
  roastMediaConfigured: mocks.configured, listRoastMediaParticipants: mocks.list,
  reconcileRoastMediaPermissions: mocks.reconcile, removeRoastMediaParticipant: mocks.remove,
  deleteRoastMediaRoom: mocks.deleteRoom,
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: () => ({ upsert: mocks.upsert, delete: mocks.deleteHistory }) }) }));
vi.mock("@/lib/server/redis", () => ({ redisCommand: mocks.redis }));

import { cleanupRoastHistory, runRoastTick, syncRoastMedia } from "@/lib/server/roast-runtime";
import { roastRoomNeedsWorker } from "@/lib/server/roast-store";

const now = Date.parse("2026-09-07T12:00:00Z");
const memberIds = ["host", "first", "second", "spectator"];
const lease: RoastLease = { assert: mocks.assert, save: mocks.save };
let stored: StoredRoastRoom;

function fixture(): StoredRoastRoom {
  let state = createRoom({ id: "main", name: "Main stage", visibility: "public", host: {
    id: "host", name: "Host", signedIn: true, adultAcknowledged: true,
  } }, now);
  for (const id of memberIds.slice(1)) state = addMember(state, { id, name: id, signedIn: id !== "spectator", adultAcknowledged: true }, now);
  for (const id of memberIds) {
    state.members[id]!.mediaConnected = true;
    state.members[id]!.lastMediaSeenAt = now;
    state.members[id]!.ready = true;
  }
  state.stage = ["first", "second"];
  state.mediaHealthy = true;
  state.phase = "voting";
  state.deadline = now;
  state.battle = { id: "aaaaaaaa-1111-4111-8111-111111111111", performerIds: ["first", "second"], turnIndex: 3,
    startedAt: now - 120_000, eligibleVoterIds: ["spectator"], votes: { spectator: "first" }, result: null };
  return { state, owners: Object.fromEntries(memberIds.map(id => [id, { ownerKey: id, userId: id === "spectator" ? null : id }])),
    inviteHash: null, mediaRoom: "fixture", mediaCreated: true, archivedResults: [], creationKey: "fixture", updatedAt: now };
}

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
  stored = fixture();
  mocks.configured.mockReturnValue(true);
  mocks.active.mockResolvedValue(["main"]);
  mocks.load.mockImplementation(async () => structuredClone(stored));
  mocks.withLease.mockImplementation(async (work: (held: RoastLease) => Promise<void>) => work(lease));
  mocks.assert.mockResolvedValue(undefined);
  mocks.save.mockImplementation(async (room: StoredRoastRoom) => { stored = structuredClone(room); });
  mocks.list.mockResolvedValue(memberIds.map(identity => ({ identity, sid: identity, connected: true, tracks: [] })));
  mocks.reconcile.mockResolvedValue([]); mocks.remove.mockResolvedValue(undefined); mocks.deleteRoom.mockResolvedValue(undefined);
  mocks.upsert.mockResolvedValue({ error: null }); mocks.olderThan.mockResolvedValue({ error: null });
  mocks.deleteHistory.mockReturnValue({ lt: mocks.olderThan });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Roast Off runtime recovery", () => {
  it("does not publish or archive a candidate audience winner when permission reconciliation fails", async () => {
    mocks.reconcile.mockRejectedValueOnce(new Error("provider outage"));
    await runRoastTick();
    expect(stored.state.phase).toBe("paused");
    expect(stored.state.pause?.reason).toBe("media_unavailable");
    expect(stored.state.battle?.result).toBeNull();
    expect(stored.state.history).toEqual([]);
    expect(stored.state.battle?.votes).toEqual({ spectator: "first" });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.save.mock.calls.every(([room]) => room.state.phase === "paused")).toBe(true);
  });

  it("pauses expired voting when the media observation is unavailable", async () => {
    mocks.list.mockRejectedValue(new Error("provider unavailable"));
    await runRoastTick();
    expect(stored.state.phase).toBe("paused");
    expect(stored.state.history).toEqual([]);
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("starts the full speaking clock only after successful media permissions", async () => {
    stored.state.phase = "intro";
    stored.state.battle!.startedAt = null;
    stored.state.battle!.turnIndex = 0;
    mocks.reconcile.mockImplementationOnce(async () => {
      expect(mocks.save).not.toHaveBeenCalled();
      vi.setSystemTime(now + 2_500);
      return [];
    });
    await runRoastTick();
    expect(stored.state.phase).toBe("turn");
    expect(stored.state.deadline).toBe(now + 2_500 + ROAST_LIMITS.turnMs);
    expect(stored.state.battle?.startedAt).toBe(now + 2_500);
  });

  it("keeps a closed room scheduled until its failed history write succeeds", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result: RoastResult = { id: stored.state.battle!.id, performerIds: ["first", "second"], performerNames: ["First", "Second"],
      kind: "no_contest", winnerId: null, votes: [0, 0], streak: 0, reason: "Host closed stage.", endedAt: now };
    stored.state.phase = "closed";
    stored.state.history = [result];
    stored.state.battle!.result = result;
    stored.owners.disconnected = { ownerKey: "prior-issued-identity", userId: null };
    mocks.upsert.mockResolvedValueOnce({ error: { message: "database outage" } });
    await runRoastTick();
    expect(stored.mediaCreated).toBe(false);
    expect(stored.archivedResults).toEqual([]);
    expect(roastRoomNeedsWorker(stored)).toBe(true);
    await runRoastTick();
    expect(stored.archivedResults).toEqual([result.id]);
    expect(roastRoomNeedsWorker(stored)).toBe(false);
    expect(mocks.deleteRoom).toHaveBeenCalledTimes(1);
    expect(mocks.remove.mock.calls.map(call => call[1])).toContain("disconnected");
    expect(mocks.remove.mock.invocationCallOrder.at(-1)).toBeLessThan(mocks.deleteRoom.mock.invocationCallOrder[0]!);
    expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ id: result.id, expires_at: new Date(now + 30 * 86_400_000).toISOString() }), { onConflict: "id", ignoreDuplicates: true });
  });

  it("releases media after the unattended-host deadline", async () => {
    vi.setSystemTime(now + ROAST_LIMITS.hostCloseMs);
    await runRoastTick();
    expect(stored.state.phase).toBe("closed");
    expect(stored.state.battle?.result?.kind).toBe("no_contest");
    expect(stored.state.battle?.result?.winnerId).toBeNull();
    expect(mocks.deleteRoom).toHaveBeenCalledWith("fixture");
    expect(roastRoomNeedsWorker(stored)).toBe(false);
  });

  it("keeps closure pending if an issued token could not be revoked", async () => {
    stored.state.phase = "closed";
    mocks.remove.mockRejectedValueOnce(new Error("revocation unavailable"));
    await runRoastTick();
    expect(stored.state.phase).toBe("closed");
    expect(stored.mediaCreated).toBe(true);
    expect(roastRoomNeedsWorker(stored)).toBe(true);
    expect(mocks.deleteRoom).not.toHaveBeenCalled();
  });

  it("removes unknown, departed, and heartbeat-expired media peers before granting sources", async () => {
    stored.state.members.spectator!.lastSeenAt = now - ROAST_LIMITS.presenceMs;
    stored.state.members.second!.left = true;
    mocks.list.mockResolvedValue([...memberIds, "unknown"].map(identity => ({ identity, sid: identity, connected: true, tracks: [] })));
    await syncRoastMedia(stored, lease);
    expect(mocks.remove.mock.calls.map(call => call[1])).toEqual(["second", "spectator", "unknown"]);
    expect(mocks.remove.mock.invocationCallOrder.at(-1)).toBeLessThan(mocks.reconcile.mock.invocationCallOrder[0]!);
  });

  it("deletes history by expiry without touching other media or tables", async () => {
    await cleanupRoastHistory();
    expect(mocks.olderThan).toHaveBeenCalledWith("expires_at", new Date(now).toISOString());
    expect(mocks.deleteRoom).not.toHaveBeenCalled();
  });

  it("rejects a fenced-out writer while retaining identities needed for token revocation", async () => {
    const original = await vi.importActual<typeof import("@/lib/server/roast-store")>("@/lib/server/roast-store");
    stored.owners.expired = { ownerKey: "obsolete-guest-binding", userId: null };
    mocks.redis.mockResolvedValueOnce("OK").mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await expect(original.withRoastLease(async held => held.save(stored))).rejects.toMatchObject({ code: "ROAST_BUSY" });
    expect(stored.owners.expired).toEqual({ ownerKey: "obsolete-guest-binding", userId: null });
    expect(mocks.redis).toHaveBeenCalledTimes(3);
  });
});
