import {
  ENERGY_MODIFIERS,
  getDailyPrompt,
  getEnergyModifierById,
  getPromptById,
  getRandomPrompt,
  isEnergyCompatible,
  PACKS,
} from "@/data/content";
import type {
  ContentRating,
  DeliveryPrompt,
  EnergyModifier,
  PromptDifficulty,
} from "@/data/content";
import type { GameMode, Prompt } from "@/types/game";

const difficultyScore: Record<PromptDifficulty, 1 | 2 | 3 | 4 | 5> = {
  easy: 1,
  medium: 2,
  hard: 4,
  impossible: 5,
};
function randomEnergy(
  prompt: DeliveryPrompt,
  mode: GameMode,
  recentEnergyIds: readonly string[] = [],
): EnergyModifier {
  const compatible = ENERGY_MODIFIERS.filter(
    (energy) =>
      isEnergyCompatible(prompt, energy) &&
      (mode !== "impossible" || energy.intensity >= 4),
  );
  const fresh = compatible.filter(
    (energy) => !recentEnergyIds.includes(energy.id),
  );
  const pool = fresh.length ? fresh : compatible;
  if (!pool.length)
    throw new Error("No compatible direction is available for this line.");
  return pool[Math.floor(Math.random() * pool.length)]!;
}
export function toGamePrompt(
  prompt: DeliveryPrompt,
  energy: EnergyModifier,
): Prompt {
  const pack = PACKS.find((candidate) => prompt.packIds.includes(candidate.id));
  return {
    id: prompt.id,
    line: prompt.line,
    energy: energy.instruction,
    energyId: energy.id,
    directionLabel: energy.shortLabel,
    category: prompt.category.replaceAll("-", " "),
    difficulty: difficultyScore[prompt.difficulty],
    pack: pack?.name ?? "Delivery Originals",
    tags: [...prompt.tags],
    source: "editorial",
    rating: prompt.rating,
  };
}
export function gamePrompt(
  mode: GameMode = "classic",
  excludeId?: string,
  maxRating: ContentRating = "everyone",
  recentIds: readonly string[] = [],
  recentEnergyIds: readonly string[] = [],
): Prompt {
  const freePackIds = PACKS.filter((pack) => pack.access !== "pro").map(
    (pack) => pack.id,
  );
  const options = {
    excludeIds: [...recentIds, ...(excludeId ? [excludeId] : [])],
    maxRating,
    packId: mode === "impossible" ? "impossible-energy" : undefined,
    packIds: mode === "impossible" ? undefined : freePackIds,
    difficulties: mode === "impossible" ? ["impossible" as const] : undefined,
  };
  let contentPrompt: DeliveryPrompt;
  try {
    contentPrompt = getRandomPrompt(options);
  } catch {
    contentPrompt = getRandomPrompt({
      ...options,
      excludeIds: excludeId ? [excludeId] : [],
    });
  }
  return toGamePrompt(
    contentPrompt,
    randomEnergy(contentPrompt, mode, recentEnergyIds),
  );
}
export function gamePromptForPack(
  packId: string,
  excludeId?: string,
  maxRating: ContentRating = "everyone",
  recentIds: readonly string[] = [],
  recentEnergyIds: readonly string[] = [],
): Prompt {
  let prompt: DeliveryPrompt;
  try {
    prompt = getRandomPrompt({
      packId,
      maxRating,
      excludeIds: [...recentIds, ...(excludeId ? [excludeId] : [])],
    });
  } catch {
    prompt = getRandomPrompt({
      packId,
      maxRating,
      excludeIds: excludeId ? [excludeId] : [],
    });
  }
  return toGamePrompt(
    prompt,
    randomEnergy(
      prompt,
      packId === "impossible-energy" ? "impossible" : "classic",
      recentEnergyIds,
    ),
  );
}
export function dailyGamePrompt(date = new Date()): Prompt {
  const daily = getDailyPrompt(date);
  return toGamePrompt(daily.prompt, daily.energy);
}
export function gamePromptById(
  promptId: string,
  energyId?: string,
): Prompt | null {
  const prompt = getPromptById(promptId);
  if (!prompt) return null;
  const requested = energyId ? getEnergyModifierById(energyId) : undefined;
  if (requested && !isEnergyCompatible(prompt, requested)) return null;
  return toGamePrompt(prompt, requested ?? randomEnergy(prompt, "classic"));
}
