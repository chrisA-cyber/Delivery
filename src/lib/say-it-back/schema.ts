import { z } from "zod";
import { MAX_SAY_RECORDING_MS } from "@/lib/audio-capture";

const asset = z.string().max(2048).refine((value) => {
  if (/^\/media\/say-it-back\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes("..")) return true;
  if (/^\/api\/say-it-back\/imports\/[a-f0-9-]{36}\/media\/(source|video|poster|reference|backing)\?key=[a-f0-9]{48}$/.test(value)) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}, "Use a stable HTTPS media asset or a Delivery scene media path.");
const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
const interval = z.object({ start: z.number().min(0).max(MAX_SAY_RECORDING_MS / 1000), end: z.number().positive().max(MAX_SAY_RECORDING_MS / 1000) }).refine((value) => value.end > value.start);
export const sayClipSchema = z.object({
  id, version: id, title: z.string().min(2).max(100), description: z.string().min(5).max(500),
  duration: z.number().min(1).max(MAX_SAY_RECORDING_MS / 1000), difficulty: z.enum(["easy", "medium", "hard"]),
  rating: z.enum(["everyone", "teen", "mature"]), category: z.string().min(2).max(60), tags: z.array(z.string().max(40)).max(10),
  videoUrl: asset, posterUrl: asset, referenceAudioUrl: asset.optional(),
  assetIntegrity: z.record(z.string().regex(/^[a-f0-9]{64}$/)).optional(),
  roles: z.array(z.object({ id, name: z.string().min(1).max(80), description: z.string().max(300), muteIntervals: z.array(interval).min(1).max(40), dubAudioUrl: asset.optional() })).min(1).max(4),
  cues: z.array(z.object({ id, roleId: id, text: z.string().min(1).max(500), start: z.number().min(0), end: z.number().positive() })).min(1).max(40),
  source: z.object({ title: z.string().min(1).max(200), creator: z.string().min(1).max(200), url: z.string().url(), license: z.string().min(2).max(200), licenseUrl: z.string().url(), attribution: z.string().min(2).max(1000), reuseNote: z.string().min(10).max(1500), exportAllowed: z.boolean().optional(), excerptStart: z.number().min(0), excerptEnd: z.number().positive() }),
}).superRefine((clip, ctx) => {
  const roleIds = new Set(clip.roles.map((role) => role.id));
  if (roleIds.size !== clip.roles.length || new Set(clip.cues.map((cue) => cue.id)).size !== clip.cues.length) ctx.addIssue({ code: "custom", message: "Role and cue IDs must be unique." });
  for (const cue of clip.cues) {
    // Supporting speakers may have cues without being playable roles.
    if (cue.end <= cue.start || cue.end > clip.duration + 0.1) ctx.addIssue({ code: "custom", message: "Cue exceeds excerpt bounds." });
  }
  for (const role of clip.roles) {
    if (!clip.cues.some((cue) => cue.roleId === role.id)) ctx.addIssue({ code: "custom", message: "Every playable role needs dialogue." });
    if (role.muteIntervals.some((range) => range.end > clip.duration + 0.1)) ctx.addIssue({ code: "custom", message: "Mute interval exceeds excerpt bounds." });
  }
  if (Math.abs(clip.source.excerptEnd - clip.source.excerptStart - clip.duration) > 0.25) ctx.addIssue({ code: "custom", message: "Source excerpt must match media duration." });
});
