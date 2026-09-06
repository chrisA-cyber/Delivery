import "server-only";

import { createHash } from "node:crypto";

import { AppError } from "@/lib/server/api-error";

export type AudioContainer = "webm" | "ogg" | "mp3" | "mp4" | "wav";

export interface ValidatedAudio {
  container: AudioContainer;
  durationMs: number;
  approximateBitrateKbps: number;
  contentHash: string;
}

interface WavInfo {
  audioFormat: number;
  bitsPerSample: number;
  blockAlign: number;
  byteRate: number;
  channels: number;
  sampleRate: number;
  dataOffset: number;
  dataSize: number;
}

interface Mp3Info {
  audioBytes: number;
  durationMs: number;
  frames: number;
}

const containerMimes: Record<AudioContainer, ReadonlySet<string>> = {
  webm: new Set(["audio/webm", "video/webm"]),
  ogg: new Set(["audio/ogg", "application/ogg"]),
  mp3: new Set(["audio/mpeg", "audio/mp3"]),
  mp4: new Set(["audio/mp4", "audio/x-m4a", "video/mp4"]),
  wav: new Set(["audio/wav", "audio/wave", "audio/x-wav"]),
};

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function detectContainer(bytes: Uint8Array): AudioContainer | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return "webm";
  }
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS") return "ogg";
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WAVE"
  ) {
    return "wav";
  }
  if (
    bytes.length >= 3 &&
    (ascii(bytes, 0, 3) === "ID3" ||
      (bytes[0] === 0xff && bytes[1] !== undefined && (bytes[1] & 0xe0) === 0xe0))
  ) {
    return "mp3";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") return "mp4";
  return null;
}

function parseWav(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format: Omit<WavInfo, "dataOffset" | "dataSize"> | null = null;
  let data: Pick<WavInfo, "dataOffset" | "dataSize"> | null = null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (size > bytes.length - chunkStart) return null;
    if (chunk === "fmt " && size >= 16) {
      format = {
        audioFormat: view.getUint16(chunkStart, true),
        channels: view.getUint16(chunkStart + 2, true),
        sampleRate: view.getUint32(chunkStart + 4, true),
        byteRate: view.getUint32(chunkStart + 8, true),
        blockAlign: view.getUint16(chunkStart + 12, true),
        bitsPerSample: view.getUint16(chunkStart + 14, true),
      };
    } else if (chunk === "data") {
      data = { dataOffset: chunkStart, dataSize: size };
    }
    if (format && data) return { ...format, ...data };
    offset = chunkStart + size + (size % 2);
  }
  return null;
}

const MPEG1_BITRATES = {
  1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
} as const;

const MPEG2_BITRATES = {
  1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
} as const;

function id3v2End(bytes: Uint8Array): number | null {
  if (bytes.length < 10 || ascii(bytes, 0, 3) !== "ID3") return 0;
  const sizeBytes = [bytes[6], bytes[7], bytes[8], bytes[9]];
  if (sizeBytes.some((value) => value === undefined || (value & 0x80) !== 0)) return null;
  const size =
    (sizeBytes[0]! << 21) |
    (sizeBytes[1]! << 14) |
    (sizeBytes[2]! << 7) |
    sizeBytes[3]!;
  const footer = (bytes[5]! & 0x10) !== 0 ? 10 : 0;
  const end = 10 + size + footer;
  return end <= bytes.length ? end : null;
}

function mp3Frame(
  bytes: Uint8Array,
  offset: number,
): { bytes: number; durationMs: number } | null {
  if (offset + 4 > bytes.length) return null;
  const header =
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>> 0;
  if ((header >>> 21) !== 0x7ff) return null;
  const versionBits = (header >>> 19) & 0x3;
  const layerBits = (header >>> 17) & 0x3;
  const bitrateIndex = (header >>> 12) & 0xf;
  const sampleRateIndex = (header >>> 10) & 0x3;
  const padding = (header >>> 9) & 0x1;
  if (
    versionBits === 1 ||
    layerBits === 0 ||
    bitrateIndex === 0 ||
    bitrateIndex === 15 ||
    sampleRateIndex === 3
  ) {
    return null;
  }

  const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 2.5;
  const layer = layerBits === 3 ? 1 : layerBits === 2 ? 2 : 3;
  const sampleRates =
    version === 1
      ? [44_100, 48_000, 32_000]
      : version === 2
        ? [22_050, 24_000, 16_000]
        : [11_025, 12_000, 8_000];
  const sampleRate = sampleRates[sampleRateIndex]!;
  const table = version === 1 ? MPEG1_BITRATES : MPEG2_BITRATES;
  const bitrateKbps = table[layer][bitrateIndex];
  if (!bitrateKbps) return null;

  const samplesPerFrame = layer === 1 ? 384 : layer === 2 || version === 1 ? 1_152 : 576;
  const frameBytes =
    layer === 1
      ? Math.floor((12 * bitrateKbps * 1_000) / sampleRate + padding) * 4
      : Math.floor(
          ((layer === 3 && version !== 1 ? 72 : 144) * bitrateKbps * 1_000) /
            sampleRate +
            padding,
        );
  if (frameBytes < 4 || offset + frameBytes > bytes.length) return null;
  return { bytes: frameBytes, durationMs: (samplesPerFrame / sampleRate) * 1_000 };
}

