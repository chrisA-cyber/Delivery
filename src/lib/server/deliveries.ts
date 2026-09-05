import "server-only";

import type { User } from "@supabase/supabase-js";

import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { MATURE_CONTENT_LABEL } from "@/lib/server/content-publication";
import type { ContentRating } from "@/lib/content/types";
import { isSupabaseAdminConfigured } from "@/lib/server/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DeliveryJudgment, DeliveryMode } from "@/lib/types";

const AUDIO_BUCKET = "delivery-audio";

function audioExtension(file: File): string {
  const byMime: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/wave": "wav",
  };
  return byMime[file.type] ?? "webm";
}

export interface PersistDeliveryInput {
  user: User | null;
  audio: File;
  promptId: string;
  energyId: string;
  challengeId?: string;
  dailyDate?: string | null;
  dailyMarket?: string | null;
  contentRating?: ContentRating;
  promptText: string;
  energy: string;
  mode: DeliveryMode;
  durationMs?: number;
  judgment: DeliveryJudgment;
  moderationLabels?: string[];
}

export interface PersistDeliveryResult {
  id: string | null;
  persisted: boolean;
  dailyRanked?: boolean;
  dailyRank?: number;
  dailyParticipants?: number;
  warning?: string;
}

export async function getViewerDailyLeaderboardPosition(
  expectedUserId: string,
): Promise<{ dailyRank: number; dailyParticipants: number } | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_daily_leaderboard_position", {
    p_metric: "overall",
    p_market: "global",
  });
  if (error) {
    throw new ExternalServiceError("Supabase Daily leaderboard position", {
      cause: error,
    });
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { user_id?: unknown; rank?: unknown; participant_count?: unknown }
    | null;
  if (!row) return null;
  const rank = Number(row.rank);
  const participants = Number(row.participant_count);
  if (
    String(row.user_id) !== expectedUserId ||
    !Number.isInteger(rank) ||
    rank < 1 ||
    !Number.isInteger(participants) ||
    participants < rank
  ) {
    throw new ExternalServiceError("Supabase Daily leaderboard position");
  }
  return { dailyRank: rank, dailyParticipants: participants };
}

export async function persistDelivery(
  input: PersistDeliveryInput,
): Promise<PersistDeliveryResult> {
  if (!input.user) {
    return {
      id: null,
      persisted: false,
      warning: "Sign in to save this take to your profile.",
    };
  }
  if (!isSupabaseAdminConfigured()) {
    return {
      id: null,
      persisted: false,
      warning: "Secure score storage is not configured, so this take was not saved.",
    };
  }

  const supabase = createSupabaseAdminClient();

  const id = crypto.randomUUID();
  const path = `${input.user.id}/${id}.${audioExtension(input.audio)}`;
  const { error: uploadError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, input.audio, {
      cacheControl: "31536000",
      contentType: input.audio.type || "audio/webm",
      upsert: false,
    });
  if (uploadError) {
    throw new ExternalServiceError("Supabase storage", { cause: uploadError });
  }

  const { error: insertError } = await supabase.from("deliveries").insert({
    id,
    user_id: input.user.id,
    prompt_id: input.promptId,
    energy_modifier_id: input.energyId,
    challenge_id: input.challengeId ?? null,
    daily_challenge_date: input.dailyDate ?? null,
    daily_challenge_market: input.dailyMarket ?? null,
    state: "processing",
    // Publishing is a separate, moderated, service-only transition.
    visibility: "private",
    recording_path: path,
    mime_type: input.audio.type || "audio/webm",
    duration_ms: input.durationMs ?? null,
    byte_size: input.audio.size,
    transcript: input.judgment.transcript,
    moderation_labels: [...new Set([...(input.moderationLabels ?? []), ...(input.contentRating === "mature" ? [MATURE_CONTENT_LABEL] : [])])],
  });

  if (insertError) {
    await supabase.storage.from(AUDIO_BUCKET).remove([path]);
    throw new ExternalServiceError("Supabase", { cause: insertError });
  }

  const { scores } = input.judgment;
  const { error: scoreError } = await supabase.from("delivery_scores").insert({
    delivery_id: id,
    overall: scores.overall,
    commitment: scores.commitment,
    comedy: scores.comedy,
    accuracy: scores.accuracy,
    chaos: scores.chaos,
    confidence: null,
    headline: input.judgment.verdictTag.replaceAll("_", " ").slice(0, 80),
    verdict: input.judgment.verdict,
    rubric_version: input.judgment.rubricVersion ?? "delivery-voice-v1",
    provider: input.judgment.source,
    model: input.judgment.model,
    evidence: {
      requested_energy: input.energy,
      mode: input.mode,
      highlights: input.judgment.highlights,
      coach_note: input.judgment.coachNote,
      scoring_version: input.judgment.scoringVersion ?? "delivery-voice-v1",
      ...(input.contentRating ? { content_rating: input.contentRating } : {}),
      ...(input.judgment.transcription ? { transcription: input.judgment.transcription } : {}),
    },
    safety: {},
  });

  if (scoreError) {
    await supabase.from("deliveries").delete().eq("id", id).eq("user_id", input.user.id);
    await supabase.storage.from(AUDIO_BUCKET).remove([path]);
    throw new ExternalServiceError("Supabase", { cause: scoreError });
  }

  if (input.challengeId) {
    const { error: entryError } = await supabase.from("challenge_entries").insert({
      challenge_id: input.challengeId,
      delivery_id: id,
      entrant_id: input.user.id,
    });
    if (entryError) {
      await supabase.from("deliveries").delete().eq("id", id).eq("user_id", input.user.id);
      await supabase.storage.from(AUDIO_BUCKET).remove([path]);
      throw new ExternalServiceError("Supabase challenge entry", { cause: entryError });
    }
  }

  let dailyRanked: boolean | undefined;
  let warning: string | undefined;
  if (input.dailyDate) {
    const { data: rankedDelivery, error: rankError } = await supabase
      .from("deliveries")
      .select("daily_ranked")
      .eq("id", id)
      .single();
    if (rankError) {
      warning = "This take was saved, but its Daily rank receipt is temporarily unavailable.";
      console.error("Daily rank receipt lookup failed", {
        deliveryId: id,
        error: rankError,
      });
    } else {
      dailyRanked = Boolean(rankedDelivery.daily_ranked);
    }
  }

  return { id, persisted: true, dailyRanked, warning };
}

export async function setDeliveryVisibility(
  deliveryId: string,
  userId: string,
  visibility: "public" | "private",
): Promise<{ visibility: "public" | "private"; publishedAt: string | null }> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "set_delivery_visibility",
    {
      p_delivery_id: deliveryId,
      p_visibility: visibility,
      p_user_id: userId,
    },
  );
  if (error?.code === "42501" && /Mature recordings must stay private/.test(error.message ?? "")) {
    throw new AppError("MATURE_PUBLICATION_UNAVAILABLE", "Mature takes stay private until Delivery’s public age and audience policy is finalized.", 403);
  }
  if (error) throw new ExternalServiceError("Supabase publishing", { cause: error });
  const row = (Array.isArray(data) ? data[0] : data) as
    | { visibility?: "public" | "private"; published_at?: string | null }
    | null;
  if (!row?.visibility) throw new ExternalServiceError("Supabase publishing");
  return { visibility: row.visibility, publishedAt: row.published_at ?? null };
}
