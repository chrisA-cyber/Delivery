import { describe, expect, it } from "vitest";
import { addMember, applyAction, closeRoomForMediaFailure, createRoom, desiredPublish, snapshotRoom, tickRoom } from "./engine";
import { ROAST_LIMITS as L, type RoastAction, type RoastRoomState } from "./types";

const start = 1_000_000;
function fixture() {
  let state = createRoom({ id: "main", name: "Main stage", visibility: "public", host: {
    id: "host", name: "Host", signedIn: true, adultAcknowledged: true,
  } }, start);
  for (const id of ["a", "b", "c", "d", "voter", "guest"]) state = addMember(state, {
    id, name: id.toUpperCase(), signedIn: id !== "guest", adultAcknowledged: true,
  }, start);
  return state;
}
function act(state: RoastRoomState, id: string, action: RoastAction, now = start) {
  return applyAction(state, id, action, now);
}
function readyQueue(state: RoastRoomState, id: string, now = start) {
  return act(act(state, id, { type: "ready", adultAcknowledged: true, microphoneReady: true }, now), id, { type: "queue_join" }, now);
}
function observed(state: RoastRoomState, now: number, ids = ["a", "b", "c", "d", "voter", "guest", "host"], healthy = true) {
  // Represents independent UI heartbeats, separate from the SFU's trusted observation.
  state = structuredClone(state);
  for (const member of Object.values(state.members)) if (!member.removed) member.lastSeenAt = now;
  return tickRoom(state, now, { connectedIds: ids, providerHealthy: healthy });
}
function begin(state = fixture(), now = start) {
  state = readyQueue(readyQueue(state, "a", now), "b", now);
  state = act(state, "a", { type: "offer_accept", offerExpiresAt: now + L.offerMs }, now);
  state = act(state, "b", { type: "offer_accept", offerExpiresAt: now + L.offerMs }, now);
  return observed(state, now);
}
function toVote(state: RoastRoomState, now: number) {
  state = observed(state, now + L.introMs);
  for (let i = 1; i <= 4; i++) state = observed(state, now + L.introMs + i * L.turnMs);
  return observed(state, now + L.introMs + 4 * L.turnMs + L.mediaBufferMs);
}

describe("Roast Off authoritative turns and stage permissions", () => {
  it("requires readiness, explicit stage acceptance, actual media connection and only grants the active microphone", () => {
    let state = fixture();
    expect(() => act(state, "guest", { type: "queue_join" })).toThrow(/Sign in/);
    expect(() => act(state, "a", { type: "ready", adultAcknowledged: false, microphoneReady: true })).toThrow(/18 or older/);
    state = readyQueue(readyQueue(state, "a"), "b");
    expect(desiredPublish(state, "a")).toEqual({ canPublish: false, audio: false, video: false });
    state = act(state, "a", { type: "offer_accept", offerExpiresAt: start + L.offerMs });
    state = act(state, "b", { type: "offer_accept", offerExpiresAt: start + L.offerMs });
    expect(state.phase).toBe("waiting");
    state = act(state, "b", { type: "camera", enabled: true });
    state = observed(state, start);
    expect(state.phase).toBe("intro");
    expect(desiredPublish(state, "a").audio).toBe(false);
    state = observed(state, start + L.introMs);
    expect(desiredPublish(state, "a").audio).toBe(true);
    expect(desiredPublish(state, "b")).toEqual({ canPublish: true, audio: false, video: true });
    expect(desiredPublish(state, "voter")).toEqual({ canPublish: false, audio: false, video: false });
    state = observed(state, state.deadline!);
    expect(state.battle?.turnIndex).toBe(1);
    expect(desiredPublish(state, "a").audio).toBe(false);
    expect(desiredPublish(state, "b").audio).toBe(true);
    state = act(state, "host", { type: "host_mute", memberId: "b", muted: true }, state.deadline! - 1);
    expect(desiredPublish(state, "b").audio).toBe(false);
  });
  it("runs four full alternating turns, drains final media, votes and creates exactly one result", () => {
    let state = begin();
    const battleId = state.battle!.id;
    expect(battleId).toMatch(/^[0-9a-f-]{36}$/);
    state = observed(state, start + L.introMs);
    for (let i = 0; i < 4; i++) {
      expect(snapshotRoom(state, "voter", state.deadline! - 1).activeSpeakerId).toBe(i % 2 ? "b" : "a");
      expect(state.battle?.turnIndex).toBe(i);
      state = observed(state, state.deadline!);
    }
    expect(state.phase).toBe("buffer");
    expect(desiredPublish(state, "a").audio).toBe(false);
    expect(snapshotRoom(state, "voter", state.deadline! - 1).viewer.canVote).toBe(false);
    state = observed(state, state.deadline!);
    expect(state.phase).toBe("voting");
    const voteEnd = state.deadline!;
    state = act(state, "voter", { type: "vote", candidateId: "a", battleId }, voteEnd - 1);
    state = observed(state, voteEnd);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]!).toMatchObject({ id: battleId, kind: "completed", winnerId: "a", votes: [1, 0], streak: 1 });
    state = observed(state, voteEnd);
    expect(state.history).toHaveLength(1);
  });
  it("does not skip a speaking turn when the worker is late", () => {
    let state = begin();
    state = observed(state, start + L.introMs);
    const lateAt = state.deadline! + 45_000;
    state = observed(state, lateAt);
    expect(state.battle?.turnIndex).toBe(1);
    expect(state.deadline).toBe(lateAt + L.turnMs);
  });
});

