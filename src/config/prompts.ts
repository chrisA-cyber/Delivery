import type { GameMode, Prompt } from "@/types/game";
import { seededNumber } from "@/lib/utils";

export const FALLBACK_PROMPTS: Prompt[] = [
  { id: "air-fryer-alibi", line: "The air fryer knows what it did.", energy: "Like a detective closing a 20-year cold case", category: "Household lore", difficulty: 2, pack: "Everyday Chaos", source: "editorial" },
  { id: "scenic-route", line: "I did not miss the exit. I selected the scenic route.", energy: "Like the GPS personally betrayed you", category: "Delusional confidence", difficulty: 2, pack: "Main Character", source: "editorial" },
  { id: "tomorrow-problem", line: "Respectfully, that sounds like a tomorrow problem.", energy: "Like a CEO ending the quarterly call", category: "Corporate menace", difficulty: 2, pack: "Reply All", source: "editorial" },
  { id: "horse-email", line: "Why is there a horse in the email thread?", energy: "Like everyone else can clearly see the horse", category: "Office lore", difficulty: 3, pack: "Reply All", source: "editorial" },
  { id: "forbidden-snack", line: "This is not a snack. This is a legally binding decision.", energy: "Like an ancient wizard guarding the fridge", category: "Food court", difficulty: 3, pack: "Everyday Chaos", source: "editorial" },
  { id: "soft-launch", line: "I would like to soft-launch my return to having plans.", energy: "Like a celebrity reading a notes-app apology", category: "Timeline behavior", difficulty: 2, pack: "Online Forever", source: "editorial" },
  { id: "wifi-free-will", line: "The Wi-Fi has developed free will.", energy: "Like mission control just lost the moon", category: "Tech support", difficulty: 3, pack: "Online Forever", source: "editorial" },
  { id: "calendar-threat", line: "My calendar is no longer a tool. It is a threat.", energy: "Like you are warning a small coastal town", category: "Office lore", difficulty: 3, pack: "Reply All", source: "editorial" },
  { id: "chair-squeak", line: "The chair squeaked first. I merely responded.", energy: "Like you are testifying under oath", category: "Chaotic alibi", difficulty: 4, pack: "No Context", source: "editorial" },
  { id: "vibes-audit", line: "I ran the numbers. The vibes are insolvent.", energy: "Like a financial analyst during the apocalypse", category: "Corporate menace", difficulty: 4, pack: "Reply All", source: "editorial" },
  { id: "group-chat", line: "The group chat will hear about this.", energy: "Like a final boss revealing phase two", category: "Friend group", difficulty: 2, pack: "Group Chat Evidence", source: "editorial" },
  { id: "tiny-spoon", line: "Bring me the tiny spoon. We are celebrating.", energy: "Like a royal decree at 3 a.m.", category: "No context", difficulty: 3, pack: "No Context", source: "editorial" },
  { id: "plant-manager", line: "I have promoted the plant. You report to it now.", energy: "With unsettling managerial calm", category: "Corporate menace", difficulty: 3, pack: "Reply All", source: "editorial" },
  { id: "parking-lot", line: "The parking lot has chosen violence today.", energy: "Like a nature documentary narrator", category: "Everyday chaos", difficulty: 2, pack: "Everyday Chaos", source: "editorial" },
  { id: "do-not-perceive", line: "Please do not perceive me until further notice.", energy: "Like a ghost filing a formal complaint", category: "Social battery", difficulty: 4, pack: "Online Forever", source: "editorial" },
  { id: "soup-consequence", line: "This soup has consequences.", energy: "Like a defeated hero delivering a prophecy", category: "Food court", difficulty: 5, pack: "Impossible Energy", source: "editorial" },
];

const impossibleEnergy = [
  "Start as a whisper, end like you just conquered a small moon",
  "Like a defeated final boss trying not to cry in front of the minions",
  "With maximum aura and absolutely no evidence",
  "Like you are lying to the police but also hosting a cooking show",
  "As a nature documentary narrated by someone being actively chased",
];

export function fallbackPrompt(mode: GameMode = "classic", excludeId?: string): Prompt {
  const pool = FALLBACK_PROMPTS.filter((prompt) => prompt.id !== excludeId);
  const source = mode === "impossible" ? pool.filter((prompt) => prompt.difficulty >= 3) : pool;
  const item = source[Math.floor(Math.random() * source.length)] ?? FALLBACK_PROMPTS[0]!;
  if (mode !== "impossible") return item;
  return {
    ...item,
    id: `${item.id}-impossible`,
    energy: impossibleEnergy[Math.floor(Math.random() * impossibleEnergy.length)] ?? item.energy,
    difficulty: 5,
    pack: "Impossible Energy",
  };
}

export function fallbackDailyPrompt(date = new Date()): Prompt {
  const key = date.toISOString().slice(0, 10);
  return FALLBACK_PROMPTS[seededNumber(key) % FALLBACK_PROMPTS.length] ?? FALLBACK_PROMPTS[0]!;
}
