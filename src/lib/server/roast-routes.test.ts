// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupViewer } from "@/lib/server/group-rounds";
import type { StoredRoastRoom } from "@/lib/server/roast-store";

const mocks = vi.hoisted(() => ({
  viewer: vi.fn(), profile: { role: "user", display_name: "Signed player", handle: "player" },
  restrictions: [] as Array<{ starts_at: string; ends_at: string | null }>,
  rooms: new Map<string, unknown>(), configured: vi.fn(), worker: vi.fn(), token: vi.fn(),
  createMedia: vi.fn(), removeMedia: vi.fn(), deleteMedia: vi.fn(), sync: vi.fn(), rate: vi.fn(),
  report: vi.fn(), reportActor: vi.fn(), save: vi.fn(),
}));
vi.mock("@/lib/server/group-rounds", () => ({ getGroupViewer: mocks.viewer }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: (table: string) => {
  const result = () => ({ data: table === "profiles" ? mocks.profile : mocks.restrictions, error: null });
  const query = { select: () => query, eq: () => query, in: async () => result(), maybeSingle: async () => result() };
  return query;
} }) }));
vi.mock("@/lib/server/roast-store", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/roast-store")>(),
  ROAST_MAX_ROOMS: 2,
  loadRoastRoom: async (id: string) => structuredClone(mocks.rooms.get(id) ?? null),
  activeRoastRooms: async () => [...mocks.rooms.keys()],
  roastWorkerAlive: mocks.worker,
  withRoastLease: async (work: (lease: unknown) => Promise<unknown>) => work({ assert: async () => {}, save: async (room: StoredRoastRoom) => { mocks.save(room); mocks.rooms.set(room.state.id, structuredClone(room)); } }),
}));
vi.mock("@/lib/server/roast-media", () => ({
  roastMediaConfigured: mocks.configured, issueRoastMediaToken: mocks.token,
  createRoastMediaRoom: mocks.createMedia, removeRoastMediaParticipant: mocks.removeMedia,
  deleteRoastMediaRoom: mocks.deleteMedia,
}));
vi.mock("@/lib/server/roast-runtime", () => ({ syncRoastMedia: mocks.sync }));
vi.mock("@/lib/server/rate-limit", () => ({ getClientKey: () => "test-network", enforceRateLimit: mocks.rate }));
vi.mock("@/lib/server/reports", () => ({ insertReport: mocks.report, prepareReportActor: mocks.reportActor }));

import { addMember, createRoom } from "@/lib/roast/engine";
import { handleRoastLobby, handleRoastRoom } from "@/lib/server/roast-routes";
import { claimRoastMember, findRoastMember, getRoastViewer } from "@/lib/server/roast-identity";

const hostId = "8ecb169b-ec9a-42ce-bd47-6e8480a34cc1";
const guestId = "f91ac928-5263-46a1-a962-a780695f9e52";
const userId = "ca021d6b-5efb-4a0e-8f8f-ed25320a9f02";
const guestHash = "b".repeat(64);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const signedIn = (id = userId): GroupViewer => ({ user: { id } as User, guest: { idempotencyScope: guestHash, scope: `${guestHash}.network` } });
const guest = (): GroupViewer => ({ user: null, guest: { idempotencyScope: guestHash, scope: `${guestHash}.network` } });
const post = (body: Record<string, unknown>) => new Request("http://localhost/api/roast/main", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: randomUUID(), ...body }) });
const get = (invite?: string) => new Request(`http://localhost/api/roast/main${invite ? `?invite=${invite}` : ""}`);
function fixture(visibility: "public" | "private" = "public") {
  let state = createRoom({ id: "main", name: "Test stage", visibility, host: { id: hostId, name: "Host", signedIn: true, adultAcknowledged: true } }, Date.now());
  state = addMember(state, { id: guestId, name: "Audience", signedIn: false, adultAcknowledged: true }, Date.now());
  state.mediaHealthy = true;
  const room: StoredRoastRoom = { state, owners: { [hostId]: { ownerKey: `user:${userId}`, userId }, [guestId]: { ownerKey: `guest:${guestHash}`, userId: null } }, inviteHash: visibility === "private" ? hash("old-invitation") : null, mediaRoom: "provider-room", mediaCreated: true, archivedResults: [], creationKey: "fixture", updatedAt: Date.now() };
  mocks.rooms.set("main", structuredClone(room));
  return room;
}

