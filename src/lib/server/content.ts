import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import type { User } from "@supabase/supabase-js";

import {
  ENERGY_MODIFIERS,
  getEnergyModifierById,
  getDailyPrompt,
  getPackById,
  getPromptById,
  isRatingAllowed,
  isActivePrompt,
  isEnergyCompatible,
  PACKS,
} from "@/data/content";
import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import {
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/server/env";
import type { JudgingUsage } from "@/lib/server/entitlements";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ContentRating } from "@/lib/content/types";
import { ENERGY_MODIFIERS as LEGACY_ENERGY } from "@/data/legacy-content";
import { ENERGY_MODIFIERS as V2_ENERGY } from "@/data/classic-content-v2";
import type { DeliveryMode } from "@/lib/types";

interface PromptPackRow {
  content_packs:
    | {
        access: "free" | "pro" | "rotating";
        state: string;
        draw_enabled?: boolean;
        available_from: string | null;
        available_until: string | null;
      }
    | {
        access: "free" | "pro" | "rotating";
        state: string;
        draw_enabled?: boolean;
        available_from: string | null;
        available_until: string | null;
      }[]
    | null;
}

interface PromptRow {
  id: string;
  slug: string;
  body: string;
  category: string;
  difficulty: number;
  rating: ContentRating;
  draw_enabled?: boolean;
  state: string;
  available_from: string | null;
  available_until: string | null;
  pack_prompts: PromptPackRow[] | null;
}

interface EnergyRow {
  id: string;
  slug: string;
  instruction: string;
  tags?: string[];
  compatible_difficulties?: number[] | null;
  draw_enabled?: boolean;
  state: string;
}

interface ChallengeRestrictionRow {
  user_id: string;
  kind: string;
  starts_at: string;
  ends_at: string | null;
}

export interface CanonicalDeliveryContent {
  promptId: string;
  promptSlug: string;
  promptText: string;
  rating: ContentRating;
  category: string;
  difficulty: number;
  energyId: string;
  energySlug: string;
  energy: string;
  requiresPro: boolean;
  dailyDate: string | null;
  dailyMarket: string | null;
}

export interface ResolveContentInput {
  promptId: string;
  promptText: string;
  energy: string;
  category?: string;
  mode: DeliveryMode;
  /** Explicit content opt-in from the submitted request; absent means clean. */
  maxRating?: ContentRating;
  challengeId?: string;
  challengeToken?: string;
  dailyDate?: string;
  dailyMarket?: string;
  user: User | null;
  usage: JudgingUsage;
}

export function assertContentRating(
  rating: ContentRating,
  maxRating: ContentRating = "everyone",
): void {
  if (!isRatingAllowed(rating, maxRating)) {
    throw new AppError(
      "CONTENT_OPT_IN_REQUIRED",
      rating === "mature"
        ? "This line contains adult humor or strong language. Enable Mature (18+) content before playing it."
        : "Enable Spicy content to play this line, or choose a clean round.",
      403,
      { rating },
    );
  }
}

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function available(from: string | null, until: string | null): boolean {
  const now = Date.now();
  return (
    (!from || new Date(from).getTime() <= now) &&
    (!until || new Date(until).getTime() > now)
  );
}

export function resolvePromptPackEntitlement(
  memberships: Array<{
    access: "free" | "pro" | "rotating";
    state: string;
    draw_enabled?: boolean;
    available_from: string | null;
    available_until: string | null;
  }>,
  mode: DeliveryMode,
): { requiresPro: boolean } {
  const activeMemberships = memberships.filter(
    (pack) =>
      pack.state === "published" &&
      (mode === "daily" ||
        mode === "challenge" ||
        pack.draw_enabled !== false) &&
      available(pack.available_from, pack.available_until),
  );
  // A canonical prompt is playable only through an active editorial pack. The
  // current Daily pairing is an explicit promotional slot and remains free even
  // if its source pack rotates while that UTC challenge is live.
  if (mode !== "daily" && activeMemberships.length === 0) {
    throw new AppError(
      "PROMPT_NOT_FOUND",
      "That line is no longer on the stage. Pick a fresh round.",
      404,
    );
  }
  return {
    requiresPro:
      mode === "stream" ||
      mode === "impossible" ||
      (mode !== "daily" &&
        activeMemberships.every((pack) => pack.access === "pro")),
  };
}

