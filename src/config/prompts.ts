import { PROMPTS, getPackById } from "@/data/content";
import { dailyGamePrompt, gamePrompt, toGamePrompt } from "@/lib/game-prompts";
import { getSuggestedEnergy } from "@/lib/content/catalog";
import type { GameMode, Prompt } from "@/types/game";
/** The offline catalog uses the same immutable IDs/copy as server resolution. */
export const FALLBACK_PROMPTS: Prompt[] = PROMPTS.filter((prompt) => prompt.rating === "everyone" && prompt.packIds.some((id) => getPackById(id)?.access !== "pro")).map((prompt) => toGamePrompt(prompt, getSuggestedEnergy(prompt, "fallback")));
export function fallbackPrompt(mode: GameMode = "classic", excludeId?: string): Prompt { return gamePrompt(mode, excludeId); }
export function fallbackDailyPrompt(date = new Date()): Prompt { return dailyGamePrompt(date); }
