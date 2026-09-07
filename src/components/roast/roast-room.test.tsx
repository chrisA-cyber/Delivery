import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoastPublicMember, RoastRoomSnapshot } from "@/lib/roast/types";
import { RoastRoom } from "./roast-room";

// These are UI consent/permission tests, not actual media transport evidence.
const mocks = vi.hoisted(() => ({ room: null as RoastRoomSnapshot | null, joined: true, ready: false, act: vi.fn(), prepare: vi.fn(), acceptStage: vi.fn(), leaveStage: vi.fn(), stopPreview: vi.fn(), mediaOptions: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./use-roast-room", () => ({ useRoastRoom: () => ({ room: mocks.room, loading: false, error: "", busy: "", now: 1000, joined: mocks.joined, credentials: mocks.joined ? { url: "wss://fixture.invalid", token: "ui-fixture", identity: "me" } : null, mediaError: "", mediaLoading: false, refresh: vi.fn(), act: mocks.act, connectMedia: vi.fn(), setError: vi.fn() }) }));
vi.mock("./live-media", () => ({
  useRoastMedia: (options: unknown) => { mocks.mediaOptions(options); return { connectionState: "connected", localVideoTrack: null, stageConsent: false, ready: mocks.ready, prepare: mocks.prepare, acceptStage: mocks.acceptStage, leaveStage: mocks.leaveStage, stopPreview: mocks.stopPreview, microphoneEnabled: true, toggleMicrophone: vi.fn(), toggleCamera: vi.fn() }; },
  PerformerMedia: ({ name }: { name: string }) => <div>Fixture tile: {name}</div>,
  RoastMediaPreparation: () => <button onClick={mocks.prepare}>Fixture private microphone check</button>,
}));

function member(id: string, name: string): RoastPublicMember { return { id, name, role: "spectator", mediaConnected: true, cameraEnabled: false, muted: false, online: true }; }
function fixture(): RoastRoomSnapshot {
  return { id: "fixture-room", name: "UI fixture stage", visibility: "private", hostId: "host", revision: 1, serverNow: 1000, phase: "waiting", deadline: null,
    phaseLabel: "Waiting for challengers", activeSpeakerId: null, turnIndex: null, battleId: null, stage: [null, null], queue: [], offers: [], members: [member("host", "Fixture host"), member("me", "Fixture spectator")],
    viewer: { id: "me", isHost: false, signedIn: true, ready: false, adultAcknowledged: true, queuePosition: null, offer: null, canVote: false, vote: null, blockedIds: [], removed: false },
    memberCount: 2, spectatorCount: 2, capacity: 28, queueCapacity: 12, result: null, history: [], championId: null, streak: 0, chat: [], reactions: [], mediaHealthy: true, pauseReason: null, closedReason: null };
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("React", React);
  Element.prototype.scrollIntoView = vi.fn();
  mocks.room = fixture(); mocks.joined = true; mocks.ready = false;
  mocks.act.mockImplementation(async () => ({ room: mocks.room }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Roast Off participant consent", () => {
  it("lets a spectator enter with age acknowledgement without starting any devices", async () => {
    mocks.joined = false; mocks.room!.viewer.id = null; mocks.room!.viewer.adultAcknowledged = false;
    render(<RoastRoom id="fixture-room" />);
    const enter = screen.getByRole("button", { name: "Enter as a spectator" });
    expect(enter).toBeDisabled();
    expect(mocks.mediaOptions).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false, token: undefined }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(enter);
    await waitFor(() => expect(mocks.act).toHaveBeenCalledWith("join", { adult: true, name: undefined }));
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.acceptStage).not.toHaveBeenCalled();
  });

  it("requires both a private device check and explicit roast consent before queuing", async () => {
    const { rerender } = render(<RoastRoom id="fixture-room" />);
    fireEvent.click(screen.getByRole("button", { name: "Get in line" }));
    const queue = screen.getByRole("button", { name: "Join the challenger queue" });
    expect(queue).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(queue).toBeDisabled();
    mocks.ready = true; rerender(<RoastRoom id="fixture-room" />);
    fireEvent.click(queue);
    await waitFor(() => expect(mocks.act).toHaveBeenCalledWith("queue_join"));
    expect(mocks.act).toHaveBeenNthCalledWith(1, "ready", { adultAcknowledged: true, microphoneReady: true, cameraEnabled: false });
    expect(mocks.acceptStage).not.toHaveBeenCalled();
  });

  it("binds stage acceptance to the displayed invitation and never auto-accepts", async () => {
    mocks.ready = true;
    mocks.room!.viewer.offer = { memberId: "me", seat: 0, expiresAt: 21000 };
    mocks.room!.viewer.queuePosition = 1;
    render(<RoastRoom id="fixture-room" />);
    expect(mocks.acceptStage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Accept stage" }));
    expect(mocks.act).not.toHaveBeenCalledWith("offer_accept", expect.anything());
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Accept stage · 20s" }));
    await waitFor(() => expect(mocks.act).toHaveBeenCalledWith("offer_accept", { offerExpiresAt: 21000 }));
    expect(mocks.acceptStage).toHaveBeenCalledOnce();
  });

  it("shows the vote to eligible audience members and keeps performer voting disabled", async () => {
    mocks.room!.phase = "voting"; mocks.room!.deadline = 16000; mocks.room!.battleId = "fixture-battle";
    mocks.room!.stage = [member("first", "Fixture first"), member("second", "Fixture second")];
    mocks.room!.viewer.canVote = true;
    const { rerender } = render(<RoastRoom id="fixture-room" />);
    fireEvent.click(screen.getByRole("button", { name: "Fixture first" }));
    await waitFor(() => expect(mocks.act).toHaveBeenCalledWith("vote", { candidateId: "first" }));
    mocks.room!.viewer.id = "first"; mocks.room!.viewer.canVote = false;
    rerender(<RoastRoom id="fixture-room" />);
    expect(screen.getByRole("button", { name: "Fixture first" })).toBeDisabled();
    expect(screen.getByText(/Performers cannot vote in their own battle/)).toBeInTheDocument();
  });

  it("requires a fresh explicit device action when a performer refreshes", () => {
    mocks.room!.stage = [member("me", "Fixture performer"), null];
    render(<RoastRoom id="fixture-room" />);
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.acceptStage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enable my stage devices" }));
    expect(screen.getByRole("heading", { name: "Before you take the heat." })).toBeInTheDocument();
    expect(mocks.acceptStage).not.toHaveBeenCalled();
  });
});
