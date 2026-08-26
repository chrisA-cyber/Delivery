import "server-only";

import OpenAI from "openai";

import { ExternalServiceError } from "@/lib/server/api-error";
import { EnvironmentError, getServerEnv } from "@/lib/server/env";

export type ModerationDecision = "approved" | "rejected" | "review";

export interface ModerationResult {
  decision: ModerationDecision;
  reason: string;
  categories: string[];
  provider: "openai" | "local";
  raw?: Record<string, unknown>;
}

const hardBlockPatterns = [
  /\b(?:kill|murder|shoot)\s+(?:all|every|those)\b/i,
  /\b(?:dox|swat)\s+(?:him|her|them|this)\b/i,
  /\b(?:phone|address|email)\s*:\s*\S+/i,
];

const manualReviewPatterns = [
  /https?:\/\//i,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /\b(?:suicide|self[- ]?harm)\b/i,
];

let moderationClient: OpenAI | undefined;

function client(): OpenAI {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    throw new EnvironmentError("OPENAI_API_KEY is required for moderation.", [
      "OPENAI_API_KEY",
    ]);
  }
  moderationClient ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 20_000, maxRetries: 1 });
  return moderationClient;
}

export async function moderateLine(text: string): Promise<ModerationResult> {
  if (hardBlockPatterns.some((pattern) => pattern.test(text))) {
    return {
      decision: "rejected",
      reason: "The line appears to include a threat or private contact information.",
      categories: ["local-safety-filter"],
      provider: "local",
    };
  }

  const env = getServerEnv();
  if (env.DELIVERY_AI_MODE === "mock" || (!env.OPENAI_API_KEY && env.NODE_ENV !== "production")) {
    return {
      decision: "review",
      reason: "Live moderation is unavailable, so this submission needs a human review.",
      categories: manualReviewPatterns.some((pattern) => pattern.test(text))
        ? ["local-review-filter"]
        : [],
      provider: "local",
    };
  }

  try {
    const response = await client().moderations.create({
      model: env.OPENAI_MODERATION_MODEL,
      input: text,
    });
    const result = response.results[0];
    if (!result) throw new Error("Moderation returned no result.");

    const rawCategories = Object.entries(
      result.categories as unknown as Record<string, boolean>,
    )
      .filter(([, flagged]) => flagged)
      .map(([category]) => category);
    const categories = [
      ...new Set(
        rawCategories.flatMap((category) => [category, category.split("/")[0] ?? category]),
      ),
    ];
    const scores = Object.values(
      result.category_scores as unknown as Record<string, number>,
    );
    const peakScore = scores.length ? Math.max(...scores) : 0;
    const localReview = manualReviewPatterns.some((pattern) => pattern.test(text));

    if (result.flagged) {
      return {
        decision: "rejected",
        reason: "The line crossed a community safety boundary.",
        categories,
        provider: "openai",
      };
    }

    if (localReview || peakScore >= 0.35) {
      return {
        decision: "review",
        reason: "The line is queued for a quick human review.",
        categories,
        provider: "openai",
      };
    }

    return {
      decision: "approved",
      reason: "The line passed automated safety checks.",
      categories: [],
      provider: "openai",
    };
  } catch (error) {
    throw new ExternalServiceError("OpenAI moderation", { cause: error });
  }
}
