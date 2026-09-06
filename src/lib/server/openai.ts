import "server-only";

import { createHash } from "node:crypto";

import OpenAI from "openai";
import { z } from "zod";

import { audioJudgeInstructions, overallScore, RUBRIC_VERSION, SCORING_VERSION } from "@/lib/judging/rubric";
import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { EnvironmentError, getServerEnv } from "@/lib/server/env";
import { transcribeWithScribe } from "@/lib/server/elevenlabs";
import type { DeliveryJudgment, DeliveryMode, VerdictTag } from "@/lib/types";

const modelJudgmentSchema = z
  .object({
    speechDetected: z.boolean(),
    transcript: z.string().trim().max(2_000),
    commitment: z.number().int().min(0).max(100),
    comedy: z.number().int().min(0).max(100),
    chaos: z.number().int().min(0).max(100),
    verdict: z.string().trim().min(8).max(240),
    verdictTag: z.enum([
      "MAIN_CHARACTER",
      "AURA_FARMING",
      "COMMITTED_TO_THE_BIT",
      "CHAOS_MERCHANT",
      "CINEMA",
      "NPC_DIALOGUE",
      "SENT_IT",
      "NEEDS_MORE_SAUCE",
    ]),
    highlights: z.array(z.string().trim().min(2).max(90)).min(1).max(3),
    coachNote: z.string().trim().min(4).max(140),
  })
  .strict();

type ModelJudgment = z.infer<typeof modelJudgmentSchema>;

const modelSpeechPresenceSchema = z
  .object({
    speechDetected: z.boolean(),
    transcript: z.string().max(2_000).optional(),
  })
  .passthrough();

const JUDGMENT_DEADLINE_MS = 38_000;
const JUDGMENT_ATTEMPT_TIMEOUT_MS = 18_000;
const MINIMUM_REPAIR_BUDGET_MS = 2_500;

class ModelJudgmentFormatError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ModelJudgmentFormatError";
  }
}

const JUDGMENT_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_delivery_judgment",
    description:
      "Submit the final judgment after listening to the entire voice recording.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        speechDetected: {
          type: "boolean",
          description: "True only when clear human speech is actually audible in the recording.",
        },
        transcript: { type: "string", maxLength: 2_000 },
        commitment: { type: "integer", minimum: 0, maximum: 100, description: "Commitment score out of 100, not out of 10." },
        comedy: { type: "integer", minimum: 0, maximum: 100, description: "Comedy score out of 100, not out of 10." },
        chaos: { type: "integer", minimum: 0, maximum: 100, description: "Chaos score out of 100, not out of 10." },
        verdict: { type: "string", minLength: 8, maxLength: 240 },
        verdictTag: {
          type: "string",
          enum: [
            "MAIN_CHARACTER",
            "AURA_FARMING",
            "COMMITTED_TO_THE_BIT",
            "CHAOS_MERCHANT",
            "CINEMA",
            "NPC_DIALOGUE",
            "SENT_IT",
            "NEEDS_MORE_SAUCE",
          ],
        },
        highlights: {
          type: "array",
          minItems: 0,
          maxItems: 3,
          description:
            "One to three audible performance details when speech is detected; otherwise an empty array.",
          items: { type: "string", minLength: 2, maxLength: 90 },
        },
        coachNote: { type: "string", minLength: 4, maxLength: 140 },
      },
      required: [
        "speechDetected",
        "transcript",
        "commitment",
        "comedy",
        "chaos",
        "verdict",
        "verdictTag",
        "highlights",
        "coachNote",
      ],
    },
  },
};

export interface JudgeDeliveryInput {
  audio: File;
  promptText: string;
  energy: string;
  mode: DeliveryMode;
  durationMs?: number;
  safetyIdentifier?: string;
  requestId?: string;
  /** Private evaluation hook; never included in a judgment or persisted receipt. */
  onProviderRequest?: (provider: "openai" | "elevenlabs") => void;
  onOpenAIUsage?: (usage: OpenAI.CompletionUsage | undefined) => void;
}