describe("audience voting and rotation", () => {
  it("freezes voter eligibility, supports changes, rejects self/late/stale votes and rotates draws", () => {
    let state = toVote(begin(), start);
    const now = state.deadline! - L.voteMs;
    const battleId = state.battle!.id;
    state = addMember(state, { id: "late", name: "Late", signedIn: false, adultAcknowledged: true }, now + 1);
    expect(() => act(state, "late", { type: "vote", candidateId: "a", battleId }, now + 2)).toThrow(/before voting/);
    expect(() => act(state, "a", { type: "vote", candidateId: "a", battleId }, now + 2)).toThrow(/spectators/);
    expect(() => act(state, "voter", { type: "vote", candidateId: "a", battleId: "old" }, now + 2)).toThrow(/battle has changed/);
    state = act(state, "voter", { type: "vote", candidateId: "a", battleId }, now + 2);
    state = act(state, "voter", { type: "vote", candidateId: "b", battleId }, now + 3);
    state = act(state, "guest", { type: "vote", candidateId: "a", battleId }, now + 4);
    expect(Object.keys(state.battle!.votes)).toHaveLength(2);
    expect(() => act(state, "voter", { type: "vote", candidateId: "a", battleId }, state.deadline!)).toThrow(/closed/);
    state = observed(state, state.deadline!);
    expect(state.history[0]!).toMatchObject({ kind: "completed", winnerId: null, votes: [1, 1] });
    state = observed(state, state.deadline!);
    expect(state.stage).toEqual([null, null]);
    expect(state.championId).toBeNull();
  });
  it("rotates both performers on zero votes and allows a winner at most three consecutive wins", () => {
    let empty = toVote(begin(), start);
    empty = observed(empty, empty.deadline!);
    expect(empty.history[0]!.reason).toMatch(/No audience votes/);
    empty = observed(empty, empty.deadline!);
    expect(empty.stage).toEqual([null, null]);
    let state = begin();
    state = readyQueue(readyQueue(state, "c"), "d");
    let began = start;
    for (let win = 1; win <= 3; win++) {
      state = toVote(state, began);
      state = act(state, "voter", { type: "vote", candidateId: "a", battleId: state.battle!.id }, state.deadline! - 1);
      state = observed(state, state.deadline!);
      expect(state.battle!.result!.streak).toBe(win);
      state = observed(state, state.deadline!);
      if (win < 3) {
        expect(state.stage).toEqual(["a", null]);
        const offer = state.offers[0]!;
        began = state.members.host!.lastSeenAt;
        state = act(state, offer.memberId, { type: "offer_accept", offerExpiresAt: offer.expiresAt }, began);
        state = observed(state, began);
        expect(state.phase).toBe("intro");
      }
    }
    expect(state.stage).toEqual([null, null]);
    expect(state.history).toHaveLength(3);
    expect(state.streak).toBe(0);
  });
});

