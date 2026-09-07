import "server-only";
import { isDeepStrictEqual } from "node:util";
import type { GroupAssignment } from "@/lib/groups/types";
import type { ContentRating } from "@/lib/content/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { assertAccountNotDeleting, isOwnerStoragePath } from "@/lib/server/account-deletion";
import { assertContentRating, challengeHasActiveProfileContainment } from "@/lib/server/content";
import { assertPublicContentAllowed, isMatureTake } from "@/lib/server/content-publication";
import { sayClipSchema } from "@/lib/say-it-back/schema";
import { switchChallengeSchema } from "@/lib/switch/schema";
import type { SwitchViewer } from "@/lib/server/switch";
import { validGroupStoragePath } from "@/lib/server/group-rounds";
import { ensurePublicAssignment } from "@/lib/server/public-assignments";
import type { ClipEditSettings } from "@/lib/video-composition";

import { loadCamera } from "@/lib/server/camera-media";
import type { CameraSegment } from "@/lib/camera";

type Row = Record<string, unknown>;
export type ExportMode = "classic" | "switch" | "say-it-back";
export type ExportSourceKind = "delivery" | "classic_video_attempt" | "switch_attempt" | "say_attempt" | "group_take";
export interface ExportInput {
  recordingPath: string; audioHash: string | null; durationMs: number; recordingOffsetMs: number;
  assignment: GroupAssignment; invitationUrl: string; displayName: string | null; avatarPath: string | null;
  score: {value: number; label: string; beta?: boolean} | null;
  settings?: ClipEditSettings;
  camera?: CameraSegment[];
}
export interface ExportSource { kind: ExportSourceKind; row: Row; ownerKey: string; userId: string | null; input: ExportInput }
export const exportUnavailable = () => new AppError("EXPORT_UNAVAILABLE", "This performance is private, expired, or unavailable. Open a take you recorded to create its video.", 404);
export function checkedExport(error: unknown): void { if (error) throw new ExternalServiceError("Video export storage", {cause:error}); }
const obj = (v: unknown): Row => v && typeof v === "object" ? v as Row : {};
const one = (v: unknown): Row => obj(Array.isArray(v) ? v[0] : v);
const expired = (v: unknown) => !!v && new Date(String(v)).getTime() <= Date.now();

export function assertSceneExportEligible(assignment: GroupAssignment): void {
  if (assignment.mode !== "say-it-back") return;
  const source = assignment.clip.source;
  // Read the existing provenance. Never infer new creator permission from playback availability.
  const reusable = source.exportAllowed === true || /^CC BY 3\.0/i.test(source.license) || /public domain/i.test(source.license) && !/not|unverified/i.test(source.license);
  if (!reusable) throw new AppError("SCENE_EXPORT_UNAVAILABLE", "This scene is available for in-app replay, but its recorded source permissions do not cover downloadable videos. Try one of the film scenes with a reusable license.", 409);
}
export async function assertExportAccount(userId: string | null): Promise<void> {
  if (!userId) return;
  await assertAccountNotDeleting(userId);
  const restrictions = await createSupabaseAdminClient().from("account_restrictions").select("user_id,kind,starts_at,ends_at").eq("user_id", userId).in("kind", ["profile-limit", "profile-remove", "recording", "publish"]);
  checkedExport(restrictions.error);
  if ((restrictions.data ?? []).some(r => ["recording","publish"].includes(String(r.kind)) && new Date(String(r.starts_at)).getTime()<=Date.now() && (!r.ends_at || new Date(String(r.ends_at)).getTime()>Date.now()))) throw exportUnavailable();
  if (challengeHasActiveProfileContainment((restrictions.data ?? []) as {user_id:string;kind:string;starts_at:string;ends_at:string|null}[], [userId])) throw exportUnavailable();
}