let openAIClient: OpenAI | undefined;

function getOpenAI(): OpenAI {
  const { OPENAI_API_KEY } = getServerEnv();
  if (!OPENAI_API_KEY) {
    throw new EnvironmentError("OPENAI_API_KEY is required for live AI judging.", [
      "OPENAI_API_KEY",
    ]);
  }
  openAIClient ??= new OpenAI({
    apiKey: OPENAI_API_KEY,
    timeout: JUDGMENT_ATTEMPT_TIMEOUT_MS,
    maxRetries: 0,
  });
  return openAIClient;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function words(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}' ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function levenshteinDistance(left: string[], right: string[]): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution =
        previous[rightIndex - 1]! +
        (left[leftIndex - 1]! === right[rightIndex - 1]! ? 0 : 1);
      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        substitution,
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? left.length;
}

export function transcriptAccuracy(expected: string, actual: string): number {
  const expectedWords = words(expected);
  const actualWords = words(actual);
  const length = Math.max(expectedWords.length, actualWords.length, 1);
  return clampScore(100 * (1 - levenshteinDistance(expectedWords, actualWords) / length));
}

function safeIdentifier(value?: string): string | undefined {
  if (!value) return undefined;
  return createHash("sha256").update(value).digest("hex").slice(0, 64);
}

export function audioJudgeFormatForMime(mimeType: string): "wav" | "mp3" | null {
  const mime = mimeType.toLowerCase().split(";")[0];
  if (mime === "audio/wav" || mime === "audio/wave" || mime === "audio/x-wav") {
    return "wav";
  }
  if (mime === "audio/mpeg" || mime === "audio/mp3") return "mp3";
  return null;
}

