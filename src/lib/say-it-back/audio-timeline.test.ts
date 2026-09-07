import { describe, expect, it } from "vitest";
import { encodeMonoWav } from "@/lib/audio-capture";
import { composeLineTakes, readPcmWav, waveformFromPcm } from "./audio-timeline";

function bytes(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}
function take(samples: Float32Array, sampleRate = 48_000) { return encodeMonoWav([samples], samples.length, sampleRate); }

function markedTake() {
  const samples = new Float32Array(48_000 * 2);
  // Technical startup: 0.2 s. Performance enters 0.4 s after scene playback begins.
  samples.fill(0.4, Math.round(48_000 * 0.6), Math.round(48_000 * 0.8));
  return take(samples);
}

describe("line capture assembly", () => {
  it("removes only measured startup and preserves a late performance on the scene timeline", async () => {
    const result = await composeLineTakes([{ blob: markedTake(), sceneStart: 2, sceneEnd: 4, recordingOffsetMs: 200 }], 4);
    const audio = readPcmWav(await bytes(result.blob))!;
    expect(audio.samples.length / audio.sampleRate).toBe(4);
    expect(audio.samples.slice(0, 2.399 * audio.sampleRate).every((sample) => sample === 0)).toBe(true);
    expect(audio.samples[Math.round(2.5 * audio.sampleRate)]).toBeCloseTo(0.4, 3);
    expect(audio.samples[Math.round(2.8 * audio.sampleRate)]).toBe(0);
    expect(result.canSubmit).toBe(true);
    expect(result.quality).toBe("ready");
    expect(result.waveform.find((point) => point.peak > 0)?.time).toBeCloseTo(2.4);
  });

  it("replaces one line without changing neighboring timing, including a different device sample rate", async () => {
    const first = take(new Float32Array(44_100).fill(0.1), 44_100);
    const redo = take(new Float32Array(48_000).fill(0.6));
    const initial = await composeLineTakes([
      { blob: first, sceneStart: 0, sceneEnd: 1, recordingOffsetMs: 0 },
      { blob: take(new Float32Array(48_000).fill(0.2)), sceneStart: 1, sceneEnd: 2, recordingOffsetMs: 0 },
    ], 2);
    const replacement = await composeLineTakes([
      { blob: first, sceneStart: 0, sceneEnd: 1, recordingOffsetMs: 0 },
      { blob: redo, sceneStart: 1, sceneEnd: 2, recordingOffsetMs: 0 },
    ], 2);
    const originalAudio = readPcmWav(await bytes(initial.blob))!.samples;
    const replacementAudio = readPcmWav(await bytes(replacement.blob))!.samples;
    expect(replacementAudio.slice(0, 48_000)).toEqual(originalAudio.slice(0, 48_000));
    expect(replacementAudio[72_000]).toBeCloseTo(0.6, 3);
    expect(replacementAudio[0]).toBe(0);
    expect(replacementAudio[47_999]).toBe(0);
    expect(replacementAudio[48_000]).toBe(0);
    expect(replacementAudio[95_999]).toBe(0);
  });

  it("pads measured late technical startup rather than moving the performance earlier", async () => {
    const result = await composeLineTakes([{ blob: take(new Float32Array(48_000).fill(0.2)), sceneStart: 0, sceneEnd: 1, recordingOffsetMs: -100 }], 1);
    const audio = readPcmWav(await bytes(result.blob))!;
    expect(audio.samples.slice(0, 4_800).every((sample) => sample === 0)).toBe(true);
    expect(audio.samples[9_600]).toBeCloseTo(0.2, 3);
    expect(audio.samples.every(Number.isFinite)).toBe(true);
  });

  it("does not qualify an empty or silent arrangement and rejects overlapping regions", async () => {
    const silence = take(new Float32Array(48_000));
    expect((await composeLineTakes([{ blob: silence, sceneStart: 0, sceneEnd: 1, recordingOffsetMs: 0 }], 1)).canSubmit).toBe(false);
    await expect(composeLineTakes([
      { blob: silence, sceneStart: 0, sceneEnd: 1, recordingOffsetMs: 0 },
      { blob: silence, sceneStart: 0.5, sceneEnd: 1.5, recordingOffsetMs: 0 },
    ], 2)).rejects.toThrow("overlap");
  });

  it("keeps a line at the end of a 45-second scene and rejects a longer scene", async () => {
    const lines = [{ blob: take(new Float32Array(48_000).fill(0.25)), sceneStart: 44, sceneEnd: 45, recordingOffsetMs: 0 }];
    const result = await composeLineTakes(lines, 45);
    const audio = readPcmWav(await bytes(result.blob))!;
    expect(result.durationMs).toBe(45_000);
    expect(audio.samples[48_000 * 43]).toBe(0);
    expect(audio.samples[48_000 * 44.5]).toBeCloseTo(0.25, 3);
    expect(result.canSubmit).toBe(true);
    await expect(composeLineTakes(lines, 45.001)).rejects.toThrow("duration limit");
  });

  it("measures peaks at their PCM time without inventing silence or amplifying quiet audio", () => {
    const samples = new Float32Array(4_800);
    samples[1_300] = 0.15;
    samples[2_500] = Number.NaN;
    const points = waveformFromPcm(samples, 48_000);
    expect(points).toHaveLength(4);
    expect(points[0]).toEqual({ time: 0, peak: 0 });
    expect(points[1]!.time).toBe(0.025);
    expect(points[1]!.peak).toBeCloseTo(0.15);
    expect(points[2]!.peak).toBe(0);
  });
});