export async function resolveExportSource(mode: ExportMode, id: string, viewer: SwitchViewer, maxRating: ContentRating, options: {includeName?:boolean;includeScore?:boolean;invitation?:boolean;mediaOnly?:boolean} = {}): Promise<ExportSource> {
  const admin = createSupabaseAdminClient();
  let kind: ExportSourceKind = mode === "switch" ? "switch_attempt" : mode === "say-it-back" ? "say_attempt" : "delivery";
  let result = await admin.from(mode === "switch" ? "switch_attempts" : mode === "say-it-back" ? "say_attempts" : "deliveries").select("*").eq("id", id).maybeSingle();
  checkedExport(result.error);
  if (!result.data && mode === "classic") { kind = "classic_video_attempt"; result = await admin.from("classic_video_attempts").select("*").eq("id", id).maybeSingle(); checkedExport(result.error); }
  if (!result.data && mode === "classic") { kind = "group_take"; result = await admin.from("challenge_group_takes").select("*").eq("id", id).eq("mode", "classic").maybeSingle(); checkedExport(result.error); }
  const row = result.data;
  if (!row || row.deleted_at || expired(row.expires_at) || !row.recording_path || ["removed", "rejected", "deleted", "hidden"].includes(String(row.state)) || ["rejected", "review"].includes(String(row.moderation_state))) throw exportUnavailable();
  if(Array.isArray(row.moderation_labels) && row.moderation_labels.some(label=>["publish-rejected","publish-review","account-deletion"].includes(String(label))))throw exportUnavailable();
  let userId = row.user_id ? String(row.user_id) : null;
  let ownerKey = String(row.owner_key ?? (userId ? `user:${userId}` : ""));
  let group: Row | null = null;
  let member: Row | null = null;
  if (kind === "group_take") {
    const members = await admin.from("challenge_group_members").select("*").eq("id", String(row.member_id)).maybeSingle(); checkedExport(members.error); member = members.data;
    const groups = await admin.from("challenges").select("*").eq("id", String(row.challenge_id)).maybeSingle(); checkedExport(groups.error); group = groups.data;
    if (!member || !group || member.challenge_id !== row.challenge_id || expired(group.group_replay_until) || member.hidden_at) throw exportUnavailable();
    userId = member.user_id ? String(member.user_id) : null;
    ownerKey = userId ? `user:${userId}` : `guest:${member.guest_owner_hash}`;
  }
  if (ownerKey !== viewer.ownerKey) throw exportUnavailable();
  await assertExportAccount(userId);
  const path = String(row.recording_path);
  const guestHash = String(member?.guest_owner_hash ?? row.guest_owner_hash ?? "");
  if (!(kind === "group_take" ? validGroupStoragePath(path, member!, String(group!.id)) : userId ? isOwnerStoragePath(path, userId) : /^[a-f0-9]{64}$/.test(guestHash) && isOwnerStoragePath(path, `guests/${guestHash}`))) throw exportUnavailable();
  let assignment: GroupAssignment;
  let score: ExportInput["score"] = null;
  if (mode === "switch") {
    const challenge = switchChallengeSchema.parse(row.challenge_snapshot);
    assignment = {mode,challenge,rating:challenge.rating,scoringVersion:String(row.scoring_version),rubricVersion:challenge.rubricVersion};
    const s = obj(row.score);
    if (row.status === "scored" && typeof s.overall === "number" && s.overall >= 0 && s.overall <= 100) score = {value:s.overall,label:"Switch score",beta:true};
  } else if (mode === "say-it-back") {
    const clip = sayClipSchema.parse(row.clip_snapshot);
    const version = await admin.from("say_clip_versions").select("enabled,manifest").eq("id", String(row.clip_version_id)).maybeSingle(); checkedExport(version.error);
    if (!version.data?.enabled || !isDeepStrictEqual(sayClipSchema.parse(version.data.manifest), clip)) throw exportUnavailable();
    assignment = {mode,clip,roleId:String(row.role_id),rating:clip.rating,scoringVersion:String(row.scoring_version)};
    const s = obj(row.score);
    if (row.status === "scored" && typeof s.overall === "number" && s.overall >= 0 && s.overall <= 100) score = {value:s.overall,label:s.timing === null ? "Words only" : "Scene match"};
  } else if (kind === "classic_video_attempt") {
    assignment = row.assignment_snapshot as GroupAssignment;
  } else if (kind === "group_take") {
    assignment = group!.group_assignment as GroupAssignment;
    const s = obj(row.score); const scores = obj(s.scores);
    if (s.source === "openai" && typeof scores.overall === "number" && scores.overall >= 0 && scores.overall <= 100) score = {value:scores.overall,label:"Delivery score"};
  } else {
    const details = await admin.from("deliveries").select("*,prompts!inner(*),energy_modifiers(*),delivery_scores(*)").eq("id", id).maybeSingle(); checkedExport(details.error);
    if (!details.data) throw exportUnavailable();
    const prompt = one(details.data.prompts), energy = one(details.data.energy_modifiers), s = one(details.data.delivery_scores), evidence = obj(s.evidence);
    if (["removed", "rejected", "archived"].includes(String(prompt.state))) throw exportUnavailable();
    assignment = {mode:"classic",promptId:String(prompt.id),promptSlug:String(prompt.slug),promptText:String(evidence.requested_prompt_text ?? prompt.body),energyId:String(energy.id),energySlug:String(energy.slug),energy:String(evidence.requested_energy ?? energy.instruction),category:String(prompt.category),difficulty:Number(prompt.difficulty),rating:prompt.rating as ContentRating,scoringVersion:String(evidence.scoring_version ?? "legacy-unversioned"),rubricVersion:String(s.rubric_version ?? "legacy-unversioned")};
    if (s.provider === "openai" && typeof s.overall === "number" && s.overall >= 0 && s.overall <= 100) score = {value:s.overall,label:"Delivery score"};
  }
  if (assignment.mode !== mode) throw exportUnavailable();
  const privateOnly = isMatureTake(assignment.rating, Array.isArray(row.moderation_labels) ? row.moderation_labels as string[] : []);
  assertContentRating(privateOnly ? "mature" : assignment.rating, maxRating);
  if (!options.mediaOnly) {
    if (!privateOnly) assertPublicContentAllowed(assignment.rating);
    assertSceneExportEligible(assignment);
  }
  let displayName: string | null = null, avatarPath: string | null = null;
  if (options.includeName) {
    displayName = String(member?.display_name ?? row.display_name ?? "").trim().slice(0,64) || null;
    if (userId) {
      const profile = await admin.from("profiles").select("display_name,handle,avatar_path").eq("id",userId).maybeSingle(); checkedExport(profile.error);
      if (profile.data) { displayName = String(profile.data.display_name || profile.data.handle || displayName || "").slice(0,64) || null; const candidate = String(profile.data.avatar_path ?? ""); if (candidate && isOwnerStoragePath(candidate,userId)) avatarPath=candidate; }
    }
  }
  // The stable Netlify hostname already redirects paths and query strings to the playable app.
  const invitation = options.invitation && !privateOnly && !(assignment.mode === "say-it-back" && assignment.clip.id.startsWith("custom-")) ? await ensurePublicAssignment(assignment,"https://deliverygame.netlify.app") : null;
  return {kind,row,ownerKey,userId,input:{camera:await loadCamera(kind,id),recordingPath:path,audioHash:row.audio_hash ? String(row.audio_hash) : null,durationMs:Number(row.duration_ms),recordingOffsetMs:Number(row.recording_offset_ms ?? 0),assignment,invitationUrl:invitation?.url ?? "",displayName,avatarPath,score:options.includeScore ? score : null}};
}
