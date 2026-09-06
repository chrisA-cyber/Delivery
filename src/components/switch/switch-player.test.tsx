import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SwitchChallenge } from "@/lib/switch/types";
import { SwitchPlayer, type SwitchPlayerHandle } from "./switch-player";

const challenge: SwitchChallenge = {
  id: "speed-switch", version: "saved-v1", title: "Excuse me?", description: "Same phrase, five speeds.",
  kind: "speed", duration: 20, difficulty: "easy", rating: "everyone", tags: ["speed"],
  scoringVersion: "switch-audio-v1-beta", rubricVersion: "switch-audio-v1.0",
  cues: ["🙂 Normal", "🐢 0.5x", "🦥 0.25x", "🏃 2x", "🚀 4x"].map((directionLabel, index) => ({
    id: `cue-${index}`, text: "Excuse me?", emoji: directionLabel.split(" ")[0]!, speed: [1, 0.5, 0.25, 2, 4][index], direction: directionLabel, directionLabel, start: index * 4, end: (index + 1) * 4,
  })),
};
let frame: FrameRequestCallback;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(20);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) { this.dispatchEvent(new Event("pause")); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Switch cues follow the saved take's media clock", () => {
  it("uses captured cue boundaries through scrubbing, native seeking, and feedback jumps without changing audio speed", () => {
    const ref = React.createRef<SwitchPlayerHandle>();
    const { container } = render(<SwitchPlayer ref={ref} challenge={challenge} audioUrl="/private-saved.wav" />);
    const audio = container.querySelector("audio")!;
    fireEvent.change(screen.getByRole("slider"), { target: { value: "8" } });
    expect(audio.currentTime).toBe(8);
    expect(screen.getByRole("heading", { name: "🦥 0.25x" })).toBeInTheDocument();
    audio.currentTime = 15.95;
    fireEvent.seeked(audio);
    expect(screen.getByRole("heading", { name: "🏃 2x" })).toBeInTheDocument();
    act(() => ref.current!.seek(16));
    expect(screen.getByRole("heading", { name: "🚀 4x" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Jump to 🐢 0.5x" }));
    expect(audio.currentTime).toBe(4);
    expect(screen.getByRole("heading", { name: "🐢 0.5x" })).toBeInTheDocument();
    expect(audio.playbackRate).toBe(1);
  });

  it("tracks playback and applies each broadcast replay revision only once", async () => {
    const { container, rerender } = render(<SwitchPlayer challenge={challenge} audioUrl="/private-saved.wav" externalCommand={{ revision: 1, command: "play" }} />);
    const audio = container.querySelector("audio")!;
    await act(async () => undefined);
    audio.currentTime = 12;
    act(() => frame(100));
    expect(screen.getByRole("heading", { name: "🏃 2x" })).toBeInTheDocument();
    await act(async () => rerender(<SwitchPlayer challenge={challenge} audioUrl="/private-saved.wav" externalCommand={{ revision: 2, command: "replay" }} />));
    expect(audio.currentTime).toBe(0);
    expect(screen.getByRole("heading", { name: "🙂 Normal" })).toBeInTheDocument();
    audio.currentTime = 4.5;
    fireEvent.timeUpdate(audio);
    await act(async () => rerender(<SwitchPlayer challenge={challenge} audioUrl="/private-saved.wav" externalCommand={{ revision: 2, command: "replay" }} />));
    expect(audio.currentTime).toBe(4.5);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    await act(async () => rerender(<SwitchPlayer challenge={challenge} audioUrl="/private-saved.wav" externalCommand={{ revision: 3, command: "pause" }} />));
    expect(screen.getByRole("button", { name: "Play take" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "🐢 0.5x" })).toBeInTheDocument();
    expect(audio.playbackRate).toBe(1);
  });
});
