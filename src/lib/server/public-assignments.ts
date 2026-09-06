import "server-only";

import { createHash } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import type { GroupAssignment } from "@/lib/groups/types";
import type { ContentRating } from "@/lib/content/types";
import { RUBRIC_VERSION, SCORING_VERSION } from "@/lib/judging/rubric";
import { sayClipSchema } from "@/lib/say-it-back/schema";
import { switchChallengeSchema } from "@/lib/switch/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError, ExternalServiceError } from "./api-error";
import { assertContentRating, resolvePromptPackEntitlement, type CanonicalDeliveryContent } from "./content";
import type { JudgingUsage } from "./entitlements";

const rating = z.enum(["everyone", "teen", "mature"]);
const text = z.string().min(1).max(500);
const version = z.string().min(1).max(100);
export const publicAssignmentSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("classic"), promptId: text, promptSlug: text, promptText: text, energyId: text, energySlug: text, energy: text, category: text, difficulty: z.number().int().min(1).max(5), rating, scoringVersion: version, rubricVersion: version }).strict(),
  z.object({ mode: z.literal("switch"), challenge: switchChallengeSchema, rating, scoringVersion: version, rubricVersion: version }).strict(),
  z.object({ mode: z.literal("say-it-back"), clip: sayClipSchema, roleId: text, rating, scoringVersion: version }).strict(),
]);
const unavailable = () => new AppError("ASSIGNMENT_UNAVAILABLE", "This assignment is no longer available. Choose another challenge to play.", 404);
const checked = (error: unknown) => { if (error) throw new ExternalServiceError("Assignment storage", { cause: error }); };