export function challengeHasActiveProfileContainment(
  restrictions: ChallengeRestrictionRow[],
  participantIds: readonly string[],
  now = Date.now(),
): boolean {
  const participants = new Set(participantIds);
  return restrictions.some((restriction) => {
    if (
      !participants.has(restriction.user_id) ||
      !["profile-limit", "profile-remove"].includes(restriction.kind)
    ) {
      return false;
    }
    const startsAt = new Date(restriction.starts_at).getTime();
    const endsAt = restriction.ends_at
      ? new Date(restriction.ends_at).getTime()
      : Number.POSITIVE_INFINITY;
    return Number.isFinite(startsAt) && startsAt <= now && endsAt > now;
  });
}

function assertMatches(
  supplied: string,
  canonical: string,
  code: "PROMPT_MISMATCH" | "ENERGY_MISMATCH" | "CATEGORY_MISMATCH",
): void {
  if (normalized(supplied) !== normalized(canonical)) {
    throw new AppError(
      code,
      "This round changed after it loaded. Refresh the line before submitting your take.",
      409,
    );
  }
}

function assertPremium(
  content: CanonicalDeliveryContent,
  usage: JudgingUsage,
): void {
  if (!content.requiresPro || usage.tier === "pro") return;
  throw new AppError(
    "PRO_REQUIRED",
    "That line is on the Pro stage. Upgrade to judge this take, or pick a free pack.",
    402,
    { upgradeCode: "DELIVERY_PRO", tier: usage.tier },
  );
}

