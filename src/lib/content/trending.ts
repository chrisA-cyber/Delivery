import { ENERGY_MODIFIERS, PROMPTS, isEnergyCompatible, isRatingAllowed } from "../../data/content";
import { createSeededRandom, toUtcDateKey } from "./hash";
import type {
  ActiveTrend,
  ContentRating,
  DeliveryPrompt,
  EnergyModifier,
  TrendingPromptInjection,
} from "./types";

export interface TrendResolutionOptions {
  readonly maxRating?: ContentRating;
  readonly now?: Date;
  /** Lowercase ISO country code, `global`, or a product-defined market key. */
  readonly market?: string;
}

function parseInstant(value: string): number | undefined {
  const instant = Date.parse(value);
  return Number.isNaN(instant) ? undefined : instant;
}

export function resolveActiveTrends(
  injections: readonly TrendingPromptInjection[],
  options: TrendResolutionOptions = {},
): readonly ActiveTrend[] {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) throw new RangeError("Invalid trend resolution date");
  const market = options.market?.trim().toLocaleLowerCase("en") ?? "global";

  return injections
    .flatMap((injection) => {
      if (!isRatingAllowed(injection.prompt.rating, options.maxRating)) return [];
      const startsAt = parseInstant(injection.startsAt);
      const endsAt = parseInstant(injection.endsAt);
      if (
        startsAt === undefined ||
        endsAt === undefined ||
        startsAt > nowMs ||
        endsAt <= nowMs ||
        injection.priority < 0
      ) return [];
      const markets = injection.markets?.map((value) => value.toLocaleLowerCase("en"));
      if (markets?.length && !markets.includes("global") && !markets.includes(market)) {
        return [];
      }
      const allowedEnergy = new Set(injection.energyIds ?? []);
      const compatibleEnergy = allowedEnergy.size
        ? ENERGY_MODIFIERS.filter((modifier) => allowedEnergy.has(modifier.id) && isEnergyCompatible(injection.prompt, modifier))
        : ENERGY_MODIFIERS.filter((modifier) => isEnergyCompatible(injection.prompt, modifier));
      if (!compatibleEnergy.length) return [];
      return [{ injection, compatibleEnergy }] satisfies ActiveTrend[];
    })
    .sort((left, right) =>
      right.injection.priority - left.injection.priority ||
      left.injection.id.localeCompare(right.injection.id),
    );
}

/** Active editorial prompts win by ID; base content remains as a safe fallback. */
export function buildTrendingCatalog(
  injections: readonly TrendingPromptInjection[],
  options: TrendResolutionOptions = {},
): readonly DeliveryPrompt[] {
  const active = resolveActiveTrends(injections, options);
  const activeIds = new Set<string>();
  const editorialPrompts = active.flatMap(({ injection }) => {
    if (activeIds.has(injection.prompt.id)) return [];
    activeIds.add(injection.prompt.id);
    return [injection.prompt];
  });
  return [
    ...editorialPrompts,
    ...PROMPTS.filter((prompt) => !activeIds.has(prompt.id) && isRatingAllowed(prompt.rating, options.maxRating)),
  ];
}

export interface TrendingSelection {
  readonly prompt: DeliveryPrompt;
  readonly energy: EnergyModifier;
  readonly trendId: string | null;
  readonly label: string | null;
}

/**
 * Deterministically picks an active trend for a session/day. Priority is a weight,
 * not a hard override, so multiple cultural moments can coexist.
 */
export function getTrendingSelection(
  injections: readonly TrendingPromptInjection[],
  options: TrendResolutionOptions & { readonly seed?: string | number } = {},
): TrendingSelection {
  const now = options.now ?? new Date();
  const active = resolveActiveTrends(injections, { now, market: options.market, maxRating: options.maxRating });
  const seed = options.seed ?? `delivery:trend:${toUtcDateKey(now)}:${options.market ?? "global"}`;
  const random = createSeededRandom(seed);

  if (active.length === 0) {
    const safe = PROMPTS.filter((prompt) => isRatingAllowed(prompt.rating, options.maxRating));
    const prompt = safe[Math.floor(random() * safe.length)]!;
    const energies = ENERGY_MODIFIERS.filter((energy) => isEnergyCompatible(prompt, energy));
    const energy = energies[Math.floor(random() * energies.length)]!;
    return { prompt, energy, trendId: null, label: null };
  }

  const totalWeight = active.reduce(
    (total, trend) => total + Math.max(1, trend.injection.priority),
    0,
  );
  let cursor = random() * totalWeight;
  const selected =
    active.find((trend) => {
      cursor -= Math.max(1, trend.injection.priority);
      return cursor <= 0;
    }) ?? active[0]!;
  const energy =
    selected.compatibleEnergy[
      Math.floor(random() * selected.compatibleEnergy.length)
    ] ?? ENERGY_MODIFIERS[0]!;
  return {
    prompt: selected.injection.prompt,
    energy,
    trendId: selected.injection.id,
    label: selected.injection.label ?? null,
  };
}
