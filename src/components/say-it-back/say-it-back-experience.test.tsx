import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "@/lib/say-it-back/catalog.json";
import { encodeMonoWav } from "@/lib/audio-capture";
import { SayItBackExperience } from "./say-it-back-experience";
import type { SayClip } from "@/lib/say-it-back/types";

const mocks = vi.hoisted(() => ({ reset: vi.fn(), refreshAccount: vi.fn(), push: vi.fn(), sceneStart: vi.fn(), prepare: vi.fn(), preview: vi.fn(), playerProps: {} as Record<string, unknown>, cancelCapture: vi.fn(), commitCapture: vi.fn(), authenticated: false, recorder: {} as Record<string, unknown> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/providers/app-provider", () => ({
  useApp: () => {
    const [contentRating, setContentRating] = React.useState("everyone");
    return { authenticated: mocks.authenticated, authReady: true, contentRating, tier: mocks.authenticated ? "free" : "guest",
      refreshAccount: mocks.refreshAccount,
      updatePreferences: ({ contentRating: next }: { contentRating: string }) => setContentRating(next) };
  },
}));
vi.mock("@/hooks/use-audio-recorder", () => ({ useAudioRecorder: () => ({ status: "idle", reset: mocks.reset, ...mocks.recorder }) }));
vi.mock("./take-waveform", () => ({ TakeWaveform: () => <div aria-label="Waveform comparison" /> }));
vi.mock("./dub-player", () => ({ DubPlayer: React.forwardRef(function FakePlayer(_props, ref) {
  mocks.playerProps = _props as Record<string, unknown>;
  React.useImperativeHandle(ref, () => ({ prepare: mocks.prepare, pause: vi.fn(), startScene: mocks.sceneStart, previewRange: mocks.preview }));
  return <div data-testid="scene-player" />;
}) }));

