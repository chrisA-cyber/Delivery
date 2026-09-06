import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SayClip } from "@/lib/say-it-back/types";
import { DubPlayer } from "./dub-player";

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
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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
    expect(screen.getByRole("alert")).toHaveTextContent("buffering");
    fireEvent.canPlay([voice!, background!][audioIndex]!);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play scene" })));
    expect(video.currentTime).toBe(2);
    expect(voice!.currentTime).toBeCloseTo(2.2);
    expect(background!.currentTime).toBe(2);
    expect(video.paused).toBe(false);
    expect(voice!.paused).toBe(false);
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
