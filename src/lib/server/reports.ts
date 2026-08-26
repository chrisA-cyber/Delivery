import "server-only";

import type { User } from "@supabase/supabase-js";

import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import {
  getAnonymousReportHashes,
  getGuestIdentity,
  type GuestIdentity,
} from "@/lib/server/guest";
import {
  enforceRateLimit,
  type RateLimitResult,
} from "@/lib/server/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface ReportActor {
  user: User | null;
  guest: GuestIdentity | null;
  reporterId: string | null;
  anonymousReporterHash: string | null;
  anonymousNetworkHash: string | null;
  idempotencyScope: string;
  rateLimit: RateLimitResult;
}

export function reportIdempotencyKey(request: Request): string {
  const supplied = request.headers.get("idempotency-key")?.trim();
  if (!supplied) return crypto.randomUUID();
  if (
    supplied.length < 20 ||
    supplied.length > 128 ||
    !/^[A-Za-z0-9:_.-]+$/.test(supplied) ||
    new Set(supplied.toLowerCase()).size < 6
  ) {
    throw new AppError(
      "IDEMPOTENCY_KEY_INVALID",
      "Refresh the report form and try again.",
      422,
    );
  }
  return supplied;
}

export async function prepareReportActor(
  request: Request,
  user: User | null,
  idempotencyKey: string,
): Promise<ReportActor> {
  if (user) {
    const rateLimit = await enforceRateLimit(`report:${user.id}`, {
      limit: 10,
      windowMs: 10 * 60 * 1_000,
    });
    return {
      user,
      guest: null,
      reporterId: user.id,
      anonymousReporterHash: null,
      anonymousNetworkHash: null,
      idempotencyScope: `user:${user.id}`,
      rateLimit,
    };
  }

  const guest = getGuestIdentity(request, idempotencyKey);
  const hashes = getAnonymousReportHashes(guest);
  // A signed device prevents network hopping from resetting the cap; the
  // separately HMACed network dimension catches cookie clearing without ever
  // storing or logging a raw address.
  const deviceLimit = await enforceRateLimit(
    `report-guest-device:${hashes.deviceHash}`,
    { limit: 6, windowMs: 60 * 60 * 1_000 },
  );
  await enforceRateLimit(`report-guest-network:${hashes.networkHash}`, {
    limit: 20,
    windowMs: 60 * 60 * 1_000,
  });
  return {
    user: null,
    guest,
    reporterId: null,
    anonymousReporterHash: hashes.deviceHash,
    anonymousNetworkHash: hashes.networkHash,
    idempotencyScope: `guest-device:${guest.idempotencyScope}`,
    rateLimit: deviceLimit,
  };
}

export async function insertReport(
  actor: ReportActor,
  values: {
    deliveryId?: string | null;
    profileId?: string | null;
    promptId?: string | null;
    submissionId?: string | null;
    reason: string;
    details?: string | null;
  },
): Promise<Record<string, unknown>> {
  const { data, error } = await createSupabaseAdminClient()
    .from("reports")
    .insert({
      reporter_id: actor.reporterId,
      anonymous_reporter_hash: actor.anonymousReporterHash,
      anonymous_network_hash: actor.anonymousNetworkHash,
      delivery_id: values.deliveryId ?? null,
      profile_id: values.profileId ?? null,
      prompt_id: values.promptId ?? null,
      submission_id: values.submissionId ?? null,
      reason: values.reason,
      details: values.details ?? null,
      state: "open",
    })
    .select("id,created_at")
    .single();
  if (error) throw new ExternalServiceError("Supabase reports", { cause: error });
  return data as Record<string, unknown>;
}
