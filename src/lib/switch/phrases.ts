import type { SwitchChallenge } from "./types";

export type SwitchPhrase = {
  key: string;
  text: string;
  variants: Partial<Record<SwitchChallenge["kind"], SwitchChallenge>>;
};

/** Group the picker only; recording, scoring, and saved rounds keep their exact challenge. */
export function groupSwitchPhrases(challenges: readonly SwitchChallenge[]): SwitchPhrase[] {
  const phrases = new Map<string, SwitchPhrase>();
  for (const challenge of challenges) {
    const text = challenge.cues[0]?.text ?? challenge.title;
    const key = `${challenge.rating}:${text.trim().replace(/\s+/g, " ").toLowerCase()}`;
    const phrase: SwitchPhrase = phrases.get(key) ?? { key, text, variants: {} };
    phrase.variants[challenge.kind] ??= challenge;
    phrases.set(key, phrase);
  }
  return [...phrases.values()].sort((a, b) =>
    Number(Object.values(b.variants).some((item) => item.tags.includes("social-trend")))
    - Number(Object.values(a.variants).some((item) => item.tags.includes("social-trend"))));
}
