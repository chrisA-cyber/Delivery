import "server-only";

import { isMatureTake } from "@/lib/server/content-publication";
import { ExternalServiceError } from "@/lib/server/api-error";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/server/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ShareDelivery, VerdictTag } from "@/lib/types";

const AUDIO_BUCKET = "delivery-audio";

interface DeliveryRow {
  id: string;
  user_id: string;
  recording_path: string | null;
  moderation_labels: string[];
  created_at: string;
  prompts: { body: string; rating: string } | { body: string; rating: string }[] | null;
  energy_modifiers:
    | { instruction: string }
    | { instruction: string }[]
    | null;
  delivery_scores:
    | {
        overall: number;
        commitment: number;
        comedy: number;
        accuracy: number | null;
        chaos: number;
        headline: string;
        verdict: string;
        evidence: Record<string, unknown>;
      }
    | {
        overall: number;
        commitment: number;
        comedy: number;
        accuracy: number | null;
        chaos: number;
        headline: string;
        verdict: string;
        evidence: Record<string, unknown>;
      }[];
  profiles:
    | { handle: string; display_name: string; avatar_path: string | null }
    | { handle: string; display_name: string; avatar_path: string | null }[]
    | null;
}

export async function getShareDelivery(id: string, options: { includeAssets?: boolean } = {}): Promise<ShareDelivery | null> {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) return null;

  // This user-scoped query deliberately relies on can_view_delivery/profile RLS.
  // The service client is used only after authorization to mint a short URL.
  const viewer = await createServerSupabaseClient();
  const { data, error } = await viewer
    .from("deliveries")
    .select(
      "id,user_id,recording_path,moderation_labels,created_at,prompts!inner(body,rating),energy_modifiers(instruction),delivery_scores!inner(overall,commitment,comedy,accuracy,chaos,headline,verdict,evidence),profiles!deliveries_user_id_fkey(handle,display_name,avatar_path)",
    )
    .eq("id", id)
    .eq("visibility", "public")
    .eq("state", "judged")
    .maybeSingle();

  if (error) throw new ExternalServiceError("Supabase", { cause: error });
  if (!data) return null;
  const row = data as unknown as DeliveryRow;
  const blockedLabels = new Set([
    "publish-rejected",
    "publish-review",
    "publish-limited",
    "publish-moderation-unavailable",
    "harassment",
    "hate",
    "sexual",
    "violence",
    "self-harm",
    "privacy",
  ]);
  if (
    !row.moderation_labels.includes("publish-approved") ||
    row.moderation_labels.some((label) => blockedLabels.has(label))
  ) {
    return null;
  }
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const prompt = Array.isArray(row.prompts) ? row.prompts[0] : row.prompts;
  const energy = Array.isArray(row.energy_modifiers)
    ? row.energy_modifiers[0]
    : row.energy_modifiers;
  const score = Array.isArray(row.delivery_scores)
    ? row.delivery_scores[0]
    : row.delivery_scores;
  if (!prompt || !score || isMatureTake(prompt.rating, row.moderation_labels) || !["everyone", "teen"].includes(prompt.rating)) return null;
  let audioUrl: string | null = null;
  let avatarUrl: string | null = null;
  const admin = createSupabaseAdminClient();

  if (options.includeAssets !== false && row.recording_path && isOwnerStoragePath(row.recording_path, row.user_id)) {
    const { data: signed, error: signError } = await admin.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(row.recording_path, 5 * 60);
    if (signError) throw new ExternalServiceError("Supabase storage", { cause: signError });
    audioUrl = signed?.signedUrl ?? null;
  }
  if (options.includeAssets !== false && profile?.avatar_path) {
    if (/^https:\/\//i.test(profile.avatar_path)) {
      avatarUrl = profile.avatar_path;
    } else if (isSafeStoragePath(profile.avatar_path)) {
      avatarUrl = admin.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl;
    }
  }

  const verdictTags = new Set<VerdictTag>([
    "MAIN_CHARACTER",
    "AURA_FARMING",
    "COMMITTED_TO_THE_BIT",
    "CHAOS_MERCHANT",
    "CINEMA",
    "NPC_DIALOGUE",
    "SENT_IT",
    "NEEDS_MORE_SAUCE",
  ]);
  const headlineTag = score.headline.replaceAll(" ", "_") as VerdictTag;

  return {
    id: row.id,
    promptText: prompt.body,
    energy:
      energy?.instruction ??
      (typeof score.evidence.requested_energy === "string"
        ? score.evidence.requested_energy
        : null),
    score: score.overall,
    scores: {
      commitment: score.commitment,
      comedy: score.comedy,
      accuracy: score.accuracy ?? 0,
      chaos: score.chaos,
    },
    verdict: score.verdict,
    verdictTag: verdictTags.has(headlineTag) ? headlineTag : "SENT_IT",
    audioUrl,
    createdAt: row.created_at,
    player: profile
      ? {
          username: profile.handle,
          displayName: profile.display_name,
          avatarUrl,
        }
      : null,
  };
}

function isSafeStoragePath(path: string): boolean {
  return (
    path.length > 2 &&
    path.length <= 512 &&
    !path.includes("\\") &&
    !path.includes("\0") &&
    path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
  );
}

function isOwnerStoragePath(path: string, ownerId: string): boolean {
  return isSafeStoragePath(path) && path.startsWith(`${ownerId}/`);
}
