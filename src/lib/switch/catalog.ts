import type { ContentRating } from "@/lib/content/types";
import { SWITCH_RUBRIC_VERSION, SWITCH_SCORING_VERSION, type SwitchChallenge, type SwitchCue } from "@/lib/switch/types";

type Emotion = { emoji: string; directionLabel: string; direction: string };
const emotions = {
  laughing: { emoji: "😂", directionLabel: "Laughing", direction: "Say the phrase while barely containing laughter. Keep the words intelligible; you do not need to force a laugh." },
  angry: { emoji: "😡", directionLabel: "Angry", direction: "Say the same phrase with controlled irritation or anger. Intensity can be quiet; shouting is not required." },
  sad: { emoji: "😭", directionLabel: "Sad", direction: "Say the same phrase with sincere sadness, as if this tiny problem matters enormously." },
  robot: { emoji: "🤖", directionLabel: "Robot", direction: "Say the same phrase like a very literal robot: measured, deliberate, mechanical articulation." },
  alien: { emoji: "👽", directionLabel: "Alien", direction: "Say the same phrase like an alien trying human speech. Play with unexpected emphasis or rhythm; keep the words clear." },
  whisper: { emoji: "🤫", directionLabel: "Whisper", direction: "Say the same phrase in a clear, secretive whisper. Quiet control can earn full credit." },
  confident: { emoji: "😎", directionLabel: "Confident", direction: "Say the same phrase with effortless confidence, as if there is absolutely no room for doubt." },
  shocked: { emoji: "😱", directionLabel: "Shocked", direction: "Say the same phrase with astonished disbelief, as if you have just discovered something outrageous." },
  flirty: { emoji: "😉", directionLabel: "Flirty", direction: "Say the same phrase with warm, playful charm, as if you are gently teasing someone you like." },
  sarcastic: { emoji: "🙄", directionLabel: "Sarcastic", direction: "Say the same phrase with dry irony. Let the emphasis suggest you mean the opposite of the words." },
  disappointed: { emoji: "😒", directionLabel: "Disappointed", direction: "Say the same phrase with a restrained letdown, as if you expected better. Let the energy drop without forcing tears." },
} satisfies Record<string, Emotion>;
type EmotionKey = keyof typeof emotions;
type ChallengeOptions = { rating?: ContentRating; tags?: string[] };

function freeze(value: SwitchChallenge): SwitchChallenge {
  value.cues.forEach(Object.freeze);
  Object.freeze(value.cues);
  Object.freeze(value.tags);
  return Object.freeze(value);
}

function emotionChallenge(id: string, title: string, description: string, phrase: string, sequence: EmotionKey[], options: ChallengeOptions = {}): SwitchChallenge {
  return freeze({
    id, version: "1", kind: "emotion", title, description, duration: 20, difficulty: "easy", rating: options.rating ?? "everyone",
    tags: ["emotions", "emoji", "same-phrase", ...options.tags ?? []], scoringVersion: SWITCH_SCORING_VERSION, rubricVersion: SWITCH_RUBRIC_VERSION,
    cues: sequence.map((emotion, index) => ({
      id: `${id}-${index + 1}`, text: phrase, ...emotions[emotion]!, start: index * 4, end: (index + 1) * 4,
    })),
  });
}

