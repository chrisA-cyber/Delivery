import "server-only";

import { z } from "zod";

import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { EnvironmentError, getServerEnv } from "@/lib/server/env";
import type { DeliveryTranscription } from "@/lib/types";

const SCRIBE_ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";
const TRANSCRIPTION_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 256 * 1024;

const responseSchema = z.object({
  text: z.string().trim().max(2_000),
  language_code: z.string().max(20).optional(),
  language_probability: z.number().min(0).max(1).optional(),
  words: z.array(z.object({
    text: z.string().max(2_000),
    type: z.enum(["word", "spacing", "audio_event"]),
    start: z.number().finite().min(0).max(61).nullable().optional(),
    end: z.number().finite().min(0).max(61).nullable().optional(),
  })).max(2_000),
});

export function parseScribeTranscript(value: unknown, durationMs?: number): DeliveryTranscription {
  const result = responseSchema.safeParse(value);
  if (!result.success) {
    throw new AppError("TRANSCRIPTION_FORMAT_INVALID", "The transcript could not be read. Your take is safe; try judging again.", 502);
  }
  if (!result.data.text) {
    throw new AppError("NO_SPEECH_DETECTED", "The transcriber could not hear words in that take. Replay it and check your mic.", 422);
  }
  const wordEntries = result.data.words.filter((word) => word.type === "word" && word.text.trim());
  if (!wordEntries.length || wordEntries.some((word) =>
    typeof word.start !== "number" || typeof word.end !== "number" ||
    word.end < word.start || word.end > (durationMs ?? 60_000) / 1_000 + 1,
  )) {
    throw new AppError("TRANSCRIPTION_FORMAT_INVALID", "The word timings were incomplete. Your take is safe; try judging again.", 502);
  }
  return {
    text: result.data.text,
    provider: "elevenlabs",
    model: "scribe_v2",
    usedForAccuracy: false,
    words: wordEntries.map((word) => ({ text: word.text.trim(), start: word.start!, end: word.end! })),
    languageCode: result.data.language_code,
    languageProbability: result.data.language_probability,
  };
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("Missing transcription response body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES) throw new Error("Transcription response too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** Called only after the player submits a validated take, never during capture. */
export async function transcribeWithScribe(audio: File, durationMs?: number): Promise<DeliveryTranscription> {
  const env = getServerEnv();
  if (!env.ELEVENLABS_API_KEY) {
    throw new EnvironmentError("ELEVENLABS_API_KEY is required for Scribe transcription.", ["ELEVENLABS_API_KEY"]);
  }
  const form = new FormData();
  form.set("file", audio, audio.type.toLowerCase().includes("mp") ? "delivery-take.mp3" : "delivery-take.wav");
  form.set("model_id", "scribe_v2");
  form.set("timestamps_granularity", "word");
  form.set("tag_audio_events", "false");
  form.set("diarize", "false");
  // No target line, keyterms, instructions, identity, or public audio URL is sent.
  const endpoint = env.ELEVENLABS_ZERO_RETENTION
    ? `${SCRIBE_ENDPOINT}?enable_logging=false`
    : SCRIBE_ENDPOINT;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
      body: form,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      // Provider bodies may contain the transcript or account details. Do not log or echo them.
      if (response.status === 401 || response.status === 403) {
        throw new AppError("TRANSCRIPTION_NOT_CONFIGURED", "Transcription access needs attention. Your take is safe; try again after setup is corrected.", 503);
      }
      if (response.status === 429) {
        throw new AppError("TRANSCRIPTION_BUSY", "The transcriber is busy. Your take is safe; try judging again shortly.", 503);
      }
      throw new ExternalServiceError("ElevenLabs");
    }
    return parseScribeTranscript(await boundedJson(response), durationMs);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new ExternalServiceError("ElevenLabs", { cause: error });
  }
}
