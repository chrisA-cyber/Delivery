import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/server/api-error";
import { validateAudio } from "@/lib/server/audio";

function webmFile(mime = "audio/webm") {
  const bytes = new Uint8Array(2_048);
  bytes.set([0x1a, 0x45, 0xdf, 0xa3]);
  return fileFromBytes(bytes, mime);
}

function fileFromBytes(bytes: Uint8Array, type: string): File {
  return {
    name: "take.webm",
    size: bytes.byteLength,
    type,
    arrayBuffer: async () => bytes.buffer.slice(0),
  } as unknown as File;
}

function pcmWav(samples: number[], sampleRate = 8_000): File {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
  return fileFromBytes(bytes, "audio/wav");
}

function constantBitrateMp3(frames: number): File {
  // MPEG-1 Layer III, 128 kbps, 44.1 kHz. Each frame is 417 bytes and
  // represents 1,152 samples (about 26.12ms).
  const frameBytes = 417;
  const bytes = new Uint8Array(frameBytes * frames);
  for (let frame = 0; frame < frames; frame += 1) {
    bytes.set([0xff, 0xfb, 0x90, 0x00], frame * frameBytes);
  }
  return fileFromBytes(bytes, "audio/mpeg");
}

describe("validateAudio", () => {
  it("accepts 45-second Say audio and measures over-limit content despite a shorter claim", async () => {
    const maxDurationMs = 45_000;
    const exact = pcmWav(Array(8_000 * 45).fill(1000));
    await expect(validateAudio(exact, maxDurationMs, { maxDurationMs })).resolves.toMatchObject({ durationMs: maxDurationMs });
    const over = pcmWav(Array(8_000 * 45 + 8).fill(1000));
    await expect(validateAudio(over, maxDurationMs, { maxDurationMs })).rejects.toMatchObject({ code: "AUDIO_DURATION_INVALID" });
    await expect(validateAudio(exact, maxDurationMs, { maxDurationMs: 20_000 })).rejects.toMatchObject({ code: "AUDIO_DURATION_INVALID" });
  });
  it("rejects an unparsed browser container instead of trusting its duration claim", async () => {
    await expect(validateAudio(webmFile(), 1_000)).rejects.toMatchObject({
      code: "AUDIO_FORMAT_UNSUPPORTED",
      status: 415,
    } satisfies Partial<AppError>);
  });

  it("rejects a MIME type that disagrees with the magic bytes", async () => {
    await expect(validateAudio(webmFile("audio/mp4"), 1_000)).rejects.toMatchObject({
      code: "AUDIO_TYPE_MISMATCH",
      status: 415,
    } satisfies Partial<AppError>);
  });

  it("rejects disguised non-audio data", async () => {
    const file = fileFromBytes(new Uint8Array(2_048), "audio/webm");
    await expect(validateAudio(file, 1_000)).rejects.toMatchObject({
      code: "AUDIO_SIGNATURE_INVALID",
      status: 415,
    } satisfies Partial<AppError>);
  });

  it("accepts an audible PCM WAV take", async () => {
    const samples = Array.from({ length: 8_000 }, (_, index) =>
      Math.round(Math.sin(index / 8) * 4_000),
    );
    await expect(validateAudio(pcmWav(samples), 1_000)).resolves.toMatchObject({
      container: "wav",
      durationMs: 1_000,
    });
  });

  it("rejects a valid but silent PCM WAV before judging", async () => {
    await expect(validateAudio(pcmWav(new Array(8_000).fill(0)), 1_000)).rejects.toMatchObject({
      code: "NO_SPEECH_DETECTED",
      status: 422,
    } satisfies Partial<AppError>);
  });

  it("rejects a WAV whose byte-rate header understates its decoded duration", async () => {
    const samples = Array.from({ length: 8_000 }, (_, index) =>
      Math.round(Math.sin(index / 8) * 4_000),
    );
    const forged = pcmWav(samples) as File & { arrayBuffer(): Promise<ArrayBuffer> };
    const bytes = new Uint8Array(await forged.arrayBuffer());
    new DataView(bytes.buffer).setUint32(28, 80_000, true);
    await expect(validateAudio(fileFromBytes(bytes, "audio/wav"), 100)).rejects.toMatchObject({
      code: "AUDIO_WAV_FORMAT_UNSUPPORTED",
      status: 415,
    } satisfies Partial<AppError>);
  });

  it("derives MP3 duration from frames instead of trusting the browser", async () => {
    await expect(validateAudio(constantBitrateMp3(39), 1_019)).resolves.toMatchObject({
      container: "mp3",
      durationMs: 1_019,
      approximateBitrateKbps: expect.closeTo(127.7, 0),
    });
  });

  it("rejects an MP3 whose claimed duration disagrees with its frames", async () => {
    await expect(validateAudio(constantBitrateMp3(39), 30_000)).rejects.toMatchObject({
      code: "AUDIO_DURATION_INVALID",
      status: 422,
    } satisfies Partial<AppError>);
  });

  it("rejects an MP3 longer than the server maximum despite a short claim", async () => {
    await expect(validateAudio(constantBitrateMp3(2_300), 60_000)).rejects.toMatchObject({
      code: "AUDIO_DURATION_INVALID",
      status: 422,
    } satisfies Partial<AppError>);
  });
});