function speedChallenge(id: string, title: string, description: string, phrase: string, options: ChallengeOptions = {}): SwitchChallenge {
  const speeds = [1, 0.5, 0.25, 2, 4];
  const boundaries = [0, 4, 9, 15, 18, 20];
  const labels = ["Normal · 1×", "Slow · 0.5×", "Super slow · 0.25×", "Fast · 2×", "Turbo · 4×"];
  const emojis = ["🚶", "🐢", "🦥", "🏃", "🚀"];
  return freeze({
    id, version: "1", kind: "speed", title, description, duration: 20, difficulty: "medium", rating: options.rating ?? "everyone",
    tags: ["speed", "same-phrase", ...options.tags ?? []], scoringVersion: SWITCH_SCORING_VERSION, rubricVersion: SWITCH_RUBRIC_VERSION,
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
  emotionChallenge("grandma-stop", "Grandma stop", "Grandma has a lot going on.", "Grandma stop", ["shocked", "angry", "flirty", "laughing", "whisper"], { rating: "teen", tags: ["social-trend", "absurd"] }),
  speedChallenge("speed-grandma-stop", "Speed: Grandma stop", "She is not slowing down. You are.", "Grandma stop", { rating: "teen", tags: ["social-trend", "absurd"] }),
  emotionChallenge("shut-the-fuck-up", "Shut the fuck up", "The words are rude. The delivery is up to you.", "Shut the fuck up", ["angry", "shocked", "flirty", "sad", "laughing"], { rating: "mature", tags: ["social-trend", "profanity"] }),
  speedChallenge("speed-shut-the-fuck-up", "Speed: shut the fuck up", "Five speeds. Still not a polite request.", "Shut the fuck up", { rating: "mature", tags: ["social-trend", "profanity"] }),
  emotionChallenge("absolute-air-mate", "Absolute air mate", "An insult with surprising emotional range.", "Absolute air mate", ["sarcastic", "disappointed", "flirty", "angry", "sad"], { rating: "teen", tags: ["social-trend", "absurd"] }),
  speedChallenge("speed-absolute-air-mate", "Speed: absolute air mate", "Deliver the diagnosis at every speed.", "Absolute air mate", { rating: "teen", tags: ["social-trend", "absurd"] }),
  emotionChallenge("literally", "Literally", "One word. Five very different opinions.", "Literally", ["confident", "sarcastic", "shocked", "sad", "laughing"], { tags: ["social-trend"] }),
  speedChallenge("speed-literally", "Speed: literally", "Find out how long one word can last.", "Literally", { tags: ["social-trend"] }),
  emotionChallenge("i-missed-you", "I missed you", "A reunion with several unresolved feelings.", "I missed you", ["sad", "angry", "flirty", "sarcastic", "laughing"], { tags: ["social-trend", "everyday"] }),
  speedChallenge("speed-i-missed-you", "Speed: I missed you", "A reunion at dial-up speed. Then broadband.", "I missed you", { tags: ["social-trend", "everyday"] }),
  emotionChallenge("you-look-tired", "You look tired", "Concern, judgment, or a terrible opening line.", "You look tired", ["whisper", "sarcastic", "shocked", "disappointed", "laughing"], { tags: ["social-trend", "everyday"] }),
  speedChallenge("speed-you-look-tired", "Speed: you look tired", "The observation nobody asked for, five times.", "You look tired", { tags: ["social-trend", "everyday"] }),
  emotionChallenge("give-me-a-second", "Give me a second", "You need a moment. They need to wait.", "Give me a second", ["confident", "angry", "sad", "robot", "laughing"], { tags: ["social-trend", "everyday"] }),
  speedChallenge("speed-give-me-a-second", "Speed: give me a second", "Some seconds last longer than others.", "Give me a second", { tags: ["social-trend", "everyday"] }),
  emotionChallenge("im-coming", "I'm coming", "Context is doing absolutely none of the work.", "I'm coming", ["confident", "flirty", "shocked", "whisper", "laughing"], { rating: "mature", tags: ["social-trend", "innuendo"] }),
  speedChallenge("speed-im-coming", "Speed: I'm coming", "Your estimated arrival time keeps changing.", "I'm coming", { rating: "mature", tags: ["social-trend", "innuendo"] }),
  // Complete the original phrases so every library card offers both ways to play.
  speedChallenge("speed-im-the-manager", "Speed: I'm the manager", "Your promotion, at every pace.", "I'm the manager."),
  speedChallenge("speed-thats-my-lawyer", "Speed: that's my lawyer", "The legal department has five gears.", "That's my lawyer."),
  speedChallenge("speed-send-help", "Speed: send help", "Same emergency. Different response times.", "Please send help."),
  emotionChallenge("im-cooked", "I'm cooked", "Five ways to realize it is over.", "I am cooked.", ["shocked", "sad", "laughing", "angry", "robot"]),
  emotionChallenge("skill-issue", "Skill issue", "The diagnosis has range.", "Major skill issue.", ["confident", "sarcastic", "sad", "laughing", "alien"]),
  emotionChallenge("sir-please", "Sir, please", "Customer service is going through it.", "Sir, please stop.", ["whisper", "angry", "sad", "robot", "laughing"]),
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
