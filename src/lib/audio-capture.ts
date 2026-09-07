// Local upload guards. Classic is shorter than the server's compatibility
// allowance for historical audio containers.
export const MIN_RECORDING_MS = 250;
export const MAX_RECORDING_MS = 20_000;
export const MAX_SAY_RECORDING_MS = 45_000;
export const MAX_RECORDING_BYTES = 15 * 1024 * 1024;

export type TakeQuality = "empty" | "too-short" | "silent" | "quiet" | "ready";

function pcm16(sample: number): number {
  const bounded = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
  return Math.trunc(bounded * (bounded < 0 ? 0x8000 : 0x7fff));
}

export function encodeMonoWav(frames: Float32Array[], sampleCount: number, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * 2, true);
  let offset = 44;
  for (const frame of frames) {
    for (const sample of frame) {
      view.setInt16(offset, pcm16(sample), true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function inspectTake(frames: Float32Array[], sampleCount: number, sampleRate: number): {
  quality: TakeQuality;
  message: string;
  canSubmit: boolean;
} {
  if (sampleCount === 0) return { quality: "empty", message: "No audio arrived from the microphone. Check your input device and try again.", canSubmit: false };
  if (sampleCount / sampleRate * 1_000 < MIN_RECORDING_MS) return { quality: "too-short", message: "That take ended before a quarter-second. Record the full line before stopping.", canSubmit: false };
  let squareSum = 0;
  let peak = 0;
  for (const frame of frames) {
    for (const sample of frame) {
      // Inspect encoded PCM so the server agrees near its silence threshold.
      // This is an input check, never a speech or performance score.
      const amplitude = Math.abs(pcm16(sample) / 0x8000);
      peak = Math.max(peak, amplitude);
      squareSum += amplitude * amplitude;
    }
  }
  const rms = Math.sqrt(squareSum / sampleCount);
  if (peak < 0.002 || rms < 0.0002) return { quality: "silent", message: "There is too little sound to judge. Replay it, check your microphone, and record again.", canSubmit: false };
  if (rms < 0.01) return { quality: "quiet", message: "A quiet take is welcome. Replay it to check that every word is audible.", canSubmit: true };
  return { quality: "ready", message: "Your take is ready. Listen back or send it to the judge.", canSubmit: true };
}
