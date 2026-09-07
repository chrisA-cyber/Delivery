import { VISUAL_THEME } from "../lib/visual-theme";
import { RECOGNIZABLE_PROMPTS } from "./recognizable-content";
import { createSeededRandom, toUtcDateKey } from "../lib/content/hash";
import {
  PACKS as LEGACY_PACKS,
  PROMPTS as LEGACY_PROMPTS,
  ENERGY_MODIFIERS as LEGACY_ENERGY,
  getDailyPrompt as legacyDaily,
} from "./legacy-content";
import {
  PROMPTS as V2_PROMPTS,
  ENERGY_MODIFIERS as V2_ENERGY,
  getDailyPrompt as v2Daily,
} from "./classic-content-v2";
import type {
  ContentPack,
  ContentRating,
  DailyPrompt,
  DeliveryPrompt,
  EnergyModifier,
  FavoritePromptRef,
  PromptQuery,
  RandomPromptOptions,
} from "../lib/content/types";
export type {
  ContentPack,
  ContentRating,
  DailyPrompt,
  DeliveryPrompt,
  EnergyModifier,
  FavoritePromptRef,
  PromptCategory,
  PromptDifficulty,
  PromptQuery,
  RandomPromptOptions,
  ScoringDimension,
} from "../lib/content/types";

/** Active Step 1B catalog. Text changes receive fresh IDs; prior releases stay resolvable. */
export const CATALOG_VERSION = "classic-content-v3";
export const PACKS: readonly ContentPack[] = [
  {
    id: "internet-originals",
    name: "Public Apology",
    eyebrow: "Main character damage",
    description:
      "Confessions, delusions, and apologies that somehow make it worse.",
    access: "free",
    categories: ["main-character"],
    color: VISUAL_THEME.accent,
    accent: VISUAL_THEME.ink,
    icon: "spark",
    coverTone: "internet-originals",
    sortOrder: 10,
    featured: true,
  },
  {
    id: "stream-gremlins",
    name: "Clip That",
    eyebrow: "Chat has the receipts",
    description:
      "Stream meltdowns, familiar phrases, and microphones that were definitely on.",
    access: "free",
    categories: ["streamer-mode"],
    color: VISUAL_THEME.pink,
    accent: VISUAL_THEME.ink,
    icon: "live",
    coverTone: "stream-gremlins",
    sortOrder: 20,
    featured: true,
  },
  {
    id: "gaming-comms",
    name: "Skill Issue",
    eyebrow: "Your team heard that",
    description:
      "Failed clutches, hostile tutorials, and excuses with zero evidence.",
    access: "free",
    categories: ["gaming"],
    color: VISUAL_THEME.blue,
    accent: VISUAL_THEME.ink,
    icon: "controller",
    coverTone: "gaming-comms",
    sortOrder: 30,
    featured: false,
  },
  {
    id: "group-chat-evidence",
    name: "Do Not Forward",
    eyebrow: "The voice note stays here",
    description:
      "Private confessions and social disasters with no plausible deniability.",
    access: "free",
    categories: ["group-chat"],
    color: VISUAL_THEME.accent,
    accent: VISUAL_THEME.ink,
    icon: "bubble",
    coverTone: "group-chat-evidence",
    sortOrder: 40,
    featured: true,
  },
  {
    id: "romance-rejection",
    name: "Down Catastrophic",
    eyebrow: "Read. Regret. Repeat.",
    description: "Flirting, bad dates, and dignity left on read.",
    access: "rotating",
    categories: ["romance"],
    color: VISUAL_THEME.pink,
    accent: VISUAL_THEME.ink,
    icon: "heart-crack",
    coverTone: "romance-rejection",
    sortOrder: 50,
    featured: false,
  },
  {
    id: "impossible-energy",
    name: "Final Boss Behavior",
    eyebrow: "Pro: emotional whiplash",
    description:
      "Grand declarations for people who absolutely cannot back them up.",
    access: "pro",
    categories: ["wildcard"],
    color: VISUAL_THEME.accent,
    accent: VISUAL_THEME.ink,
    icon: "warning",
    coverTone: "impossible-energy",
    sortOrder: 60,
    featured: false,
  },
];

