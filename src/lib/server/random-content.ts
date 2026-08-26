import "server-only";

import { z } from "zod";

import {
  ENERGY_MODIFIERS,
  getRandomPrompt,
  PACKS,
} from "@/data/content";
import { createSeededRandom } from "@/lib/content/hash";
import type {
  DeliveryPrompt,
  EnergyModifier,
  PromptCategory,
  PromptDifficulty,
} from "@/lib/content/types";
import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { preflightJudgingUsage } from "@/lib/server/entitlements";
import { isSupabaseConfigured } from "@/lib/server/env";
import { getOptionalUser } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const difficultyName = ["easy", "easy", "medium", "hard", "impossible"] as const;
const difficultyNumber: Record<PromptDifficulty, 1 | 2 | 3 | 4> = {
  easy: 1,
  medium: 2,
  hard: 3,
  impossible: 4,
};

const packRowSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  access: z.enum(["free", "pro", "rotating"]),
  state: z.literal("published"),
  available_from: z.string().nullable(),
  available_until: z.string().nullable(),
});

const promptRowSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  body: z.string().min(1),
  category: z.enum([
    "main-character",
    "group-chat",
    "gaming",
    "anime-energy",
    "cinema-coded",
    "workplace",
    "romance",
    "villain-era",
    "brainrot",
    "customer-service",
    "streamer-mode",
    "wildcard",
  ]),
  difficulty: z.number().int().min(1).max(4),
  rating: z.enum(["everyone", "teen"]),
  state: z.literal("published"),
  tags: z.array(z.string()),
  scoring_focus: z.array(z.enum(["commitment", "comedy", "accuracy", "chaos"])),
  locale: z.literal("en"),
  is_mimic: z.boolean(),
  available_from: z.string().nullable(),
  available_until: z.string().nullable(),
});

const membershipRowSchema = z.object({
  pack_id: z.string().min(1),
  prompt_id: z.string().min(1),
  prompts: z.union([promptRowSchema, z.array(promptRowSchema)]),
});

const energyRowSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  instruction: z.string().min(1),
  short_label: z.string().min(1),
  intensity: z.number().int().min(1).max(5),
  tags: z.array(z.string()),
  compatible_difficulties: z.array(z.number().int().min(1).max(4)).nullable(),
  state: z.literal("published"),
});

const campaignRowSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  label: z.string().min(1),
  markets: z.array(z.string()),
  priority: z.number().int().min(0).max(1_000),
  starts_at: z.string(),
  ends_at: z.string(),
  state: z.literal("published"),
});

const trendRowSchema = z.object({
  campaign_id: z.string().min(1),
  prompt_id: z.string().min(1),
  energy_modifier_id: z.string().nullable(),
  weight: z.number().int().min(1).max(100),
  trend_campaigns: z.union([campaignRowSchema, z.array(campaignRowSchema)]),
});

type RuntimePackRow = z.infer<typeof packRowSchema>;
type RuntimePromptRow = z.infer<typeof promptRowSchema>;
type RuntimeMembershipRow = z.infer<typeof membershipRowSchema>;
type RuntimeEnergyRow = z.infer<typeof energyRowSchema>;
type RuntimeCampaignRow = z.infer<typeof campaignRowSchema>;
type RuntimeTrendRow = z.infer<typeof trendRowSchema>;

export interface RandomContentQuery {
  pack?: string;
  category?: PromptCategory;
  difficulty?: PromptDifficulty;
  excludeIds?: readonly string[];
  seed?: string;
  market: string;
  includePro: boolean;
}

export interface RuntimeTrendMetadata {
  id: string;
  label: string;
  priority: number;
  market: string;
}

export interface RandomContentResult {
  prompt: DeliveryPrompt;
  energy: EnergyModifier;
  source: "curated" | "database" | "trend";
  trend?: RuntimeTrendMetadata;
}

interface RuntimeCatalogSnapshot {
  packs: RuntimePackRow[];
  memberships: RuntimeMembershipRow[];
  energies: RuntimeEnergyRow[];
  trends: RuntimeTrendRow[];
}

interface TrendSignal {
  campaign: RuntimeCampaignRow;
  energyId: string | null;
  weight: number;
}

