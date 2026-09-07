import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SayClip } from "@/lib/say-it-back/types";
import { DubPlayer, type DubPlayerHandle } from "./dub-player";

const clip: SayClip = {
  id: "scene", version: "v1", title: "A scene", description: "A short exchange", duration: 8,
  difficulty: "easy", rating: "everyone", category: "Film", tags: [], videoUrl: "/scene.mp4", posterUrl: "/scene.jpg",
  roles: [{ id: "lead", name: "Lead", description: "Your role", muteIntervals: [{ start: 1, end: 4 }], dubAudioUrl: "/background.m4a" }],
  cues: [{ id: "line", roleId: "lead", text: "Come back.", start: 1, end: 2 }],
  source: { title: "Scene", creator: "Creator", url: "https://example.test", license: "CC0", licenseUrl: "https://example.test", attribution: "Creator", reuseNote: "Reusable", excerptStart: 0, excerptEnd: 8 },
};
let frame: FrameRequestCallback;
let stopped: WeakMap<HTMLMediaElement, boolean>;

beforeEach(() => {
  stopped = new WeakMap();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(function (this: HTMLMediaElement) { return stopped.get(this) ?? true; });
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(4);
  vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(8);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) { stopped.set(this, false); return Promise.resolve(); });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) { stopped.set(this, true); });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("synchronized scene playback", () => {
  it("keeps the take offset through seek, comparison, and pause without changing playback speed", async () => {
    const { container } = render(<DubPlayer clip={clip} role={clip.roles[0]!} takeUrl="/private.wav" recordingOffsetMs={200} />);
    const video = container.querySelector("video")!;
    const [voice, background] = container.querySelectorAll("audio");
    fireEvent.loadedData(video);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });
    expect(voice!.currentTime).toBeCloseTo(3.2);
    expect(background!.currentTime).toBe(3);
    expect(video.muted).toBe(true);
    expect(voice!.playbackRate).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Original" }));
    act(() => frame(200));
    expect(video.currentTime).toBe(3);
    expect(video.muted).toBe(false);
    expect(voice!.muted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Your take" }));
    fireEvent.click(screen.getByRole("button", { name: "Play scene" }));
    await waitFor(() => expect(voice!.paused).toBe(false));
    fireEvent.pause(video);
    expect(voice!.paused).toBe(true);
    expect(background!.paused).toBe(true);
  });

  it("starts a negative-offset take only when its timeline begins", async () => {
    const { container } = render(<DubPlayer clip={clip} role={clip.roles[0]!} takeUrl="/private.wav" recordingOffsetMs={-200} />);
    const video = container.querySelector("video")!;
    const voice = container.querySelector("audio")!;
    fireEvent.loadedData(video);
    fireEvent.click(screen.getByRole("button", { name: "Play scene" }));
    await act(async () => { frame(100); });
    expect(voice.paused).toBe(true);
    video.currentTime = 0.4;
    await act(async () => { frame(200); });
    expect(voice.currentTime).toBeCloseTo(0.2);
    expect(voice.paused).toBe(false);
  });

  it("recovers expected audio-play aborts during replay and labels a friend's take distinctly", async () => {
    const interrupted = new WeakSet<HTMLMediaElement>();
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(function (this: HTMLMediaElement) {
      if (this.tagName === "AUDIO" && !interrupted.has(this)) {
        interrupted.add(this);
        stopped.set(this, true);
        return Promise.reject(new DOMException("Interrupted by seek", "AbortError"));
      }
      stopped.set(this, false);
      return Promise.resolve();
    });
    const { container } = render(<DubPlayer clip={clip} role={clip.roles[0]!} takeUrl="/private.wav" takeLabel="Friend’s take" />);
    const video = container.querySelector("video")!;
    const voice = container.querySelector("audio")!;
    fireEvent.loadedData(video);
    video.currentTime = clip.duration;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Play scene" })); });
    await act(async () => frame(100));
    expect(video.currentTime).toBe(0);
    expect(video.paused).toBe(false);
    expect(voice.paused).toBe(false);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Original" }));
    await act(async () => frame(200));
    expect(video.paused).toBe(true);
    expect(voice.paused).toBe(true);
    expect(voice.muted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Friend’s take" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Play scene" })); frame(300); });
    expect(video.paused).toBe(false);
    expect(voice.paused).toBe(false);
    expect(video.muted).toBe(true);
    expect(screen.queryByRole("button", { name: "Your take" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("refreshes a failed private source once, then waits for an explicit recovery request", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<DubPlayer clip={clip} role={clip.roles[0]!} takeUrl="/private.wav" onAudioError={refresh} />);
    const voice = container.querySelector("audio")!;
    fireEvent.error(voice);
    await waitFor(() => expect(HTMLMediaElement.prototype.load).toHaveBeenCalledOnce());
    fireEvent.error(voice);
    expect(refresh).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Reload recording" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  });

  it("retains the scene position for a refreshed source but resets a genuinely new take", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = render(<DubPlayer clip={clip} role={clip.roles[0]!} takeUrl="/private.wav?token=old" onAudioError={refresh} />);
    const video = container.querySelector("video")!;
    const voice = container.querySelector("audio")!;
    video.currentTime = 3;
    await act(async () => fireEvent.error(voice));
    rerender(<DubPlayer clip={clip} role={clip.roles[0]!} takeUrl="/private.wav?token=new" onAudioError={refresh} />);
    expect(video.currentTime).toBe(3);
    rerender(<DubPlayer clip={clip} role={clip.roles[0]!} takeUrl="blob:new-take" onAudioError={refresh} />);
    expect(video.currentTime).toBe(0);
  });

  it("stops a recording when scene buffering would break the timing relationship", () => {
    const interrupted = vi.fn();
    const { container } = render(<DubPlayer clip={clip} role={clip.roles[0]!} recording onInterruption={interrupted} />);
    fireEvent.waiting(container.querySelector("video")!);
    expect(interrupted).toHaveBeenCalledOnce();
  });

  it.each([0, 1])("pauses the scene when companion audio %s buffers, then resumes together", async (audioIndex) => {
    const { container } = render(<DubPlayer clip={clip} role={clip.roles[0]!} takeUrl="/private.wav" recordingOffsetMs={200} />);
    const video = container.querySelector("video")!;
    const [voice, background] = container.querySelectorAll("audio");
    fireEvent.loadedData(video);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play scene" })));
    video.currentTime = 2;
    fireEvent.waiting([voice!, background!][audioIndex]!);
    expect(video.paused).toBe(true);
    expect(voice!.paused).toBe(true);
    expect(background!.paused).toBe(true);
    expect(screen.getByLabelText("Loading scene")).toBeInTheDocument();
    await act(async () => fireEvent.canPlay([voice!, background!][audioIndex]!));
    expect(video.currentTime).toBe(2);
    expect(voice!.currentTime).toBeCloseTo(2.2);
    expect(background!.currentTime).toBe(2);
    expect(video.paused).toBe(false);
    expect(voice!.paused).toBe(false);
  });

  it("waits for every buffering track without a seek loop, then resumes automatically", async () => {
    const { container } = render(<DubPlayer clip={clip} role={clip.roles[0]!} takeUrl="/private.wav" />);
    const video = container.querySelector("video")!;
    const [voice, background] = container.querySelectorAll("audio");
    fireEvent.loadedData(video);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play scene" })));
    video.currentTime = 2;
    fireEvent.waiting(voice!);
    fireEvent.waiting(background!);
    await act(async () => fireEvent.canPlay(voice!));
    expect(video.paused).toBe(true);
    expect(screen.getByLabelText("Loading scene")).toBeInTheDocument();
    await act(async () => fireEvent.canPlay(background!));
    expect(screen.queryByLabelText("Loading scene")).not.toBeInTheDocument();
    expect(video.paused).toBe(false);
    expect(voice!.currentTime).toBe(2);
    expect(background!.currentTime).toBe(2);
  });

  it("does not repeatedly seek paused or already-seeking companion media", async () => {
    const { container } = render(<DubPlayer clip={clip} role={clip.roles[0]!} takeUrl="/private.wav" />);
    const video = container.querySelector("video")!;
    const voice = container.querySelector("audio")!;
    let voiceTime = 0;
    const seekVoice = vi.fn((value: number) => { voiceTime = value; });
    Object.defineProperty(voice, "currentTime", { configurable: true, get: () => voiceTime, set: seekVoice });
    fireEvent.loadedData(video);
    video.currentTime = 3;
    act(() => { frame(100); frame(200); });
    expect(seekVoice).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3.1" } });
    expect(seekVoice).toHaveBeenCalledOnce();
    Object.defineProperty(voice, "seeking", { configurable: true, value: true });
    video.currentTime = 4;
    fireEvent.seeked(video);
    act(() => frame(300));
    expect(seekVoice).toHaveBeenCalledOnce();
  });

  it("starts playable short audio at readyState 2 instead of freezing for a higher state", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(2);
    const { container } = render(<DubPlayer clip={clip} role={clip.roles[0]!} takeUrl="/private.wav" />);
    const video = container.querySelector("video")!;
    const voice = container.querySelector("audio")!;
    fireEvent.loadedData(video);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Play scene" })); fireEvent.playing(video); });
    expect(video.paused).toBe(false);
    expect(voice.paused).toBe(false);
    expect(screen.queryByLabelText("Loading scene")).not.toBeInTheDocument();
  });

  it("prepares and starts a later line without a replaced take pausing the new recording", async () => {
    const ref = React.createRef<DubPlayerHandle>();
    const { container, rerender } = render(<DubPlayer ref={ref} clip={clip} role={clip.roles[0]!} takeUrl="/previous.wav" />);
    const video = container.querySelector("video")!;
    fireEvent.loadedData(video);
    act(() => ref.current!.prepare(3));
    expect(video.currentTime).toBe(3);
    rerender(<DubPlayer ref={ref} clip={clip} role={clip.roles[0]!} takeUrl="/updated-previous.wav" countdown={0} />);
    let startedAt = 0;
    await act(async () => { startedAt = await ref.current!.startScene(); });
    expect(startedAt).toBe(3);
    expect(video.paused).toBe(false);
    video.currentTime = 3.2;
    rerender(<DubPlayer ref={ref} clip={clip} role={clip.roles[0]!} recording />);
    act(() => frame(100));
    expect(video.currentTime).toBe(3.2);
    expect(video.paused).toBe(false);
    expect(video.muted).toBe(true);
    act(() => ref.current!.pause());
    rerender(<DubPlayer ref={ref} clip={clip} role={clip.roles[0]!} takeUrl="/new.wav" />);
    expect(video.paused).toBe(true);
    expect(video.currentTime).toBe(0);
    expect(screen.getByRole("button", { name: "Your take" })).toHaveAttribute("aria-pressed", "true");
  });

  it("ignores a late playback failure from the old dub after a new recording starts", async () => {
    const ref = React.createRef<DubPlayerHandle>();
    const { container } = render(<DubPlayer ref={ref} clip={clip} role={clip.roles[0]!} takeUrl="/previous.wav" />);
    const video = container.querySelector("video")!;
    let rejectOldPlay: (cause: Error) => void = () => undefined;
    vi.mocked(video.play).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOldPlay = reject; }));
    fireEvent.loadedData(video);
    fireEvent.click(screen.getByRole("button", { name: "Play scene" }));
    await act(async () => { ref.current!.prepare(3); await ref.current!.startScene(); });
    await act(async () => rejectOldPlay(new Error("The previous source failed")));
    expect(video.paused).toBe(false);
    expect(video.currentTime).toBe(3);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("previews only the requested original line and stops at its end", async () => {
    const ref = React.createRef<DubPlayerHandle>();
    const { container } = render(<DubPlayer ref={ref} clip={clip} role={clip.roles[0]!} takeUrl="/private.wav" />);
    const video = container.querySelector("video")!;
    const voice = container.querySelector("audio")!;
    fireEvent.loadedData(video);
    await act(async () => ref.current!.previewRange(1, 2.5));
    act(() => frame(100));
    expect(video.currentTime).toBe(1);
    expect(video.paused).toBe(false);
    expect(video.muted).toBe(false);
    expect(voice.paused).toBe(true);
    video.currentTime = 2.5;
    act(() => frame(200));
    expect(video.paused).toBe(true);
  });

  it("enforces a recording range from media events without waiting for a rendered frame", async () => {
    const ref = React.createRef<DubPlayerHandle>();
    const ended = vi.fn();
    const time = vi.fn();
    const { container } = render(<DubPlayer ref={ref} clip={clip} role={clip.roles[0]!} onEnded={ended} onTime={time} />);
    const video = container.querySelector("video")!;
    await act(async () => { ref.current!.prepare(1, 2.375); await ref.current!.startScene(); });
    video.currentTime = 2.39;
    fireEvent.timeUpdate(video);
    expect(video.paused).toBe(true);
    expect(video.currentTime).toBe(2.375);
    expect(ended).toHaveBeenCalledOnce();
    expect(time).toHaveBeenLastCalledWith(2.375);
    fireEvent.timeUpdate(video);
    act(() => frame(100));
    expect(ended).toHaveBeenCalledOnce();
  });

  it("rechecks media time at a listen boundary when animation frames are unavailable", async () => {
    vi.useFakeTimers();
    const ref = React.createRef<DubPlayerHandle>();
    const { container } = render(<DubPlayer ref={ref} clip={clip} role={clip.roles[0]!} />);
    const video = container.querySelector("video")!;
    await act(async () => ref.current!.previewRange(1, 2.375));
    video.currentTime = 1.5;
    await act(async () => vi.advanceTimersByTimeAsync(1375));
    expect(video.paused).toBe(false); // A stalled media clock is not elapsed scene time.
    video.currentTime = 2.4;
    await act(async () => vi.advanceTimersByTimeAsync(875));
    expect(video.paused).toBe(true);
    expect(video.currentTime).toBe(2.375);
  });

  it("queues the first Listen before metadata and keeps its range through initial buffering", async () => {
    const ref = React.createRef<DubPlayerHandle>();
    const { container } = render(<DubPlayer ref={ref} clip={clip} role={clip.roles[0]!} />);
    const video = container.querySelector("video")!;
    let readyState = 0;
    let currentTime = 0;
    Object.defineProperty(video, "readyState", { configurable: true, get: () => readyState });
    Object.defineProperty(video, "currentTime", { configurable: true, get: () => currentTime, set: (value: number) => {
      if (!readyState) throw new DOMException("Metadata unavailable", "InvalidStateError");
      currentTime = value;
    } });
    let completePlay: () => void = () => undefined;
    vi.mocked(video.play).mockImplementationOnce(function (this: HTMLMediaElement) {
      stopped.set(this, false);
      return new Promise((resolve) => { completePlay = resolve; });
    });
    let preview: Promise<void> = Promise.resolve();
    act(() => { preview = ref.current!.previewRange(3, 4.5); });
    expect(video.play).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Loading scene")).toBeInTheDocument();
    fireEvent.waiting(video);
    expect(video.paused).toBe(false);
    readyState = 1;
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(3);
    readyState = 4;
    await act(async () => { fireEvent.canPlay(video); fireEvent.playing(video); completePlay(); await preview; });
    expect(screen.queryByLabelText("Loading scene")).not.toBeInTheDocument();
    expect(video.paused).toBe(false);
    video.currentTime = 4.5;
    act(() => frame(100));
    expect(video.paused).toBe(true);
  });

  it("bounds a stalled recording start and releases the player for another attempt", async () => {
    vi.useFakeTimers();
    const ref = React.createRef<DubPlayerHandle>();
    const { container } = render(<DubPlayer ref={ref} clip={clip} role={clip.roles[0]!} />);
    const video = container.querySelector("video")!;
    vi.mocked(video.play).mockImplementationOnce(() => new Promise(() => undefined));
    let failedStart: Promise<void>;
    await act(async () => {
      ref.current!.prepare();
      failedStart = expect(ref.current!.startScene()).rejects.toThrow("too long");
      await vi.advanceTimersByTimeAsync(8_000);
      await failedStart;
    });
    expect(video.paused).toBe(true);
    await act(async () => { ref.current!.prepare(1); await ref.current!.startScene(); });
    expect(video.currentTime).toBe(1);
    expect(video.paused).toBe(false);
  });

  it("clears buffering when ended and offers recovery after a real loading timeout", async () => {
    vi.useFakeTimers();
    const { container } = render(<DubPlayer clip={clip} role={clip.roles[0]!} takeUrl="/private.wav" />);
    const video = container.querySelector("video")!;
    const voice = container.querySelector("audio")!;
    fireEvent.loadedData(video);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play scene" })));
    fireEvent.waiting(voice);
    fireEvent.ended(video);
    expect(screen.queryByLabelText("Loading scene")).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play scene" })));
    fireEvent.waiting(voice);
    await act(async () => vi.advanceTimersByTimeAsync(8_000));
    expect(screen.queryByLabelText("Loading scene")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Tap play to retry");
  });

  it("does not start expired take audio again when resuming beyond its end", async () => {
    const { container } = render(<DubPlayer clip={clip} role={clip.roles[0]!} takeUrl="/private.wav" />);
    const video = container.querySelector("video")!;
    const voice = container.querySelector("audio")!;
    Object.defineProperty(voice, "duration", { configurable: true, value: 2 });
    fireEvent.loadedData(video);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "4" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play scene" })));
    expect(video.paused).toBe(false);
    expect(voice.paused).toBe(true);
  });
});

