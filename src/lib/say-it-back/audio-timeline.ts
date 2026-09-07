import { encodeMonoWav, inspectTake, MAX_SAY_RECORDING_MS, type TakeQuality } from "@/lib/audio-capture";

/** A measured PCM peak, at a time in seconds. This is a visual aid, not a score. */
export interface WaveformPoint { time: number; peak: number }
export const WAVEFORM_BIN_SECONDS = 0.025;
export interface MonoAudio { samples: Float32Array; sampleRate: number }
export interface LineCapture {
  blob: Blob;
  /** The exact scene interval selected for capture, including room before/after dialogue. */
  sceneStart: number;
  sceneEnd: number;
  /** Captured audio time when sceneStart began playing. Technical startup only. */
  recordingOffsetMs: number;
}

export function waveformFromPcm(samples: Float32Array, sampleRate: number): WaveformPoint[] {
  const points: WaveformPoint[] = [];
  const width = Math.max(1, Math.ceil(sampleRate * WAVEFORM_BIN_SECONDS));
  for (let start = 0; start < samples.length; start += width) {
    let peak = 0;
    for (let i = start; i < Math.min(samples.length, start + width); i += 1) {
      if (Number.isFinite(samples[i])) peak = Math.max(peak, Math.min(1, Math.abs(samples[i]!)));
    }
    points.push({ time: start / sampleRate, peak });
  }
  return points;
}

/** Read the app's PCM WAV directly: no audio device/context is needed for line assembly. */
export function readPcmWav(buffer: ArrayBuffer): MonoAudio | null {
  if (buffer.byteLength < 44) return null;
  const view = new DataView(buffer);
  const text = (offset: number, length: number) => String.fromCharCode(...new Uint8Array(buffer, offset, length));
  if (text(0, 4) !== "RIFF" || text(8, 4) !== "WAVE") return null;
  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  let dataStart = 0;
  let dataLength = 0;
  for (let offset = 12; offset + 8 <= buffer.byteLength;) {
    const length = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + length > buffer.byteLength) return null;
    if (text(offset, 4) === "fmt " && length >= 16) {
      format = view.getUint16(start, true);
      channels = view.getUint16(start + 2, true);
      sampleRate = view.getUint32(start + 4, true);
      bits = view.getUint16(start + 14, true);
    } else if (text(offset, 4) === "data") {
      dataStart = start;
      dataLength = length;
    }
    offset = start + length + length % 2;
  }
  if (!dataStart || !channels || channels > 32 || sampleRate < 8_000 || sampleRate > 192_000 || !((format === 1 && bits === 16) || (format === 3 && bits === 32))) return null;
  const bytes = bits / 8;
  const count = Math.floor(dataLength / (bytes * channels));
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const offset = dataStart + (i * channels + channel) * bytes;
      const value = format === 1 ? view.getInt16(offset, true) / 0x8000 : view.getFloat32(offset, true);
      sum += Number.isFinite(value) ? value : 0;
    }
    samples[i] = Math.max(-1, Math.min(1, sum / channels));
  }
  return { samples, sampleRate };
}

async function blobBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("This browser could not read the recording. Your line takes are still here."));
    reader.readAsArrayBuffer(blob);
  });
}

async function decodeAudio(buffer: ArrayBuffer): Promise<MonoAudio> {
  const pcm = readPcmWav(buffer);
  if (pcm) return pcm;
  const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) throw new Error("Audio waveform preview is unavailable in this browser.");
  const context = new Context();
  try {
    const audio = await context.decodeAudioData(buffer);
    const samples = new Float32Array(audio.length);
    for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
      const source = audio.getChannelData(channel);
      for (let i = 0; i < samples.length; i += 1) samples[i] = samples[i]! + source[i]! / audio.numberOfChannels;
    }
    return { samples, sampleRate: audio.sampleRate };
  } finally { void context.close().catch(() => undefined); }
}

/** Personal waveforms are measured locally and never put in the reference cache. */
export async function measureTakeWaveform(buffer: ArrayBuffer, offsetMs = 0): Promise<WaveformPoint[]> {
  const audio = await decodeAudio(buffer);
  return waveformFromPcm(audio.samples, audio.sampleRate).map((point) => ({ ...point, time: point.time - offsetMs / 1000 }));
}