beforeEach(() => { vi.clearAllMocks(); Object.defineProperty(Element.prototype, "scrollIntoView", { value: vi.fn(), configurable: true }); mocks.authenticated = false; mocks.recorder = {}; vi.stubGlobal("React", React); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const cleanClip = catalog.find((item) => item.rating === "everyone")!;
function makeAttempt(overrides = {}) {
  return { id: "retained-guest-take", clip: cleanClip, roleId: cleanClip.roles[0]!.id, status: "ready", score: null,
    audioUrl: "/private-guest-audio", saved: false, owned: true, recordingOffsetMs: 23, ...overrides };
}
function ok(data: unknown) { return { ok: true, json: async () => ({ ok: true, data }) }; }

describe("keeping the first take through sign-in", () => {
  it("uploads an unscored take before header sign-in and carries its claim receipt", async () => {
    mocks.recorder = { audioBlob: new Blob(["test audio"]), audioUrl: "blob:local-take", canSubmit: true, durationMs: 1800 };
    const fetch = vi.fn(async (url: string) => url.includes("/clips") ? ok({ clips: [cleanClip] }) : ok({ attempt: makeAttempt() }));
    vi.stubGlobal("fetch", fetch);
    render(<><a href="/login?next=%2Fsay-it-back">Header sign in</a><SayItBackExperience initialClipId={cleanClip.id} /></>);
    await screen.findByRole("button", { name: "Sign in & keep this take" });
    fireEvent.click(screen.getByRole("link", { name: "Header sign in" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledOnce());
    const target = new URL(mocks.push.mock.calls[0]![0], "https://delivery.test");
    expect(target.searchParams.get("next")).toBe("/say-it-back?claim=retained-guest-take");
    expect(window.location.search).toBe("?attempt=retained-guest-take");
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/say-it-back/clips?maxRating=everyone", "/api/say-it-back/attempts"]);
  });

  it("keeps replay and stays on the scene when the upload before sign-in fails", async () => {
    mocks.recorder = { audioBlob: new Blob(["test audio"]), audioUrl: "blob:local-take", canSubmit: true, durationMs: 1800 };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/clips") ? ok({ clips: [cleanClip] }) : { ok: false, json: async () => ({ error: { message: "Upload interrupted. Try again." } }) }));
    render(<SayItBackExperience initialClipId={cleanClip.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in & keep this take" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload interrupted");
    expect(screen.getByRole("heading", { name: "Your dub is ready." })).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("saves a signed-in take to history without requesting a paid match", async () => {
    mocks.authenticated = true;
    mocks.recorder = { audioBlob: new Blob(["test audio"]), audioUrl: "blob:local-take", canSubmit: true, durationMs: 1800 };
    const fetch = vi.fn(async (url: string) => url.includes("/clips") ? ok({ clips: [cleanClip] }) : ok({ attempt: makeAttempt({ saved: true }) }));
    vi.stubGlobal("fetch", fetch);
    render(<SayItBackExperience initialClipId={cleanClip.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Save without scoring" }));
    expect(await screen.findByRole("link", { name: "Saved in your history" })).toHaveAttribute("href", "/profile");
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/say-it-back/clips?maxRating=everyone", "/api/say-it-back/attempts"]);
  });

  it("restores the guest attempt and its challenge together after sign-in", async () => {
    mocks.authenticated = true;
    const attempt = makeAttempt({ saved: true });
    const challenge = { token: "friend-token", challengerName: "Friend", clip: cleanClip, roleId: cleanClip.roles[0]!.id,
      challengerAttempt: { score: null, owned: false, audioUrl: "/private-friend-audio" }, recipientAttempts: [] };
    const fetch = vi.fn(async (url: string) => url.includes("/clips") ? ok({ clips: [cleanClip] }) : url.includes("/challenges/") ? ok({ challenge }) : ok({ attempt }));
    vi.stubGlobal("fetch", fetch);
    render(<SayItBackExperience initialClaimId={attempt.id} challengeToken={challenge.token} />);
    expect(await screen.findByRole("heading", { name: /Friend set the scene/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Saved in your history" })).toBeInTheDocument();
    expect(fetch.mock.calls.map(([url]) => url)).toContain("/api/say-it-back/attempts/retained-guest-take/claim");
    expect(fetch.mock.calls.map(([url]) => url)).toContain("/api/say-it-back/challenges/friend-token?maxRating=everyone");
  });

  it("lets a guest reopen the retained take after leaving sign-in unfinished", async () => {
    const fetch = vi.fn(async (url: string) => url.includes("/clips") ? ok({ clips: [cleanClip] }) : ok({ attempt: makeAttempt() }));
    vi.stubGlobal("fetch", fetch);
    render(<SayItBackExperience initialClaimId="retained-guest-take" />);
    expect(await screen.findByRole("button", { name: "Sign in & keep this take" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your guest take is still here");
    expect(fetch.mock.calls.map(([url]) => url)).toContain("/api/say-it-back/attempts/retained-guest-take");
    expect(fetch.mock.calls.some(([url]) => url.endsWith("/claim"))).toBe(false);
  });

  it("keeps the previous uploaded take when microphone permission is denied on retake", async () => {
    mocks.recorder = { requestPermission: vi.fn().mockResolvedValue(false), primeAudioContext: vi.fn(), cancelCapture: mocks.cancelCapture };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/clips") ? ok({ clips: [cleanClip] }) : ok({ attempt: makeAttempt() })));
    render(<SayItBackExperience initialAttemptId="retained-guest-take" />);
    await screen.findByRole("button", { name: "Record another take" });
    mocks.reset.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Record another take" }));
    fireEvent.click(screen.getByRole("button", { name: "Full scene" }));
    fireEvent.click(screen.getByRole("button", { name: "Record full scene" }));
    await waitFor(() => expect(mocks.cancelCapture).toHaveBeenCalledOnce());
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Your dub is ready." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in & keep this take" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/login?next=%2Fsay-it-back%3Fclaim%3Dretained-guest-take"));
  });

  it("keeps the previous take when a retake countdown is cancelled", async () => {
    mocks.recorder = { requestPermission: vi.fn().mockResolvedValue(true), primeAudioContext: vi.fn(), cancelCapture: mocks.cancelCapture };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/clips") ? ok({ clips: [cleanClip] }) : ok({ attempt: makeAttempt() })));
    Object.defineProperty(Element.prototype, "scrollIntoView", { value: vi.fn(), configurable: true });
    render(<SayItBackExperience initialAttemptId="retained-guest-take" />);
    fireEvent.click(await screen.findByRole("button", { name: "Record another take" }));
    fireEvent.click(screen.getByRole("button", { name: "Full scene" }));
    fireEvent.click(screen.getByRole("button", { name: "Record full scene" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel countdown" }));
    expect(mocks.cancelCapture).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Your previous take is unchanged");
    expect(screen.getByRole("heading", { name: "Your dub is ready." })).toBeInTheDocument();
  });

  it("discards an unsynchronized startup without pairing it with the previous take", async () => {
    const start = vi.fn().mockResolvedValue(true);
    mocks.sceneStart.mockResolvedValue(0.9);
    mocks.recorder = { requestPermission: vi.fn().mockResolvedValue(true), primeAudioContext: vi.fn(), start,
      getCapturePositionMs: () => 23, cancelCapture: mocks.cancelCapture, commitCapture: mocks.commitCapture };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/clips") ? ok({ clips: [cleanClip] }) : ok({ attempt: makeAttempt() })));
    Object.defineProperty(Element.prototype, "scrollIntoView", { value: vi.fn(), configurable: true });
    render(<SayItBackExperience initialAttemptId="retained-guest-take" />);
    await screen.findByRole("button", { name: "Record another take" });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Record another take" }));
    fireEvent.click(screen.getByRole("button", { name: "Full scene" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Record full scene" })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(start).toHaveBeenCalledWith({ preservePreviousTake: true });
    expect(mocks.cancelCapture).toHaveBeenCalledOnce();
    expect(mocks.commitCapture).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("took too long to start in sync");
    expect(screen.getByRole("heading", { name: "Your dub is ready." })).toBeInTheDocument();
    expect(window.location.search).toBe("?attempt=retained-guest-take");
  });
});

describe("challenge content preferences", () => {
  it("keeps a Spicy challenge closed for Clean and opens it when the player enables Spicy", async () => {
    vi.stubGlobal("React", React);
    const clip = catalog.find((item) => item.rating === "teen")!;
    const challenge = { token: "disposable-test", challengerName: "Friend", clip, roleId: clip.roles[0]!.id,
      challengerAttempt: { score: null, owned: false, audioUrl: "/private-test-audio" }, recipientAttempts: [] };
    const requestedRatings: (string | null)[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = new URL(input, "https://delivery.test");
      if (url.pathname.endsWith("/clips")) return { ok: true, json: async () => ({ ok: true, data: { clips: [] } }) };
      const rating = url.searchParams.get("maxRating");
      requestedRatings.push(rating);
      return rating === "teen"
        ? { ok: true, json: async () => ({ ok: true, data: { challenge } }) }
        : { ok: false, json: async () => ({ ok: false, error: { message: "Enable Spicy content to play this line, or choose a clean round." } }) };
    }));

    render(<SayItBackExperience challengeToken="disposable-test" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Enable Spicy content");
    expect(requestedRatings).toEqual(["everyone"]);
    expect(screen.queryByTestId("scene-player")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Spicy$/ }));
    await waitFor(() => expect(screen.getByTestId("scene-player")).toBeInTheDocument());
    expect(requestedRatings).toEqual(["everyone", "teen"]);
    expect(screen.getByRole("heading", { name: /Friend set the scene/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("line recording and responsive retakes", () => {
  it("previews a selected line and keeps each accepted line while redoing another", async () => {
    const clip = { ...cleanClip, duration: 4, cues: [
      { id: "one", roleId: cleanClip.roles[0]!.id, text: "First phrase.", start: 0.2, end: 1.5 },
      { id: "two", roleId: cleanClip.roles[0]!.id, text: "Second phrase.", start: 2.5, end: 3.8 },
    ] };
    vi.stubGlobal("fetch", vi.fn(async () => ok({ clips: [clip] })));
    const createUrl = vi.fn().mockReturnValueOnce("blob:line-one").mockReturnValueOnce("blob:both-lines").mockReturnValueOnce("blob:redone-line");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() }));
    const start = vi.fn(async () => { mocks.recorder.status = "recording"; mocks.recorder.audioBlob = null; return true; });
    const stop = vi.fn(() => {
      const samples = new Float32Array(48_000 * 2.1).fill(0.12);
      mocks.recorder.audioBlob = encodeMonoWav([samples], samples.length, 48_000);
      mocks.recorder.status = "stopped";
    });
    mocks.recorder = { status: "ready", requestPermission: vi.fn().mockResolvedValue(true), primeAudioContext: vi.fn(), start, stop,
      getCapturePositionMs: () => 20, cancelCapture: mocks.cancelCapture, commitCapture: mocks.commitCapture, canSubmit: true, durationMs: 2100 };
    mocks.sceneStart.mockImplementation(async () => mocks.prepare.mock.lastCall?.[0] ?? 0);
    render(<SayItBackExperience initialClipId={clip.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Listen to original line 2" }));
    expect(mocks.preview).toHaveBeenCalledWith(2, 4);
    const record = async (name: string, end: number) => {
      vi.useFakeTimers();
      await act(async () => { fireEvent.click(screen.getByRole("button", { name })); });
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
      expect(mocks.playerProps.recording).toBe(true);
      vi.useRealTimers();
      expect(mocks.prepare.mock.lastCall?.[1]).toBe(end);
      await act(async () => { (mocks.playerProps.onEnded as () => void)(); });
      await waitFor(() => expect(screen.queryByText("Preparing your local preview…")).not.toBeInTheDocument());
    };
    await record("Record line 1", 2);
    expect(await screen.findByRole("button", { name: "Redo line 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Match these 1 of 2 lines" })).toBeEnabled();
    expect(screen.getByText(/Unrecorded lines stay silent and count as missing words/)).toBeInTheDocument();
    expect(mocks.playerProps.takeUrl).toBe("blob:line-one");
    await record("Record line 2", 4);
    expect(await screen.findByRole("button", { name: "Redo line 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get my match" })).toBeEnabled();
    await record("Redo line 1", 2);
    expect(screen.getByRole("button", { name: "Redo line 2" })).toBeInTheDocument();
    expect(mocks.playerProps.takeUrl).toBe("blob:redone-line");
    expect(mocks.playerProps.recordingOffsetMs).toBe(0);
    expect(mocks.commitCapture).toHaveBeenCalledTimes(3);
  });

  it("opens the recorder during a pending match and ignores the old result", async () => {
    let finishJudge!: (value: unknown) => void;
    const fetch = vi.fn(async (url: string) => url.endsWith("/judge") ? await new Promise((resolve) => { finishJudge = resolve; }) : url.includes("/clips") ? ok({ clips: [cleanClip] }) : ok({ attempt: makeAttempt() }));
    vi.stubGlobal("fetch", fetch);
    render(<SayItBackExperience initialAttemptId="retained-guest-take" />);
    fireEvent.click(await screen.findByRole("button", { name: "Get my match" }));
    expect(await screen.findByRole("button", { name: /Checking your match/ })).toBeDisabled();
    const retake = screen.getByRole("button", { name: "Record another take" });
    expect(retake).toBeEnabled();
    fireEvent.click(retake);
    expect(screen.getByRole("button", { name: "Record line 1" })).toBeEnabled();
    await act(async () => { finishJudge(ok({ attempt: makeAttempt({ status: "scored", score: { overall: 99 } }) })); });
    expect(screen.queryByRole("region", { name: "Your matching result" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record line 1" })).toBeEnabled();
  });
});

describe("round recording handoff", () => {
  const roundContext = { token: "group-token", clip: cleanClip as unknown as SayClip, roleId: cleanClip.roles[0]!.id, returnPath: "/rounds/group-token" };

  it("keeps the immutable assignment and hands off an unscored private take for consent", async () => {
    mocks.recorder = { audioBlob: new Blob(["test audio"]), audioUrl: "blob:local-take", canSubmit: true, durationMs: 1800 };
    const fetch = vi.fn(async (url: string) => url.includes("/clips") ? ok({ clips: [] }) : ok({ attempt: makeAttempt() }));
    vi.stubGlobal("fetch", fetch);
    render(<SayItBackExperience roundContext={roundContext} />);
    fireEvent.click(await screen.findByRole("button", { name: "Use this take in round" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/rounds/group-token?attempt=retained-guest-take"));
    expect(window.location.pathname).toBe("/rounds/group-token/record");
    expect(screen.queryByRole("combobox", { name: "Choose your role" })).not.toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => url.endsWith("/judge"))).toBe(false);
    expect(fetch.mock.calls.some(([url]) => url.endsWith("/submit"))).toBe(false);
  });

  it("retains the guest claim and round route through sign-in", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/clips") ? ok({ clips: [] }) : ok({ attempt: makeAttempt() })));
    render(<SayItBackExperience roundContext={roundContext} initialAttemptId="retained-guest-take" />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in & keep this take" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledOnce());
    expect(new URL(mocks.push.mock.calls[0]![0], "https://delivery.test").searchParams.get("next")).toBe("/rounds/group-token/record?claim=retained-guest-take");
  });

  it("does not load another assignment's take into a group editor", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/clips") ? ok({ clips: [] }) : ok({ attempt: makeAttempt({ roleId: "different-role" }) })));
    render(<SayItBackExperience roundContext={roundContext} initialAttemptId="different-assignment" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("another assignment");
    expect(screen.queryByTestId("scene-player")).not.toBeInTheDocument();
  });
});
