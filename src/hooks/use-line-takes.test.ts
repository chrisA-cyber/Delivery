import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeMonoWav } from "@/lib/audio-capture";
import { composeLineTakes, readPcmWav } from "@/lib/say-it-back/audio-timeline";
import type { SayCue } from "@/lib/say-it-back/types";
import { lineRecordingWindows, useLineTakes } from "./use-line-takes";

vi.mock("@/lib/say-it-back/audio-timeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/say-it-back/audio-timeline")>();
  return { ...actual, composeLineTakes: vi.fn(actual.composeLineTakes) };
});

const compose = vi.mocked(composeLineTakes);
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

function bytes(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}
function audio(amplitude: number, seconds = 2) {
  const pcm = new Float32Array(Math.round(48_000 * seconds)).fill(amplitude);
  return encodeMonoWav([pcm], pcm.length, 48_000);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const cues: SayCue[] = [
  { id: "line-1", roleId: "player", text: "First phrase.", start: 0.5, end: 1.5 },
  { id: "line-2", roleId: "player", text: "Second phrase.", start: 2.5, end: 3.5 },
];
const firstLine = () => ({ cueId: "line-1", blob: audio(0.15), sceneStart: 0, sceneEnd: 2, recordingOffsetMs: 0 });
const secondLine = () => ({ cueId: "line-2", blob: audio(0.3), sceneStart: 2, sceneEnd: 4, recordingOffsetMs: 0 });

beforeEach(() => {
  compose.mockClear();
  let url = 0;
  createObjectURL = vi.fn(() => `blob:assembled-${++url}`);
  revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
});
afterEach(cleanup);

describe("accepted line takes", () => {
  it("keeps the playable arrangement while a redo is pending and after composition fails", async () => {
    const { result } = renderHook(() => useLineTakes());
    const first = firstLine();
    await act(async () => { expect(await result.current.accept(first, 4)).toBe(true); });
    const saved = result.current.take;
    const redo = deferred<Awaited<ReturnType<typeof composeLineTakes>>>();
    compose.mockReturnValueOnce(redo.promise);
    let pending!: Promise<unknown>;
    await act(async () => { pending = result.current.accept({ ...first, blob: audio(0.7) }, 4).catch((error: unknown) => error); });
    expect(result.current.assembling).toBe(true);
    expect(result.current.take).toBe(saved);
    expect(result.current.lines).toEqual([first]);
    await act(async () => { redo.reject(new Error("Could not decode this line")); await pending; });
    expect(result.current.assembling).toBe(false);
    expect(result.current.take).toBe(saved);
    expect(result.current.lines).toEqual([first]);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("redoes only the chosen line and releases the old assembled URL after success", async () => {
    const { result } = renderHook(() => useLineTakes());
    const first = firstLine();
    const second = secondLine();
    await act(async () => { await result.current.accept(first, 4); await result.current.accept(second, 4); });
    const original = readPcmWav(await bytes(result.current.take!.blob))!.samples;
    const oldUrl = result.current.take!.audioUrl;
    const replacement = { ...second, blob: audio(0.65) };
    await act(async () => { expect(await result.current.accept(replacement, 4)).toBe(true); });
    const redone = readPcmWav(await bytes(result.current.take!.blob))!.samples;
    expect(result.current.lines).toEqual([first, replacement]);
    expect(redone.slice(0, 96_000)).toEqual(original.slice(0, 96_000));
    expect(redone[144_000]).toBeCloseTo(0.65, 3);
    expect(revokeObjectURL).toHaveBeenCalledWith(oldUrl);
    expect(revokeObjectURL).not.toHaveBeenCalledWith(result.current.take!.audioUrl);
  });

  it("seeds a saved full take without losing untouched dialogue or its measured startup offset", async () => {
    const { result } = renderHook(() => useLineTakes());
    const pcm = new Float32Array(Math.round(4.1 * 48_000));
    pcm.fill(0.9, 0, 4_800); // Measured startup, not part of the scene.
    pcm.fill(0.2, 4_800, 100_800);
    pcm.fill(0.4, 100_800);
    const baseline = encodeMonoWav([pcm], pcm.length, 48_000);
    const windows = lineRecordingWindows(cues, 4);
    act(() => result.current.seed(baseline, windows, 100));
    expect(result.current.lines.map((line) => line.recordingOffsetMs)).toEqual([100, 2_100]);
    expect(result.current.lines.every((line) => line.blob === baseline)).toBe(true);
    expect(result.current.take).toBeNull(); // The owner continues playing the saved baseline until acceptance.
    act(() => result.current.seed(audio(0.95, 4), windows, 0));
    expect(result.current.lines[0]!.blob).toBe(baseline);
    await act(async () => { await result.current.accept({ ...secondLine(), blob: audio(0.7) }, 4); });
    const assembled = readPcmWav(await bytes(result.current.take!.blob))!.samples;
    expect(assembled[48_000]).toBeCloseTo(0.2, 3);
    expect(assembled[144_000]).toBeCloseTo(0.7, 3);
    expect(result.current.lines[0]!.blob).toBe(baseline);
    expect(assembled.some((sample) => sample > 0.8)).toBe(false);
  });

  it("invalidates an in-flight arrangement on reset without resurrecting its audio URL", async () => {
    const { result } = renderHook(() => useLineTakes());
    await act(async () => { await result.current.accept(firstLine(), 4); });
    const previous = result.current.take!;
    const held = deferred<Awaited<ReturnType<typeof composeLineTakes>>>();
    compose.mockReturnValueOnce(held.promise);
    let pending!: Promise<boolean>;
    await act(async () => { pending = result.current.accept(secondLine(), 4); });
    act(() => result.current.reset());
    expect(result.current.take).toBeNull();
    expect(result.current.lines).toEqual([]);
    expect(result.current.assembling).toBe(false);
    await act(async () => { held.resolve(previous); expect(await pending).toBe(false); });
    expect(result.current.take).toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(previous.audioUrl);
  });

  it("does not let superseded line composition overwrite the previous accepted take", async () => {
    const { result } = renderHook(() => useLineTakes());
    await act(async () => { await result.current.accept(firstLine(), 4); });
    const previous = result.current.take!;
    const obsolete = deferred<Awaited<ReturnType<typeof composeLineTakes>>>();
    const latest = deferred<Awaited<ReturnType<typeof composeLineTakes>>>();
    compose.mockReturnValueOnce(obsolete.promise).mockReturnValueOnce(latest.promise);
    let canceled!: Promise<boolean>;
    let active!: Promise<unknown>;
    await act(async () => {
      canceled = result.current.accept(secondLine(), 4);
      active = result.current.accept({ ...secondLine(), blob: audio(0.8) }, 4).catch((error: unknown) => error);
    });
    await act(async () => { latest.reject(new Error("Replacement failed")); await active; });
    await act(async () => { obsolete.resolve(previous); expect(await canceled).toBe(false); });
    expect(result.current.take).toBe(previous);
    expect(result.current.lines).toHaveLength(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});

describe("line recording windows", () => {
  it("keeps every complete phrase inside contiguous windows split halfway through its pauses", () => {
    const reversed = [...cues].reverse();
    const windows = lineRecordingWindows(reversed, 4);
    expect(windows.map(({ cue, start, end }) => [cue.id, start, end])).toEqual([["line-1", 0, 2], ["line-2", 2, 4]]);
    expect(windows.every((window) => window.start <= window.cue.start && window.end >= window.cue.end)).toBe(true);
    expect(reversed[0]!.id).toBe("line-2");
  });
});
