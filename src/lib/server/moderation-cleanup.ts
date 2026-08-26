import "server-only";

import { ExternalServiceError } from "@/lib/server/api-error";
import { isOwnerStoragePath } from "@/lib/server/account-deletion";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ModerationCleanupBucket = "delivery-share" | "avatars";

export interface ModerationCleanupJob {
  id: string;
  bucket: ModerationCleanupBucket;
  objectPath: string;
  attemptCount: number;
}

interface CleanupDependencies {
  remove: (
    bucket: ModerationCleanupBucket,
    paths: string[],
  ) => Promise<{ error?: unknown }>;
  finish: (
    jobIds: string[],
    success: boolean,
    errorCode?: string,
  ) => Promise<{ dead: number }>;
}

export function isModerationStoragePath(path: string): boolean {
  const ownerId = path.split("/", 1)[0] ?? "";
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId) &&
    isOwnerStoragePath(path, ownerId)
  );
}

export async function drainClaimedModerationJobs(
  jobs: ModerationCleanupJob[],
  dependencies: CleanupDependencies,
): Promise<{ completed: number; retrying: number; dead: number }> {
  let completed = 0;
  let retrying = 0;
  let dead = 0;
  const valid = new Map<ModerationCleanupBucket, ModerationCleanupJob[]>();
  const invalid = jobs.filter((job) => !isModerationStoragePath(job.objectPath));
  for (const job of jobs) {
    if (!isModerationStoragePath(job.objectPath)) continue;
    const group = valid.get(job.bucket) ?? [];
    group.push(job);
    valid.set(job.bucket, group);
  }

  if (invalid.length) {
    const result = await dependencies.finish(
      invalid.map((job) => job.id),
      false,
      "INVALID_STORAGE_PATH",
    );
    retrying += invalid.length - result.dead;
    dead += result.dead;
  }

  for (const [bucket, group] of valid) {
    const removal = await dependencies.remove(
      bucket,
      [...new Set(group.map((job) => job.objectPath))],
    );
    const success = !removal.error;
    const result = await dependencies.finish(
      group.map((job) => job.id),
      success,
      success ? undefined : "STORAGE_REMOVE_FAILED",
    );
    if (success) completed += group.length;
    else retrying += group.length - result.dead;
    dead += result.dead;
  }

  return { completed, retrying, dead };
}

export async function processModerationStorageCleanup(limit = 100): Promise<{
  claimed: number;
  completed: number;
  retrying: number;
  dead: number;
}> {
  const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 100));
  const admin = createSupabaseAdminClient();
  const claim = await admin.rpc("claim_moderation_storage_cleanup", {
    p_limit: boundedLimit,
    p_lease_seconds: 120,
  });
  if (claim.error) {
    throw new ExternalServiceError("Supabase moderation cleanup claim", {
      cause: claim.error,
    });
  }
  const jobs = ((claim.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.job_id),
    bucket: String(row.bucket) as ModerationCleanupBucket,
    objectPath: String(row.object_path),
    attemptCount: Number(row.attempt_count),
  }));
  if (!jobs.length) return { claimed: 0, completed: 0, retrying: 0, dead: 0 };

  const result = await drainClaimedModerationJobs(jobs, {
    remove: async (bucket, paths) => {
      const removal = await admin.storage.from(bucket).remove(paths);
      return { error: removal.error ?? undefined };
    },
    finish: async (jobIds, success, errorCode) => {
      const finish = await admin.rpc("finish_moderation_storage_cleanup", {
        p_job_ids: jobIds,
        p_success: success,
        p_error_code: errorCode ?? null,
      });
      if (finish.error) {
        throw new ExternalServiceError("Supabase moderation cleanup receipt", {
          cause: finish.error,
        });
      }
      const row = (Array.isArray(finish.data) ? finish.data[0] : finish.data) as
        | { dead?: unknown }
        | null;
      return { dead: Number(row?.dead ?? 0) };
    },
  });
  return { claimed: jobs.length, ...result };
}

export async function attemptImmediateModerationCleanup(receipt: unknown): Promise<{
  attempted: number;
  failed: number;
}> {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return { attempted: 0, failed: 0 };
  }
  const value = receipt as Record<string, unknown>;
  const shares = Array.isArray(value.revokedShareAssetPaths)
    ? value.revokedShareAssetPaths.map(String)
    : [];
  const avatar = typeof value.revokedAvatarPath === "string"
    ? [value.revokedAvatarPath]
    : [];
  const groups: Array<[ModerationCleanupBucket, string[]]> = [
    ["delivery-share", [...new Set(shares)]],
    ["avatars", [...new Set(avatar)]],
  ];
  const admin = createSupabaseAdminClient();
  let attempted = 0;
  let failed = 0;
  for (const [bucket, paths] of groups) {
    if (!paths.length) continue;
    attempted += paths.length;
    if (paths.some((path) => !isModerationStoragePath(path))) {
      failed += paths.length;
      continue;
    }
    const removal = await admin.storage.from(bucket).remove(paths);
    if (removal.error) failed += paths.length;
  }
  return { attempted, failed };
}