export const ENERGY_MODIFIERS: readonly EnergyModifier[] = [
  {
    id: "v2-confidence-tears",
    shortLabel: "Winning. Barely.",
    instruction:
      "Sound outrageously confident while holding back tears; let one word wobble, then recover.",
    intensity: 4,
    tags: ["confident", "strained", "contrast"],
  },
  {
    id: "v2-polite-fury",
    shortLabel: "Whispered fury",
    instruction:
      "Whisper a furious outburst with immaculate politeness. Keep every word audible.",
    intensity: 3,
    tags: ["quiet", "whisper", "angry"],
  },
  {
    id: "v2-sincere-confession",
    shortLabel: "Painfully sincere",
    instruction:
      "Confess with total sincerity, as if this is the bravest thing you have ever admitted.",
    intensity: 2,
    tags: ["quiet", "sincere", "confessional"],
  },
  {
    id: "v2-deadpan-evidence",
    shortLabel: "Under oath",
    instruction:
      "Give flat, precise testimony. Pause before the most embarrassing detail; do not wink at the joke.",
    intensity: 1,
    tags: ["quiet", "deadpan", "timing"],
  },
  {
    id: "v2-apology-smile",
    shortLabel: "Sorry you noticed",
    instruction:
      "Start with a soft apology; become audibly proud halfway through, then pretend you did not.",
    intensity: 3,
    tags: ["apology", "contrast"],
  },
  {
    id: "v3-hold-laugh",
    shortLabel: "Absolutely serious",
    instruction:
      "Try not to laugh. Let one breath escape, then force the ending back into rigid seriousness.",
    intensity: 3,
    tags: ["restrained", "comedy", "multi-beat"],
  },
  {
    id: "v3-last-voicemail",
    shortLabel: "Please call back",
    instruction:
      "Leave a voicemail pretending everything is fine. Let the final few words give away how badly you need a call back.",
    intensity: 3,
    tags: ["confessional", "escalating", "multi-beat"],
  },
  {
    id: "v3-press-conference",
    shortLabel: "No further questions",
    instruction:
      "Answer a question you wish nobody had asked. Start defensive; finish congratulating yourself.",
    intensity: 4,
    tags: ["defensive", "confident", "multi-beat"],
  },
  {
    id: "v3-soft-threat",
    shortLabel: "Sweet little threat",
    instruction:
      "Use a warm, gentle voice. Let the final phrase turn cold, as if your patience has just run out.",
    intensity: 2,
    tags: ["quiet", "controlled", "villain", "multi-beat"],
  },
  {
    id: "v2-fake-ad",
    shortLabel: "Buy my disaster",
    instruction:
      "Pitch every word like an irresistible deal. Make the worst detail your big selling point.",
    intensity: 4,
    tags: ["sales", "confident"],
  },
  {
    id: "v3-bedtime-catastrophe",
    shortLabel: "Sleep tight",
    instruction:
      'Soothe someone back to sleep. Give the worst word the same gentle care as "sweet dreams."',
    intensity: 1,
    tags: ["quiet", "gentle"],
  },
  {
    id: "v2-betrayed-teammate",
    shortLabel: "You promised",
    instruction:
      "Speak to your most trusted teammate after a betrayal. Hurt first; outrage at the end.",
    intensity: 4,
    tags: ["hurt", "contrast"],
  },
  {
    id: "v2-no-breathless-rush",
    shortLabel: "Missed the mute",
    instruction:
      "Start casually, realize everyone can hear you, and finish in tightly controlled panic.",
    intensity: 4,
    tags: ["panic", "contrast"],
  },
  {
    id: "v3-documentary-scandal",
    shortLabel: "Rare behavior",
    instruction:
      "Describe this behavior with hushed scientific wonder. Sound grateful you lived long enough to witness it.",
    intensity: 2,
    tags: ["quiet", "wonder"],
  },
  {
    id: "v2-villain-crack",
    shortLabel: "Evil. Mostly.",
    instruction:
      "Begin with smooth villain menace, accidentally sound needy, then claw back your authority.",
    intensity: 4,
    tags: ["villain", "contrast"],
  },
  {
    id: "v2-forbidden-whisper",
    shortLabel: "Do not wake them",
    instruction:
      "Whisper an urgent secret to someone beside you. Be intense without raising your volume.",
    intensity: 2,
    tags: ["quiet", "whisper", "urgent"],
  },
  {
    id: "v2-one-word-break",
    shortLabel: "The word that broke you",
    instruction:
      "Keep a completely level voice until one important word; crack emotionally there, then go flat again.",
    intensity: 3,
    tags: ["quiet", "deadpan", "contrast"],
  },
  {
    id: "v3-fake-casual",
    shortLabel: "Obviously casual",
    instruction:
      "Try painfully hard to sound casual. Add a tiny nervous laugh, then pretend you never made it.",
    intensity: 2,
    tags: ["awkward", "restrained", "multi-beat"],
  },
  {
    id: "v3-sports-final",
    shortLabel: "Last seconds",
    instruction:
      "Call the final seconds of a championship. Tighten the pace, pause before the ending, then release the suspense.",
    intensity: 5,
    tags: ["broadcast", "escalating", "multi-beat"],
  },
  {
    id: "v2-reverse-meltdown",
    shortLabel: "Get it together",
    instruction:
      "Begin on the edge of a meltdown. Force your voice back into calm by the last few words.",
    intensity: 4,
    tags: ["contrast", "controlled"],
  },
  {
    id: "v2-no-context-pride",
    shortLabel: "Standing ovation",
    instruction:
      "Accept an award for this exact behavior. Sound moved, grateful, and completely unashamed.",
    intensity: 3,
    tags: ["proud", "sincere"],
  },
  {
    id: "v2-quiet-winner",
    shortLabel: "Already won",
    instruction:
      "Speak softly and slowly, with the certainty of someone who has already won. No raised voice.",
    intensity: 1,
    tags: ["quiet", "confident"],
  },
  {
    id: "v3-horror-realization",
    shortLabel: "Oh. Oh no.",
    instruction:
      "Begin with an ordinary observation. Pause as the meaning sinks in; finish in a clear, horrified whisper.",
    intensity: 3,
    tags: ["quiet", "eerie", "contrast"],
  },
  {
    id: "v3-news-desk",
    shortLabel: "Keep broadcasting",
    instruction:
      "Read the news with crisp professionalism. Let a laugh threaten one word, swallow it, and keep broadcasting.",
    intensity: 3,
    tags: ["broadcast", "restrained", "multi-beat"],
  },
  {
    id: "v2-romantic-disaster",
    shortLabel: "This is love",
    instruction:
      "Make it a tender declaration of love. Commit especially hard to the least romantic word.",
    intensity: 2,
    tags: ["gentle", "romance"],
  },
  {
    id: "v2-wrong-room",
    shortLabel: "Wrong audience",
    instruction:
      "Start with bold authority. Realize halfway through you are in the wrong room; finish anyway.",
    intensity: 4,
    tags: ["awkward", "contrast"],
  },
  {
    id: "v2-tiny-argument",
    shortLabel: "Losing the argument",
    instruction:
      "Try to sound reasonable while clearly losing an argument. Stress the detail nobody believes.",
    intensity: 3,
    tags: ["defensive", "timing"],
  },
  {
    id: "v2-hero-last-stand",
    shortLabel: "One last request",
    instruction:
      "Deliver a wounded hero’s final request. Keep the words clear and make the ending absurdly noble.",
    intensity: 4,
    tags: ["dramatic", "strained"],
  },
  {
    id: "v2-smug-explanation",
    shortLabel: "As I predicted",
    instruction:
      "Explain it with unbearable smugness. Treat the final detail as proof of your genius.",
    intensity: 3,
    tags: ["confident", "comedy"],
  },
  {
    id: "v2-terrible-good-news",
    shortLabel: "Great news, somehow",
    instruction:
      "Announce it as wonderful news. Let doubt flash through once, then double down on the celebration.",
    intensity: 4,
    tags: ["victorious", "contrast"],
  },
  {
    id: "v2-voice-assistant",
    shortLabel: "Human mode failed",
    instruction:
      "Use a smooth automated voice that briefly glitches into real embarrassment, then resets.",
    intensity: 3,
    tags: ["robotic", "contrast"],
  },
  {
    id: "v3-bad-interrogation",
    shortLabel: "You cannot prove it",
    instruction:
      "Sound calmly innocent. Rush the detail that could incriminate you, then slow down far too much.",
    intensity: 3,
    tags: ["nervous", "timing", "multi-beat"],
  },
  {
    id: "v2-angry-gratitude",
    shortLabel: "Thank you so much",
    instruction:
      "Sound intensely grateful through clenched frustration. Make the courtesy unmistakable.",
    intensity: 3,
    tags: ["polite", "angry"],
  },
  {
    id: "v3-manual-serious",
    shortLabel: "Read the manual",
    instruction:
      "Read this as a vital instruction from an appliance manual. Give one absurd word painfully precise emphasis.",
    intensity: 2,
    tags: ["quiet", "deadpan", "timing"],
  },
  {
    id: "v2-awe-to-disgust",
    shortLabel: "What a miracle",
    instruction:
      "Start in genuine wonder. Gradually realize this is disgusting; finish with defeated acceptance.",
    intensity: 4,
    tags: ["contrast", "disgust"],
  },
  {
    id: "v2-tiny-emergency",
    shortLabel: "Controlled emergency",
    instruction:
      "Brief someone on a crisis in a low, steady voice. Put urgency into the pace, not the volume.",
    intensity: 2,
    tags: ["quiet", "controlled", "urgent"],
  },
];