function validChallengeToken(storedDigest: unknown, token?: string): boolean {
  if (!token || typeof storedDigest !== "string") return false;
  const hex = storedDigest.replace(/^\\x/i, "");
  if (!/^[a-f0-9]{64}$/i.test(hex)) return false;
  const expected = Buffer.from(hex, "hex");
  const supplied = createHash("sha256").update(token, "utf8").digest();
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

function resolveLocal(input: ResolveContentInput): CanonicalDeliveryContent {
  const prompt = getPromptById(input.promptId);
  if (!prompt) {
    throw new AppError(
      "PROMPT_NOT_FOUND",
      "That line is no longer on the board. Grab a fresh one.",
      404,
    );
  }
  const energy =
    getEnergyModifierById(input.energy) ??
    [...ENERGY_MODIFIERS, ...V2_ENERGY, ...LEGACY_ENERGY].find(
      (candidate) =>
        normalized(candidate.instruction) === normalized(input.energy),
    );
  if (!energy) {
    throw new AppError(
      "ENERGY_NOT_FOUND",
      "That energy modifier is no longer available. Grab a fresh one.",
      404,
    );
  }
  assertContentRating(prompt.rating, input.maxRating);
  if (
    (!isActivePrompt(prompt.id) ||
      !ENERGY_MODIFIERS.some((candidate) => candidate.id === energy.id)) &&
    input.mode !== "daily" &&
    input.mode !== "challenge"
  ) {
    throw new AppError(
      "PROMPT_RETIRED",
      "That line has left new rounds. Choose a fresh line.",
      409,
    );
  }
  if (
    isActivePrompt(prompt.id) &&
    input.mode !== "daily" &&
    input.mode !== "challenge" &&
    !isEnergyCompatible(prompt, energy)
  ) {
    throw new AppError(
      "ENERGY_INCOMPATIBLE",
      "Choose a direction with room for this line.",
      409,
    );
  }
  assertMatches(input.promptText, prompt.line, "PROMPT_MISMATCH");
  assertMatches(input.energy, energy.instruction, "ENERGY_MISMATCH");
  const packs = prompt.packIds
    .map((id) => getPackById(id))
    .filter((pack): pack is NonNullable<typeof pack> => Boolean(pack));
  const requiresPro =
    input.mode === "stream" ||
    input.mode === "impossible" ||
    (input.mode !== "daily" &&
      packs.length > 0 &&
      packs.every((pack) => pack.access === "pro"));
  const difficulty = { easy: 1, medium: 2, hard: 3, impossible: 4 }[
    prompt.difficulty
  ];
  let dailyDate: string | null = null;
  let dailyMarket: string | null = null;
  if (input.mode === "daily") {
    dailyDate = input.dailyDate ?? new Date().toISOString().slice(0, 10);
    dailyMarket = (input.dailyMarket ?? "global").toLowerCase();
    const daily = getDailyPrompt(new Date(`${dailyDate}T12:00:00.000Z`));
    if (
      daily.prompt.id !== prompt.id ||
      daily.energy.id !== energy.id ||
      dailyMarket !== "global"
    ) {
      throw new AppError(
        "DAILY_CHALLENGE_MISMATCH",
        "Today’s line has changed. Reload the Daily Drop before submitting.",
        409,
      );
    }
  }
  const content = {
    promptId: prompt.id,
    promptSlug: prompt.id,
    promptText: prompt.line,
    rating: prompt.rating,
    category: prompt.category,
    difficulty,
    energyId: energy.id,
    energySlug: energy.id,
    energy: energy.instruction,
    requiresPro,
    dailyDate,
    dailyMarket,
  };
  assertPremium(content, input.usage);
  return content;
}

async function resolveDatabase(
  input: ResolveContentInput,
): Promise<CanonicalDeliveryContent> {
  const supabase = isSupabaseAdminConfigured()
    ? createSupabaseAdminClient()
    : await createServerSupabaseClient();
  let query = supabase
    .from("prompts")
    .select(
      "id,slug,body,category,difficulty,rating,draw_enabled,state,available_from,available_until,pack_prompts(content_packs(access,state,draw_enabled,available_from,available_until))",
    )
    .limit(1);
  query =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.promptId,
    )
      ? query.eq("id", input.promptId)
      : query.eq("slug", input.promptId);
  const { data: rawPrompt, error: promptError } = await query.maybeSingle();
  if (promptError)
    throw new ExternalServiceError("Supabase content", { cause: promptError });
  const prompt = rawPrompt as unknown as PromptRow | null;
  if (
    !prompt ||
    prompt.state !== "published" ||
    !available(prompt.available_from, prompt.available_until)
  ) {
    throw new AppError(
      "PROMPT_NOT_FOUND",
      "That line is no longer on the board. Grab a fresh one.",
      404,
    );
  }

  let energyQuery = supabase
    .from("energy_modifiers")
    .select(
      "id,slug,instruction,tags,compatible_difficulties,draw_enabled,state",
    )
    .limit(1);
  energyQuery =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.energy,
    )
      ? energyQuery.eq("id", input.energy)
      : /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(input.energy)
        ? energyQuery.eq("slug", input.energy)
        : energyQuery.eq("instruction", input.energy);
  const { data: rawEnergy, error: energyError } =
    await energyQuery.maybeSingle();
  if (energyError)
    throw new ExternalServiceError("Supabase content", { cause: energyError });
  const energy = rawEnergy as unknown as EnergyRow | null;
  if (!energy || energy.state !== "published") {
    throw new AppError(
      "ENERGY_NOT_FOUND",
      "That energy modifier is no longer available. Grab a fresh one.",
      404,
    );
  }

  assertContentRating(prompt.rating, input.maxRating);
  if (
    input.mode !== "daily" &&
    input.mode !== "challenge" &&
    (prompt.draw_enabled === false || energy.draw_enabled === false)
  ) {
    throw new AppError(
      "PROMPT_RETIRED",
      "That round has left new draws. Choose a fresh line.",
      409,
    );
  }
  const difficultyNames = [
    "easy",
    "easy",
    "medium",
    "hard",
    "impossible",
  ] as const;
  const canonicalEnergy = {
    id: energy.slug,
    instruction: energy.instruction,
    shortLabel: energy.slug,
    intensity: 1 as const,
    tags: energy.tags ?? [],
    ...(energy.compatible_difficulties
      ? {
          compatibleDifficulties: energy.compatible_difficulties.map(
            (level) => difficultyNames[level] ?? "medium",
          ),
        }
      : {}),
  };
  if (
    input.mode !== "daily" &&
    input.mode !== "challenge" &&
    !isEnergyCompatible(
      {
        line: prompt.body,
        difficulty: difficultyNames[prompt.difficulty] ?? "medium",
      },
      canonicalEnergy,
    )
  ) {
    throw new AppError(
      "ENERGY_INCOMPATIBLE",
      "Choose a direction with room for this line.",
      409,
    );
  }
  assertMatches(input.promptText, prompt.body, "PROMPT_MISMATCH");
  assertMatches(input.energy, energy.instruction, "ENERGY_MISMATCH");

  if (input.challengeId) {
    await assertChallengeAccess(input, false, {
      promptId: prompt.id,
      energyId: energy.id,
    });
  }

  let dailyDate: string | null = null;
  let dailyMarket: string | null = null;
  if (input.mode === "daily") {
    dailyDate = input.dailyDate ?? new Date().toISOString().slice(0, 10);
    dailyMarket = (input.dailyMarket ?? "global").toLowerCase();
    const { data: daily, error: dailyError } = await supabase
      .from("daily_challenges")
      .select("challenge_date,market,prompt_id,energy_modifier_id")
      .eq("challenge_date", dailyDate)
      .eq("market", dailyMarket)
      .maybeSingle();
    if (dailyError) {
      throw new ExternalServiceError("Supabase daily challenge", {
        cause: dailyError,
      });
    }
    if (
      !daily ||
      daily.prompt_id !== prompt.id ||
      daily.energy_modifier_id !== energy.id
    ) {
      throw new AppError(
        "DAILY_CHALLENGE_MISMATCH",
        "Today’s line has changed. Reload the Daily Drop before submitting.",
        409,
      );
    }
  }

  const memberships = (prompt.pack_prompts ?? []).flatMap((membership) => {
    const value = membership.content_packs;
    return Array.isArray(value) ? value : value ? [value] : [];
  });
  const { requiresPro } = resolvePromptPackEntitlement(memberships, input.mode);
  const content = {
    promptId: prompt.id,
    promptSlug: prompt.slug,
    promptText: prompt.body,
    rating: prompt.rating,
    category: prompt.category,
    difficulty: prompt.difficulty,
    energyId: energy.id,
    energySlug: energy.slug,
    energy: energy.instruction,
    requiresPro,
    dailyDate,
    dailyMarket,
  };
  assertPremium(content, input.usage);
  return content;
}