interface Candidate {
  row: RuntimePromptRow;
  packSlugs: string[];
  trends: TrendSignal[];
  weight: number;
}

function relationOne<T>(value: T | T[]): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isAvailable(
  value: { available_from: string | null; available_until: string | null },
  now: Date,
): boolean {
  const timestamp = now.getTime();
  const startsAt = value.available_from ? Date.parse(value.available_from) : Number.NEGATIVE_INFINITY;
  const endsAt = value.available_until ? Date.parse(value.available_until) : Number.POSITIVE_INFINITY;
  return Number.isFinite(timestamp) && startsAt <= timestamp && endsAt > timestamp;
}

function campaignIsActive(campaign: RuntimeCampaignRow, market: string, now: Date): boolean {
  const startsAt = Date.parse(campaign.starts_at);
  const endsAt = Date.parse(campaign.ends_at);
  const markets = campaign.markets.map((value) => value.trim().toLowerCase());
  return (
    startsAt <= now.getTime() &&
    endsAt > now.getTime() &&
    (markets.includes("global") || markets.includes(market))
  );
}

function boundedRandom(random: () => number): number {
  const sample = random();
  return Number.isFinite(sample) ? Math.min(0.999_999_999, Math.max(0, sample)) : 0;
}

function weightedPick<T>(
  values: readonly T[],
  weightFor: (value: T) => number,
  random: () => number,
): T | undefined {
  const total = values.reduce((sum, value) => sum + Math.max(0, weightFor(value)), 0);
  if (total <= 0) return values[0];
  let target = boundedRandom(random) * total;
  for (const value of values) {
    target -= Math.max(0, weightFor(value));
    if (target < 0) return value;
  }
  return values.at(-1);
}

function toEnergy(row: RuntimeEnergyRow): EnergyModifier {
  return {
    id: row.slug,
    instruction: row.instruction,
    shortLabel: row.short_label,
    intensity: row.intensity as 1 | 2 | 3 | 4 | 5,
    tags: row.tags,
    ...(row.compatible_difficulties
      ? {
          compatibleDifficulties: row.compatible_difficulties.map(
            (difficulty) => difficultyName[difficulty] ?? "medium",
          ),
        }
      : {}),
  };
}

function compatibleEnergy(row: RuntimeEnergyRow, difficulty: number): boolean {
  return !row.compatible_difficulties || row.compatible_difficulties.includes(difficulty);
}