// Cache only small measured envelopes, never personal audio. Failed downloads can retry.
const referenceWaveforms = new Map<string, Promise<WaveformPoint[]>>();
export function loadReferenceWaveform(url: string): Promise<WaveformPoint[]> {
  const cached = referenceWaveforms.get(url);
  if (cached) return cached;
  const pending = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("The original waveform could not load. Recording is still available.");
      const audio = await decodeAudio(await response.arrayBuffer());
      return waveformFromPcm(audio.samples, audio.sampleRate);
    } finally { clearTimeout(timeout); }
  })();
  referenceWaveforms.set(url, pending);
  if (referenceWaveforms.size > 20) referenceWaveforms.delete(referenceWaveforms.keys().next().value!);
  void pending.catch(() => { if (referenceWaveforms.get(url) === pending) referenceWaveforms.delete(url); });
  return pending;
}

/**
 * Assemble explicitly selected line intervals at their original scene positions.
 * Removes measured capture startup only. Never detects/moves speech, changes the
 * reference intervals, or time-stretches the performance. Redoing a line replaces
 * that interval; neighboring recordings remain byte-for-byte equivalent in time.
 */
export async function composeLineTakes(lines: LineCapture[], duration: number): Promise<{ blob: Blob; waveform: WaveformPoint[]; durationMs: number; quality: TakeQuality; qualityMessage: string; canSubmit: boolean }> {
  if (!Number.isFinite(duration) || duration <= 0 || duration * 1_000 > MAX_SAY_RECORDING_MS) throw new Error("This scene is outside the recording duration limit.");
  const ordered = [...lines].sort((a, b) => a.sceneStart - b.sceneStart);
  for (let i = 0; i < ordered.length; i += 1) {
    const line = ordered[i]!;
    if (![line.sceneStart, line.sceneEnd, line.recordingOffsetMs].every(Number.isFinite)
      || line.sceneStart < 0 || line.sceneEnd <= line.sceneStart || line.sceneEnd > duration + 0.001
      || (i > 0 && line.sceneStart < ordered[i - 1]!.sceneEnd - 0.000001)) throw new Error("The line recording ranges overlap or are invalid. Your individual line takes are still here.");
  }
  const sampleRate = 48_000;
  const output = new Float32Array(Math.ceil(duration * sampleRate));
  for (const line of ordered) {
    const audio = await decodeAudio(await blobBytes(line.blob));
    const start = Math.round(line.sceneStart * sampleRate);
    const end = Math.min(output.length, Math.round(line.sceneEnd * sampleRate));
    const offset = line.recordingOffsetMs / 1_000 * audio.sampleRate;
    const available = Math.max(0, Math.floor((audio.samples.length - offset) * sampleRate / audio.sampleRate));
    const count = Math.min(end - start, available);
    // Four milliseconds avoids edge clicks without shifting any sample in time.
    const firstSample = Math.max(0, Math.ceil(-offset * sampleRate / audio.sampleRate));
    const fade = Math.max(0, Math.min(Math.round(sampleRate * 0.004), Math.floor((count - firstSample) / 2)));
    for (let i = 0; i < count; i += 1) {
      const position = offset + i * audio.sampleRate / sampleRate;
      if (position < 0) continue;
      const index = Math.floor(position);
      const fraction = position - index;
      const value = audio.samples[index]! * (1 - fraction) + (audio.samples[index + 1] ?? audio.samples[index]!) * fraction;
      const gain = fade ? Math.min(1, (i - firstSample) / fade, (count - 1 - i) / fade) : 1;
      output[start + i] = value * gain;
    }
  }
  const checked = inspectTake([output], output.length, sampleRate);
  return { blob: encodeMonoWav([output], output.length, sampleRate), waveform: waveformFromPcm(output, sampleRate), durationMs: Math.round(output.length / sampleRate * 1_000), quality: checked.quality, qualityMessage: checked.message, canSubmit: checked.canSubmit };
}
