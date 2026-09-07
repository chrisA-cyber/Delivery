import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionState, DisconnectReason, RoomEvent, Track, type LocalAudioTrack, type LocalVideoTrack } from "livekit-client";

const mocks = vi.hoisted(() => ({ audio: vi.fn(), video: vi.fn(), rooms: [] as unknown[] }));
vi.mock("livekit-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("livekit-client")>();
  return { ...actual, createLocalAudioTrack: mocks.audio, createLocalVideoTrack: mocks.video, Room: class {
    state = "disconnected";
    canPlaybackAudio = true;
    remoteParticipants = new Map();
    handlers = new Map<string, Array<(...args: unknown[]) => void>>();
    localParticipant = {
      identity: "member-1",
      permissions: { canPublish: false, canPublishSources: [] as number[] },
      publications: new Map<string, { track: { source: string } }>(),
      getTrackPublication: (source: string) => this.localParticipant.publications.get(source),
      publishTrack: vi.fn(async (track: { source: string }) => { this.localParticipant.publications.set(track.source, { track }); }),
      unpublishTrack: vi.fn(async (track: { source: string }) => { this.localParticipant.publications.delete(track.source); }),
    };
    constructor() { mocks.rooms.push(this); }
    on(event: string, callback: (...args: unknown[]) => void) { this.handlers.set(event, [...(this.handlers.get(event) ?? []), callback]); return this; }
    emit(event: string, ...args: unknown[]) { for (const callback of this.handlers.get(event) ?? []) callback(...args); }
    removeAllListeners() { this.handlers.clear(); }
    async connect() { this.state = "connected"; this.emit(actual.RoomEvent.ConnectionStateChanged, this.state); }
    async disconnect() { this.state = "disconnected"; }
    async startAudio() { this.canPlaybackAudio = true; }
  } };
});

import { useRoastMedia } from "@/components/roast/live-media";

interface TestRoom {
  state: string;
  localParticipant: { permissions: { canPublish: boolean; canPublishSources: number[] }; publishTrack: ReturnType<typeof vi.fn>; unpublishTrack: ReturnType<typeof vi.fn> };
  emit(event: string, ...args: unknown[]): void;
}
function testTrack(source: Track.Source) {
  const mediaStreamTrack = { readyState: "live", enabled: true, addEventListener: vi.fn() };
  return { source, mediaStreamTrack, stop: vi.fn(() => { mediaStreamTrack.readyState = "ended"; }), mute: vi.fn(async () => { mediaStreamTrack.enabled = false; }), unmute: vi.fn(async () => { mediaStreamTrack.enabled = true; }) };
}

beforeEach(() => {
  vi.clearAllMocks(); mocks.rooms.length = 0;
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(), enumerateDevices: vi.fn().mockResolvedValue([]) } });
});
afterEach(() => { cleanup(); });