function parseMp3(bytes: Uint8Array): Mp3Info | null {
  const firstFrame = id3v2End(bytes);
  if (firstFrame === null) return null;
  let offset = firstFrame;
  let frames = 0;
  let audioBytes = 0;
  let durationMs = 0;

  while (offset + 4 <= bytes.length) {
    // ID3v1 is a fixed 128-byte tail and is not audio duration.
    if (bytes.length - offset === 128 && ascii(bytes, offset, 3) === "TAG") {
      offset = bytes.length;
      break;
    }
    const frame = mp3Frame(bytes, offset);
    if (!frame) return null;
    frames += 1;
    audioBytes += frame.bytes;
    durationMs += frame.durationMs;
    offset += frame.bytes;
  }

  // A compliant 250ms minimum take has several frames. Requiring two also
  // prevents a header-shaped four-byte upload from being accepted as audio.
  if (frames < 2 || offset !== bytes.length || !Number.isFinite(durationMs)) return null;
  return { audioBytes, durationMs, frames };
}

function wavSample(view: DataView, offset: number, format: WavInfo): number {
  if (format.audioFormat === 3 && format.bitsPerSample === 32) {
    return view.getFloat32(offset, true);
  }
  if (format.audioFormat === 3 && format.bitsPerSample === 64) {
    return view.getFloat64(offset, true);
  }
  if (format.bitsPerSample === 8) return (view.getUint8(offset) - 128) / 128;
  if (format.bitsPerSample === 16) return view.getInt16(offset, true) / 0x8000;
  if (format.bitsPerSample === 24) {
    let value =
      view.getUint8(offset) |
      (view.getUint8(offset + 1) << 8) |
      (view.getUint8(offset + 2) << 16);
    if (value & 0x800000) value |= 0xff000000;
    return value / 0x800000;
  }
  return view.getInt32(offset, true) / 0x80000000;
}