/** Pure selection core exported for contract tests. Database loading stays server-only. */
export function selectRuntimeContent(
  snapshot: RuntimeCatalogSnapshot,
  query: RandomContentQuery,
  options: { now?: Date; random?: () => number } = {},
): RandomContentResult {
  const now = options.now ?? new Date();
  const excluded = new Set(query.excludeIds ?? []);
  const activePacks = snapshot.packs.filter(
    (pack) =>
      pack.state === "published" &&
      isAvailable(pack, now) &&
      (query.includePro || pack.access !== "pro"),
  );
  const requestedPack = query.pack
    ? activePacks.find((pack) => pack.id === query.pack || pack.slug === query.pack)
    : undefined;
  const eligiblePacks = requestedPack ? [requestedPack] : query.pack ? [] : activePacks;
  const eligiblePackIds = new Set(eligiblePacks.map((pack) => pack.id));
  const packById = new Map(eligiblePacks.map((pack) => [pack.id, pack]));
  const compatibleEnergies = snapshot.energies.filter((energy) => energy.state === "published");

  const candidateById = new Map<string, Candidate>();
  for (const membership of snapshot.memberships) {
    if (!eligiblePackIds.has(membership.pack_id)) continue;
    const row = relationOne(membership.prompts);
    if (!row || row.state !== "published" || !isAvailable(row, now)) continue;
    if (excluded.has(row.id) || excluded.has(row.slug)) continue;
    if (query.category && row.category !== query.category) continue;
    if (query.difficulty && row.difficulty !== difficultyNumber[query.difficulty]) continue;
    if (!compatibleEnergies.some((energy) => compatibleEnergy(energy, row.difficulty))) continue;

    const pack = packById.get(membership.pack_id);
    if (!pack) continue;
    const existing = candidateById.get(row.id);
    if (existing) {
      if (!existing.packSlugs.includes(pack.slug)) existing.packSlugs.push(pack.slug);
    } else {
      candidateById.set(row.id, { row, packSlugs: [pack.slug], trends: [], weight: 1 });
    }
  }

  const candidates = [...candidateById.values()];
  for (const trend of snapshot.trends) {
    const candidate = candidateById.get(trend.prompt_id);
    const campaign = relationOne(trend.trend_campaigns);
    if (!candidate || !campaign || !campaignIsActive(campaign, query.market, now)) continue;

    // Priority is a multiplier without making the default priority (10) monopolize
    // the catalog. Multiple relevant campaigns stack intentionally.
    const trendWeight = trend.weight * (1 + campaign.priority / 10);
    candidate.trends.push({
      campaign,
      energyId: trend.energy_modifier_id,
      weight: trendWeight,
    });
    candidate.weight += trendWeight;
  }

  if (candidates.length === 0) {
    throw new AppError("NO_PROMPTS", "No lines match those filters. Try a wider vibe.", 404);
  }

  const promptRandom = query.seed
    ? createSeededRandom(`delivery:runtime:prompt:${query.seed}:${query.market}`)
    : options.random ?? Math.random;
  const selected = weightedPick(candidates, (candidate) => candidate.weight, promptRandom)!;
  const trendRandom = query.seed
    ? createSeededRandom(`delivery:runtime:trend:${query.seed}:${selected.row.slug}:${query.market}`)
    : options.random ?? Math.random;
  const selectedTrend = weightedPick(selected.trends, (trend) => trend.weight, trendRandom);
  const energies = compatibleEnergies.filter((energy) => compatibleEnergy(energy, selected.row.difficulty));
  const requestedEnergy = selectedTrend?.energyId
    ? energies.find((energy) => energy.id === selectedTrend.energyId)
    : undefined;
  const energyRandom = query.seed
    ? createSeededRandom(`delivery:runtime:energy:${query.seed}:${selected.row.slug}`)
    : options.random ?? Math.random;
  const selectedEnergy =
    requestedEnergy ?? energies[Math.floor(boundedRandom(energyRandom) * energies.length)];
  if (!selectedEnergy) {
    throw new AppError("NO_ENERGY", "No energy matches that line right now. Try another vibe.", 404);
  }

  const prompt: DeliveryPrompt = {
    id: selected.row.slug,
    line: selected.row.body,
    category: selected.row.category,
    packIds: selected.packSlugs,
    tags: selected.row.tags,
    difficulty: difficultyName[selected.row.difficulty] ?? "medium",
    rating: selected.row.rating,
    scoringFocus: selected.row.scoring_focus,
    locale: "en",
    ...(selected.row.is_mimic ? { isMimic: true } : {}),
  };

  return {
    prompt,
    energy: toEnergy(selectedEnergy),
    source: selectedTrend ? "trend" : "database",
    ...(selectedTrend
      ? {
          trend: {
            id: selectedTrend.campaign.slug,
            label: selectedTrend.campaign.label,
            priority: selectedTrend.campaign.priority,
            market: query.market,
          },
        }
      : {}),
  };
}

