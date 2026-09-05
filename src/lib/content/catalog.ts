import {
  ENERGY_MODIFIERS,
  PACKS,
  PROMPTS,
  getEnergyModifierById,
  getFavoritePrompts,
  getPackById,
  getPromptById,
  getPromptsForPack,
  queryPrompts,
  isEnergyCompatible,
} from "../../data/content";
import { hashString, shuffleDeterministic } from "./hash";
import type {
  DeliveryPrompt,
  EnergyModifier,
  PromptQuery,
} from "./types";

export interface CatalogIssue {
  readonly level: "error" | "warning";
  readonly code:
    | "duplicate-id"
    | "missing-pack"
    | "empty-pack"
    | "line-too-long"
    | "missing-tag";
  readonly itemId: string;
  readonly message: string;
}

export interface PromptDeckOptions extends PromptQuery {
  readonly seed: string | number;
  readonly excludeIds?: readonly string[];
  readonly limit?: number;
}

/** Produces a seeded, no-repeat deck for Endless/Hot Streak mode. */
export function createPromptDeck(options: PromptDeckOptions): DeliveryPrompt[] {
  const excluded = new Set(options.excludeIds ?? []);
  const candidates = queryPrompts(options).filter((prompt) => !excluded.has(prompt.id));
  const shuffled = shuffleDeterministic(candidates, options.seed);
  return options.limit === undefined
    ? shuffled
    : shuffled.slice(0, Math.max(0, options.limit));
}

/**
 * Picks a modifier without coupling it to array order. Difficulty and prompt tags
 * influence the seed, while the optional recent list prevents immediate repeats.
 */
export function getSuggestedEnergy(
  prompt: DeliveryPrompt,
  seed: string | number,
  recentEnergyIds: readonly string[] = [],
): EnergyModifier {
  const recent = new Set(recentEnergyIds);
  const compatible = ENERGY_MODIFIERS.filter(
    (modifier) =>
      !recent.has(modifier.id) &&
      isEnergyCompatible(prompt, modifier),
  );
  const pool = compatible.length > 0 ? compatible : ENERGY_MODIFIERS.filter((energy) => isEnergyCompatible(prompt, energy));
  if (!pool.length) throw new RangeError("No compatible direction for this line");
  const index = hashString(`${seed}:${prompt.id}:${prompt.tags.join(":")}`) % pool.length;
  return pool[index]!;
}

/** Returns IDs in user-selected order, de-duplicated and stripped of stale IDs. */
export function normalizeFavoritePromptIds(
  favoriteIds: readonly string[],
): string[] {
  const seen = new Set<string>();
  return favoriteIds.filter((id) => {
    if (seen.has(id) || !getPromptById(id)) return false;
    seen.add(id);
    return true;
  });
}

export function validateContentCatalog(): readonly CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const seenPromptIds = new Set<string>();
  const seenEnergyIds = new Set<string>();

  for (const prompt of PROMPTS) {
    if (seenPromptIds.has(prompt.id)) {
      issues.push({ level: "error", code: "duplicate-id", itemId: prompt.id, message: `Duplicate prompt ID: ${prompt.id}` });
    }
    seenPromptIds.add(prompt.id);
    if (prompt.line.length > 180) {
      issues.push({ level: "warning", code: "line-too-long", itemId: prompt.id, message: "Prompt exceeds the recommended 180-character recording length." });
    }
    if (prompt.tags.length === 0) {
      issues.push({ level: "warning", code: "missing-tag", itemId: prompt.id, message: "Prompt has no discovery tags." });
    }
    for (const packId of prompt.packIds) {
      if (!getPackById(packId)) {
        issues.push({ level: "error", code: "missing-pack", itemId: prompt.id, message: `Unknown pack ID: ${packId}` });
      }
    }
  }

  for (const modifier of ENERGY_MODIFIERS) {
    if (seenEnergyIds.has(modifier.id)) {
      issues.push({ level: "error", code: "duplicate-id", itemId: modifier.id, message: `Duplicate energy ID: ${modifier.id}` });
    }
    seenEnergyIds.add(modifier.id);
  }

  for (const pack of PACKS) {
    if (getPromptsForPack(pack.id).length === 0) {
      issues.push({ level: "warning", code: "empty-pack", itemId: pack.id, message: "Pack has no prompts." });
    }
  }

  return issues;
}

export {
  ENERGY_MODIFIERS,
  PACKS,
  PROMPTS,
  getEnergyModifierById,
  getFavoritePrompts,
  getPackById,
  getPromptById,
  getPromptsForPack,
  queryPrompts,
};