describe("Roast Off browser device consent", () => {
  it("connects an audience member without requesting any devices, including after a server grant", async () => {
    const { result } = renderHook(() => useRoastMedia({ url: "wss://test.livekit.cloud", token: "audience-token", identity: "member-1" }));
    await waitFor(() => expect(result.current.connectionState).toBe(ConnectionState.Connected));
    const room = mocks.rooms[0] as TestRoom;
    await act(async () => { room.localParticipant.permissions = { canPublish: true, canPublishSources: [Track.sourceToProto(Track.Source.Microphone)] }; room.emit(RoomEvent.ParticipantPermissionsChanged); });
    expect(mocks.audio).not.toHaveBeenCalled(); expect(mocks.video).not.toHaveBeenCalled(); expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(room.localParticipant.publishTrack).not.toHaveBeenCalled(); expect(result.current.ready).toBe(false);
  });

  it("keeps preparation private, then reuses only explicitly enabled tracks through alternating turns", async () => {
    const audio = testTrack(Track.Source.Microphone), video = testTrack(Track.Source.Camera);
    mocks.audio.mockResolvedValue(audio as unknown as LocalAudioTrack); mocks.video.mockResolvedValue(video as unknown as LocalVideoTrack);
    const { result } = renderHook(() => useRoastMedia({ url: "wss://test.livekit.cloud", token: "performer-token", identity: "member-1" }));
    await waitFor(() => expect(result.current.connectionState).toBe(ConnectionState.Connected));
    const room = mocks.rooms[0] as TestRoom;
    await act(async () => { room.localParticipant.permissions = { canPublish: true, canPublishSources: [Track.sourceToProto(Track.Source.Camera), Track.sourceToProto(Track.Source.Microphone)] }; await result.current.prepare({ camera: true }); });
    expect(result.current.ready).toBe(true); expect(room.localParticipant.publishTrack).not.toHaveBeenCalled();
    await act(async () => { expect(result.current.acceptStage()).toBe(true); });
    await waitFor(() => expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(2));
    await act(async () => { room.localParticipant.permissions.canPublishSources = [Track.sourceToProto(Track.Source.Camera)]; room.emit(RoomEvent.ParticipantPermissionsChanged); });
    expect(room.localParticipant.unpublishTrack).toHaveBeenCalledWith(audio, false); expect(audio.stop).not.toHaveBeenCalled();
    await act(async () => { room.localParticipant.permissions.canPublishSources.push(Track.sourceToProto(Track.Source.Microphone)); room.emit(RoomEvent.ParticipantPermissionsChanged); });
    await waitFor(() => expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(3));
    expect(mocks.audio).toHaveBeenCalledTimes(1); expect(mocks.video).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.toggleMicrophone(); });
    expect(audio.mute).toHaveBeenCalledTimes(1);
    await act(async () => { room.emit(RoomEvent.ParticipantPermissionsChanged); });
    expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(3);
    expect(audio.unmute).not.toHaveBeenCalled();
  });

  it("stops private and published devices after removal without automatically acquiring replacements", async () => {
    const audio = testTrack(Track.Source.Microphone), video = testTrack(Track.Source.Camera);
    mocks.audio.mockResolvedValue(audio); mocks.video.mockResolvedValue(video);
    const { result } = renderHook(() => useRoastMedia({ url: "wss://test.livekit.cloud", token: "performer-token", identity: "member-1" }));
    await waitFor(() => expect(result.current.connectionState).toBe(ConnectionState.Connected));
    await act(async () => { await result.current.prepare({ camera: true }); });
    const room = mocks.rooms[0] as TestRoom;
    await act(async () => { room.state = "disconnected"; room.emit(RoomEvent.Disconnected, DisconnectReason.PARTICIPANT_REMOVED); });
    expect(audio.stop).toHaveBeenCalledTimes(1); expect(video.stop).toHaveBeenCalledTimes(1);
    expect(result.current.ready).toBe(false); expect(result.current.stageConsent).toBe(false); expect(result.current.error).toContain("removed");
    expect(mocks.audio).toHaveBeenCalledTimes(1); expect(mocks.video).toHaveBeenCalledTimes(1);
  });

  it("requires the user's own unmute after host muting and keeps a new device check private", async () => {
    const audio = testTrack(Track.Source.Microphone), replacement = testTrack(Track.Source.Microphone);
    mocks.audio.mockResolvedValueOnce(audio).mockResolvedValueOnce(replacement);
    const { result, rerender } = renderHook(({ hostMuted }) => useRoastMedia({ url: "wss://test.livekit.cloud", token: "performer-token", identity: "member-1", hostMuted }), { initialProps: { hostMuted: false } });
    await waitFor(() => expect(result.current.connectionState).toBe(ConnectionState.Connected));
    const room = mocks.rooms[0] as TestRoom;
    await act(async () => { room.localParticipant.permissions = { canPublish: true, canPublishSources: [Track.sourceToProto(Track.Source.Microphone)] }; await result.current.prepare(); result.current.acceptStage(); });
    await waitFor(() => expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(1));
    await act(async () => { rerender({ hostMuted: true }); });
    expect(result.current.microphoneEnabled).toBe(false); expect(audio.mute).toHaveBeenCalledTimes(1);
    await act(async () => { rerender({ hostMuted: false }); });
    expect(audio.unmute).not.toHaveBeenCalled(); expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.prepare(); });
    expect(result.current.stageConsent).toBe(false); expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(1);
    expect(replacement.stop).not.toHaveBeenCalled();
  });
});