export const ORIGINAL_PROMPTS: readonly DeliveryPrompt[] = [
  {
    id: "v2-favorite-child",
    line: "I am my own emergency contact. We are both panicking.",
    category: "main-character",
    packIds: ["internet-originals"],
    tags: ["main-character", "confession"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-two-phone-calls",
    line: "I faked a phone call to avoid someone. My phone rang. I answered both.",
    category: "main-character",
    packIds: ["internet-originals"],
    tags: ["main-character", "boast"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-mirror-argument",
    line: "I won an argument in the shower. I have called a press conference.",
    category: "main-character",
    packIds: ["internet-originals"],
    tags: ["main-character", "confession"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-camera-relationship",
    line: "I waved at a security camera. The guard waved back. I have to go there every day now.",
    category: "main-character",
    packIds: ["internet-originals"],
    tags: ["main-character", "boast"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-fake-account",
    line: "I made a fake account to defend myself. It got bullied into agreeing with them.",
    category: "main-character",
    packIds: ["internet-originals"],
    tags: ["main-character", "confession"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-villain-budget",
    line: "I cannot afford a villain era. I have to be a problem on public transport.",
    category: "main-character",
    packIds: ["internet-originals"],
    tags: ["main-character", "boast"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-crying-hot",
    line: "I checked the mirror while crying. The sadness can wait. I look incredible.",
    category: "main-character",
    packIds: ["internet-originals"],
    tags: ["main-character", "confession"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-apology-sponsor",
    line: "This apology is sponsored by the consequences of my own bullshit.",
    category: "main-character",
    packIds: ["internet-originals"],
    tags: ["main-character", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-emotional-support-lie",
    line: "I faked a British accent on a first date. We have been married six fucking years.",
    category: "main-character",
    packIds: ["internet-originals"],
    tags: ["main-character", "confession"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-blocked-therapist",
    line: "I blocked my therapist. She kept bringing up things I specifically paid her to hear.",
    category: "main-character",
    packIds: ["internet-originals"],
    tags: ["main-character", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-banned-list",
    line: "I told the bouncer I was on the list. It was the fucking banned list.",
    category: "main-character",
    packIds: ["internet-originals"],
    tags: ["main-character", "confession"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-character-witness",
    line: 'I asked for a character witness. My best friend said, "For the prosecution?" Fuck.',
    category: "main-character",
    packIds: ["internet-originals"],
    tags: ["main-character", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-muted-scream",
    line: "I have been screaming on mute for six minutes. The neighbors got the exclusive.",
    category: "streamer-mode",
    packIds: ["stream-gremlins"],
    tags: ["streamer-mode", "confession"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-chat-dad",
    line: "Chat, stop calling him Dad. He is here to fix the internet.",
    category: "streamer-mode",
    packIds: ["stream-gremlins"],
    tags: ["streamer-mode", "boast"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-skip-how-to-move",
    line: 'I clicked "skip tutorial" and immediately searched "how to move."',
    category: "streamer-mode",
    packIds: ["stream-gremlins"],
    tags: ["streamer-mode", "confession"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-sponsor-mom",
    line: 'My mom asked what I do for work. I showed her the clip. She said, "Besides that."',
    category: "streamer-mode",
    packIds: ["stream-gremlins"],
    tags: ["streamer-mode", "boast"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-clip-grandma",
    line: "Who sent that clip to my grandma? She has started saying it at church.",
    category: "streamer-mode",
    packIds: ["stream-gremlins"],
    tags: ["streamer-mode", "confession"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-stream-snore",
    line: "I fell asleep on stream and gained viewers. The audience has made its position clear.",
    category: "streamer-mode",
    packIds: ["stream-gremlins"],
    tags: ["streamer-mode", "boast"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-ban-me",
    line: "Mods, ban me before I finish this sentence.",
    category: "streamer-mode",
    packIds: ["stream-gremlins"],
    tags: ["streamer-mode", "confession"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-dentist-breedable",
    line: 'Mute me. Mute me. Why is my dentist asking what "breedable" means?',
    category: "streamer-mode",
    packIds: ["stream-gremlins"],
    tags: ["streamer-mode", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-sponsored-breakup",
    line: "This breakup is sponsored. Use code ABANDONED for ten percent off my fucking mattress.",
    category: "streamer-mode",
    packIds: ["stream-gremlins"],
    tags: ["streamer-mode", "confession"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-donation-confession",
    line: "Thank you for the five dollars. I am not reading that fucking confession out loud.",
    category: "streamer-mode",
    packIds: ["stream-gremlins"],
    tags: ["streamer-mode", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-clutch-camera",
    line: "I turned the camera off to lock in. I was naked from the waist down and losing.",
    category: "streamer-mode",
    packIds: ["stream-gremlins"],
    tags: ["streamer-mode", "confession"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-robot-sext",
    line: "The donation robot just read my sext. It pronounced every fucking emoji.",
    category: "streamer-mode",
    packIds: ["stream-gremlins"],
    tags: ["streamer-mode", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-loot-goblin",
    line: "I did not abandon the team. I heard a chest.",
    category: "gaming",
    packIds: ["gaming-comms"],
    tags: ["gaming", "confession"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-friendly-fire",
    line: "The enemy team invited me back. They said I helped more than their fifth player.",
    category: "gaming",
    packIds: ["gaming-comms"],
    tags: ["gaming", "boast"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-boss-second-phase",
    line: "The boss has a second phase. I have a bedtime.",
    category: "gaming",
    packIds: ["gaming-comms"],
    tags: ["gaming", "confession"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-bot-custody",
    line: "The practice bot sent me a friend request. I think it wants custody.",
    category: "gaming",
    packIds: ["gaming-comms"],
    tags: ["gaming", "boast"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-voice-crack",
    line: 'I said "watch this" and my voice cracked before my character died.',
    category: "gaming",
    packIds: ["gaming-comms"],
    tags: ["gaming", "confession"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-ranked-breathing",
    line: "Stop breathing into the mic. I cannot hear myself making excuses.",
    category: "gaming",
    packIds: ["gaming-comms"],
    tags: ["gaming", "boast"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-single-player-lag",
    line: "I blamed lag in a single-player game. Please let me finish lying.",
    category: "gaming",
    packIds: ["gaming-comms"],
    tags: ["gaming", "confession"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-ranked-flirting",
    line: 'I said "get fucked" to the boss. My date thought I was talking to them.',
    category: "gaming",
    packIds: ["gaming-comms"],
    tags: ["gaming", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-healer-payment",
    line: "I am the healer. Say please or die with your fucking principles.",
    category: "gaming",
    packIds: ["gaming-comms"],
    tags: ["gaming", "confession"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-skill-funeral",
    line: "I uninstalled out of respect for the people who made this shit.",
    category: "gaming",
    packIds: ["gaming-comms"],
    tags: ["gaming", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-fall-damage",
    line: "I survived the apocalypse and died walking down some fucking stairs.",
    category: "gaming",
    packIds: ["gaming-comms"],
    tags: ["gaming", "confession"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-push-to-talk",
    line: "I used push-to-talk to fart. I need to leave this server and start a new life.",
    category: "gaming",
    packIds: ["gaming-comms"],
    tags: ["gaming", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-voice-note-podcast",
    line: "That was not a voice note. That was a hostage situation with chapters.",
    category: "group-chat",
    packIds: ["group-chat-evidence"],
    tags: ["group-chat", "confession"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-photo-audit",
    line: "I liked their old photo, panicked, and liked twelve more. It is an audit now.",
    category: "group-chat",
    packIds: ["group-chat-evidence"],
    tags: ["group-chat", "boast"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-reply-everyone",
    line: 'I said "you too" when the dentist said "open wide." Neither of us recovered.',
    category: "group-chat",
    packIds: ["group-chat-evidence"],
    tags: ["group-chat", "confession"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-birthday-without-me",
    line: "I made a group chat for my birthday. They started planning without me.",
    category: "group-chat",
    packIds: ["group-chat-evidence"],
    tags: ["group-chat", "boast"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-screenshot-option-two",
    line: 'I sent them the screenshot of me asking how to reply to them. They said "option two."',
    category: "group-chat",
    packIds: ["group-chat-evidence"],
    tags: ["group-chat", "confession"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-typing-hostage",
    line: 'I have been typing for eleven minutes. The message is "okay."',
    category: "group-chat",
    packIds: ["group-chat-evidence"],
    tags: ["group-chat", "boast"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-full-name-sound-effect",
    line: "Do not play that voice note out loud. I used your full name in the sound effect.",
    category: "group-chat",
    packIds: ["group-chat-evidence"],
    tags: ["group-chat", "confession"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-toilet-unmute",
    line: "I unmuted to flush so they would know I was done with this conversation.",
    category: "group-chat",
    packIds: ["group-chat-evidence"],
    tags: ["group-chat", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-subpoena-award",
    line: "If this chat gets subpoenaed, I was hacked. If it wins an award, I wrote the dick joke.",
    category: "group-chat",
    packIds: ["group-chat-evidence"],
    tags: ["group-chat", "confession"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-nude-printer",
    line: "I tried to send a nude and accidentally selected the printer. Dad is downstairs.",
    category: "group-chat",
    packIds: ["group-chat-evidence"],
    tags: ["group-chat", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-poop-authorship",
    line: "Someone used my bathroom and left a crime scene. I live alone.",
    category: "group-chat",
    packIds: ["group-chat-evidence"],
    tags: ["group-chat", "confession"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-autocorrect-funeral",
    line: 'Autocorrect changed "condolences" to "congratulations." I sent a fucking balloon.',
    category: "group-chat",
    packIds: ["group-chat-evidence"],
    tags: ["group-chat", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-date-handshake",
    line: "They leaned in for a kiss. I panicked and said my full legal name.",
    category: "romance",
    packIds: ["romance-rejection"],
    tags: ["romance", "confession"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-crush-door",
    line: "I held the door for my crush and bowed. I do not know why I bowed.",
    category: "romance",
    packIds: ["romance-rejection"],
    tags: ["romance", "boast"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-drive-through-rehearsal",
    line: "I rehearsed asking them out. They heard me through the drive-through speaker.",
    category: "romance",
    packIds: ["romance-rejection"],
    tags: ["romance", "confession"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-thumb-alibi",
    line: "I watched their story in three seconds. My thumb needs an alibi.",
    category: "romance",
    packIds: ["romance-rejection"],
    tags: ["romance", "boast"],
    difficulty: "easy",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-no-pressure-question-marks",
    line: 'I said "no pressure" and sent three question marks. Separately.',
    category: "romance",
    packIds: ["romance-rejection"],
    tags: ["romance", "confession"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-read-receipt-romance",
    line: "They left me on read. At least we are doing an activity together.",
    category: "romance",
    packIds: ["romance-rejection"],
    tags: ["romance", "boast"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-fix-me-estimate",
    line: "They said they could fix me. I asked for an estimate.",
    category: "romance",
    packIds: ["romance-rejection"],
    tags: ["romance", "confession"],
    difficulty: "medium",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-dirty-service-voice",
    line: "Talk dirty to me. Actually, wait. Why are you using your customer service voice?",
    category: "romance",
    packIds: ["romance-rejection"],
    tags: ["romance", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-casual-wife",
    line: "We are keeping it casual. I have met his wife.",
    category: "romance",
    packIds: ["romance-rejection"],
    tags: ["romance", "confession"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-own-name",
    line: "I tried to moan their name and said my own. Honestly? Best sex of my life.",
    category: "romance",
    packIds: ["romance-rejection"],
    tags: ["romance", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-booty-call-carpool",
    line: "It was a booty call. I brought snacks and asked if anyone needed a ride home.",
    category: "romance",
    packIds: ["romance-rejection"],
    tags: ["romance", "confession"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-date-safe-word",
    line: 'Our safe word is "commitment." Apparently I said it too early.',
    category: "romance",
    packIds: ["romance-rejection"],
    tags: ["romance", "boast"],
    difficulty: "medium",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-final-boss-refund",
    line: "I have come to collect what I am owed. It is seven dollars and you know it.",
    category: "wildcard",
    packIds: ["impossible-energy"],
    tags: ["wildcard", "confession"],
    difficulty: "impossible",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-royal-laundry",
    line: "I called an emergency family meeting. Nobody is allowed to ask why my eyebrows are missing.",
    category: "wildcard",
    packIds: ["impossible-energy"],
    tags: ["wildcard", "boast"],
    difficulty: "impossible",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-door-single-combat",
    line: "I challenged the automatic door to single combat. It only opens when I retreat.",
    category: "wildcard",
    packIds: ["impossible-energy"],
    tags: ["wildcard", "confession"],
    difficulty: "impossible",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-evil-laugh",
    line: "I tried to leave dramatically. The door said pull. I gave it everything.",
    category: "wildcard",
    packIds: ["impossible-energy"],
    tags: ["wildcard", "boast"],
    difficulty: "impossible",
    rating: "everyone",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-enemy-has-map",
    line: "I followed my enemy to confront him. We are both lost. He has the map.",
    category: "wildcard",
    packIds: ["impossible-energy"],
    tags: ["wildcard", "confession"],
    difficulty: "impossible",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-hold-my-hand",
    line: "Hold my glasses. And my hand. This is escalating faster than I rehearsed.",
    category: "wildcard",
    packIds: ["impossible-energy"],
    tags: ["wildcard", "boast"],
    difficulty: "impossible",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-power-pose",
    line: "I practiced my entrance in the elevator. Someone was already in it.",
    category: "wildcard",
    packIds: ["impossible-energy"],
    tags: ["wildcard", "confession"],
    difficulty: "impossible",
    rating: "teen",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-devil-bank-balance",
    line: "I told the devil he could not afford me. He showed me my fucking bank balance.",
    category: "wildcard",
    packIds: ["impossible-energy"],
    tags: ["wildcard", "boast"],
    difficulty: "impossible",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-throne-toilet",
    line: 'I said "fear me" and my stomach made a noise like a fucking haunted drain.',
    category: "wildcard",
    packIds: ["impossible-energy"],
    tags: ["wildcard", "confession"],
    difficulty: "impossible",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-begging-ambulance",
    line: "I dropped to my knees to beg. They cracked so loud she asked if I needed a fucking ambulance.",
    category: "wildcard",
    packIds: ["impossible-energy"],
    tags: ["wildcard", "boast"],
    difficulty: "impossible",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v3-two-men-context",
    line: "I told everyone I could take two men at once. Apparently the context was important.",
    category: "wildcard",
    packIds: ["impossible-energy"],
    tags: ["wildcard", "confession"],
    difficulty: "impossible",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
  {
    id: "v2-death-speech",
    line: "Tell my enemies I died standing. Edit out the bit where I fell into the fucking hedge.",
    category: "wildcard",
    packIds: ["impossible-energy"],
    tags: ["wildcard", "boast"],
    difficulty: "impossible",
    rating: "mature",
    scoringFocus: ["commitment", "accuracy"],
    locale: "en",
  },
];

export const PROMPTS: readonly DeliveryPrompt[] = [
  ...ORIGINAL_PROMPTS,
  ...RECOGNIZABLE_PROMPTS,
];

const PACK_BY_ID = new Map(
  [...LEGACY_PACKS, ...PACKS].map((pack) => [pack.id, pack]),
);
const PROMPT_BY_ID = new Map(
  [...LEGACY_PROMPTS, ...V2_PROMPTS, ...PROMPTS].map((prompt) => [
    prompt.id,
    prompt,
  ]),
);
const ENERGY_BY_ID = new Map(
  [...LEGACY_ENERGY, ...V2_ENERGY, ...ENERGY_MODIFIERS].map((modifier) => [
    modifier.id,
    modifier,
  ]),
);

export const ratingRank: Record<ContentRating, number> = {
  everyone: 0,
  teen: 1,
  mature: 2,
};
export function isRatingAllowed(
  rating: ContentRating,
  maxRating: ContentRating = "everyone",
): boolean {
  return ratingRank[rating] <= ratingRank[maxRating];
}
export function isActivePrompt(id: string): boolean {
  return PROMPTS.some((prompt) => prompt.id === id);
}
export function isEnergyCompatible(
  prompt: Pick<DeliveryPrompt, "difficulty" | "line">,
  energy: EnergyModifier,
): boolean {
  if (
    energy.compatibleDifficulties &&
    !energy.compatibleDifficulties.includes(prompt.difficulty)
  )
    return false;
  // A multi-beat emotional turn needs space to perform it.
  return (
    !(energy.tags.includes("contrast") || energy.tags.includes("multi-beat")) ||
    prompt.line.trim().split(/\s+/).length >= 8
  );
}

export function getPackById(id: string): ContentPack | undefined {
  return PACK_BY_ID.get(id);
}

export function getPromptById(id: string): DeliveryPrompt | undefined {
  return PROMPT_BY_ID.get(id);
}

export function getEnergyModifierById(id: string): EnergyModifier | undefined {
  return ENERGY_BY_ID.get(id);
}

export function getPromptsForPack(packId: string): readonly DeliveryPrompt[] {
  return PROMPTS.filter((prompt) => prompt.packIds.includes(packId));
}

export function getFavoritePrompts(
  favorites: readonly (FavoritePromptRef | string)[],
): readonly DeliveryPrompt[] {
  return favorites.flatMap((favorite) => {
    const id = typeof favorite === "string" ? favorite : favorite.promptId;
    const prompt = PROMPT_BY_ID.get(id);
    return prompt ? [prompt] : [];
  });
}

export function queryPrompts(
  query: PromptQuery = {},
): readonly DeliveryPrompt[] {
  const search = query.search?.trim().toLocaleLowerCase("en");
  return PROMPTS.filter((prompt) => {
    if (
      query.packIds?.length &&
      !query.packIds.some((packId) => prompt.packIds.includes(packId))
    )
      return false;
    if (
      query.categories?.length &&
      !query.categories.includes(prompt.category)
    ) {
      return false;
    }
    if (
      query.difficulties?.length &&
      !query.difficulties.includes(prompt.difficulty)
    )
      return false;
    if (
      query.tags?.length &&
      !query.tags.every((tag) => prompt.tags.includes(tag))
    ) {
      return false;
    }
    if (!isRatingAllowed(prompt.rating, query.maxRating)) {
      return false;
    }
    if (
      search &&
      !`${prompt.line} ${prompt.tags.join(" ")}`
        .toLocaleLowerCase("en")
        .includes(search)
    )
      return false;
    return true;
  });
}

export function getRandomPrompt(
  options: RandomPromptOptions = {},
): DeliveryPrompt {
  const excluded = new Set(options.excludeIds ?? []);
  const packIds =
    options.packIds ?? (options.packId ? [options.packId] : undefined);
  const candidates = queryPrompts({
    packIds,
    categories: options.categories,
    difficulties: options.difficulties,
    maxRating: options.maxRating,
    tags: options.tags,
  }).filter((prompt) => !excluded.has(prompt.id));

  if (candidates.length === 0) {
    throw new RangeError("No Delivery prompts match the requested filters");
  }

  const random =
    options.seed === undefined
      ? (options.random ?? Math.random)
      : createSeededRandom(options.seed);
  const sample = random();
  const boundedSample = Number.isFinite(sample)
    ? Math.min(0.999_999_999, Math.max(0, sample))
    : 0;
  return candidates[Math.floor(boundedSample * candidates.length)]!;
}

/**
 * Returns the globally stable UTC daily pairing. Pass a date to preview or test a day.
 * Prompt and modifier use separate seeds so adding one catalog does not couple the other.
 */
export function getDailyPrompt(date: Date = new Date()): DailyPrompt {
  const dateKey = toUtcDateKey(date);
  // Bundled historical Daily receipts keep their original deterministic pair.
  if (dateKey < "2026-09-05") return legacyDaily(date);
  if (dateKey < "2026-09-06") return v2Daily(date);
  const dailyPackIds = PACKS.filter((pack) => pack.access !== "pro").map(
    ({ id }) => id,
  );
  const prompt = getRandomPrompt({
    packIds: dailyPackIds,
    seed: `delivery:daily:prompt:${dateKey}`,
  });
  const compatibleEnergy = ENERGY_MODIFIERS.filter((modifier) =>
    isEnergyCompatible(prompt, modifier),
  );
  const energyRandom = createSeededRandom(
    `delivery:daily:energy:${dateKey}:${prompt.id}`,
  );
  const energy =
    compatibleEnergy[Math.floor(energyRandom() * compatibleEnergy.length)] ??
    ENERGY_MODIFIERS[0]!;
  return {
    dateKey,
    prompt,
    energy,
    shareSlug: `${dateKey}-${prompt.id}-${energy.id}`,
  };
}

export const CONTENT_COUNTS = Object.freeze({
  prompts: PROMPTS.length,
  modifiers: ENERGY_MODIFIERS.length,
  packs: PACKS.length,
});