describe("queue concurrency, moderation and safe snapshots", () => {
  it("deduplicates queue/action retries, skips expired offers and protects host actions", () => {
    let state = readyQueue(readyQueue(readyQueue(fixture(), "a"), "b"), "c");
    state = act(state, "c", { type: "queue_join", requestId: "repeat" });
    const same = act(state, "c", { type: "queue_join", requestId: "repeat" });
    expect(same).toBe(state);
    expect(state.queue).toEqual(["a", "b", "c"]);
    expect(() => act(state, "c", { type: "host_queue_remove", memberId: "a" })).toThrow(/Only this room/);
    const revision = state.revision;
    state = act(state, "host", { type: "host_queue_move", memberId: "c", position: 0, expectedRevision: revision });
    expect(() => act(state, "host", { type: "host_queue_remove", memberId: "a", expectedRevision: revision })).toThrow(/room changed/);
    state = observed(state, start + L.offerMs);
    expect(state.queue).toEqual(["c"]);
    expect(state.offers).toEqual([{ memberId: "c", seat: 0, expiresAt: start + 2 * L.offerMs }]);
    expect(() => act(state, "a", { type: "offer_accept", offerExpiresAt: start + L.offerMs }, start + L.offerMs)).toThrow(/expired/);
    state = act(state, "c", { type: "queue_leave" }, start + L.offerMs);
    expect(state.offers).toEqual([]);
  });
  it("revokes publishing on removal, enforces bans and records a forfeit without inventing audience votes", () => {
    let state = observed(begin(), start + L.introMs);
    expect(desiredPublish(state, "a").audio).toBe(true);
    state = act(state, "host", { type: "host_remove", memberId: "a", ban: true }, start + L.introMs + 1);
    expect(desiredPublish(state, "a")).toEqual({ canPublish: false, audio: false, video: false });
    expect(state.battle!.result).toMatchObject({ kind: "forfeit", winnerId: "b", votes: [0, 0] });
    expect(() => addMember(state, { id: "a", name: "New name", signedIn: true, adultAcknowledged: true }, start + 4000)).toThrow(/cannot join/);
    expect(() => act(state, "a", { type: "camera", enabled: true }, start + 4000)).toThrow(/Join this room/);
  });
  it("bounds chat/reactions, keeps blocked messages private and never exposes ballots in snapshots", () => {
    let state = fixture();
    for (let i = 0; i < 105; i++) state = act(state, "a", { type: "chat", text: `line ${i}`, requestId: `chat-${i}` });
    for (let i = 0; i < 25; i++) state = act(state, "b", { type: "react", kind: "fire" });
    expect(state.chat).toHaveLength(L.chat);
    expect(state.reactions).toHaveLength(L.reactions);
    state = act(state, "voter", { type: "block", memberId: "a", blocked: true });
    let view = snapshotRoom(state, "voter", start);
    expect(view.chat).toEqual([]);
    expect(snapshotRoom(state, "guest", start).chat).toHaveLength(L.chat);
    state = toVote(begin(state), start);
    state = act(state, "guest", { type: "vote", candidateId: "a", battleId: state.battle!.id }, state.deadline! - 1);
    view = snapshotRoom(state, "voter", state.deadline! - 1);
    expect(view).not.toHaveProperty("battle");
    expect(view).not.toHaveProperty("bannedIds");
    expect(view.viewer.vote).toBeNull();
    expect(view.result).toBeNull();
    view.viewer.blockedIds.push("external-mutation");
    expect(state.members.voter!.blockedIds).not.toContain("external-mutation");
    expect(snapshotRoom(state, "guest", start + L.chatRetentionMs).chat).toEqual([]);
  });
  it("keeps voluntary leavers disconnected until they rejoin and retains host removal after pruning", () => {
    let state = fixture();
    state = act(state, "a", { type: "leave" });
    expect(state.members.a!.removed).toBe(false);
    expect(snapshotRoom(state, "a", start).viewer.id).toBeNull();
    expect(() => act(state, "a", { type: "heartbeat" })).toThrow(/Join this room/);
    state = addMember(state, { id: "a", name: "A again", signedIn: true, adultAcknowledged: true }, start + 1);
    expect(snapshotRoom(state, "a", start + 1).viewer.id).toBe("a");
    state = act(state, "host", { type: "host_remove", memberId: "a" }, start + 2);
    state = observed(state, start + L.hostCloseMs + 100);
    expect(state.members.a!.removed).toBe(true);
    expect(() => addMember(state, { id: "a", name: "A again", signedIn: true, adultAcknowledged: true }, start + L.hostCloseMs + 101)).toThrow(/host removed/);
  });
  it("binds acceptance to the exact offer and preserves command deduplication across noisy audience traffic", () => {
    let state = readyQueue(fixture(), "a");
    const expiresAt = state.offers[0]!.expiresAt;
    expect(() => act(state, "a", { type: "offer_accept", offerExpiresAt: expiresAt - 1 })).toThrow(/expired/);
    state = act(state, "host", { type: "host_pause", requestId: "host-pause-once" });
    state = act(state, "host", { type: "host_resume", requestId: "host-resume-once" });
    for (let i = 0; i < 300; i++) {
      state = act(state, "voter", { type: "heartbeat", requestId: `heartbeat-${i}` });
      state = act(state, "voter", { type: "chat", text: "hello", requestId: `chat-${i}` });
    }
    state = act(state, "host", { type: "host_pause", requestId: "host-pause-once" });
    expect(state.phase).toBe("waiting");
    expect(state.recentRequestIds).toHaveLength(2);
    expect(state.recentChatRequestIds).toHaveLength(256);
  });
});