export function parseModelJudgmentArguments(argumentsText: string): ModelJudgment {
  let candidate: unknown;
  try {
    candidate = JSON.parse(argumentsText);
  } catch (error) {
    throw new ModelJudgmentFormatError("The audio judge returned invalid JSON.", {
      cause: error,
    });
  }

  const presence = modelSpeechPresenceSchema.safeParse(candidate);
  if (!presence.success) {
    throw new ModelJudgmentFormatError(
      "The audio judge omitted its speech-detection result.",
      { cause: presence.error },
    );
  }

  const transcript = presence.data.transcript?.trim() ?? "";
  if (!presence.data.speechDetected) {
    throw new AppError(
      "NO_SPEECH_DETECTED",
      "The judge could not hear a line in that take. Check your mic and go again.",
      422,
    );
  }
  if (!transcript) {
    throw new ModelJudgmentFormatError(
      "The audio judge detected speech but omitted its transcript.",
    );
  }

  const parsed = modelJudgmentSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new ModelJudgmentFormatError(
      "The audio judge returned an incomplete scorecard.",
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

async function liveJudgment(input: JudgeDeliveryInput): Promise<DeliveryJudgment> {
  const env = getServerEnv();
  const client = getOpenAI();
  const format = audioJudgeFormatForMime(input.audio.type);
  if (!format) {
    throw new AppError(
      "AUDIO_JUDGE_FORMAT_UNSUPPORTED",
      "Live voice judging needs a WAV or MP3 recording so the judge can hear tone and timing.",
      422,
      { accepted: ["audio/wav", "audio/mpeg"] },
    );
  }

  const audio = Buffer.from(await input.audio.arrayBuffer()).toString("base64");
  const deadlineAt = Date.now() + JUDGMENT_DEADLINE_MS;
  let formatError: ModelJudgmentFormatError | undefined;
  let attempts = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs < MINIMUM_REPAIR_BUDGET_MS) break;
    attempts += 1;
    input.onProviderRequest?.("openai");
    const completion = await client.chat.completions.create({
      model: env.OPENAI_AUDIO_JUDGE_MODEL,
      store: false,
      safety_identifier: safeIdentifier(input.safetyIdentifier),
      max_completion_tokens: 900,
      parallel_tool_calls: false,
      tool_choice: {
        type: "function",
        function: { name: JUDGMENT_TOOL.function.name },
      },
      tools: [JUDGMENT_TOOL],
      messages: [
        {
          role: "developer",
          content: audioJudgeInstructions(attempt === 1),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `TARGET LINE (quoted): ${JSON.stringify(input.promptText)}`,
                `REQUESTED ENERGY (quoted): ${JSON.stringify(input.energy)}`,
                `MODE: ${input.mode}`,
                `RECORDED DURATION MS: ${input.durationMs ?? "unknown"}`,
                "Judge the attached performance, then call the required tool.",
              ].join("\n"),
            },
            {
              type: "input_audio",
              input_audio: { data: audio, format },
            },
          ],
        },
      ],
    }, {
      maxRetries: 0,
      timeout: Math.min(JUDGMENT_ATTEMPT_TIMEOUT_MS, remainingMs),
    });
    input.onOpenAIUsage?.(completion.usage);

    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      throw new AppError(
        "JUDGMENT_REFUSED",
        "The judge could not score that recording safely. Try another line.",
        422,
      );
    }
    const calls = message?.tool_calls?.filter(
      (candidate) =>
        candidate.type === "function" &&
        candidate.function.name === JUDGMENT_TOOL.function.name,
    );
    const call = calls?.[0];
    if (message?.tool_calls?.length !== 1 || calls?.length !== 1 || !call || call.type !== "function") {
      formatError = new ModelJudgmentFormatError(
        "The audio judge must return exactly one structured tool result.",
      );
      continue;
    }

    let parsed: ModelJudgment;
    try {
      parsed = parseModelJudgmentArguments(call.function.arguments);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (!(error instanceof ModelJudgmentFormatError)) throw error;
      formatError = error;
      continue;
    }

    const transcript = parsed.transcript.trim();
    const accuracy = transcriptAccuracy(input.promptText, transcript);
    return {
      transcript,
      scores: {
        commitment: parsed.commitment,
        comedy: parsed.comedy,
        accuracy,
        chaos: parsed.chaos,
        overall: overallScore(parsed.commitment, parsed.comedy, accuracy, parsed.chaos),
      },
      verdict: parsed.verdict,
      verdictTag: parsed.verdictTag,
      highlights: parsed.highlights,
      coachNote: parsed.coachNote,
      source: "openai",
      model: env.OPENAI_AUDIO_JUDGE_MODEL,
      rubricVersion: RUBRIC_VERSION,
      scoringVersion: SCORING_VERSION,
    };
  }

  console.error("OpenAI judge returned an invalid scorecard", {
    requestId: input.requestId,
    model: env.OPENAI_AUDIO_JUDGE_MODEL,
    attempts,
    errorName: formatError?.name ?? "unknown",
  });
  throw new AppError(
    "JUDGMENT_FORMAT_INVALID",
    "The judge returned a messy scorecard. Your take is safe—try judging it again.",
    502,
    undefined,
    { cause: formatError },
  );
}

function seededNumber(seed: string, offset: number): number {
  const digest = createHash("sha256").update(`${seed}:${offset}`).digest();
  return digest.readUInt32BE(0) / 0xffffffff;
}

