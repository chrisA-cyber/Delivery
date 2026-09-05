import { describe, expect, it } from "vitest";

import { encodeMonoWav, inspectTake } from "@/lib/audio-capture";
import { validateAudio } from "@/lib/server/audio";

async function capturedFile(frames: Float32Array[], sampleRate = 48_000) {
  const sampleCount = frames.reduce((sum, frame) => sum + frame.length, 0);
  const blob = encodeMonoWav(frames, sampleCount, sampleRate);
  // FileReader also works in the same jsdom environment as the recorder tests.
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
  const file = { name: "take.wav", size: blob.size, type: blob.type, arrayBuffer: async () => buffer } as File;
  return { file, buffer, local: inspectTake(frames, sampleCount, sampleRate), durationMs: Math.round(sampleCount / sampleRate * 1_000) };
}

describe("browser WAV compatibility with live audio validation", () => {
  it.each([
    [0.003, "quiet"],
    [0.05, "ready"],
    [1.5, "ready"],
  ] as const)("accepts amplitude %s through the real validator", async (amplitude, quality) => {
    const frames = [new Float32Array(16_000).fill(amplitude), new Float32Array(32_000).fill(-amplitude)];
    const take = await capturedFile(frames);
    expect(take.local).toMatchObject({ quality, canSubmit: true });
    await expect(validateAudio(take.file, take.durationMs)).resolves.toMatchObject({ container: "wav", durationMs: 1_000 });
  });

  it("clamps samples and encodes non-finite input as silence without corrupting WAV", async () => {
    const frames = [new Float32Array([2, -2, Number.NaN, Number.POSITIVE_INFINITY, 0])];
    const take = await capturedFile(frames);
    const data = new DataView(take.buffer);
    expect([0, 1, 2, 3, 4].map((index) => data.getInt16(44 + index * 2, true))).toEqual([32767, -32768, 0, 0, 0]);
    expect(data.getUint32(40, true)).toBe(10);
    expect(take.file.size).toBe(54);
  });

  it.each([0, 0.001, 0.002])("uses the server's silence threshold after PCM quantization: %s", async (amplitude) => {
    const take = await capturedFile([new Float32Array(48_000).fill(amplitude)]);
    expect(take.local).toMatchObject({ quality: "silent", canSubmit: false });
    await expect(validateAudio(take.file, take.durationMs)).rejects.toMatchObject({ code: "NO_SPEECH_DETECTED" });
  });

  it("agrees with the server at the minimum duration", async () => {
    const tooShort = await capturedFile([new Float32Array(11_999).fill(0.05)]);
    expect(tooShort.local.canSubmit).toBe(false);
    await expect(validateAudio(tooShort.file, tooShort.durationMs)).rejects.toMatchObject({ code: "AUDIO_DURATION_INVALID" });
    const minimum = await capturedFile([new Float32Array(12_000).fill(0.05)]);
    expect(minimum.local.canSubmit).toBe(true);
    await expect(validateAudio(minimum.file, minimum.durationMs)).resolves.toMatchObject({ durationMs: 250 });
  });
});