beforeEach(() => {
  vi.clearAllMocks(); mocks.rooms.clear(); mocks.restrictions = []; mocks.profile.role = "user";
  mocks.viewer.mockResolvedValue(guest()); mocks.configured.mockReturnValue(true); mocks.worker.mockResolvedValue(true);
  mocks.token.mockResolvedValue({ url: "wss://test.livekit.cloud", token: "test-token", identity: guestId });
  mocks.createMedia.mockResolvedValue(undefined); mocks.removeMedia.mockResolvedValue(undefined); mocks.deleteMedia.mockResolvedValue(undefined); mocks.sync.mockResolvedValue(undefined); mocks.rate.mockResolvedValue(undefined);
  mocks.report.mockResolvedValue("report-id"); mocks.reportActor.mockResolvedValue({});
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("REDIS_URL", ""); vi.stubEnv("UPSTASH_REDIS_REST_URL", ""); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", ""); vi.stubEnv("ROAST_PUBLIC_HOST_IDS", "");
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("Roast route authority and input", () => {
  it("requires sign-in for private hosting and explicit public moderation authority", async () => {
    expect((await handleRoastLobby(post({ kind: "private", name: "Friends", adult: true }))).status).toBe(401);
    mocks.viewer.mockResolvedValue(signedIn());
    expect((await handleRoastLobby(post({ kind: "public", name: "Main", adult: true }))).status).toBe(403);
    expect(mocks.createMedia).not.toHaveBeenCalled();
    vi.stubEnv("ROAST_PUBLIC_HOST_IDS", userId);
    expect((await handleRoastLobby(post({ kind: "public", name: "Main", adult: true }))).status).toBe(201);
    expect(mocks.createMedia).toHaveBeenCalledTimes(1);
  });

  it.each(["media", "history"])("does not overwrite a closed public stage while %s cleanup remains", async (pending) => {
    const room = fixture(); room.state.phase = "closed";
    if (pending === "history") {
      room.mediaCreated = false;
      room.state.history = [{ id: randomUUID(), performerIds: [hostId, guestId], performerNames: ["Host", "Audience"], kind: "no_contest", winnerId: null, votes: [0, 0], streak: 0, reason: "Technical failure", endedAt: Date.now() }];
    }
    mocks.rooms.set("main", room); mocks.viewer.mockResolvedValue(signedIn()); vi.stubEnv("ROAST_PUBLIC_HOST_IDS", userId);
    const response = await handleRoastLobby(post({ kind: "public", name: "Main", adult: true }));
    expect(response.status).toBe(409); expect((await response.json()).error.code).toBe("ROAST_CLOSING");
    expect(mocks.createMedia).not.toHaveBeenCalled();
    expect((mocks.rooms.get("main") as StoredRoastRoom).mediaRoom).toBe("provider-room");
  });

  it("returns the original private invitation on a repeated creation request", async () => {
    mocks.viewer.mockResolvedValue(signedIn());
    const input = { requestId: randomUUID(), kind: "private", name: "Friends", adult: true };
    const first = await (await handleRoastLobby(post(input))).json();
    const retry = await (await handleRoastLobby(post(input))).json();
    expect(first.data.inviteToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(retry.data.inviteToken).toBe(first.data.inviteToken);
    expect(retry.data.roomId).toBe(first.data.roomId);
    expect(mocks.createMedia).toHaveBeenCalledTimes(1);
  });

  it("lets guests enter receive-only without treating payload identity fields as authority", async () => {
    fixture();
    expect((await handleRoastRoom(post({ action: "join", adult: true, signedIn: true, role: "host" }), "main")).status).toBe(422);
    expect((await handleRoastRoom(post({ action: "join", adult: true, name: "Audience" }), "main")).status).toBe(200);
    const token = await handleRoastRoom(post({}), "main", true);
    expect(token.status).toBe(200);
    expect(mocks.token).toHaveBeenCalledWith({ roomId: "provider-room", identity: guestId, name: "Audience" });
    expect((await handleRoastRoom(post({ action: "ready", adultAcknowledged: true, microphoneReady: true }), "main")).status).toBe(403);
    expect((await handleRoastRoom(post({ action: "host_end" }), "main")).status).toBe(403);
  });

  it.each([
    { action: "chat" }, { action: "camera" }, { action: "react" },
    { action: "block", memberId: hostId }, { action: "host_mute", memberId: guestId },
    { action: "host_queue_move", memberId: guestId }, { action: "offer_accept" },
    { action: "vote", candidateId: hostId },
  ])("rejects incomplete $action before entering room state", async (body) => {
    fixture();
    expect((await handleRoastRoom(post(body), "main")).status).toBe(422);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("keeps server ownership, invitation hashes, and voter lists out of snapshots", async () => {
    const room = fixture(); room.state.chat.push({ id: "chat-1", name: "Host", memberId: hostId, text: "Private audience chat", at: Date.now() }); mocks.rooms.set("main", room);
    mocks.viewer.mockResolvedValue({ ...guest(), guest: { idempotencyScope: "stranger", scope: "stranger.network" } });
    const response = await handleRoastRoom(get(), "main"); const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.room.chat).toEqual([]);
    const encoded = JSON.stringify(body);
    for (const privateValue of ["ownerKey", "provider-room", "eligibleVoterIds", "creationKey", guestHash]) expect(encoded).not.toContain(privateValue);
  });

  it("rotates private invitations once per request and rejects old links for outsiders", async () => {
    fixture("private"); mocks.viewer.mockResolvedValue(signedIn());
    const input = { action: "revoke_invite", requestId: randomUUID() };
    const first = await (await handleRoastRoom(post(input), "main")).json();
    const retry = await (await handleRoastRoom(post(input), "main")).json();
    expect(first.data.inviteToken).toBe(retry.data.inviteToken);
    mocks.viewer.mockResolvedValue({ ...guest(), guest: { idempotencyScope: "stranger", scope: "stranger.network" } });
    expect((await handleRoastRoom(get("old-invitation"), "main")).status).toBe(404);
    expect((await handleRoastRoom(get(first.data.inviteToken), "main")).status).toBe(200);
  });

  it("revokes host-removed publishing immediately and refuses reads, rejoins, and replacement tokens", async () => {
    fixture(); mocks.viewer.mockResolvedValue(signedIn()); vi.stubEnv("ROAST_PUBLIC_HOST_IDS", userId);
    expect((await handleRoastRoom(post({ action: "host_remove", memberId: guestId, ban: true }), "main")).status).toBe(200);
    expect(mocks.removeMedia).toHaveBeenCalledWith("provider-room", guestId);
    mocks.viewer.mockResolvedValue(guest());
    expect((await handleRoastRoom(get(), "main")).status).toBe(403);
    expect((await handleRoastRoom(post({ action: "join", adult: true }), "main")).status).toBe(403);
    expect((await handleRoastRoom(post({}), "main", true)).status).toBe(403);
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it("preserves a host ban if media removal fails and reports the unresolved revocation", async () => {
    fixture(); mocks.viewer.mockResolvedValue(signedIn()); vi.stubEnv("ROAST_PUBLIC_HOST_IDS", userId);
    mocks.removeMedia.mockRejectedValue(new Error("provider unavailable"));
    expect((await handleRoastRoom(post({ action: "host_remove", memberId: guestId, ban: true }), "main")).status).toBe(503);
    const saved = mocks.rooms.get("main") as StoredRoastRoom;
    expect(saved.state.bannedIds).toContain(guestId);
    expect(saved.state.phase).toBe("closed");
    expect(saved.mediaCreated).toBe(true);
    expect(mocks.deleteMedia).toHaveBeenCalledWith("provider-room");
    expect((await handleRoastRoom(post({}), "main", true)).status).toBe(410);
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it("reconciles a permission change before exposing it and does not fabricate a forfeit on outage", async () => {
    const room = fixture(); mocks.viewer.mockResolvedValue(signedIn()); vi.stubEnv("ROAST_PUBLIC_HOST_IDS", userId);
    room.state.phase = "turn"; room.state.deadline = Date.now() + 30_000; room.state.stage = [hostId, guestId];
    for (const member of Object.values(room.state.members)) { member.signedIn = true; member.ready = true; member.mediaConnected = true; member.lastMediaSeenAt = Date.now(); }
    room.state.battle = { id: randomUUID(), performerIds: [hostId, guestId], turnIndex: 0, startedAt: Date.now() - 1000, eligibleVoterIds: [], votes: {}, result: null };
    mocks.rooms.set("main", structuredClone(room));
    mocks.sync.mockImplementationOnce(async () => {
      expect((mocks.rooms.get("main") as StoredRoastRoom).state.phase).toBe("turn");
    });
    expect((await handleRoastRoom(post({ action: "host_pause" }), "main")).status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    mocks.rooms.set("main", room); mocks.removeMedia.mockRejectedValue(new Error("provider outage"));
    expect((await handleRoastRoom(post({ action: "host_remove", memberId: guestId, ban: true }), "main")).status).toBe(503);
    const saved = mocks.rooms.get("main") as StoredRoastRoom;
    expect(saved.state.history.at(-1)).toMatchObject({ kind: "no_contest", winnerId: null });
    expect(saved.state.bannedIds).toContain(guestId);
  });

  it("allows explicit rejoin after voluntary leaving while denying media until that rejoin", async () => {
    fixture();
    expect((await handleRoastRoom(post({ action: "leave" }), "main")).status).toBe(200);
    expect((await handleRoastRoom(post({}), "main", true)).status).toBe(403);
    expect((await handleRoastRoom(post({ action: "join", adult: true }), "main")).status).toBe(200);
    expect((await handleRoastRoom(post({}), "main", true)).status).toBe(200);
  });

  it("deduplicates reports with the same request key and does not invent live availability", async () => {
    fixture(); const input = { action: "report", memberId: hostId, reason: "privacy", requestId: randomUUID() };
    expect((await handleRoastRoom(post(input), "main")).status).toBe(200);
    expect((await handleRoastRoom(post(input), "main")).status).toBe(200);
    expect(mocks.report).toHaveBeenCalledTimes(1);
    mocks.configured.mockReturnValue(false);
    const lobby = await (await handleRoastLobby(get())).json();
    expect(lobby.data).toMatchObject({ available: false, main: null });
    expect((await handleRoastRoom(post({}), "main", true)).status).toBe(503);
  });
});

describe("Roast identity continuity", () => {
  it("retains an established guest membership on sign-in and drops signed-out account ownership", async () => {
    const room = fixture("private");
    const newAccount = signedIn("1f25cf1f-8568-43b1-8c72-813d1e1228de"); mocks.viewer.mockResolvedValue(newAccount);
    const viewer = await getRoastViewer(get());
    expect(findRoastMember(room, viewer)).toBe(guestId);
    expect(claimRoastMember(room, viewer)).toBe(guestId);
    expect(room.owners[guestId]?.userId).toBe(newAccount.user!.id);
    mocks.viewer.mockResolvedValue(guest());
    expect(findRoastMember(room, await getRoastViewer(get()))).toBeNull();
  });

  it("never treats a new provisional device cookie as proof of an existing guest membership", async () => {
    const room = fixture("private");
    mocks.viewer.mockResolvedValue({ ...signedIn("1f25cf1f-8568-43b1-8c72-813d1e1228de"), guest: { ...guest().guest, setCookie: "newly-minted" } });
    const viewer = await getRoastViewer(get());
    expect(findRoastMember(room, viewer)).toBeNull(); expect(claimRoastMember(room, viewer)).toBeNull();
    expect(room.owners[guestId]?.userId).toBeNull();
  });

  it("rejects currently restricted accounts before room access", async () => {
    fixture(); mocks.viewer.mockResolvedValue(signedIn());
    mocks.restrictions = [{ starts_at: "2000-01-01T00:00:00Z", ends_at: null }];
    expect((await handleRoastRoom(get(), "main")).status).toBe(403);
    expect(mocks.token).not.toHaveBeenCalled();
  });
});
