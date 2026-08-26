import "server-only";

import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const ACCOUNT_MEDIA_PAGE_SIZE = 500;
export const ACCOUNT_MEDIA_DELETE_BATCH_SIZE = 100;

export type AccountDeletionCheckpoint =
  | "contained"
  | "billing_deleted"
  | "media_deleted"
  | "identity_deleted";

export interface AccountDeletionJob {
  userId: string;
  state: "processing" | "failed" | "completed";
  checkpoint: AccountDeletionCheckpoint;
  stripeCustomerId: string | null;
  attemptCount: number;
}

export interface DeliveryMediaRow {
  id: string;
  recording_path?: unknown;
  share_asset_path?: unknown;
}

interface DeleteDeliveryMediaInput {
  ownerId: string;
  loadPage: (
    afterId: string | null,
    limit: number,
  ) => Promise<{ rows: DeliveryMediaRow[]; error?: unknown }>;
  remove: (
    bucket: "delivery-audio" | "delivery-share",
    paths: string[],
  ) => Promise<{ error?: unknown }>;
  pageSize?: number;
  batchSize?: number;
}

export function isOwnerStoragePath(path: string, ownerId: string): boolean {
  return (
    path.length > ownerId.length + 1 &&
    path.length <= 512 &&
    path.startsWith(`${ownerId}/`) &&
    !/[\\\u0000-\u001f\u007f]/.test(path) &&
    path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
  );
}

function checkedPath(value: unknown, ownerId: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  const path = String(value);
  if (!isOwnerStoragePath(path, ownerId)) {
    throw new AppError(
      "ACCOUNT_MEDIA_PATH_INVALID",
      "Account media cleanup needs an operator review before deletion can finish.",
      503,
      { retryable: true },
    );
  }
  return path;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

/**
 * Streams delivery paths with keyset pagination and deletes them in bounded
 * batches. It deliberately fails closed on a corrupt/foreign path so identity
 * deletion cannot hide an orphaned object from the cleanup job.
 */
export async function deleteAllDeliveryMedia(
  input: DeleteDeliveryMediaInput,
): Promise<{ rowsVisited: number; objectsRequested: number }> {
  const pageSize = Math.max(1, Math.min(input.pageSize ?? ACCOUNT_MEDIA_PAGE_SIZE, 1_000));
  const batchSize = Math.max(
    1,
    Math.min(input.batchSize ?? ACCOUNT_MEDIA_DELETE_BATCH_SIZE, 100),
  );
  let afterId: string | null = null;
  let rowsVisited = 0;
  let objectsRequested = 0;

  for (;;) {
    const page = await input.loadPage(afterId, pageSize);
    if (page.error) {
      throw new ExternalServiceError("Supabase account media listing", {
        cause: page.error,
      });
    }
    if (page.rows.length > pageSize) {
      throw new AppError(
        "ACCOUNT_MEDIA_PAGE_INVALID",
        "Account media cleanup returned an invalid page.",
        503,
        { retryable: true },
      );
    }
    if (!page.rows.length) break;

    const audioPaths = new Set<string>();
    const sharePaths = new Set<string>();
    let previousId = afterId;
    for (const row of page.rows) {
      const rowId = String(row.id ?? "");
      if (!rowId || (previousId !== null && rowId <= previousId)) {
        throw new AppError(
          "ACCOUNT_MEDIA_CURSOR_INVALID",
          "Account media cleanup could not advance safely.",
          503,
          { retryable: true },
        );
      }
      previousId = rowId;
      const audio = checkedPath(row.recording_path, input.ownerId);
      const share = checkedPath(row.share_asset_path, input.ownerId);
      if (audio) audioPaths.add(audio);
      if (share) sharePaths.add(share);
    }

    const bucketPaths: Array<{
      bucket: "delivery-audio" | "delivery-share";
      paths: string[];
    }> = [
      { bucket: "delivery-audio", paths: [...audioPaths] },
      { bucket: "delivery-share", paths: [...sharePaths] },
    ];
    for (const entry of bucketPaths) {
      for (const batch of chunks(entry.paths, batchSize)) {
        const removal = await input.remove(entry.bucket, batch);
        if (removal.error) {
          throw new ExternalServiceError("Supabase account media deletion", {
            cause: removal.error,
          });
        }
        objectsRequested += batch.length;
      }
    }

    rowsVisited += page.rows.length;
    afterId = String(page.rows.at(-1)!.id);
    if (page.rows.length < pageSize) break;
  }

  return { rowsVisited, objectsRequested };
}

export function isStripeResourceMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; statusCode?: unknown; status?: unknown };
  return (
    candidate.code === "resource_missing" ||
    candidate.statusCode === 404 ||
    candidate.status === 404
  );
}

export function safeDeletionErrorCode(error: unknown): string {
  if (error instanceof AppError) return error.code.slice(0, 80);
  if (error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(error.name)) {
    return error.name;
  }
  return "PROVIDER_FAILURE";
}

export async function assertAccountNotDeleting(userId: string): Promise<void> {
  const { data, error } = await createSupabaseAdminClient()
    .from("account_deletion_jobs")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new ExternalServiceError("Supabase account status", { cause: error });
  }
  if (data) {
    throw new AppError(
      "ACCOUNT_DELETION_IN_PROGRESS",
      "This account is already being deleted. Retry deletion from Settings if it did not finish.",
      409,
      { retryable: true },
    );
  }
}

export async function reconcileCompletedAccountDeletions(limit = 100): Promise<number> {
  const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 1_000));
  const { data, error } = await createSupabaseAdminClient().rpc(
    "reconcile_completed_account_deletions",
    { p_limit: boundedLimit },
  );
  if (error) {
    throw new ExternalServiceError("Supabase account deletion reconciliation", {
      cause: error,
    });
  }
  return Number(data ?? 0);
}
