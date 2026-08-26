import "server-only";

import { createHash } from "node:crypto";

import type { User } from "@supabase/supabase-js";

import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { getServerEnv, isSupabaseAdminConfigured } from "@/lib/server/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const FREE_DAILY_PLAYS = 5;

export interface JudgingUsage {
  tier: "guest" | "free" | "pro";
  used: number | null;
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
  tracked: boolean;
  replayed?: boolean;
}

export interface JudgingReservation {
  claimId: string;
  kind: "supabase" | "guest";
  usage: JudgingUsage;
  replayed: boolean;
}

interface ReserveRow {
  claim_id: string;
  allowed: boolean;
  used: number;
  play_limit: number | null;
  remaining: number | null;
  reset_at: string;
  tier: "free" | "pro";
  replayed: boolean;
}

interface GuestClaim {
  id: string;
  counterKeys: string[];
  state: "reserved" | "released" | "denied";
  used: number;
  resetAt: number;
}

interface GuestReserveResult {
  claimId: string;
  allowed: boolean;
  used: number;
  resetAt: number;
  replayed: boolean;
  tracked: boolean;
}

const guestClaims = new Map<string, GuestClaim>();
const guestClaimsById = new Map<string, GuestClaim>();
const guestCounters = new Map<string, number>();

function nextUtcResetMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

function nextUtcReset(): string {
  return new Date(nextUtcResetMs()).toISOString();
}

function limitReached(resetAt: string, playLimit = FREE_DAILY_PLAYS): AppError {
  return new AppError(
    "FREE_PLAY_LIMIT_REACHED",
    `You used today’s ${playLimit} free judged plays. Go Pro or come back after the UTC reset.`,
    402,
    { limit: playLimit, remaining: 0, resetAt, upgradeCode: "DELIVERY_PRO" },
  );
}

function claimDigest(scope: string, attemptKey: string): string {
  return createHash("sha256").update(scope).update("\0").update(attemptKey).digest("hex");
}

function guestQuotaKeys(scope: string): string[] {
  const parts = scope.split(".");
  if (
    parts.length === 2 &&
    parts.every((part) => /^[a-f0-9]{64}$/i.test(part))
  ) {
    return [`device:${parts[0]}`, `ip:${parts[1]}`];
  }
  return [`scope:${scope}`];
}

function reserveGuestMemory(scope: string, attemptKey: string): GuestReserveResult {
  const now = Date.now();
  const resetAt = nextUtcResetMs();
  const digest = claimDigest(scope, attemptKey);
  const existing = guestClaims.get(digest);
  if (existing && existing.resetAt > now && existing.state !== "released") {
    return {
      claimId: existing.id,
      allowed: existing.state === "reserved",
      used: existing.used,
      resetAt: existing.resetAt,
      replayed: true,
      tracked: true,
    };
  }

  const date = new Date(now).toISOString().slice(0, 10);
  const counterKeys = guestQuotaKeys(scope).map((key) => `${key}:${date}`);
  const current = Math.max(...counterKeys.map((key) => guestCounters.get(key) ?? 0));
  const allowed = counterKeys.every(
    (key) => (guestCounters.get(key) ?? 0) < FREE_DAILY_PLAYS,
  );
  if (allowed) {
    for (const key of counterKeys) {
      guestCounters.set(key, (guestCounters.get(key) ?? 0) + 1);
    }
  }
  const used = allowed ? current + 1 : current;
  const claim: GuestClaim = {
    id: `guest_${digest}`,
    counterKeys,
    state: allowed ? "reserved" : "denied",
    used,
    resetAt,
  };
  guestClaims.set(digest, claim);
  guestClaimsById.set(claim.id, claim);
  return { claimId: claim.id, allowed, used, resetAt, replayed: false, tracked: true };
}

function releaseGuestMemory(claimId: string): boolean {
  const claim = guestClaimsById.get(claimId);
  if (!claim || claim.state !== "reserved") return false;
  claim.state = "released";
  for (const key of claim.counterKeys) {
    guestCounters.set(key, Math.max(0, (guestCounters.get(key) ?? 0) - 1));
  }
  return true;
}