async function assertChallengeAccess(
  input: Pick<ResolveContentInput, "user" | "challengeId" | "challengeToken">,
  receiptReplay: boolean,
  expectedPair?: { promptId: string; energyId: string },
): Promise<void> {
  if (!input.challengeId) return;
  if (!isSupabaseConfigured()) {
    throw new AppError(
      "CHALLENGE_UNAVAILABLE",
      "Challenge receipts are unavailable until secure storage is configured.",
      503,
    );
  }
  const supabase = isSupabaseAdminConfigured()
    ? createSupabaseAdminClient()
    : await createServerSupabaseClient();
  const challengeUser = input.user;
  if (!challengeUser) {
    throw new AppError(
      "CHALLENGE_AUTH_REQUIRED",
      "Sign in before judging a challenge take so the result can join the matchup.",
      401,
    );
  }
  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select(
      "id,prompt_id,energy_modifier_id,state,visibility,created_by,recipient_user_id,expires_at,max_entries,token_digest",
    )
    .eq("id", input.challengeId)
    .maybeSingle();
  if (challengeError) {
    throw new ExternalServiceError("Supabase challenge", {
      cause: challengeError,
    });
  }
  if (!challenge) {
    throw new AppError(
      "CHALLENGE_INVALID",
      "That challenge is unavailable or no longer matches this round.",
      404,
    );
  }
  const isParticipant =
    challenge.created_by === challengeUser.id ||
    challenge.recipient_user_id === challengeUser.id;
  const hasInviteToken = validChallengeToken(
    challenge.token_digest,
    input.challengeToken,
  );
  let valid =
    challenge &&
    (receiptReplay
      ? ["open", "accepted", "completed", "expired"].includes(
          String(challenge.state),
        )
      : ["open", "accepted"].includes(String(challenge.state)) &&
        new Date(String(challenge.expires_at)).getTime() > Date.now()) &&
    (challenge.visibility === "public" || isParticipant || hasInviteToken) &&
    (!expectedPair ||
      (challenge.prompt_id === expectedPair.promptId &&
        (!challenge.energy_modifier_id ||
          challenge.energy_modifier_id === expectedPair.energyId)));
  if (
    valid &&
    challenge.recipient_user_id &&
    challengeUser.id !== challenge.created_by &&
    challengeUser.id !== challenge.recipient_user_id
  ) {
    valid = false;
  }
  if (valid) {
    const counterpartIds = [
      challenge.created_by,
      challenge.recipient_user_id,
    ].filter(
      (id): id is string => typeof id === "string" && id !== challengeUser.id,
    );
    for (const counterpartId of counterpartIds) {
      const { data: block, error: blockError } = await supabase
        .from("blocks")
        .select("blocker_id")
        .or(
          `and(blocker_id.eq.${challengeUser.id},blocked_id.eq.${counterpartId}),and(blocker_id.eq.${counterpartId},blocked_id.eq.${challengeUser.id})`,
        )
        .limit(1)
        .maybeSingle();
      if (blockError) {
        throw new ExternalServiceError("Supabase challenge privacy", {
          cause: blockError,
        });
      }
      if (block) {
        valid = false;
        break;
      }
    }
  }
  if (valid && isSupabaseAdminConfigured()) {
    const participantIds = [
      ...new Set(
        [
          challenge.created_by,
          challenge.recipient_user_id,
          challengeUser.id,
        ].filter((id): id is string => typeof id === "string"),
      ),
    ];
    if (participantIds.length) {
      const [deletionResult, restrictionResult] = await Promise.all([
        supabase
          .from("account_deletion_jobs")
          .select("user_id")
          .in("user_id", participantIds)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("account_restrictions")
          .select("user_id,kind,starts_at,ends_at")
          .in("user_id", participantIds)
          .in("kind", ["profile-limit", "profile-remove"]),
      ]);
      if (deletionResult.error || restrictionResult.error) {
        throw new ExternalServiceError("Supabase challenge privacy", {
          cause: deletionResult.error ?? restrictionResult.error,
        });
      }
      if (
        deletionResult.data ||
        challengeHasActiveProfileContainment(
          (restrictionResult.data ?? []) as ChallengeRestrictionRow[],
          participantIds,
        )
      ) {
        valid = false;
      }
    }
  }
  if (!valid) {
    throw new AppError(
      "CHALLENGE_INVALID",
      "That challenge is unavailable or no longer matches this round.",
      404,
    );
  }
  // A completed receipt is retrieval, not another attempt to join the match.
  if (receiptReplay) return;
  const { data: entries, error: entriesError } = await supabase
    .from("challenge_entries")
    .select("entrant_id")
    .eq("challenge_id", input.challengeId);
  if (entriesError) {
    throw new ExternalServiceError("Supabase challenge entries", {
      cause: entriesError,
    });
  }
  if (entries?.some((entry) => entry.entrant_id === challengeUser.id)) {
    throw new AppError(
      "CHALLENGE_ALREADY_ENTERED",
      "You already delivered this challenge. Send the link to your rival for their turn.",
      409,
    );
  }
  if ((entries?.length ?? 0) >= Number(challenge.max_entries)) {
    throw new AppError(
      "CHALLENGE_FULL",
      "That challenge already has all its deliveries.",
      409,
    );
  }
}

