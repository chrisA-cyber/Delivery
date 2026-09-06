import "server-only";

import { createHash } from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { EnvironmentError, getServerEnv } from "@/lib/server/env";
import { audioJudgeFormatForMime, transcriptAccuracy } from "@/lib/server/openai";
import { switchChallengeSchema } from "@/lib/switch/schema";
import { switchJudgeInstructions, switchOverall } from "@/lib/switch/rubric";
import { SWITCH_RUBRIC_VERSION, SWITCH_SCORING_VERSION, SWITCH_TIMING_TOLERANCE_MS, type SwitchChallenge, type SwitchScore } from "@/lib/switch/types";

const score = z.number().int().min(0).max(100).nullable();
const modelScoreSchema = z.object({
  speechDetected: z.boolean(),
  transcriptReliable: z.boolean(),
  transcript: z.string().trim().max(3_000),
  timingUncertain: z.boolean(),
  transitions: score,
  transitionFeedback: z.string().trim().min(4).max(240),
  segments: z.array(z.object({
    cueId: z.string().min(1).max(100),
    transcript: z.string().trim().max(1_000).nullable(),
    delivery: score,
    feedback: z.string().trim().min(4).max(240),
  }).strict()).min(4).max(6),
  coachNote: z.string().trim().min(4).max(240),
  limitations: z.array(z.string().trim().min(4).max(240)).max(5),
}).strict();

const nullableScore = { type: ["integer", "null"], minimum: 0, maximum: 100, description: "Score out of 100, not out of 10; null when audio evidence is insufficient." };
const JUDGE_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_switch_judgment",
    description: "Submit the full Switch judgment after listening to the entire audio with every cue direction.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        speechDetected: { type: "boolean" },
        transcriptReliable: { type: "boolean" },
        transcript: { type: "string", maxLength: 3_000 },
        timingUncertain: { type: "boolean" },
        transitions: nullableScore,
        transitionFeedback: { type: "string", minLength: 4, maxLength: 240 },
        segments: {
          type: "array", minItems: 4, maxItems: 6,
          items: {
            type: "object", additionalProperties: false,
            properties: {
              cueId: { type: "string", minLength: 1, maxLength: 100 },
              transcript: { type: ["string", "null"], maxLength: 1_000 },
              delivery: nullableScore,
              feedback: { type: "string", minLength: 4, maxLength: 240 },
            },
            required: ["cueId", "transcript", "delivery", "feedback"],
          },
        },
        coachNote: { type: "string", minLength: 4, maxLength: 240 },
        limitations: { type: "array", maxItems: 5, items: { type: "string", minLength: 4, maxLength: 240 } },
      },
      required: ["speechDetected", "transcriptReliable", "transcript", "timingUncertain", "transitions", "transitionFeedback", "segments", "coachNote", "limitations"],
    },
  },
};

export interface JudgeSwitchInput {
  audio: File;
  challenge: SwitchChallenge;
  durationMs: number;
  recordingOffsetMs?: number;
  safetyIdentifier?: string;
  requestId?: string;
  /** Evaluation ledger hooks only; usage is never exposed in a player's score. */
  onProviderRequest?: (provider: "openai") => void;
  onOpenAIUsage?: (usage: OpenAI.CompletionUsage | undefined) => void;
}

function invalidScore(cause?: unknown): AppError {
  return new AppError("SWITCH_JUDGMENT_INVALID", "The judge could not finish a reliable scorecard. Your recording is safe; you can retry scoring.", 502, undefined, { cause });
}

export function parseSwitchJudgment(argumentsText: string, challenge: SwitchChallenge, evidence: SwitchScore["evidence"]): SwitchScore {
  let candidate: unknown;
  try { candidate = JSON.parse(argumentsText); } catch (error) { throw invalidScore(error); }
  // A silent take need not have fabricated segment observations to be rejected.
  if (typeof candidate === "object" && candidate !== null && "speechDetected" in candidate && candidate.speechDetected === false) {
    throw new AppError("NO_SPEECH_DETECTED", "The judge could not hear speech in that take. Check your mic and record again; a clear whisper is welcome.", 422);
  }
  const result = modelScoreSchema.safeParse(candidate);
  if (!result.success) throw invalidScore(result.error);
  const parsed = result.data;
  if (!parsed.transcript || parsed.segments.length !== challenge.cues.length || parsed.segments.some((segment, index) => segment.cueId !== challenge.cues[index]?.id)) throw invalidScore();
  const segments = parsed.segments.map((segment, index) => ({
    cueId: segment.cueId,
    words: segment.transcript === null ? null : transcriptAccuracy(challenge.cues[index]!.text, segment.transcript),
    delivery: segment.delivery,
    feedback: segment.feedback,
  }));
  const words = parsed.transcriptReliable ? transcriptAccuracy(challenge.cues.map((cue) => cue.text).join(" "), parsed.transcript) : null;
  const delivery = segments.some((segment) => segment.delivery === null)
    ? null : Math.round(segments.reduce((total, segment) => total + segment.delivery!, 0) / segments.length);
  // Incomplete direction evidence cannot support a confident transition score either.
  const timingUncertain = parsed.timingUncertain || evidence.timing === "uncertain";
  const transitions = timingUncertain || delivery === null ? null : parsed.transitions;
  const limitations = [...new Set([
    "Switch is an unranked beta. Audio judgments are approximate and compare only the same challenge and rubric version.",
    ...parsed.limitations,
    ...(timingUncertain ? ["Cue timing was uncertain, so transitions and the overall score are left unscored."] : []),
    ...(words === null ? ["Some words could not be transcribed reliably; words and the overall score are left unscored."] : []),
    ...(delivery === null ? ["At least one direction could not be judged reliably; delivery and the overall score are left unscored."] : []),
    ...(transitions === null && !timingUncertain && delivery !== null ? ["The direction changes could not be judged reliably; transitions and the overall score are left unscored."] : []),
  ])];
  return {
    version: challenge.scoringVersion, rubricVersion: challenge.rubricVersion, beta: true, ranked: false,
    overall: switchOverall(words, delivery, transitions), words, delivery, transitions,
    transcript: parsed.transcript, segments, transitionFeedback: parsed.transitionFeedback,
    coachNote: parsed.coachNote, limitations, evidence: { ...evidence, timing: timingUncertain ? "uncertain" : "approximate" },
  };
}

