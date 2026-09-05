import "server-only";

import { z } from "zod";

import { MATURE_CONTENT_LABEL } from "@/lib/server/content-publication";
import type { DeliveryHistoryItem } from "@/types/game";

type Row = Record<string, unknown>;
const transcriptionReceipt = z.object({
  text: z.string().max(12_000), provider: z.literal("elevenlabs"), model: z.literal("scribe_v2"), usedForAccuracy: z.literal(false),
  words: z.array(z.object({ text: z.string().max(200), start: z.number().finite().min(0).max(120), end: z.number().finite().min(0).max(120) }).refine((word) => word.end >= word.start)).max(1_000),
});
function record(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function nonempty(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value : undefined; }

/** Owner-only projection; expose documented receipt fields, not arbitrary provider evidence. */
export function mapAccountHistoryItem(delivery: Row, score: Row, prompt: Row, energy?: Row): DeliveryHistoryItem {
  const evidence = record(score.evidence);
  const highlights = Array.isArray(evidence.highlights) ? evidence.highlights.filter((value): value is string => typeof value === "string").slice(0, 3) : [];
  const coachNote = nonempty(evidence.coach_note);
  const rubricVersion = nonempty(score.rubric_version) ?? "legacy-unversioned";
  const scoringVersion = nonempty(evidence.scoring_version) ?? (["delivery-voice-v1", "delivery-voice-v1.1"].includes(rubricVersion) ? "delivery-voice-v1" : "legacy-unversioned");
  const transcription = transcriptionReceipt.safeParse(evidence.transcription);
  const labels = Array.isArray(delivery.moderation_labels) ? delivery.moderation_labels : [];
  const rating = prompt.rating === "mature" || evidence.content_rating === "mature" || labels.includes(MATURE_CONTENT_LABEL)
    ? "mature" : prompt.rating === "teen" || evidence.content_rating === "teen" ? "teen" : "everyone";
  const difficulty = ([1, 1, 2, 4, 5] as const)[Number(prompt.difficulty)] ?? 2;
  return {
    id: String(delivery.id),
    scores: { overall: Number(score.overall), commitment: Number(score.commitment), comedy: Number(score.comedy), accuracy: Number(score.accuracy ?? 0), chaos: Number(score.chaos) },
    title: String(score.headline), verdict: String(score.verdict),
    moment: highlights[0] ?? coachNote ?? "A documented microphone event.",
    transcript: String(delivery.transcript ?? ""), createdAt: String(delivery.created_at),
    visibility: delivery.visibility === "public" ? "public" : delivery.visibility === "unlisted" ? "unlisted" : "private",
    dailyRanked: delivery.daily_challenge_date ? Boolean(delivery.daily_ranked) : undefined,
    rubricVersion, scoringVersion, highlights,
    ...(coachNote ? { coachNote } : {}),
    ...(transcription.success ? { transcription: transcription.data } : {}),
    ...(score.provider === "openai" ? { source: "ai" as const } : score.provider === "mock" ? { source: "fallback" as const } : {}),
    prompt: {
      id: String(prompt.slug ?? prompt.id), line: String(prompt.body), rating,
      energy: String(energy?.instruction ?? evidence.requested_energy ?? "Deliver it like you mean it."),
      ...(energy?.slug ? { energyId: String(energy.slug) } : {}),
      category: String(prompt.category).replaceAll("-", " "), difficulty,
    },
  };
}