/** Only call for a receipt already matched to an authenticated scope and exact request fingerprint. */
export async function assertChallengeReceiptAccess(
  input: Pick<ResolveContentInput, "user" | "challengeId" | "challengeToken">,
): Promise<void> {
  await assertChallengeAccess(input, true);
}

export async function resolveCanonicalDeliveryContent(
  input: ResolveContentInput,
): Promise<CanonicalDeliveryContent> {
  if (input.mode === "challenge") {
    if (!input.challengeId) {
      throw new AppError(
        "CHALLENGE_CONTEXT_REQUIRED",
        "Reload the signed challenge before recording this take.",
        422,
      );
    }
    if (!input.user) {
      throw new AppError(
        "CHALLENGE_AUTH_REQUIRED",
        "Sign in before judging a challenge take so the result can join the matchup.",
        401,
      );
    }
  } else if (input.challengeId) {
    throw new AppError(
      "CHALLENGE_MODE_MISMATCH",
      "Reload the signed challenge before recording this take.",
      409,
    );
  }
  if (input.mode === "daily") {
    const today = new Date().toISOString().slice(0, 10);
    if (!input.dailyDate) {
      throw new AppError(
        "DAILY_CONTEXT_REQUIRED",
        "Reload the Daily Drop before submitting this take.",
        422,
      );
    }
    if (input.dailyDate !== today) {
      throw new AppError(
        "DAILY_CHALLENGE_EXPIRED",
        "That Daily Drop has ended. Reload for today’s line.",
        409,
        { today },
      );
    }
    if ((input.dailyMarket ?? "global").toLowerCase() !== "global") {
      throw new AppError(
        "DAILY_MARKET_UNAVAILABLE",
        "That Daily market is not available yet. Reload the global Daily Drop.",
        409,
        { market: "global" },
      );
    }
  }
  if (!isSupabaseConfigured()) return resolveLocal(input);
  return resolveDatabase(input);
}

// Keeps tree-shaking from treating the catalog's pack list as an accidental
// side-effect-only import while retaining an inexpensive startup invariant.
if (process.env.NODE_ENV !== "production" && PACKS.length === 0) {
  throw new Error("Delivery's local content catalog is empty.");
}