/** One full-audio request. No STT companion, paid repair pass, or SDK retries. */
export async function judgeSwitch(input: JudgeSwitchInput): Promise<SwitchScore> {
  const challenge = switchChallengeSchema.parse(input.challenge);
  if (challenge.scoringVersion !== SWITCH_SCORING_VERSION || challenge.rubricVersion !== SWITCH_RUBRIC_VERSION) {
    throw new AppError("SWITCH_RUBRIC_UNAVAILABLE", "That Switch scoring version is no longer available. Your original recording and results remain playable.", 409);
  }
  const offset = input.recordingOffsetMs ?? 0;
  if (!Number.isFinite(input.durationMs) || input.durationMs < 1_000 || input.durationMs > 25_000 || !Number.isFinite(offset) || offset < 0 || offset > 2_000) {
    throw new AppError("SWITCH_TIMING_INVALID", "That recording's timing could not be verified. Please record a fresh uninterrupted take.", 422);
  }
  const format = audioJudgeFormatForMime(input.audio.type);
  if (!format) throw new AppError("AUDIO_JUDGE_FORMAT_UNSUPPORTED", "Switch judging needs a WAV or MP3 recording so the judge can hear your directions.", 422);
  const env = getServerEnv();
  // Never turn a demo transcript, failure, or missing key into an invented tone score.
  if (env.DELIVERY_AI_MODE !== "live" || !env.OPENAI_API_KEY) {
    throw new AppError("SWITCH_JUDGE_UNAVAILABLE", "Switch audio judging is unavailable here. You can still replay your take.", 503);
  }
  const bytes = Buffer.from(await input.audio.arrayBuffer());
  const evidence: SwitchScore["evidence"] = {
    source: "audio", model: env.OPENAI_AUDIO_JUDGE_MODEL,
    audioHash: createHash("sha256").update(bytes).digest("hex"),
    // A substantially shortened or extended capture cannot substantiate cue timing.
    timing: Math.abs(input.durationMs - offset - challenge.duration * 1_000) > 1_000 ? "uncertain" : "approximate",
    timingToleranceMs: SWITCH_TIMING_TOLERANCE_MS, recordingOffsetMs: offset,
  };
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 35_000, maxRetries: 0 });
  try {
    input.onProviderRequest?.("openai");
    const completion = await client.chat.completions.create({
      model: env.OPENAI_AUDIO_JUDGE_MODEL, store: false, max_completion_tokens: 1_800,
      safety_identifier: input.safetyIdentifier ? createHash("sha256").update(input.safetyIdentifier).digest("hex") : undefined,
      parallel_tool_calls: false, tools: [JUDGE_TOOL],
      tool_choice: { type: "function", function: { name: JUDGE_TOOL.function.name } },
      messages: [
        { role: "developer", content: switchJudgeInstructions() },
        { role: "user", content: [
          { type: "text", text: [
            `IMMUTABLE SWITCH CHALLENGE (quoted JSON): ${JSON.stringify(challenge)}`,
            `RECORDING DURATION MS: ${input.durationMs}`,
            `MEASURED CAPTURE STARTUP OFFSET MS: ${offset}. Add this offset to cue media seconds for this audio; never estimate or correct it from speech.`,
            `CAPTURE TIMING EVIDENCE: ${evidence.timing}. If uncertain, return transitions null and timingUncertain true.`,
            "Listen to the attached uninterrupted performance, then submit one complete scorecard.",
          ].join("\n") },
          { type: "input_audio", input_audio: { data: bytes.toString("base64"), format } },
        ] },
      ],
    }, { timeout: 35_000, maxRetries: 0 });
    input.onOpenAIUsage?.(completion.usage);
    const message = completion.choices[0]?.message;
    if (message?.refusal) throw new AppError("JUDGMENT_REFUSED", "The judge could not score that take. Your recording is still available to replay.", 422);
    const call = message?.tool_calls?.[0];
    if (message?.tool_calls?.length !== 1 || call?.type !== "function" || call.function.name !== JUDGE_TOOL.function.name) throw invalidScore();
    return parseSwitchJudgment(call.function.arguments, challenge, evidence);
  } catch (error) {
    if (error instanceof AppError || error instanceof EnvironmentError) throw error;
    console.error("Switch audio judge request failed", { requestId: input.requestId, model: env.OPENAI_AUDIO_JUDGE_MODEL, errorName: error instanceof Error ? error.name : "unknown" });
    throw new ExternalServiceError("OpenAI", { cause: error });
  }
}
