import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SwitchAttempt, SwitchChallenge, SwitchScore } from "@/lib/switch/types";
import { SwitchExperience } from "./switch-experience";

const mocks = vi.hoisted(() => ({
  reset: vi.fn(), refreshAccount: vi.fn(), push: vi.fn(), cancelCapture: vi.fn(), commitCapture: vi.fn(),
  requestPermission: vi.fn(), primeAudioContext: vi.fn(), start: vi.fn(), stop: vi.fn(),
  recorder: {} as Record<string, unknown>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/providers/app-provider", () => ({ useApp: () => ({
  authenticated: true, authReady: true, contentRating: "everyone", refreshAccount: mocks.refreshAccount, updatePreferences: vi.fn(),
}) }));
vi.mock("@/hooks/use-audio-recorder", () => ({ useAudioRecorder: () => ({
  status: "idle", audioBlob: null, audioUrl: null, durationMs: 0, level: 0, waveform: [], quality: "empty", canSubmit: false,
  reset: mocks.reset, cancelCapture: mocks.cancelCapture, commitCapture: mocks.commitCapture,
  requestPermission: mocks.requestPermission, primeAudioContext: mocks.primeAudioContext, start: mocks.start, stop: mocks.stop,
  ...mocks.recorder,
}) }));

const challenge: SwitchChallenge = {
  id: "emotion-switch", version: "saved-v1", title: "I'm fine.", description: "One phrase, five emotions.",
  kind: "emotion", duration: 20, difficulty: "easy", rating: "everyone", tags: ["emotion"],
  scoringVersion: "switch-audio-v1-beta", rubricVersion: "switch-audio-v1.0",
  cues: ["😂 Laughing", "😡 Angry", "😢 Sad", "🤖 Robot", "👽 Alien"].map((directionLabel, index) => ({
    id: `cue-${index}`, text: "I'm fine.", emoji: directionLabel.split(" ")[0]!, direction: directionLabel, directionLabel, start: index * 4, end: (index + 1) * 4,
  })),
};
const score: SwitchScore = {
  version: challenge.scoringVersion, rubricVersion: challenge.rubricVersion, beta: true, ranked: false,
  overall: 80, words: 90, delivery: 75, transitions: 75, transcript: "I'm fine.",
  segments: challenge.cues.map((cue) => ({ cueId: cue.id, words: 90, delivery: 75, feedback: `Feedback for ${cue.directionLabel}` })),
  transitionFeedback: "The changes were clear.", coachNote: "Give the robot less inflection.", limitations: ["Timing is approximate."],
  evidence: { source: "audio", audioHash: "hash", model: "mock-audio", timing: "approximate", timingToleranceMs: 750, recordingOffsetMs: 0 },
};
function attempt(overrides: Partial<SwitchAttempt> = {}): SwitchAttempt {
  return { id: "saved-take", mode: "switch", challenge, status: "ready", score: null, audioUrl: "/private-saved.wav",
    audioExpiresAt: "2026-09-07T00:00:00Z", durationMs: 20_000, recordingOffsetMs: 0,
    scoringVersion: challenge.scoringVersion, createdAt: "2026-09-06T00:00:00Z", saved: true, owned: true, ...overrides };
}
function ok(data: unknown) { return { ok: true, json: async () => ({ ok: true, data }) }; }
function localTake(url = "blob:original-take") {
  return { status: "stopped", audioBlob: new Blob([url]), audioUrl: url, canSubmit: true, durationMs: 20_000, quality: "ready", stopReason: "limit" };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.recorder = {};
  mocks.requestPermission.mockResolvedValue(true);
  mocks.start.mockResolvedValue(true);
  Object.defineProperty(Element.prototype, "scrollIntoView", { value: vi.fn(), configurable: true });
  vi.stubGlobal("React", React);
  vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(20);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Switch take recovery and immutable playback", () => {
  it("shows one phrase card and quick-picks either mode without choosing the phrase again", async () => {
    const speedChallenge = { ...challenge, id: "speed-switch", title: "Speed: I'm fine", kind: "speed" as const };
    vi.stubGlobal("fetch", vi.fn(async () => ok({ challenges: [challenge, speedChallenge] })));
    render(<SwitchExperience />);
    await screen.findByRole("heading", { name: "Switch." });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("1 phrase");
    fireEvent.click(screen.getByRole("button", { name: "Speed: I'm fine." }));
    expect(within(screen.getByRole("region", { name: "Switch recording stage" })).getByText("“I'm fine.”")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Speed: I'm fine.", pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Emoji: I'm fine." }));
    expect(screen.getByRole("heading", { name: "Switch." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Emoji: I'm fine.", pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose another Switch" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("keeps mode selection out of fixed rounds and saved takes", async () => {
    const speedChallenge = { ...challenge, id: "speed-switch", kind: "speed" as const };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/catalog") ? ok({ challenges: [challenge, speedChallenge] }) : ok({ attempt: attempt() })));
    const view = render(<SwitchExperience roundContext={{ token: "fixed-round", returnPath: "/rounds/fixed-round", challenge }} />);
    await screen.findByRole("button", { name: "Record Switch" });
    expect(screen.queryByRole("group", { name: "How to play: I'm fine." })).not.toBeInTheDocument();
    view.unmount();
    render(<SwitchExperience initialAttemptId="saved-take" />);
    await screen.findByRole("button", { name: "Retry full take" });
    expect(screen.queryByRole("group", { name: "How to play: I'm fine." })).not.toBeInTheDocument();
    const stage = screen.getByRole("region", { name: "Switch recording stage" });
    expect(within(stage).getByRole("region", { name: "Your take with Switch cues" })).toBeInTheDocument();
    expect(screen.getAllByText("“I'm fine.”")).toHaveLength(1);
  });

  it("keeps the final cue visible while a paired take finishes", async () => {
    mocks.recorder = { status: "finalizing", durationMs: 20_000 };
    vi.stubGlobal("fetch", vi.fn(async () => ok({ challenges: [challenge] })));
    render(<SwitchExperience initialChallengeId={challenge.id} />);
    const stage = await screen.findByRole("region", { name: "Switch recording stage" });
    expect(within(stage).getByRole("heading", { name: "👽 Alien" })).toBeInTheDocument();
    expect(within(stage).getByText("Finishing…")).toBeInTheDocument();
    expect(within(stage).queryByRole("button", { name: "Stop early" })).not.toBeInTheDocument();
  });

  it.each(["denied", "cancelled"])("keeps a saved take available after a %s full-take retry", async (outcome) => {
    mocks.requestPermission.mockResolvedValue(outcome !== "denied");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/catalog") ? ok({ challenges: [challenge] }) : ok({ attempt: attempt() })));
    const { container } = render(<SwitchExperience initialAttemptId="saved-take" />);
    await screen.findByRole("button", { name: "Retry full take" });
    vi.useFakeTimers();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry full take" })));
    if (outcome === "cancelled") fireEvent.click(screen.getByRole("button", { name: "Cancel take" }));
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(mocks.cancelCapture).toHaveBeenCalledOnce();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(container.querySelector("audio")).toHaveAttribute("src", "/private-saved.wav");
    expect(screen.getByRole("button", { name: "Judge my Switch" })).toBeEnabled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Saved privately" })));
    expect(screen.getByRole("status")).toHaveTextContent("Saved privately");
  });

  it("reopens the saved snapshot and jumps from its segment feedback even when the current catalog changed", async () => {
    const editedCatalog = { ...challenge, version: "current-v2", cues: challenge.cues.map((cue) => ({ ...cue, directionLabel: "Different new direction" })) };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/catalog") ? ok({ challenges: [editedCatalog] }) : ok({ attempt: attempt({ status: "scored", score }) })));
    const { container } = render(<SwitchExperience initialAttemptId="saved-take" />);
    const result = await screen.findByRole("region", { name: "Your Switch result" });
    fireEvent.click(within(result).getByText("Hear each switch"));
    fireEvent.click(within(result).getByRole("button", { name: /Feedback for 🤖 Robot/ }));
    const player = screen.getByRole("region", { name: "Your take with Switch cues" });
    expect(within(player).getByRole("heading", { name: "🤖 Robot" })).toBeInTheDocument();
    expect(container.querySelector("audio")!.currentTime).toBe(12);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    expect(screen.queryByText("Different new direction")).not.toBeInTheDocument();
  });

  it("retains immediate replay and the same attempt key when an upload must be retried", async () => {
    mocks.recorder = localTake();
    const uploads: FormData[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/catalog")) return ok({ challenges: [challenge] });
      if (url === "/api/avatars") return ok({ avatar: { kind: "builtin", id: "fox" } });
      if (url.startsWith("blob:") || url.endsWith(".wav")) return new Response(null, { status: 404 });
      uploads.push(init!.body as FormData);
      if (uploads.length === 1) throw new Error("Upload interrupted. Retry this take.");
      return ok({ attempt: attempt() });
    }));
    const { container } = render(<SwitchExperience initialChallengeId={challenge.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Save take" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload interrupted");
    expect(container.querySelector("audio")).toHaveAttribute("src", "blob:original-take");
    fireEvent.click(screen.getByRole("button", { name: "Save take" }));
    await screen.findByRole("button", { name: "Saved privately" });
    expect(uploads).toHaveLength(2);
    expect(uploads[0]!.get("attemptId")).toBeTruthy();
    expect(uploads[1]!.get("attemptId")).toBe(uploads[0]!.get("attemptId"));
  });

  it("ignores a late judge result after retrying the full take and gives the new audio a new upload key", async () => {
    mocks.recorder = localTake();
    const uploads: FormData[] = [];
    let finishJudge!: (value: ReturnType<typeof ok>) => void;
    const oldJudge = new Promise<ReturnType<typeof ok>>((resolve) => { finishJudge = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/catalog")) return ok({ challenges: [challenge] });
      if (url === "/api/avatars") return ok({ avatar: { kind: "builtin", id: "fox" } });
      if (url.startsWith("blob:") || url.endsWith(".wav")) return new Response(null, { status: 404 });
      if (url.endsWith("/judge")) return oldJudge;
      uploads.push(init!.body as FormData);
      return ok({ attempt: attempt({ id: uploads.length === 1 ? "old-take" : "new-take" }) });
    }));
    const { container, rerender } = render(<SwitchExperience initialChallengeId={challenge.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Judge my Switch" }));
    await screen.findByRole("button", { name: "Listening to your switches…" });
    expect(screen.getByRole("button", { name: "Play take" })).toBeEnabled();
    vi.useFakeTimers();
    mocks.start.mockImplementation(async () => { mocks.recorder = { status: "recording", durationMs: 0, audioBlob: null, audioUrl: null }; return true; });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry full take" })));
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(mocks.start).toHaveBeenCalledWith({ preservePreviousTake: true, maxDurationMs: 20_000 });
    mocks.recorder = { ...mocks.recorder, durationMs: 12_000 };
    rerender(<SwitchExperience initialChallengeId={challenge.id} />);
    expect(within(screen.getByRole("region", { name: "Switch recording stage" })).getByRole("heading", { name: "🤖 Robot" })).toBeInTheDocument();
    mocks.recorder = localTake("blob:new-take");
    rerender(<SwitchExperience initialChallengeId={challenge.id} />);
    await act(async () => finishJudge(ok({ attempt: attempt({ id: "old-take", status: "scored", score }), usage: { remaining: 2 } })));
    expect(mocks.commitCapture).toHaveBeenCalledOnce();
    expect(container.querySelector("audio")).toHaveAttribute("src", "blob:new-take");
    expect(screen.queryByRole("region", { name: "Your Switch result" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Judge my Switch" })).toBeEnabled();
    expect(mocks.refreshAccount).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save take" })));
    expect(uploads).toHaveLength(2);
    expect(uploads[1]!.get("attemptId")).not.toBe(uploads[0]!.get("attemptId"));
  });
});
