import type { ContentRating } from "@/lib/content/types";
import { SWITCH_RUBRIC_VERSION, SWITCH_SCORING_VERSION, type SwitchChallenge, type SwitchCue } from "@/lib/switch/types";

type Emotion = { emoji: string; directionLabel: string; direction: string };
const emotions: Record<string, Emotion> = {
  laughing: { emoji: "😂", directionLabel: "Laughing", direction: "Say the phrase while barely containing laughter. Keep the words intelligible; you do not need to force a laugh." },
  angry: { emoji: "😡", directionLabel: "Angry", direction: "Say the same phrase with controlled irritation or anger. Intensity can be quiet; shouting is not required." },
  sad: { emoji: "😭", directionLabel: "Sad", direction: "Say the same phrase with sincere sadness, as if this tiny problem matters enormously." },
  robot: { emoji: "🤖", directionLabel: "Robot", direction: "Say the same phrase like a very literal robot: measured, deliberate, mechanical articulation." },
  alien: { emoji: "👽", directionLabel: "Alien", direction: "Say the same phrase like an alien trying human speech. Play with unexpected emphasis or rhythm; keep the words clear." },
  whisper: { emoji: "🤫", directionLabel: "Whisper", direction: "Say the same phrase in a clear, secretive whisper. Quiet control can earn full credit." },
  confident: { emoji: "😎", directionLabel: "Confident", direction: "Say the same phrase with effortless confidence, as if there is absolutely no room for doubt." },
  shocked: { emoji: "😱", directionLabel: "Shocked", direction: "Say the same phrase with astonished disbelief, as if you have just discovered something outrageous." },
};

function freeze(value: SwitchChallenge): SwitchChallenge {
  value.cues.forEach(Object.freeze);
  Object.freeze(value.cues);
  Object.freeze(value.tags);
  return Object.freeze(value);
}

function emotionChallenge(id: string, title: string, description: string, phrase: string, sequence: string[]): SwitchChallenge {
  return freeze({
    id, version: "1", kind: "emotion", title, description, duration: 20, difficulty: "easy", rating: "everyone",
    tags: ["emotions", "emoji", "same-phrase"], scoringVersion: SWITCH_SCORING_VERSION, rubricVersion: SWITCH_RUBRIC_VERSION,
    cues: sequence.map((emotion, index) => ({
      id: `${id}-${index + 1}`, text: phrase, ...emotions[emotion]!, start: index * 4, end: (index + 1) * 4,
    })),
  });
}

function speedChallenge(id: string, title: string, description: string, phrase: string): SwitchChallenge {
  const speeds = [1, 0.5, 0.25, 2, 4];
  const boundaries = [0, 4, 9, 15, 18, 20];
  const labels = ["Normal · 1×", "Slow · 0.5×", "Super slow · 0.25×", "Fast · 2×", "Turbo · 4×"];
  const emojis = ["🚶", "🐢", "🦥", "🏃", "🚀"];
  return freeze({
    id, version: "1", kind: "speed", title, description, duration: 20, difficulty: "medium", rating: "everyone",
    tags: ["speed", "same-phrase"], scoringVersion: SWITCH_SCORING_VERSION, rubricVersion: SWITCH_RUBRIC_VERSION,
    cues: speeds.map((speed, index) => ({
      id: `${id}-${index + 1}`, text: phrase, speed, emoji: emojis[index]!, directionLabel: labels[index]!,
      direction: index === 0
        ? "Say the phrase once at your comfortable normal pace; this is your own reference speed. Rest until the next cue."
        : `Say the same phrase once at roughly ${speed} times your normal speaking pace. ${speed < 1 ? "Stretch the delivery and vowels without changing the words." : "Keep it short and quick, with the words as clear as you can."} The ratio is playful guidance, not a stopwatch test. Rest until the next cue.`,
      start: boundaries[index]!, end: boundaries[index + 1]!,
    })),
  });
}

/** Published versions are immutable. Editorial changes need a new version. */
export const SWITCH_CHALLENGES: readonly SwitchChallenge[] = Object.freeze([
  emotionChallenge("not-my-problem", "Not my problem", "Five emotional stages of refusing responsibility.", "Not my problem.", ["laughing", "angry", "sad", "robot", "alien"]),
  emotionChallenge("im-the-manager", "I'm the manager", "Your promotion is going through some things.", "I'm the manager.", ["confident", "shocked", "angry", "sad", "whisper"]),
  emotionChallenge("thats-my-lawyer", "That's my lawyer", "The legal department has range.", "That's my lawyer.", ["whisper", "laughing", "shocked", "robot", "alien"]),
  emotionChallenge("send-help", "Send help", "Same emergency. Five wildly different reactions.", "Please send help.", ["sad", "confident", "laughing", "angry", "robot"]),
  speedChallenge("speed-not-my-problem", "Speed: not my problem", "Deny responsibility at every available speed.", "Not my problem."),
  speedChallenge("speed-im-cooked", "Speed: I'm cooked", "A very slow realization, then a very fast one.", "I am cooked."),
  speedChallenge("speed-skill-issue", "Speed: skill issue", "The diagnosis stays the same. Your pace doesn't.", "Major skill issue."),
  speedChallenge("speed-sir-please", "Speed: sir, please", "Customer service, from sloth mode to liftoff.", "Sir, please stop."),
]);

export function getSwitchChallenge(id: string, version?: string): SwitchChallenge | null {
  return SWITCH_CHALLENGES.find((item) => item.id === id && (!version || item.version === version)) ?? null;
}

export function switchChallengesForRating(maxRating: ContentRating = "teen"): SwitchChallenge[] {
  const rank = { everyone: 0, teen: 1, mature: 2 };
  return SWITCH_CHALLENGES.filter((item) => rank[item.rating] <= rank[maxRating]);
}

export function snapshotSwitchChallenge(value: SwitchChallenge): SwitchChallenge {
  return { ...value, tags: [...value.tags], cues: value.cues.map((cue) => ({ ...cue })) };
}

export function switchChallengeKey(value: SwitchChallenge): string {
  return `${value.id}:${value.version}:${value.scoringVersion}:${value.rubricVersion}`;
}

/** Media-time lookup means seeking backwards cannot leave stale cues. */
export function switchCueAt(challenge: SwitchChallenge, seconds: number): SwitchCue {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return challenge.cues.find((cue) => time >= cue.start && time < cue.end)
    ?? (time >= challenge.duration ? challenge.cues.at(-1)! : challenge.cues[0]!);
}
