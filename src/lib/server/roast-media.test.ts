// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipantInfo, ParticipantInfo_State, ParticipantPermission, TrackSource, TokenVerifier } from "livekit-server-sdk";

const mocks = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn(), create: vi.fn(), remove: vi.fn(), delete: vi.fn() }));
vi.mock("livekit-server-sdk", async (importOriginal) => ({
  ...await importOriginal<typeof import("livekit-server-sdk")>(),
  RoomServiceClient: class {
    listParticipants = mocks.list;
    updateParticipant = mocks.update;
    createRoom = mocks.create;
    removeParticipant = mocks.remove;
    deleteRoom = mocks.delete;
  },
}));

import { createRoastMediaRoom, issueRoastMediaToken, reconcileRoastMediaPermissions, removeRoastMediaParticipant, roastMediaConfigured } from "@/lib/server/roast-media";

function participant(identity: string, sources: TrackSource[] = []) {
  return new ParticipantInfo({ identity, sid: `PA_${identity}`, state: ParticipantInfo_State.ACTIVE, permission: new ParticipantPermission({ canPublish: sources.length > 0, canPublishSources: sources, canSubscribe: true, canPublishData: false }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LIVEKIT_URL", "wss://delivery-test.livekit.cloud");
  vi.stubEnv("LIVEKIT_API_KEY", "delivery-test-key");
  vi.stubEnv("LIVEKIT_API_SECRET", "delivery-test-secret-at-least-thirty-two-characters");
  mocks.list.mockResolvedValue([]); mocks.update.mockResolvedValue(participant("updated")); mocks.create.mockResolvedValue({}); mocks.remove.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("Roast Off media permission boundary", () => {
  it("issues only short-lived, room-scoped receive-only tokens, even for hosts and performers", async () => {
    const result = await issueRoastMediaToken({ roomId: "room-1", identity: "member-session-1", name: "A performer" });
    const claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(result.token);
    expect(result.url).toBe("wss://delivery-test.livekit.cloud");
    expect(claims.sub).toBe("member-session-1");
    expect(claims.video).toMatchObject({ room: "delivery-roast-room-1", roomJoin: true, canSubscribe: true, canPublish: false, canPublishSources: [], canPublishData: false, roomAdmin: false, roomCreate: false, roomRecord: false, canUpdateOwnMetadata: false });
    expect(claims.roomConfig).toMatchObject({ name: "delivery-roast-room-1", maxParticipants: 28, emptyTimeout: 60, departureTimeout: 30, maxPlayoutDelay: 500 });
    expect(Number(claims.exp) - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(60);
  });

  it("finishes all previous-source revocations before granting the next microphone", async () => {
    mocks.list.mockResolvedValue([participant("first", [TrackSource.MICROPHONE, TrackSource.CAMERA]), participant("second", [TrackSource.CAMERA]), participant("spectator")]);
    const lease = vi.fn().mockResolvedValue(undefined);
    await reconcileRoastMediaPermissions("room-1", [{ identity: "first", microphone: false, camera: true }, { identity: "second", microphone: true, camera: true }], lease);
    const updates = mocks.update.mock.calls.map((call) => ({ identity: call[1], permission: call[2].permission }));
    expect(updates.map((entry) => entry.identity)).toEqual(["first", "second"]);
    expect(updates[0]!.permission.canPublishSources).toEqual([TrackSource.CAMERA]);
    expect(updates[1]!.permission.canPublishSources).toEqual([TrackSource.MICROPHONE, TrackSource.CAMERA]);
    expect(lease).toHaveBeenCalledTimes(2);
    expect(updates.every((entry) => !entry.permission.canPublishData && !entry.permission.canUpdateMetadata)).toBe(true);
  });

  it("does not grant anyone a microphone when revocation or the room lease fails", async () => {
    mocks.list.mockResolvedValue([participant("first", [TrackSource.MICROPHONE]), participant("second")]);
    mocks.update.mockRejectedValueOnce(new Error("private provider detail"));
    await expect(reconcileRoastMediaPermissions("room-1", [{ identity: "second", microphone: true, camera: false }])).rejects.toMatchObject({ code: "ROAST_MEDIA_UNAVAILABLE" });
    expect(mocks.update.mock.calls.every((call) => call[2].permission.canPublish === false)).toBe(true);
    mocks.update.mockClear();
    await expect(reconcileRoastMediaPermissions("room-1", [{ identity: "second", microphone: true, camera: false }], async () => { throw new Error("lease expired"); })).rejects.toMatchObject({ code: "ROAST_MEDIA_UNAVAILABLE" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects overlapping speakers and leaves queued participants without publishing permission", async () => {
    await expect(reconcileRoastMediaPermissions("room-1", [{ identity: "first", microphone: true, camera: false }, { identity: "second", microphone: true, camera: false }])).rejects.toMatchObject({ code: "INVALID_ROAST_MEDIA_GRANT" });
    expect(mocks.list).not.toHaveBeenCalled();
    mocks.list.mockResolvedValue([participant("queued", [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE])]);
    await reconcileRoastMediaPermissions("room-1", []);
    expect(mocks.update).toHaveBeenCalledWith("delivery-roast-room-1", "queued", { permission: expect.objectContaining({ canPublish: false, canPublishSources: [], canPublishData: false }) });
  });

  it("caps room capacity, cleans empty rooms, and requests removal even after disconnection", async () => {
    await createRoastMediaRoom("room-1", 500);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ maxParticipants: 28, emptyTimeout: 60, departureTimeout: 30 }));
    mocks.remove.mockRejectedValueOnce({ code: "not_found" });
    await expect(removeRoastMediaParticipant("room-1", "removed-member")).resolves.toBeUndefined();
    expect(mocks.remove).toHaveBeenCalledWith("delivery-roast-room-1", "removed-member");
  });

  it("fails closed without credentials and prevents self-hosted production URLs weakening Cloud revocation", async () => {
    vi.stubEnv("LIVEKIT_API_SECRET", ""); expect(roastMediaConfigured()).toBe(false);
    await expect(issueRoastMediaToken({ roomId: "room-1", identity: "member-1", name: "Guest" })).rejects.toMatchObject({ code: "ROAST_MEDIA_NOT_CONFIGURED" });
    vi.stubEnv("LIVEKIT_API_SECRET", "restored-test-secret"); vi.stubEnv("NODE_ENV", "production");
    for (const url of ["wss://unmanaged.example", "ws://localhost:7880", "wss://wrong.livekit.cloud.evil.example", "wss://secret@delivery.livekit.cloud", "wss://delivery.livekit.cloud/?token=private"]) {
      vi.stubEnv("LIVEKIT_URL", url); expect(roastMediaConfigured()).toBe(false);
    }
  });
});
