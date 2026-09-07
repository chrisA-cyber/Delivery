import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClipPreview, type ClipEditorSource } from "./clip-preview";
import { defaultClipEditSettings, type ClipEditSettings } from "@/lib/video-composition";

vi.mock("@/components/providers/app-provider", () => ({ useApp: () => ({ reducedMotion: false }) }));
const source: ClipEditorSource = { recordingUrl: "/audio", recordingOffsetMs: 0, duration: 4, scene: { mode: "switch", duration: 4, switch: { id: "switch", version: "1", title: "Same line", description: "", kind: "speed", duration: 4, difficulty: "easy", rating: "everyone", tags: [], scoringVersion: "1", rubricVersion: "1", cues: [{ id: "first", text: "That was intentional.", emoji: "😐", speed: 1, direction: "normal", directionLabel: "Normal", start: 0, end: 1 }, { id: "second", text: "That was intentional.", emoji: "🐢", speed: 0.5, direction: "slow", directionLabel: "Slow", start: 1, end: 3 }, { id: "third", text: "That was intentional.", emoji: "⚡", speed: 2, direction: "fast", directionLabel: "Fast", start: 3, end: 4 }] } } };
const settings = { ...defaultClipEditSettings("switch"), trimStart: 1.2, trimEnd: 3.5 };
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ArrayBuffer(8))));
  const samples = new Float32Array(48_000 * 4);
  samples.fill(0.1, 48_000, 48_000 * 2);
  vi.stubGlobal("AudioContext", class {
    decodeAudioData = vi.fn().mockResolvedValue({ length: samples.length, sampleRate: 48_000, numberOfChannels: 1, getChannelData: () => samples });
    close = vi.fn().mockResolvedValue(undefined);
  });
  vi.stubGlobal("PointerEvent", class extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? "mouse"; }
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("original-clock composition preview", () => {
  it("starts on the trimmed Switch cue and measures talking and silence from the saved audio", async () => {
    const { container } = render(<ClipPreview source={source} settings={settings} onChange={vi.fn()} />);
    expect(screen.getByText("0.5×")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(container.querySelector("audio")!.currentTime).toBe(1.2);
    const ring = () => container.querySelector('.clip-artwork circle[fill="none"]');
    await waitFor(() => expect(ring()?.getAttribute("stroke-width")).not.toBe("1.80"));
    expect(ring()?.getAttribute("stroke-width")).toBe("4.54");
    const waveform = screen.getByLabelText("Recorded audio waveform");
    const bars = [...waveform.querySelectorAll("rect")];
    expect(bars.some((bar) => Number(bar.getAttribute("height")) > 10)).toBe(true);
    expect(bars.some((bar) => bar.getAttribute("height") === "2")).toBe(true);
    const speakingWave = waveform.innerHTML;
    fireEvent.change(screen.getByRole("slider", { name: "Clip playback position" }), { target: { value: "3.2" } });
    expect(screen.getByText("2×")).toBeInTheDocument();
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(ring()?.getAttribute("stroke-width")).toBe("1.80");
    expect(waveform.innerHTML).not.toBe(speakingWave);
    expect([...waveform.querySelectorAll("rect")].every((bar) => bar.getAttribute("height") === "2")).toBe(true);
    expect(container.querySelector("audio")!.playbackRate).toBe(1);
  });

  it.each(["mouse", "touch"])("moves the actual avatar frame with %s and keyboard input", async (pointerType) => {
    const onChange = vi.fn();
    render(<ClipPreview source={source} settings={settings} onChange={onChange} />);
    const preview = screen.getByLabelText("Editable clip preview");
    vi.spyOn(preview, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 270, bottom: 480, width: 270, height: 480, toJSON: () => ({}) });
    const avatar = screen.getByRole("button", { name: /Move avatar/ });
    fireEvent.pointerDown(avatar, { pointerId: 4, pointerType, clientX: 135, clientY: 150, button: 0 });
    fireEvent.pointerMove(avatar, { pointerId: 4, pointerType, clientX: 162, clientY: 198 });
    expect(onChange).toHaveBeenLastCalledWith({ avatarX: expect.closeTo(settings.avatarX + 0.1, 2), avatarY: expect.closeTo(settings.avatarY + 0.1, 2) });
    fireEvent.pointerUp(avatar, { pointerId: 4, pointerType });
    fireEvent.keyDown(avatar, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith({ avatarX: expect.closeTo(settings.avatarX - 0.01, 2), avatarY: expect.closeTo(settings.avatarY, 2) });
  });

  it("uses the normalized uploaded crop in the same nested avatar SVG as export", () => {
    const upload = { ...settings, avatar: { kind: "upload", dataUrl: "data:image/png;base64,YWJj" } } as ClipEditSettings;
    const { container } = render(<ClipPreview source={source} settings={upload} onChange={vi.fn()} />);
    const avatar = container.querySelector('image[clip-path]');
    expect(avatar).toHaveAttribute("href", upload.avatar.kind === "upload" ? upload.avatar.dataUrl : "");
    expect(avatar).toHaveAttribute("preserveAspectRatio", "xMidYMid slice");
    expect(container.querySelector("style")?.textContent).toContain(".clip-artwork > svg");
  });
});