describe("disconnect recovery and room lifecycle", () => {
  it("closes an unresolved battle as technical no-contest when media access cannot be revoked", () => {
    const active = observed(begin(), start + L.introMs);
    const closed = closeRoomForMediaFailure(active, start + 5000);
    expect(closed.phase).toBe("closed");
    expect(closed.battle!.result).toMatchObject({ kind: "no_contest", winnerId: null, votes: [0, 0] });
    expect(closed.stage).toEqual([null, null]);
    expect(desiredPublish(closed, "a").canPublish).toBe(false);
    expect(closed.history).toHaveLength(1);
  });
  it("freezes on disconnect, preserves remaining turn time on recovery and forfeits only after grace", () => {
    let state = observed(begin(), start + L.introMs);
    const originalEnd = state.deadline!;
    state = observed(state, start + 8000, ["b", "host", "voter"]);
    expect(state.phase).toBe("paused");
    expect(desiredPublish(state, "a").audio).toBe(false);
    state = observed(state, start + 13_000);
    expect(state.phase).toBe("turn");
    expect(state.deadline).toBe(originalEnd + 5000);
    state = observed(state, start + 14_000, ["b", "host", "voter"]);
    state = observed(state, start + 14_000 + L.reconnectMs, ["b", "host", "voter"]);
    expect(state.battle!.result).toMatchObject({ kind: "forfeit", winnerId: "b", votes: [0, 0] });
  });
  it("marks a provider outage or pre-start disconnect as technical no-contest", () => {
    let state = observed(begin(), start + L.introMs);
    state = observed(state, start + 5000, [], false);
    expect(state.pause?.reason).toBe("media_unavailable");
    state = observed(state, start + 5000 + L.reconnectMs, [], false);
    expect(state.battle!.result).toMatchObject({ kind: "no_contest", winnerId: null, votes: [0, 0] });
    let intro = begin();
    intro = observed(intro, start + 1, ["b"]);
    intro = observed(intro, start + 1 + L.reconnectMs, ["b"]);
    expect(intro.battle!.result!.kind).toBe("no_contest");
  });
  it("never advances a timed verdict from a request without a fresh media observation", () => {
    let state = toVote(begin(), start);
    const afterDeadline = state.deadline! + 1;
    state = act(state, "voter", { type: "heartbeat" }, afterDeadline);
    expect(state.phase).toBe("voting");
    expect(state.history).toEqual([]);
    expect(() => act(state, "voter", { type: "vote", candidateId: "a", battleId: state.battle!.id }, afterDeadline)).toThrow(/closed/);
    state = observed(state, afterDeadline, [], false);
    expect(state.phase).toBe("paused");
    state = observed(state, afterDeadline + L.reconnectMs, [], false);
    expect(state.battle!.result!.kind).toBe("no_contest");
  });
  it("pauses after host grace, recovers without restarting and closes without a host or after one hour", () => {
    let state = observed(begin(), start + L.introMs);
    const end = state.deadline!;
    state.members.host!.lastSeenAt = start;
    state = tickRoom(state, start + L.hostGraceMs);
    expect(state.pause?.reason).toBe("host_disconnected");
    state = act(state, "host", { type: "heartbeat" }, start + L.hostGraceMs + 1000);
    expect(state.phase).toBe("paused");
    state = observed(state, start + L.hostGraceMs + 1000);
    expect(state.phase).toBe("turn");
    expect(state.deadline).toBe(end + 1000);
    state.members.host!.lastSeenAt = start;
    state = tickRoom(state, start + L.hostCloseMs);
    expect(state.phase).toBe("closed");
    expect(state.stage).toEqual([null, null]);
    expect(state.battle!.result!.kind).toBe("no_contest");
    const expired = observed(fixture(), start + L.roomLifetimeMs);
    expect(expired.phase).toBe("closed");
    expect(expired.closedReason).toMatch(/one-hour/);
  });
});