/** Stable order makes one public invitation reusable across players and export options. */
export function canonicalAssignmentJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalAssignmentJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalAssignmentJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function parsePublicAssignment(value: unknown): GroupAssignment {
  const assignment = publicAssignmentSchema.parse(value);
  if (assignment.mode === "switch" && (assignment.rating !== assignment.challenge.rating || assignment.scoringVersion !== assignment.challenge.scoringVersion || assignment.rubricVersion !== assignment.challenge.rubricVersion)) throw unavailable();
  if (assignment.mode === "say-it-back") {
    if (assignment.rating !== assignment.clip.rating || !assignment.clip.roles.some((role) => role.id === assignment.roleId)) throw unavailable();
    // Invitations contain only stable reference assets, never private recording links.
    const assets = [assignment.clip.videoUrl, assignment.clip.posterUrl, assignment.clip.referenceAudioUrl, ...assignment.clip.roles.map((role) => role.dubAudioUrl)].filter((asset): asset is string => Boolean(asset));
    if (assets.some((asset) => !asset.startsWith("/media/say-it-back/") && (new URL(asset).search || /\/storage\/v1\/object\/sign\//.test(asset)))) throw unavailable();
  }
  return assignment;
}

type Pack = { access: "free" | "pro" | "rotating"; state: string; draw_enabled?: boolean; available_from: string | null; available_until: string | null };
async function assignmentAvailability(assignment: GroupAssignment, maxRating: ContentRating): Promise<{ requiresPro: boolean }> {
  assertContentRating(assignment.rating, maxRating);
  const admin = createSupabaseAdminClient();
  if (assignment.mode === "classic") {
    const [prompt, energy] = await Promise.all([
      admin.from("prompts").select("id,state,rating,available_from,available_until,pack_prompts(content_packs(access,state,draw_enabled,available_from,available_until))").eq("id", assignment.promptId).maybeSingle(),
      admin.from("energy_modifiers").select("id,state").eq("id", assignment.energyId).maybeSingle(),
    ]);
    checked(prompt.error); checked(energy.error);
    if (!prompt.data || prompt.data.state !== "published" || !energy.data || energy.data.state !== "published") throw unavailable();
    const now = Date.now();
    if ((prompt.data.available_from && Date.parse(String(prompt.data.available_from)) > now) || (prompt.data.available_until && Date.parse(String(prompt.data.available_until)) <= now)) throw unavailable();
    assertContentRating(prompt.data.rating as ContentRating, maxRating);
    const memberships = (prompt.data.pack_prompts ?? []) as unknown as { content_packs: Pack | Pack[] | null }[];
    // Like existing invitations, retirement from new draws does not alter a frozen assignment.
    return resolvePromptPackEntitlement(memberships.flatMap((item) => Array.isArray(item.content_packs) ? item.content_packs : item.content_packs ? [item.content_packs] : []), "challenge");
  }
  if (assignment.mode === "say-it-back") {
    const clip = await admin.from("say_clip_versions").select("manifest,enabled").eq("id", `${assignment.clip.id}:${assignment.clip.version}`).maybeSingle();
    checked(clip.error);
    if (!clip.data?.enabled) throw unavailable();
    const live = sayClipSchema.parse(clip.data.manifest);
    assertContentRating(live.rating, maxRating);
    if (canonicalAssignmentJson(live) !== canonicalAssignmentJson(assignment.clip)) throw unavailable();
  }
  return { requiresPro: false };
}

/** Called only after export ownership validation. No client-supplied snapshot enters here. */
export async function ensurePublicAssignment(value: GroupAssignment, origin: string): Promise<{ code: string; url: string }> {
  const assignment = parsePublicAssignment(value);
  await assignmentAvailability(assignment, "mature");
  const fingerprint = createHash("sha256").update(canonicalAssignmentJson(assignment)).digest("hex");
  const code = fingerprint.slice(0, 12);
  const admin = createSupabaseAdminClient();
  const inserted = await admin.from("public_assignment_links").upsert({ code, fingerprint, mode: assignment.mode, assignment }, { onConflict: "fingerprint", ignoreDuplicates: true });
  checked(inserted.error);
  const found = await admin.from("public_assignment_links").select("code,fingerprint,disabled_at").eq("fingerprint", fingerprint).maybeSingle();
  checked(found.error);
  if (!found.data || found.data.code !== code || found.data.disabled_at) throw unavailable();
  return { code, url: `${new URL(origin).origin}/a/${code}` };
}

export async function getPublicAssignmentDetails(code: string, maxRating: ContentRating): Promise<{ assignment: GroupAssignment; requiresPro: boolean }> {
  if (!/^[a-f0-9]{12}$/.test(code)) throw unavailable();
  const found = await createSupabaseAdminClient().from("public_assignment_links").select("assignment,fingerprint,disabled_at").eq("code", code).maybeSingle();
  checked(found.error);
  if (!found.data || found.data.disabled_at) throw unavailable();
  const assignment = parsePublicAssignment(found.data.assignment);
  if (createHash("sha256").update(canonicalAssignmentJson(assignment)).digest("hex") !== found.data.fingerprint) throw unavailable();
  return { assignment, ...await assignmentAvailability(assignment, maxRating) };
}

export async function getPublicAssignment(code: string, maxRating: ContentRating): Promise<GroupAssignment> {
  return (await getPublicAssignmentDetails(code, maxRating)).assignment;
}

export async function resolvePublicClassicAssignment(code: string, maxRating: ContentRating, _user: User | null, usage: JudgingUsage): Promise<CanonicalDeliveryContent> {
  void _user; // Ownership belongs to the attempt; this shared assignment contains no player data.
  const { assignment, requiresPro } = await getPublicAssignmentDetails(code, maxRating);
  if (assignment.mode !== "classic") throw unavailable();
  if (assignment.scoringVersion !== SCORING_VERSION || assignment.rubricVersion !== RUBRIC_VERSION) throw new AppError("ASSIGNMENT_RULES_UNAVAILABLE", "This assignment uses an older judge. You can still practice and export a take without scoring.", 409);
  if (requiresPro && usage.tier !== "pro") throw new AppError("PRO_REQUIRED", "This assignment belongs to a Pro pack.", 403);
  return { ...assignment, requiresPro, dailyDate: null, dailyMarket: null };
}
