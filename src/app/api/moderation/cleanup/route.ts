import { timingSafeEqual } from "node:crypto";

import { reconcileCompletedAccountDeletions } from "@/lib/server/account-deletion";
import { AppError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { getServerEnv } from "@/lib/server/env";
import { processModerationStorageCleanup } from "@/lib/server/moderation-cleanup";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { assertSameOrigin } from "@/lib/server/request";
import { requireStaff } from "@/lib/supabase/auth";
import { cleanupExpiredGroupTakes } from "@/lib/server/group-rounds";
import { cleanupExpiredSayGuests } from "@/lib/server/say-it-back";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validWorkerAuthorization(request: Request): boolean {
  const expected = getServerEnv().MODERATION_CLEANUP_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    let rateKey = "moderation-cleanup:worker";
    if (!validWorkerAuthorization(request)) {
      assertSameOrigin(request);
      const { user } = await requireStaff();
      rateKey = `moderation-cleanup:staff:${user.id}`;
    }
    const rateLimit = await enforceRateLimit(rateKey, {
      limit: 120,
      windowMs: 10 * 60 * 1_000,
    });
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? "100");
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
      throw new AppError("INVALID_CLEANUP_LIMIT", "Cleanup limit must be between 1 and 100.", 422);
    }
    const [moderation, accountReceiptsReconciled, expiredGuestDubs, expiredGroupTakes] = await Promise.all([
      processModerationStorageCleanup(requestedLimit),
      reconcileCompletedAccountDeletions(requestedLimit),
      cleanupExpiredSayGuests(requestedLimit),
      cleanupExpiredGroupTakes(requestedLimit),
    ]);
    return jsonOk({ moderation, accountReceiptsReconciled, expiredGuestDubs, expiredGroupTakes }, requestId, {
      headers: {
        ...rateLimitHeaders(rateLimit),
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return jsonError(error, requestId, { "Cache-Control": "private, no-store, max-age=0" });
  }
}
