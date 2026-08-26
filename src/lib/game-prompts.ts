import {
  ENERGY_MODIFIERS,
  getDailyPrompt,
  getEnergyModifierById,
  getPromptById,
  getRandomPrompt,
  PACKS,
} from "@/data/content";
import type { DeliveryPrompt, EnergyModifier, PromptDifficulty } from "@/data/content";
import type { GameMode, Prompt } from "@/types/game";

const difficultyScore: Record<PromptDifficulty, 1 | 2 | 3 | 4 | 5> = {
  easy: 1,
  medium: 2,
  hard: 4,
  impossible: 5,
};

function randomEnergy(prompt: DeliveryPrompt, mode: GameMode): EnergyModifier {
  const intensityFloor = mode === "impossible" ? 4 : prompt.difficulty === "easy" ? 1 : 2;
  const compatible = ENERGY_MODIFIERS.filter(
    (energy) =>
      energy.intensity >= intensityFloor &&
      (!energy.compatibleDifficulties || energy.compatibleDifficulties.includes(prompt.difficulty)),
  );
  return compatible[Math.floor(Math.random() * compatible.length)] ?? ENERGY_MODIFIERS[0]!;
}

export function toGamePrompt(prompt: DeliveryPrompt, energy: EnergyModifier): Prompt {
  const pack = PACKS.find((candidate) => prompt.packIds.includes(candidate.id));
  return {
    id: prompt.id,
    line: prompt.line,
    energy: energy.instruction,
    category: prompt.category.replaceAll("-", " "),
    difficulty: difficultyScore[prompt.difficulty],
    pack: pack?.name ?? "Delivery Originals",
    tags: [...prompt.tags],
    source: "editorial",
  };
}

export function gamePrompt(mode: GameMode = "classic", excludeId?: string): Prompt {
  const freePackIds = PACKS.filter((pack) => pack.access !== "pro").map((pack) => pack.id);
  const contentPrompt = getRandomPrompt({
    excludeIds: excludeId ? [excludeId.replace("-impossible", "")] : undefined,
    packId: mode === "impossible" ? "impossible-energy" : undefined,
    packIds: mode === "impossible" ? undefined : freePackIds,
    difficulties: mode === "impossible" ? ["impossible"] : undefined,
  });
  const energy = randomEnergy(contentPrompt, mode);
  return toGamePrompt(contentPrompt, energy);
}

export function gamePromptForPack(packId: string, excludeId?: string): Prompt {
  const prompt = getRandomPrompt({ packId, excludeIds: excludeId ? [excludeId] : undefined });
  return toGamePrompt(prompt, randomEnergy(prompt, packId === "impossible-energy" ? "impossible" : "classic"));
}

export function dailyGamePrompt(date = new Date()): Prompt {
  const daily = getDailyPrompt(date);
  return toGamePrompt(daily.prompt, daily.energy);
}

export function gamePromptById(promptId: string, energyId?: string): Prompt | null {
  const prompt = getPromptById(promptId);
  if (!prompt) return null;
  const energy = energyId ? getEnergyModifierById(energyId) ?? randomEnergy(prompt, "classic") : randomEnergy(prompt, "classic");
  return toGamePrompt(prompt, energy);
}
