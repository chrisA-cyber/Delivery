#!/usr/bin/env node
/** Validate a curated manifest; --apply --project <ref> inserts immutable versions. */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const projectIndex = args.indexOf("--project");
const project = projectIndex >= 0 ? args[projectIndex + 1] : null;
const filename = args.find((arg, i) => !arg.startsWith("--") && !(projectIndex >= 0 && i === projectIndex + 1))
  ?? "src/lib/say-it-back/catalog.json";
const localAsset = z.string().regex(/^\/media\/say-it-back\/[a-z0-9/_.-]+$/)
  .refine((value) => !value.includes(".."), "Asset paths must stay inside public/media/say-it-back");
const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
const interval = z.object({ start: z.number().min(0), end: z.number().positive() }).strict();
const clipSchema = z.object({
  id, version: id, title: z.string().min(2).max(100), description: z.string().min(5).max(400),
  duration: z.number().positive().max(18.5),
  difficulty: z.enum(["easy", "medium", "hard"]), rating: z.enum(["everyone", "teen", "mature"]),
  category: z.string().min(2).max(80), tags: z.array(z.string().min(1).max(60)).max(12),
  videoUrl: localAsset, posterUrl: localAsset, referenceAudioUrl: localAsset.optional(),
  roles: z.array(z.object({ id, name: z.string().min(1), description: z.string().min(1),
    muteIntervals: z.array(interval).min(1), dubAudioUrl: localAsset.optional() }).strict()).min(1).max(4),
  cues: z.array(z.object({ id, roleId: id, text: z.string().min(1).max(400),
    start: z.number().min(0), end: z.number().positive() }).strict()).min(1).max(60),
  source: z.object({ title: z.string().min(1), creator: z.string().min(1), url: z.string().url(),
    license: z.string().min(1), licenseUrl: z.string().url(), attribution: z.string().min(1),
    reuseNote: z.string().min(10), excerptStart: z.number().min(0), excerptEnd: z.number().positive() }).strict(),
  assetIntegrity: z.record(z.string().regex(/^[a-f0-9]{64}$/)),
}).strict();

function canonical(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => JSON.parse(canonical(item))));
  if (value && typeof value === "object") return JSON.stringify(Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, JSON.parse(canonical(value[key]))])));
  return JSON.stringify(value);
}

try {
  const clips = z.array(clipSchema).min(1).max(100).parse(JSON.parse(await readFile(path.resolve(root, filename), "utf8")));
  const versions = new Set();
  let totalBytes = 0;
  for (const clip of clips) {
    const key = `${clip.id}:${clip.version}`;
    if (versions.has(key)) throw new Error(`Duplicate clip version: ${key}`);
    versions.add(key);
    if (Math.abs(clip.source.excerptEnd - clip.source.excerptStart - clip.duration) > 0.06)
      throw new Error(`${key}: excerpt boundaries must agree with duration`);
    const roles = new Set(clip.roles.map((role) => role.id));
    if (roles.size !== clip.roles.length) throw new Error(`${key}: duplicate role id`);
    const cueIds = new Set();
    for (const cue of clip.cues) {
      if (!roles.has(cue.roleId) || cueIds.has(cue.id) || cue.start >= cue.end || cue.end > clip.duration)
        throw new Error(`${key}: invalid cue ${cue.id}`);
      cueIds.add(cue.id);
    }
    for (const role of clip.roles) {
      if (!clip.cues.some((cue) => cue.roleId === role.id)) throw new Error(`${key}: role ${role.id} has no dialogue`);
      let end = -1;
      for (const mute of role.muteIntervals) {
        if (mute.start < end || mute.start >= mute.end || mute.end > clip.duration)
          throw new Error(`${key}: invalid mute interval for ${role.id}`);
        end = mute.end;
      }
      for (const cue of clip.cues.filter((item) => item.roleId === role.id)) {
        if (!role.muteIntervals.some((mute) => mute.start <= cue.start && mute.end >= cue.end))
          throw new Error(`${key}: selected dialogue is not covered by a mute interval`);
      }
    }
    const assets = [clip.videoUrl, clip.posterUrl, clip.referenceAudioUrl, ...clip.roles.map((role) => role.dubAudioUrl)].filter(Boolean);
    for (const asset of new Set(assets)) {
      const assetPath = path.join(root, "public", asset);
      const info = await stat(assetPath);
      if (!info.isFile() || !info.size || info.size > 8 * 1024 * 1024) throw new Error(`${key}: invalid or oversized asset ${asset}`);
      const hash = createHash("sha256").update(await readFile(assetPath)).digest("hex");
      if (clip.assetIntegrity[asset] !== hash) throw new Error(`${key}: asset hash mismatch ${asset}; publish a new clip version after edits`);
      totalBytes += info.size;
    }
  }
  console.log(`Validated ${clips.length} immutable clip versions and ${(totalBytes / 1048576).toFixed(1)} MB of media.`);
  if (apply) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey || !project || new URL(url).hostname !== `${project}.supabase.co`)
      throw new Error("Apply requires Supabase environment variables and --project matching the intended project ref.");
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const pending = [];
    // Read every existing version before writing: a changed version cannot partially import.
    for (const clip of clips) {
      const key = `${clip.id}:${clip.version}`;
      const { data, error } = await db.from("say_clip_versions").select("manifest").eq("id", key).maybeSingle();
      if (error) throw new Error(`Unable to check catalog version: ${error.code ?? "database error"}`);
      if (data && canonical(data.manifest) !== canonical(clip)) throw new Error(`${key} already exists with different content. Create a new version.`);
      if (!data) pending.push({ id: key, clip_id: clip.id, version: clip.version, manifest: clip, enabled: true });
    }
    if (pending.length) {
      const { error } = await db.from("say_clip_versions").insert(pending);
      if (error) throw new Error(`Catalog insert failed: ${error.code ?? "database error"}`);
    }
    console.log(`Inserted ${pending.length} new clip versions; ${clips.length - pending.length} already matched.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Clip import failed");
  process.exitCode = 1;
}