async function upstash(command: unknown[]): Promise<unknown> {
  const env = getServerEnv();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Upstash is not configured.");
  }
  const response = await fetch(env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(2_500),
  });
  if (!response.ok) throw new Error(`Guest quota returned ${response.status}.`);
  const payload = (await response.json()) as { result?: unknown; error?: string };
  if (payload.error || payload.result === undefined) throw new Error("Invalid guest quota response.");
  return payload.result;
}

async function reserveGuestDistributed(
  scope: string,
  attemptKey: string,
): Promise<GuestReserveResult> {
  const resetAt = nextUtcResetMs();
  const ttl = Math.max(1_000, resetAt - Date.now());
  const digest = claimDigest(scope, attemptKey);
  const date = new Date().toISOString().slice(0, 10);
  const claimId = `guest_${digest}_${date.replaceAll("-", "")}`;
  const claimKey = `delivery:judge:claim:${digest}`;
  const counterKeys = guestQuotaKeys(scope).map(
    (key) => `delivery:judge:guest:${key}:${date}`,
  );
  const script = [
    "local state=redis.call('GET',KEYS[1])",
    "local used=0",
    "for i=2,#KEYS do local n=tonumber(redis.call('GET',KEYS[i]) or '0'); if n>used then used=n end end",
    "if state=='reserved' then return {1,used,1} end",
    "if state=='denied' then return {0,used,1} end",
    "if used>=tonumber(ARGV[1]) then redis.call('SET',KEYS[1],'denied','PX',ARGV[2]); return {0,used,0} end",
    "used=0",
    "for i=2,#KEYS do local n=redis.call('INCR',KEYS[i]); redis.call('PEXPIRE',KEYS[i],ARGV[2]); if n>used then used=n end end",
    "redis.call('SET',KEYS[1],'reserved','PX',ARGV[2])",
    "return {1,used,0}",
  ].join("; ");
  const result = (await upstash([
    "EVAL",
    script,
    1 + counterKeys.length,
    claimKey,
    ...counterKeys,
    FREE_DAILY_PLAYS,
    ttl,
  ])) as [number, number, number];
  return {
    claimId,
    allowed: Number(result[0]) === 1,
    used: Number(result[1]),
    resetAt,
    replayed: Number(result[2]) === 1,
    tracked: true,
  };
}

async function releaseGuestDistributed(claimId: string, scope: string): Promise<boolean> {
  const match = /^guest_([a-f0-9]{64})_(\d{4})(\d{2})(\d{2})$/.exec(claimId);
  if (!match) return false;
  const digest = match[1]!;
  const date = `${match[2]}-${match[3]}-${match[4]}`;
  const claimKey = `delivery:judge:claim:${digest}`;
  const counterKeys = guestQuotaKeys(scope).map(
    (key) => `delivery:judge:guest:${key}:${date}`,
  );
  const script = [
    "if redis.call('GET',KEYS[1])~='reserved' then return 0 end",
    "local ttl=redis.call('PTTL',KEYS[1])",
    "redis.call('SET',KEYS[1],'released','PX',math.max(ttl,1000))",
    "for i=2,#KEYS do local used=tonumber(redis.call('GET',KEYS[i]) or '0'); if used>0 then redis.call('DECR',KEYS[i]) end end",
    "return 1",
  ].join("; ");
  return Number(
    await upstash([
      "EVAL",
      script,
      1 + counterKeys.length,
      claimKey,
      ...counterKeys,
    ]),
  ) === 1;
}

async function reserveGuest(scope: string, attemptKey: string): Promise<GuestReserveResult> {
  const env = getServerEnv();
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await reserveGuestDistributed(scope, attemptKey);
    } catch (error) {
      if (env.NODE_ENV === "production") {
        throw new ExternalServiceError("Guest quota", { cause: error });
      }
      console.warn("Distributed guest quota unavailable; using process-local quota.", {
        error: error instanceof Error ? error.name : "unknown",
      });
      const result = reserveGuestMemory(scope, attemptKey);
      return { ...result, tracked: false };
    }
  }
  if (env.NODE_ENV === "production") {
    throw new AppError(
      "GUEST_QUOTA_NOT_CONFIGURED",
      "Guest judging is temporarily unavailable. Sign in or try again shortly.",
      503,
    );
  }
  return reserveGuestMemory(scope, attemptKey);
}