async function mockJudgment(
  input: JudgeDeliveryInput,
  warning: string,
): Promise<DeliveryJudgment> {
  const bytes = Buffer.from(await input.audio.arrayBuffer());
  const fingerprint = createHash("sha256")
    .update(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)))
    .update(input.promptText)
    .update(input.energy)
    .digest("hex");
  const score = (offset: number, floor: number, range: number) =>
    clampScore(floor + seededNumber(fingerprint, offset) * range);

  const commitment = score(1, 56, 39);
  const comedy = score(2, 48, 48);
  const accuracy = score(3, 70, 29);
  const chaos = score(4, input.mode === "impossible" ? 67 : 42, 32);
  const overall = overallScore(commitment, comedy, accuracy, chaos);
  const verdictTag: VerdictTag =
    overall >= 90
      ? "CINEMA"
      : chaos >= 82
        ? "CHAOS_MERCHANT"
        : commitment >= 80
          ? "COMMITTED_TO_THE_BIT"
          : overall >= 72
            ? "SENT_IT"
            : "NEEDS_MORE_SAUCE";

  return {
    transcript: input.promptText,
    scores: { commitment, comedy, accuracy, chaos, overall },
    verdict:
      overall >= 85
        ? "The imaginary studio audience just stood up. Suspiciously enormous delivery."
        : overall >= 70
          ? "You sent it with confidence and only lightly damaged the timeline."
          : "The aura arrived, checked the room, and asked for one more take.",
    verdictTag,
    highlights: [
      commitment >= 80 ? "Committed past the point of plausible deniability" : "A dangerous amount of potential",
      chaos >= 75 ? "Chaos meter filed a workplace complaint" : "Kept the bit mostly house-trained",
    ],
    coachNote: "One more take: make the first word a decision, not a suggestion.",
    source: "mock",
    model: "delivery-deterministic-demo-v1",
    rubricVersion: "delivery-demo-v1",
    scoringVersion: "delivery-demo-v1",
    warning,
  };
}

export async function judgeDelivery(input: JudgeDeliveryInput): Promise<DeliveryJudgment> {
  const env = getServerEnv();
  if (env.DELIVERY_AI_MODE === "mock") {
    if (env.NODE_ENV === "production") {
      throw new EnvironmentError(
        "Deterministic mock judging cannot run in production.",
        ["DELIVERY_AI_MODE=live"],
      );
    }
    return mockJudgment(input, "Demo scoring is enabled; no live AI judgment was performed.");
  }

  if (!env.OPENAI_API_KEY) {
    if (env.DELIVERY_AI_ALLOW_MOCK_FALLBACK && env.NODE_ENV !== "production") {
      return mockJudgment(
        input,
        "OPENAI_API_KEY is missing; explicit local mock fallback produced demo scoring.",
      );
    }
    throw new EnvironmentError("OPENAI_API_KEY is required for live AI judging.", ["OPENAI_API_KEY"]);
  }

  try {
    // This companion transcript is deliberately not injected into the audio
    // judge or substituted into v1 accuracy: an STT rollout needs calibration
    // before it changes ranking semantics. A configured Scribe failure is a
    // visible retry, never an unnoticed provider switch.
    let transcription;
    if (env.DELIVERY_TRANSCRIPTION_PROVIDER === "elevenlabs") {
      input.onProviderRequest?.("elevenlabs");
      transcription = await transcribeWithScribe(input.audio, input.durationMs);
    }
    const judgment = await liveJudgment(input);
    return { ...judgment, ...(transcription ? { transcription } : {}) };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof EnvironmentError) throw error;
    if (env.DELIVERY_AI_ALLOW_MOCK_FALLBACK && env.NODE_ENV !== "production") {
      return mockJudgment(
        input,
        "Live AI judging failed; explicit mock fallback is enabled for this environment.",
      );
    }
    const providerError =
      typeof error === "object" && error !== null
        ? (error as { code?: unknown; status?: unknown; type?: unknown })
        : undefined;
    console.error("OpenAI judge request failed", {
      requestId: input.requestId,
      model: env.OPENAI_AUDIO_JUDGE_MODEL,
      errorName: error instanceof Error ? error.name : "unknown",
      status: typeof providerError?.status === "number" ? providerError.status : undefined,
      code: typeof providerError?.code === "string" ? providerError.code.slice(0, 80) : undefined,
      type: typeof providerError?.type === "string" ? providerError.type.slice(0, 80) : undefined,
    });
    throw new ExternalServiceError("OpenAI", { cause: error });
  }
}