function assertAudibleWav(bytes: Uint8Array, wav: WavInfo): void {
  const supportedPcm =
    wav.audioFormat === 1 && [8, 16, 24, 32].includes(wav.bitsPerSample);
  const supportedFloat =
    wav.audioFormat === 3 && [32, 64].includes(wav.bitsPerSample);
  const bytesPerSample = wav.bitsPerSample / 8;
  if (
    (!supportedPcm && !supportedFloat) ||
    wav.channels < 1 ||
    wav.channels > 8 ||
    wav.sampleRate < 8_000 ||
    wav.sampleRate > 192_000 ||
    !Number.isInteger(bytesPerSample) ||
    wav.blockAlign !== wav.channels * bytesPerSample ||
    wav.byteRate !== wav.sampleRate * wav.blockAlign ||
    wav.dataSize < wav.blockAlign ||
    wav.dataSize % wav.blockAlign !== 0
  ) {
    throw new AppError(
      "AUDIO_WAV_FORMAT_UNSUPPORTED",
      "Use an uncompressed PCM WAV or MP3 recording for live judging.",
      415,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const frames = Math.floor(wav.dataSize / wav.blockAlign);
  const frameStep = Math.max(1, Math.floor(frames / 250_000));
  let squareSum = 0;
  let peak = 0;
  let samples = 0;
  for (let frame = 0; frame < frames; frame += frameStep) {
    const frameOffset = wav.dataOffset + frame * wav.blockAlign;
    for (let channel = 0; channel < wav.channels; channel += 1) {
      const sample = wavSample(
        view,
        frameOffset + channel * bytesPerSample,
        wav,
      );
      if (!Number.isFinite(sample)) continue;
      const amplitude = Math.min(1, Math.abs(sample));
      peak = Math.max(peak, amplitude);
      squareSum += amplitude * amplitude;
      samples += 1;
    }
  }
  const rms = Math.sqrt(squareSum / Math.max(1, samples));
  if (peak < 0.002 || rms < 0.0002) {
    throw new AppError(
      "NO_SPEECH_DETECTED",
      "That take is silent or too quiet to judge. Check your mic and try again.",
      422,
    );
  }
}

/** AC energy of PCM frames, shared by timing measurement without changing audio.
 * Returns null for compressed/unsupported data; never trusts a MIME extension.
 */
export function getWavEnergyFrames(bytes: Uint8Array): { rms: number[]; frameSeconds: number; durationSeconds: number } | null {
  if (bytes.length < 44 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") return null;
  const wav = parseWav(bytes);
  if (!wav || !((wav.audioFormat === 1 && [8, 16, 24, 32].includes(wav.bitsPerSample)) || (wav.audioFormat === 3 && [32, 64].includes(wav.bitsPerSample))) || wav.channels < 1 || wav.channels > 8 || wav.sampleRate < 8000 || wav.sampleRate > 192000 || wav.blockAlign !== wav.channels * wav.bitsPerSample / 8 || wav.dataSize % wav.blockAlign !== 0) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const totalFrames = wav.dataSize / wav.blockAlign;
  const windowFrames = Math.max(1, Math.round(wav.sampleRate * 0.01));
  const rms: number[] = [];
  for (let first = 0; first < totalFrames; first += windowFrames) {
    const count = Math.min(windowFrames, totalFrames - first);
    let channelEnergy = 0;
    for (let channel = 0; channel < wav.channels; channel++) {
      let sum = 0, squareSum = 0;
      for (let frame = first; frame < first + count; frame++) {
        const sample = wavSample(view, wav.dataOffset + frame * wav.blockAlign + channel * wav.bitsPerSample / 8, wav);
        if (!Number.isFinite(sample)) return null;
        sum += sample; squareSum += sample * sample;
      }
      // Removing each frame's DC offset prevents steady recorder bias from
      // being mistaken for an audible onset. Channel maximum avoids cancellation.
      channelEnergy = Math.max(channelEnergy, Math.sqrt(Math.max(0, squareSum / count - (sum / count) ** 2)));
    }
    rms.push(channelEnergy);
  }
  return { rms, frameSeconds: windowFrames / wav.sampleRate, durationSeconds: totalFrames / wav.sampleRate };
}

export async function validateAudio(
  file: File,
  claimedDurationMs: number,
): Promise<ValidatedAudio> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = bytes.subarray(0, Math.min(bytes.length, 256 * 1024));
  const container = detectContainer(header);
  if (!container) {
    throw new AppError(
      "AUDIO_SIGNATURE_INVALID",
      "That file does not contain a recognizable audio signature.",
      415,
    );
  }

  const mime = file.type.toLowerCase().split(";")[0] ?? "";
  if (!containerMimes[container].has(mime)) {
    throw new AppError(
      "AUDIO_TYPE_MISMATCH",
      "The recording format does not match its file signature.",
      415,
    );
  }

  // The live audio judge accepts WAV/MP3, and these are the two containers for
  // which this boundary derives duration from bytes. Never trust a claimed
  // duration for WebM, OGG, or MP4 uploads; the browser recorder emits WAV.
  if (container !== "wav" && container !== "mp3") {
    throw new AppError(
      "AUDIO_FORMAT_UNSUPPORTED",
      "Record this take as PCM WAV, or upload a valid MP3.",
      415,
      { accepted: ["audio/wav", "audio/mpeg"] },
    );
  }

  let parsedDurationMs = claimedDurationMs;
  let audioBytes = file.size;

  if (container === "mp3") {
    const mp3 = parseMp3(bytes);
    if (!mp3) {
      throw new AppError(
        "AUDIO_SIGNATURE_INVALID",
        "That MP3 file is incomplete or malformed.",
        415,
      );
    }
    parsedDurationMs = mp3.durationMs;
    audioBytes = mp3.audioBytes;
  }

  const approximateBitrateKbps = (audioBytes * 8) / parsedDurationMs;
  if (approximateBitrateKbps < 2 || approximateBitrateKbps > 2_500) {
    throw new AppError(
      "AUDIO_DURATION_INVALID",
      "The recording duration does not match the uploaded audio.",
      422,
    );
  }

  if (container === "wav") {
    const wav = parseWav(bytes);
    if (!wav || !wav.byteRate) {
      throw new AppError(
        "AUDIO_SIGNATURE_INVALID",
        "That WAV file is incomplete or malformed.",
        415,
      );
    }
    parsedDurationMs =
      (wav.dataSize / wav.blockAlign / wav.sampleRate) * 1_000;
    audioBytes = wav.dataSize;
    if (parsedDurationMs < 250 || parsedDurationMs > 60_000) {
      throw new AppError(
        "AUDIO_DURATION_INVALID",
        "Keep the recorded take between a quarter-second and 60 seconds.",
        422,
      );
    }
    if (
      Math.abs(parsedDurationMs - claimedDurationMs) > Math.max(1_500, parsedDurationMs * 0.2)
    ) {
      throw new AppError(
        "AUDIO_DURATION_INVALID",
        "The WAV duration does not match the recorded take.",
        422,
      );
    }
    assertAudibleWav(bytes, wav);
  }

  if (container === "mp3") {
    if (parsedDurationMs < 250 || parsedDurationMs > 60_000) {
      throw new AppError(
        "AUDIO_DURATION_INVALID",
        "Keep the recorded take between a quarter-second and 60 seconds.",
        422,
      );
    }
    if (
      Math.abs(parsedDurationMs - claimedDurationMs) > Math.max(1_500, parsedDurationMs * 0.2)
    ) {
      throw new AppError(
        "AUDIO_DURATION_INVALID",
        "The MP3 duration does not match the recorded take.",
        422,
      );
    }
  }

  return {
    container,
    durationMs: Math.round(parsedDurationMs),
    approximateBitrateKbps: (audioBytes * 8) / parsedDurationMs,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
  };
}