export async function preflightJudgingUsage(user: User | null): Promise<JudgingUsage> {
  if (!user) {
    return {
      tier: "guest",
      used: null,
      limit: FREE_DAILY_PLAYS,
      remaining: null,
      resetAt: nextUtcReset(),
      tracked: false,
    };
  }
  if (!isSupabaseAdminConfigured()) {
    return {
      tier: "free",
      used: null,
      limit: FREE_DAILY_PLAYS,
      remaining: null,
      resetAt: nextUtcReset(),
      tracked: false,
    };
  }

  const admin = createSupabaseAdminClient();
  const periodStart = new Date().toISOString().slice(0, 10);
  const [{ data: subscription, error: subscriptionError }, { data: counter, error: counterError }] =
    await Promise.all([
      admin
        .from("subscriptions")
        .select("tier,state,current_period_end")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("usage_counters")
        .select("plays")
        .eq("user_id", user.id)
        .eq("period_start", periodStart)
        .maybeSingle(),
    ]);
  if (subscriptionError || counterError) {
    throw new ExternalServiceError("Supabase quota", {
      cause: subscriptionError ?? counterError,
    });
  }

  const periodEnd = subscription?.current_period_end
    ? new Date(String(subscription.current_period_end))
    : null;
  const isPro =
    subscription?.tier === "pro" &&
    ["active", "trialing"].includes(String(subscription.state)) &&
    (!periodEnd || periodEnd.getTime() > Date.now());
  const used = Number(counter?.plays ?? 0);
  const resetAt = nextUtcReset();
  return isPro
    ? { tier: "pro", used, limit: null, remaining: null, resetAt, tracked: true }
    : {
        tier: "free",
        used,
        limit: FREE_DAILY_PLAYS,
        remaining: Math.max(0, FREE_DAILY_PLAYS - used),
        resetAt,
        tracked: true,
      };
}

export async function reserveJudgedPlay(
  user: User | null,
  attemptKey: string,
  guestScope: string,
): Promise<JudgingReservation> {
  if (user && isSupabaseAdminConfigured()) {
    const { data, error } = await createSupabaseAdminClient().rpc("reserve_judged_play", {
      p_attempt_key: attemptKey,
      p_user_id: user.id,
    });
    if (error) throw new ExternalServiceError("Supabase quota", { cause: error });
    const row = (Array.isArray(data) ? data[0] : data) as ReserveRow | null;
    if (!row) throw new ExternalServiceError("Supabase quota");
    if (!row.allowed) throw limitReached(row.reset_at, row.play_limit ?? FREE_DAILY_PLAYS);
    return {
      claimId: row.claim_id,
      kind: "supabase",
      replayed: row.replayed,
      usage: {
        tier: row.tier,
        used: row.used,
        limit: row.play_limit,
        remaining: row.remaining,
        resetAt: row.reset_at,
        tracked: true,
        replayed: row.replayed,
      },
    };
  }

  const scope = user ? `local-user:${user.id}` : guestScope;
  const row = await reserveGuest(scope, attemptKey);
  if (!row.allowed) throw limitReached(new Date(row.resetAt).toISOString());
  return {
    claimId: row.claimId,
    kind: "guest",
    replayed: row.replayed,
    usage: {
      tier: user ? "free" : "guest",
      used: row.used,
      limit: FREE_DAILY_PLAYS,
      remaining: Math.max(0, FREE_DAILY_PLAYS - row.used),
      resetAt: new Date(row.resetAt).toISOString(),
      tracked: row.tracked,
      replayed: row.replayed,
    },
  };
}

export async function releaseJudgedPlay(
  reservation: JudgingReservation,
  user: User | null,
  guestScope: string,
): Promise<boolean> {
  if (reservation.kind === "supabase") {
    if (!user || !isSupabaseAdminConfigured()) return false;
    const { data, error } = await createSupabaseAdminClient().rpc("release_judged_play", {
      p_claim_id: reservation.claimId,
      p_user_id: user.id,
    });
    if (error) throw new ExternalServiceError("Supabase quota", { cause: error });
    const row = (Array.isArray(data) ? data[0] : data) as { released?: boolean } | null;
    return Boolean(row?.released);
  }

  const env = getServerEnv();
  const scope = user ? `local-user:${user.id}` : guestScope;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      if (await releaseGuestDistributed(reservation.claimId, scope)) return true;
    } catch (error) {
      console.warn("Distributed guest quota release failed; trying process-local release.", {
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }
  return releaseGuestMemory(reservation.claimId);
}
