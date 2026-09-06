import { z } from "zod";

import {
  type AccountDeletionCheckpoint,
  type AccountDeletionJob,
  deleteAllDeliveryMedia,
  isOwnerStoragePath,
  isStripeResourceMissing,
  safeDeletionErrorCode,
} from "@/lib/server/account-deletion";
import { AppError, ExternalServiceError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { enforceRateLimit, rateLimitHeaders, type RateLimitResult } from "@/lib/server/rate-limit";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";
import { deleteGroupAccountMedia } from "@/lib/server/group-rounds";
import { getStripe } from "@/lib/server/stripe";
import { requireUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({ confirmation: z.literal("DELETE") }).strict();
const checkpointRank: Record<AccountDeletionCheckpoint, number> = {
  contained: 0,
  billing_deleted: 1,
  media_deleted: 2,
  identity_deleted: 3,
};

function parseJob(value: unknown): AccountDeletionJob {
  if (!value || typeof value !== "object") {
    throw new ExternalServiceError("Supabase account deletion receipt");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.userId !== "string" ||
    (row.state !== "processing" && row.state !== "failed" && row.state !== "completed") ||
    !(String(row.checkpoint) in checkpointRank)
  ) {
    throw new ExternalServiceError("Supabase account deletion receipt");
  }
  return {
    userId: row.userId,
    state: row.state,
    checkpoint: String(row.checkpoint) as AccountDeletionCheckpoint,
    stripeCustomerId: typeof row.stripeCustomerId === "string" ? row.stripeCustomerId : null,
    attemptCount: Math.max(1, Number(row.attemptCount ?? 1)),
  };
}

export async function DELETE(request: Request) {
  const requestId = requestIdFrom(request);
  let rateLimit: RateLimitResult | undefined;
  try {
    assertSameOrigin(request);
    assertJsonRequest(request);
    assertContentLength(request, 1_024);
    const user = await requireUser();
    schema.parse(await request.json());
    rateLimit = await enforceRateLimit(`account-delete:${user.id}`, {
      // Provider outages may need several explicit retries; the durable saga
      // makes those retries safe without permitting an abusive hot loop.
      limit: 10,
      windowMs: 24 * 60 * 60 * 1_000,
    });
    const admin = createSupabaseAdminClient();
    const begin = await admin.rpc("begin_account_deletion", { p_user_id: user.id });
    if (begin.error) {
      throw new ExternalServiceError("Supabase account deletion containment", {
        cause: begin.error,
      });
    }
    let job = parseJob(begin.data);

    const advance = async (
      checkpoint: AccountDeletionCheckpoint,
      state: "processing" | "failed" | "completed" = "processing",
      errorStage: "billing" | "media" | "identity" | "receipt" | null = null,
      errorCode: string | null = null,
    ): Promise<AccountDeletionJob> => {
      const result = await admin.rpc("advance_account_deletion", {
        p_user_id: user.id,
        p_checkpoint: checkpoint,
        p_state: state,
        p_error_stage: errorStage,
        p_error_code: errorCode,
      });
      if (result.error) {
        throw new ExternalServiceError("Supabase account deletion receipt", {
          cause: result.error,
        });
      }
      return parseJob(result.data);
    };

    const retryableFailure = async (
      stage: "billing" | "media" | "identity",
      cause: unknown,
    ): Promise<never> => {
      try {
        job = await advance(job.checkpoint, "failed", stage, safeDeletionErrorCode(cause));
      } catch (receiptError) {
        // The response still fails closed. Operators can correlate this sanitized
        // stage with requestId; provider bodies and user data are never logged.
        console.error("Account deletion failure receipt could not be stored", {
          requestId,
          stage,
          receiptErrorName: receiptError instanceof Error ? receiptError.name : "unknown",
        });
      }
      throw new AppError(
        "ACCOUNT_DELETION_RETRYABLE",
        "Your account is hidden and billing cleanup is protected, but deletion did not finish. Please retry from Settings.",
        503,
        { stage, retryable: true },
        { cause },
      );
    };

    if (checkpointRank[job.checkpoint] < checkpointRank.billing_deleted) {
      try {
        if (job.stripeCustomerId) {
          try {
            await getStripe().customers.del(job.stripeCustomerId);
          } catch (error) {
            if (!isStripeResourceMissing(error)) throw error;
          }
        }
        job = await advance("billing_deleted");
      } catch (error) {
        await retryableFailure("billing", error);
      }
    }

    if (checkpointRank[job.checkpoint] < checkpointRank.media_deleted) {
      try {
        await deleteAllDeliveryMedia({
          ownerId: user.id,
          loadPage: async (afterId, limit) => {
            let query = admin
              .from("deliveries")
              .select("id,recording_path,share_asset_path")
              .eq("user_id", user.id)
              .order("id", { ascending: true })
              .limit(limit);
            if (afterId) query = query.gt("id", afterId);
            const page = await query;
            return {
              rows: (page.data ?? []) as Array<{
                id: string;
                recording_path?: unknown;
                share_asset_path?: unknown;
              }>,
              error: page.error ?? undefined,
            };
          },
          remove: async (bucket, paths) => {
            const result = await admin.storage.from(bucket).remove(paths);
            return { error: result.error ?? undefined };
          },
        });

        // Say It Back uses the same private bucket, with its own durable receipts.
        // Remove those objects before the Auth cascade can erase their paths.
        await deleteAllDeliveryMedia({
          ownerId: user.id,
          loadPage: async (afterId, limit) => {
            let query = admin.from("say_attempts")
              .select("id,recording_path").eq("user_id", user.id)
              .order("id", { ascending: true }).limit(limit);
            if (afterId) query = query.gt("id", afterId);
            const page = await query;
            return { rows: (page.data ?? []) as Array<{ id: string; recording_path?: unknown }>, error: page.error ?? undefined };
          },
          remove: async (bucket, paths) => {
            const result = await admin.storage.from(bucket).remove(paths);
            return { error: result.error ?? undefined };
          },
        });

        await deleteGroupAccountMedia(user.id);

        const profile = await admin
          .from("profiles")
          .select("avatar_path")
          .eq("id", user.id)
          .maybeSingle();
        if (profile.error) {
          throw new ExternalServiceError("Supabase account avatar listing", {
            cause: profile.error,
          });
        }
        const candidate = String(profile.data?.avatar_path ?? "");
        if (candidate) {
          if (!isOwnerStoragePath(candidate, user.id)) {
            throw new AppError(
              "ACCOUNT_MEDIA_PATH_INVALID",
              "Account media cleanup needs an operator review before deletion can finish.",
              503,
              { retryable: true },
            );
          }
          const avatarRemoval = await admin.storage.from("avatars").remove([candidate]);
          if (avatarRemoval.error) {
            throw new ExternalServiceError("Supabase account avatar deletion", {
              cause: avatarRemoval.error,
            });
          }
        }
        job = await advance("media_deleted");
      } catch (error) {
        await retryableFailure("media", error);
      }
    }

    try {
      const identityDeletion = await admin.auth.admin.deleteUser(user.id);
      if (identityDeletion.error) {
        throw new ExternalServiceError("Supabase account identity deletion", {
          cause: identityDeletion.error,
        });
      }
    } catch (error) {
      await retryableFailure("identity", error);
    }

    let reconciliationPending = false;
    try {
      job = await advance("identity_deleted", "completed");
    } catch (receiptError) {
      // Billing, media, database cascade, and identity are already deleted. A
      // stale service-only receipt is an operator reconciliation issue, not a
      // reason to tell the person their completed erasure failed.
      reconciliationPending = true;
      console.error("Completed account deletion needs receipt reconciliation", {
        requestId,
        receiptErrorName: receiptError instanceof Error ? receiptError.name : "unknown",
      });
    }

    return jsonOk(
      {
        deleted: true,
        reconciliationPending,
        attemptCount: job.attemptCount,
      },
      requestId,
      {
        status: reconciliationPending ? 202 : 200,
        headers: {
          ...rateLimitHeaders(rateLimit),
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(
        new AppError(
          "CONFIRMATION_REQUIRED",
          "Type DELETE to confirm account deletion.",
          422,
        ),
        requestId,
        rateLimit ? rateLimitHeaders(rateLimit) : undefined,
      );
    }
    return jsonError(error, requestId, rateLimit ? rateLimitHeaders(rateLimit) : undefined);
  }
}
