import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import type { SayTimingEvidence, SayWord } from "@/lib/say-it-back/types";
import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { EnvironmentError, getServerEnv } from "@/lib/server/env";
import { refineSayWordTiming } from "@/lib/server/say-it-back-timing";

const TRANSCRIPTION_TIMEOUT_MS = 45_000;
const responseSchema = z.object({
  text: z.string().trim().max(2_000),
  duration: z.number().finite().positive().max(61),
  words: z.array(z.object({
    word: z.string().max(2_000),
    start: z.number().finite().min(0),
    end: z.number().finite().min(0),
  })).max(1_000).optional(),
  segments: z.array(z.object({
    no_speech_prob: z.number().min(0).max(1),
    avg_logprob: z.number().finite(),
  }).passthrough()).max(1_000).optional(),
});

let client: OpenAI | undefined;

/** Live ASR only; invoke after validated audio and an acquired idempotency lease.
 * Official contract: https://developers.openai.com/api/docs/guides/speech-to-text
 * whisper-1 supports word/segment timestamps with verbose_json. No reference
 * prompt is supplied: reference words must never bias observed word accuracy.
 * Temperature 0 is requested, but provider fallback can still vary its transcript.
 * The persisted transcript, timestamps and audio hash are the scoring evidence.
 */
export async function transcribeSayAudio(audio: File): Promise<{ text: string; words: SayWord[]; rawWords: SayWord[]; timing: SayTimingEvidence }> {
  const { OPENAI_API_KEY } = getServerEnv();
  if (!OPENAI_API_KEY) throw new EnvironmentError("OPENAI_API_KEY is required for Say It Back transcription.", ["OPENAI_API_KEY"]);
  if (!audio.size || audio.size > 12 * 1024 * 1024) {
    throw new AppError("INVALID_AUDIO", "That recording is empty or too large. Record a fresh take.", 422);
  }
  client ??= new OpenAI({ apiKey: OPENAI_API_KEY, timeout: TRANSCRIPTION_TIMEOUT_MS, maxRetries: 0 });
  try {
    const response = await client.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      language: "en",
      temperature: 0,
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"],
    }, { timeout: TRANSCRIPTION_TIMEOUT_MS, maxRetries: 0 });
    const parsed = responseSchema.safeParse(response);
    if (!parsed.success) {
      throw new AppError("TRANSCRIPTION_FORMAT_INVALID", "The transcript could not be read. Your dub is safe; try scoring again.", 502);
    }
    const value = parsed.data;
    // Requiring BOTH strong no-speech probability and poor recognition avoids
    // rejecting a clear but quiet/deadpan voice on amplitude alone. PCM silence
    // rejection is already performed before this paid request by validateAudio.
    const noSpeech = value.segments?.length && value.segments.every((segment) => segment.no_speech_prob > 0.85 && segment.avg_logprob < -1);
    if (!/[\p{L}\p{N}]/u.test(value.text) || noSpeech) {
      throw new AppError("NO_SPEECH_DETECTED", "No clear dialogue was heard. Replay your dub, check your mic and try another take.", 422);
    }
    const words = (value.words ?? []).filter((word) => /[\p{L}\p{N}]/u.test(word.word));
    const validTimestamps = words.length > 0 && words.every((word, index) =>
      word.end >= word.start && word.end <= value.duration + 0.5 &&
      (index === 0 || word.start >= words[index - 1]!.start),
    );
    // Keep the ASR receipt unchanged, and verify boundaries against this capture
    // before scoring. Reference dialogue/timings never enter this measurement.
    const rawWords = validTimestamps ? words.map((word) => ({ text: word.word.trim(), start: word.start, end: word.end })) : [];
    const measured = refineSayWordTiming(new Uint8Array(await audio.arrayBuffer()), rawWords);
    return {
      text: value.text,
      words: measured.words,
      rawWords,
      timing: measured.timing,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Provider bodies can contain private dialogue. Never log/echo the response.
    if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) {
      throw new AppError("TRANSCRIPTION_NOT_CONFIGURED", "Scoring access needs attention. Your dub is safe; try again after setup is corrected.", 503);
    }
    if (error instanceof OpenAI.APIError && error.status === 429) {
      throw new AppError("TRANSCRIPTION_BUSY", "Scoring is busy. Your dub is safe; try scoring again shortly.", 503);
    }
    throw new ExternalServiceError("OpenAI", { cause: error });
  }
}