describe("individual dub replay", () => {
  it("starts the selected recorded line with its background, preserves offset and stops every track at the line end", async () => {
    const ref = React.createRef<DubPlayerHandle>();
    const { container } = render(<DubPlayer ref={ref} clip={clip} role={clip.roles[0]!} takeUrl="/private.wav" recordingOffsetMs={200} />);
    const video = container.querySelector("video")!;
    const [voice, background] = container.querySelectorAll("audio");
    fireEvent.loadedData(video);
    fireEvent.click(screen.getByRole("button", { name: "Original" }));
    await act(async () => { await ref.current!.previewRange(1, 4, "dub"); });
    expect(video.currentTime).toBe(1);
    expect(video.muted).toBe(true);
    expect(voice!.currentTime).toBeCloseTo(1.2);
    expect(voice!.paused).toBe(false);
    expect(voice!.muted).toBe(false);
    expect(background!.paused).toBe(false);
    expect(background!.currentTime).toBe(1);
    video.currentTime = 4.03;
    fireEvent.timeUpdate(video);
    expect(video.currentTime).toBe(4);
    expect(video.paused).toBe(true);
    expect(voice!.paused).toBe(true);
    expect(background!.paused).toBe(true);
    await act(async () => { await ref.current!.previewRange(1, 4); });
    expect(video.muted).toBe(false);
    expect(voice!.paused).toBe(true);
    expect(voice!.muted).toBe(true);
  });
});
