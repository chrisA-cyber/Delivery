import "server-only";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/server/api-error";
import { assertAccountNotDeleting } from "@/lib/server/account-deletion";
import { resolveAndDownloadSource, inspectUploadedSource, prepareImportedMedia } from "@/lib/server/say-import-media";
import { transcribeSayAudio } from "@/lib/server/say-it-back-transcription";
import { SAY_IMPORT_BUCKET, checkSayImport, downloadImportAsset, importCuesFromWords, type SayImportAsset, type SayImportRow } from "@/lib/server/say-imports";

const leaseLost = () => new AppError("IMPORT_LEASE_LOST", "This import is no longer active.", 409);
const requestSignal = (parent?: AbortSignal) => parent ? AbortSignal.any([parent, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000);

/** Runs one import only when the existing export worker is idle. */
export async function runNextSayImport(parentSignal?: AbortSignal): Promise<boolean> {
  if (parentSignal?.aborted) return false;
  const admin = createSupabaseAdminClient();
  const claimed = await admin.rpc("claim_say_import", { p_lease_seconds: 360 }).abortSignal(requestSignal(parentSignal));
  checkSayImport(claimed.error);
  if (!claimed.data) return false;
  const row = claimed.data as unknown as SayImportRow;
  const signal = parentSignal ? AbortSignal.any([parentSignal, AbortSignal.timeout(300000)]) : AbortSignal.timeout(300000);
  let dir: string | undefined;
  const uploaded: string[] = [];
  const assets = { ...row.assets }, integrity = { ...row.integrity };
  let committed = false;

  async function assertLease() {
    signal.throwIfAborted();
    if (!row.lease_token || !row.lease_expires_at || Date.parse(row.lease_expires_at) <= Date.now()) throw leaseLost();
    const now = new Date().toISOString();
    const current = await admin.from("say_imports").select("id").eq("id", row.id).eq("lease_token", row.lease_token)
      .is("deleted_at", null).gt("lease_expires_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).abortSignal(requestSignal(signal)).maybeSingle();
    checkSayImport(current.error);
    if (!current.data) throw leaseLost();
  }

  async function upload(asset: SayImportAsset, file: string, mime: string, suffix: string) {
    await assertLease();
    const bytes = await readFile(file), key = `${row.id}/${row.lease_token}-${suffix}`;
    signal.throwIfAborted();
    // Each lease owns immutable objects. A stale worker can neither overwrite a
    // newer attempt nor delete its output during cleanup. Keep the path flat for
    // the existing import-folder expiry/deletion sweep.
    uploaded.push(key);
    const result = await admin.storage.from(SAY_IMPORT_BUCKET).upload(key, bytes, { contentType: mime, cacheControl: "0", upsert: false });
    checkSayImport(result.error); assets[asset] = key; integrity[asset] = createHash("sha256").update(bytes).digest("hex");
  }
  async function finish(values: Record<string, unknown>) {
    await assertLease();
    if (row.user_id) await assertAccountNotDeleting(row.user_id);
    const now = new Date().toISOString();
    const result = await admin.from("say_imports").update({ ...values, assets, integrity, job_kind: null, lease_token: null, lease_expires_at: null })
      .eq("id", row.id).eq("lease_token", row.lease_token!).is("deleted_at", null).gt("lease_expires_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`).select("id").abortSignal(requestSignal(signal)).maybeSingle();
    checkSayImport(result.error); if (!result.data) throw leaseLost(); committed = true;
  }

  async function cleanupUploads() {
    let obsolete: string[];
    if (committed) {
      // Successful re-trims no longer need the previous excerpt. The source is
      // retained, and no path still referenced by this commit is removed.
      const retained = new Set(Object.values(assets));
      obsolete = Object.values(row.assets).filter((key): key is string => typeof key === "string" && !retained.has(key));
    } else {
      if (!uploaded.length) return;
      // A timed-out UPDATE may already have committed. Re-read before removing
      // anything; uncertain cleanup is preferable to deleting a ready scene.
      const current = await admin.from("say_imports").select("assets,deleted_at").eq("id", row.id).abortSignal(requestSignal()).maybeSingle();
      checkSayImport(current.error);
      const retained = current.data && !current.data.deleted_at ? new Set(Object.values((current.data.assets ?? {}) as Record<string, unknown>)) : new Set();
      obsolete = uploaded.filter((key) => !retained.has(key));
    }
    obsolete = [...new Set(obsolete)].filter(key => key.startsWith(`${row.id}/`) && !key.includes(".."));
    if (obsolete.length) checkSayImport((await admin.storage.from(SAY_IMPORT_BUCKET).remove(obsolete)).error);
  }
  try {
    await assertLease();
    dir = await mkdtemp(path.join(tmpdir(), "delivery-import-"));
    if (row.user_id) await assertAccountNotDeleting(row.user_id);
    if (row.job_kind === "fetch") {
      let sourcePath: string, title = row.title, creator = row.creator, duration: number;
      if (row.assets.source) {
        sourcePath = path.join(dir, "source"); await downloadImportAsset(row, "source", sourcePath, signal);
        ({ duration } = await inspectUploadedSource(sourcePath, signal));
      } else {
        if (!row.source_url) throw new AppError("SCENE_SOURCE_REQUIRED", "Choose a video to import.", 422);
        const source = await resolveAndDownloadSource(row.source_url, dir, signal);
        sourcePath = source.path; title = source.title.slice(0, 100); creator = source.creator.slice(0, 200); duration = source.duration;
        await upload("source", sourcePath, "video/mp4", "source.mp4");
      }
      if (duration < 1) throw new AppError("SCENE_TOO_SHORT", "Choose a video at least one second long.", 422);
      await finish({ status: "source-ready", title, creator, source_duration: duration, source_mime: row.assets.source ? row.source_mime : "video/mp4",
        excerpt_start: 0, excerpt_end: Math.min(45, duration), error_message: null });
    } else if (row.job_kind === "prepare") {
      if (!row.assets.source) throw new AppError("SCENE_SOURCE_REQUIRED", "The original video is unavailable. Import it again.", 422);
      delete assets.backing; delete integrity.backing;
      const sourcePath = path.join(dir, "source"); await downloadImportAsset(row, "source", sourcePath, signal);
      await assertLease();
      const prepared = await prepareImportedMedia(sourcePath, dir, { start: row.excerpt_start, end: row.excerpt_end }, signal);
      await upload("video", prepared.videoPath, "video/mp4", "video.mp4");
      await upload("poster", prepared.posterPath, "image/jpeg", "poster.jpg");
      await upload("reference", prepared.referencePath, "audio/wav", "reference.wav");
      await assertLease();
      if (row.user_id) await assertAccountNotDeleting(row.user_id);
      let cues: SayImportRow["cues"] = [], warning: string | null = null;
      try {
        const bytes = await readFile(prepared.referencePath);
        signal.throwIfAborted();
        const transcription = await transcribeSayAudio(new File([bytes], "scene.wav", { type: "audio/wav" }));
        signal.throwIfAborted();
        cues = importCuesFromWords(transcription.text, transcription.words, prepared.duration);
        if (!transcription.words.length) warning = "Check the line timing before creating your scene.";
      } catch {
        signal.throwIfAborted();
        // Media and editing remain usable when speech recognition is unavailable.
        warning = "Automatic transcription was unavailable. Add the dialogue below to continue.";
      }
      if (!cues.length) {
        cues = [{ id: "line-1", text: "", start: 0, end: prepared.duration, selected: true }];
        warning ??= "No dialogue was detected. Add a line below to continue.";
      }
      await finish({ status: "ready", excerpt_end: row.excerpt_start + prepared.duration, cues, error_message: warning });
    } else throw new AppError("SCENE_JOB_INVALID", "Start this import again.", 422);
    console.log(JSON.stringify({ event: "say_import_ready", id: row.id, stage: row.job_kind }));
  } catch (error) {
    const message = error instanceof AppError ? error.message : "This source could not be prepared. Retry it or upload the video file.";
    try {
      // Lease loss, deletion, expiry or a newer successful commit must never be
      // overwritten with the old worker's failure state.
      if (row.lease_token) {
        const now = new Date().toISOString();
        const failed = await admin.from("say_imports").update({ status: "failed", error_message: message, job_kind: null, lease_token: null, lease_expires_at: null })
          .eq("id", row.id).eq("lease_token", row.lease_token).is("deleted_at", null).gt("lease_expires_at", now)
          .or(`expires_at.is.null,expires_at.gt.${now}`).abortSignal(requestSignal());
        checkSayImport(failed.error);
      }
    } catch { console.error(JSON.stringify({ event: "say_import_failure_write_deferred", id: row.id })); }
    console.error(JSON.stringify({ event: "say_import_failed", id: row.id, code: error instanceof AppError ? error.code : "IMPORT_FAILED" }));
  } finally {
    try { await cleanupUploads(); }
    catch { console.error(JSON.stringify({ event: "say_import_cleanup_deferred", id: row.id })); }
    finally { if (dir) await rm(dir, { recursive: true, force: true }); }
  }
  return true;
}
