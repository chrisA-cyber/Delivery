import "server-only";

import { ExternalServiceError } from "@/lib/server/api-error";
import { isSupabaseConfigured } from "@/lib/server/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ChallengeInvite = { id: string; token: string; challengerId: string; challengerName: string; challengerHandle: string; message: string | null; promptSlug: string; energySlug?: string; expiresAt: string; state: "open" | "accepted" | "completed" };

export type ChallengeMatchEntry = {
  entrantId: string;
  displayName: string;
  handle: string;
  deliveryId: string;
  createdAt: string;
  audioUrl: string | null;
  overall: number;
  commitment: number;
  comedy: number;
  accuracy: number;
  chaos: number;
  headline: string;
  verdict: string;
};

export type ChallengeMatch = {
  state: "open" | "accepted" | "completed";
  createdBy: string;
  recipientUserId: string | null;
  maxEntries: number;
  entries: ChallengeMatchEntry[];
};

export async function getChallengeInvite(invite: string): Promise<ChallengeInvite | null> {
  if (!isSupabaseConfigured()) return null;
  const separator = invite.indexOf(".");
  if (separator < 6) return null;
  const code = invite.slice(0, separator);
  const token = invite.slice(separator + 1);
  if (!/^[A-Za-z0-9]{6,20}$/.test(code) || !/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_challenge_by_invite", { p_code: code, p_token: token });
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row?.id || !row.prompt_id) return null;
  const [{ data: prompt }, { data: energy }] = await Promise.all([
    supabase.from("prompts").select("slug").eq("id", String(row.prompt_id)).maybeSingle(),
    row.energy_modifier_id ? supabase.from("energy_modifiers").select("slug").eq("id", String(row.energy_modifier_id)).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!prompt) return null;
  return {
    id: String(row.id), token, challengerId: String(row.created_by), challengerName: String(row.challenger_name ?? "A friend"), challengerHandle: String(row.challenger_handle ?? "player"),
    message: row.message ? String(row.message) : null, promptSlug: String((prompt as Record<string, unknown>).slug),
    energySlug: energy ? String((energy as Record<string, unknown>).slug) : undefined, expiresAt: String(row.expires_at),
    state: row.state === "completed" ? "completed" : row.state === "accepted" ? "accepted" : "open",
  };
}

function ownerAudioPath(path: string, ownerId: string) {
  return path.startsWith(`${ownerId}/`) && path.length <= 512 && !path.includes("\\") && !path.includes("\0") && path.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

export async function getChallengeMatch(challengeId: string, userId: string): Promise<ChallengeMatch | null> {
  if (!isSupabaseConfigured()) return null;
  const scoped = await createServerSupabaseClient();
  const { data: challenge, error: challengeError } = await scoped.from("challenges").select("id,created_by,recipient_user_id,state,max_entries").eq("id", challengeId).maybeSingle();
  if (challengeError) throw new ExternalServiceError("Supabase challenge", { cause: challengeError });
  if (!challenge) return null;
  const challengeRow = challenge as Record<string, unknown>;
  const createdBy = String(challengeRow.created_by);
  const recipientUserId = challengeRow.recipient_user_id ? String(challengeRow.recipient_user_id) : null;
  if (createdBy !== userId && recipientUserId !== userId) return null;
  if (!["open", "accepted", "completed"].includes(String(challengeRow.state))) return null;

  // This narrow RPC is participant-only and applies challenge, delivery,
  // prompt, moderation, deletion, and block gates in one database snapshot.
  // It intentionally returns compact stage identity for an ordinary private
  // rival without granting access to that rival's full profile.
  const { data: rawEntries, error: entryError } = await scoped.rpc(
    "get_challenge_match_entries",
    { p_challenge_id: challengeId },
  );
  if (entryError) throw new ExternalServiceError("Supabase challenge", { cause: entryError });
  const entries = (rawEntries ?? []) as Array<Record<string, unknown>>;
  const admin = createSupabaseAdminClient();

  const matchEntries = await Promise.all(entries.map(async (entry): Promise<ChallengeMatchEntry> => {
    const entrantId = String(entry.entrant_id);
    const deliveryId = String(entry.delivery_id);
    let audioUrl: string | null = null;
    const path = entry.recording_path ? String(entry.recording_path) : "";
    if (path && ownerAudioPath(path, entrantId)) {
      const { data: signed, error } = await admin.storage
        .from("delivery-audio")
        .createSignedUrl(path, 5 * 60);
      if (error) throw new ExternalServiceError("Supabase challenge audio", { cause: error });
      audioUrl = signed?.signedUrl ?? null;
    }
    return {
      entrantId,
      displayName: String(entry.display_name),
      handle: String(entry.handle),
      deliveryId,
      createdAt: String(entry.created_at),
      audioUrl,
      overall: Number(entry.overall),
      commitment: Number(entry.commitment),
      comedy: Number(entry.comedy),
      accuracy: Number(entry.accuracy ?? 0),
      chaos: Number(entry.chaos),
      headline: String(entry.headline),
      verdict: String(entry.verdict),
    };
  }));

  return {
    state: challengeRow.state === "completed" ? "completed" : challengeRow.state === "accepted" ? "accepted" : "open",
    createdBy,
    recipientUserId,
    maxEntries: Number(challengeRow.max_entries),
    entries: matchEntries,
  };
}