function parseRows<T>(schema: z.ZodType<T>, rows: unknown[] | null): T[] {
  return (rows ?? []).flatMap((row) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

async function loadDatabaseSnapshot(query: RandomContentQuery): Promise<RuntimeCatalogSnapshot> {
  const supabase = await createServerSupabaseClient();
  const { data: rawPacks, error: packError } = await supabase
    .from("content_packs")
    .select("id,slug,name,access,state,available_from,available_until")
    .eq("state", "published")
    .limit(1_000);
  if (packError) throw new ExternalServiceError("Supabase content", { cause: packError });

  const allActivePacks = parseRows(packRowSchema, rawPacks).filter((pack) =>
    isAvailable(pack, new Date()),
  );
  const explicitlyRequestedPack = query.pack
    ? allActivePacks.find((pack) => pack.id === query.pack || pack.slug === query.pack)
    : undefined;
  if (explicitlyRequestedPack?.access === "pro" && !query.includePro) {
    throw new AppError(
      "PRO_REQUIRED",
      "That line pack is on the Pro stage. Upgrade or choose a free pack.",
      403,
      { upgradeCode: "DELIVERY_PRO" },
    );
  }

  const eligiblePackIds = allActivePacks
    .filter(
      (pack) =>
        (query.includePro || pack.access !== "pro") &&
        (!query.pack || pack.id === query.pack || pack.slug === query.pack),
    )
    .map((pack) => pack.id);
  if (eligiblePackIds.length === 0) {
    throw new AppError("NO_PROMPTS", "No lines match those filters. Try a wider vibe.", 404);
  }

  let membershipQuery = supabase
    .from("pack_prompts")
    .select(
      "pack_id,prompt_id,prompts!inner(id,slug,body,category,difficulty,rating,state,tags,scoring_focus,locale,is_mimic,available_from,available_until)",
    )
    .in("pack_id", eligiblePackIds)
    .eq("prompts.state", "published")
    .eq("prompts.locale", "en")
    .limit(5_000);
  if (query.category) membershipQuery = membershipQuery.eq("prompts.category", query.category);
  if (query.difficulty) {
    membershipQuery = membershipQuery.eq("prompts.difficulty", difficultyNumber[query.difficulty]);
  }

  const [membershipResult, energyResult, trendResult] = await Promise.all([
    membershipQuery,
    supabase
      .from("energy_modifiers")
      .select(
        "id,slug,instruction,short_label,intensity,tags,compatible_difficulties,state",
      )
      .eq("state", "published")
      .limit(1_000),
    supabase
      .from("trend_prompts")
      .select(
        "campaign_id,prompt_id,energy_modifier_id,weight,trend_campaigns!inner(id,slug,label,markets,priority,starts_at,ends_at,state)",
      )
      .eq("trend_campaigns.state", "published")
      .limit(5_000),
  ]);
  const firstError = membershipResult.error ?? energyResult.error ?? trendResult.error;
  if (firstError) throw new ExternalServiceError("Supabase content", { cause: firstError });

  return {
    packs: allActivePacks,
    memberships: parseRows(membershipRowSchema, membershipResult.data),
    energies: parseRows(energyRowSchema, energyResult.data),
    trends: parseRows(trendRowSchema, trendResult.data),
  };
}

function bundledFallback(query: RandomContentQuery): RandomContentResult {
  const allowedPackIds = PACKS.filter((pack) => pack.access !== "pro").map((pack) => pack.id);
  const catalogPack = query.pack ? PACKS.find((pack) => pack.id === query.pack) : undefined;
  if (catalogPack?.access === "pro") {
    throw new AppError(
      "PRO_REQUIRED",
      "That line pack is on the Pro stage. Upgrade or choose a free pack.",
      403,
      { upgradeCode: "DELIVERY_PRO" },
    );
  }
  const requestedPack = query.pack
    ? catalogPack
    : undefined;
  if (query.pack && !requestedPack) {
    throw new AppError("NO_PROMPTS", "No lines match those filters. Try a wider vibe.", 404);
  }
  const prompt = getRandomPrompt({
    packIds: requestedPack ? [requestedPack.id] : allowedPackIds,
    categories: query.category ? [query.category] : undefined,
    difficulties: query.difficulty ? [query.difficulty] : undefined,
    excludeIds: query.excludeIds,
    seed: query.seed,
  });
  const energies = ENERGY_MODIFIERS.filter(
    (energy) =>
      !energy.compatibleDifficulties || energy.compatibleDifficulties.includes(prompt.difficulty),
  );
  const random = query.seed
    ? createSeededRandom(`delivery:random:energy:${query.seed}:${prompt.id}`)
    : Math.random;
  const energy = energies[Math.floor(boundedRandom(random) * energies.length)] ?? ENERGY_MODIFIERS[0]!;
  return { prompt, energy, source: "curated" };
}

export async function getRandomRuntimeContent(
  query: RandomContentQuery,
): Promise<RandomContentResult> {
  if (query.includePro) {
    const usage = await preflightJudgingUsage(await getOptionalUser());
    if (usage.tier !== "pro") {
      throw new AppError(
        "PRO_REQUIRED",
        "Pro packs need an active Delivery Pro subscription.",
        403,
        { upgradeCode: "DELIVERY_PRO" },
      );
    }
  }
  if (!isSupabaseConfigured()) return bundledFallback(query);
  const snapshot = await loadDatabaseSnapshot(query);
  return selectRuntimeContent(snapshot, query);
}
