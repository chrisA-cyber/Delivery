import { VISUAL_THEME } from "../lib/visual-theme";
/** Frozen pre-v2 lookup and Daily history. Excluded from fresh draws. */
import {
  createSeededRandom,
  toUtcDateKey,
} from "../lib/content/hash";
import type {
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

export const PACKS: readonly ContentPack[] = [
  {
    id: "internet-originals",
    name: "Internet Originals",
    eyebrow: "Free starter pack",
    description: "Freshly minted posts, replies, and timeline emergencies.",
    access: "free",
    categories: ["main-character", "brainrot"],
    color: VISUAL_THEME.accent,
    accent: VISUAL_THEME.ink,
    icon: "spark",
    coverTone: "acid-lime",
    sortOrder: 10,
    featured: true,
  },
  {
    id: "stream-gremlins",
    name: "Stream Gremlins",
    eyebrow: "Chat made you do it",
    description: "Technical difficulties, suspicious confidence, and chat betrayal.",
    access: "free",
    categories: ["streamer-mode"],
    color: VISUAL_THEME.pink,
    accent: VISUAL_THEME.ink,
    icon: "live",
    coverTone: "ultraviolet",
    sortOrder: 20,
    featured: true,
  },
  {
    id: "cinematic-overreaction",
    name: "Cinematic Overreaction",
    eyebrow: "No small emotions",
    description: "Original blockbuster-scale drama for deeply ordinary situations.",
    access: "free",
    categories: ["cinema-coded", "main-character"],
    color: VISUAL_THEME.accent,
    accent: VISUAL_THEME.ink,
    icon: "clapper",
    coverTone: "hot-coral",
    sortOrder: 30,
  },
  {
    id: "anime-adjacent",
    name: "Anime Adjacent",
    eyebrow: "Power level: inconvenient",
    description: "Tournament arcs and transformations, without borrowing anyone else's script.",
    access: "rotating",
    categories: ["anime-energy"],
    color: VISUAL_THEME.blue,
    accent: VISUAL_THEME.ink,
    icon: "burst",
    coverTone: "electric-cyan",
    sortOrder: 40,
  },
  {
    id: "gaming-comms",
    name: "Gaming Comms",
    eyebrow: "Absolutely calculated",
    description: "Clutches, excuses, patch notes, and one teammate who is definitely muted.",
    access: "free",
    categories: ["gaming"],
    color: VISUAL_THEME.blue,
    accent: VISUAL_THEME.ink,
    icon: "controller",
    coverTone: "respawn-green",
    sortOrder: 50,
  },
  {
    id: "group-chat-evidence",
    name: "Group Chat Evidence",
    eyebrow: "Screenshots are forever",
    description: "Messages that should have stayed in drafts, now performed aloud.",
    access: "free",
    categories: ["group-chat", "brainrot"],
    color: VISUAL_THEME.accent,
    accent: VISUAL_THEME.ink,
    icon: "bubble",
    coverTone: "notification-orange",
    sortOrder: 60,
  },
  {
    id: "corporate-delusion",
    name: "Corporate Delusion",
    eyebrow: "Circle back dramatically",
    description: "Meetings, metrics, and workplace theater with executive presence.",
    access: "pro",
    categories: ["workplace"],
    color: VISUAL_THEME.blue,
    accent: VISUAL_THEME.ink,
    icon: "briefcase",
    coverTone: "synergy-blue",
    sortOrder: 70,
  },
  {
    id: "romance-rejection",
    name: "Romance & Rejection",
    eyebrow: "Read at 2:14 AM",
    description: "Flirting, fumbling, and emotionally literate damage control.",
    access: "rotating",
    categories: ["romance"],
    color: VISUAL_THEME.pink,
    accent: VISUAL_THEME.ink,
    icon: "heart-crack",
    coverTone: "crush-pink",
    sortOrder: 80,
  },
  {
    id: "villain-internship",
    name: "Villain Internship",
    eyebrow: "Benefits not included",
    description: "Menacing monologues for people still waiting on dental coverage.",
    access: "pro",
    categories: ["villain-era", "cinema-coded"],
    color: VISUAL_THEME.pink,
    accent: VISUAL_THEME.ink,
    icon: "mask",
    coverTone: "ominous-purple",
    sortOrder: 90,
  },
  {
    id: "customer-service-boss-fight",
    name: "Customer Service Boss Fight",
    eyebrow: "Your call is important",
    description: "Polite sentences carrying the weight of a thousand hold songs.",
    access: "free",
    categories: ["customer-service"],
    color: VISUAL_THEME.accent,
    accent: VISUAL_THEME.ink,
    icon: "headset",
    coverTone: "hold-music-yellow",
    sortOrder: 100,
  },
  {
    id: "npc-malfunction",
    name: "NPC Malfunction",
    eyebrow: "Dialogue option missing",
    description: "Tiny system errors, looping thoughts, and suspicious side quests.",
    access: "pro",
    categories: ["brainrot", "wildcard"],
    color: VISUAL_THEME.blue,
    accent: VISUAL_THEME.ink,
    icon: "glitch",
    coverTone: "glitch-mint",
    sortOrder: 110,
  },
  {
    id: "impossible-energy",
    name: "Impossible Energy",
    eyebrow: "Do not attempt calmly",
    description: "Lines engineered for vocal whiplash and leaderboard chaos.",
    access: "pro",
    categories: ["wildcard"],
    color: VISUAL_THEME.accent,
    accent: VISUAL_THEME.ink,
    icon: "warning",
    coverTone: "hazard-orange",
    sortOrder: 120,
    featured: true,
  },
] as const;

export const ENERGY_MODIFIERS: readonly EnergyModifier[] = [
  { id: "defeated-final-boss", instruction: "Say it like a defeated final boss who still thinks the sequel is guaranteed.", shortLabel: "Defeated final boss", intensity: 4, tags: ["dramatic", "villain"] },
  { id: "lying-to-police", instruction: "Say it like you're calmly explaining something extremely suspicious to the police.", shortLabel: "Totally innocent", intensity: 4, tags: ["nervous", "deadpan"] },
  { id: "maximum-aura", instruction: "Say it with maximum aura and absolutely no need for approval.", shortLabel: "Maximum aura", intensity: 3, tags: ["confident", "cool"] },
  { id: "voice-note-fourth-take", instruction: "Say it like this is the fourth take of a voice note you swear is casual.", shortLabel: "Casual voice note", intensity: 2, tags: ["awkward", "romance"] },
  { id: "parents-asleep", instruction: "Whisper it like your parents are asleep but the plot cannot wait.", shortLabel: "Parents asleep", intensity: 3, tags: ["whisper", "urgent"] },
  { id: "press-conference", instruction: "Deliver it at a press conference after the worst game of your career.", shortLabel: "Tough loss", intensity: 3, tags: ["sports", "defensive"] },
  { id: "royal-decree", instruction: "Announce it as a royal decree to subjects who are barely listening.", shortLabel: "Royal decree", intensity: 4, tags: ["grand", "commanding"] },
  { id: "customer-service-breaking", instruction: "Keep your customer-service voice while your spirit visibly leaves your body.", shortLabel: "Happy to help", intensity: 4, tags: ["polite", "unhinged"] },
  { id: "documentary-narrator", instruction: "Narrate it like a nature documentary discovering a deeply confusing animal.", shortLabel: "Nature documentary", intensity: 2, tags: ["observational", "deadpan"] },
  { id: "anime-powerup", instruction: "Begin composed, then power up through three entirely unnecessary levels.", shortLabel: "Three-stage power-up", intensity: 5, tags: ["anime", "escalating"] },
  { id: "terrible-secret", instruction: "Confess it like a terrible secret that is actually just mildly embarrassing.", shortLabel: "Terrible secret", intensity: 3, tags: ["confessional", "dramatic"] },
  { id: "airport-goodbye", instruction: "Say it through an airport goodbye scene with forty seconds left to board.", shortLabel: "Airport goodbye", intensity: 4, tags: ["romance", "urgent"] },
  { id: "tutorial-npc", instruction: "Say it like a tutorial NPC repeating the hint for the seventh time.", shortLabel: "Tutorial NPC", intensity: 2, tags: ["gaming", "robotic"] },
  { id: "microwave-mission-control", instruction: "Treat a microwave countdown like mission control during re-entry.", shortLabel: "Mission control", intensity: 4, tags: ["cinematic", "urgent"] },
  { id: "one-percent-battery", instruction: "Say it with one percent battery and one final message to send.", shortLabel: "One percent", intensity: 3, tags: ["urgent", "tragic"] },
  { id: "villain-performance-review", instruction: "Deliver it as a villain giving a disappointing quarterly performance review.", shortLabel: "Evil performance review", intensity: 3, tags: ["villain", "workplace"] },
  { id: "group-chat-leak", instruction: "React like this private message was just posted to the main group chat.", shortLabel: "Wrong chat", intensity: 5, tags: ["panic", "social"] },
  { id: "medieval-town-crier", instruction: "Project it like breaking news from a medieval town square.", shortLabel: "Hear ye", intensity: 4, tags: ["loud", "grand"] },
  { id: "quietly-furious", instruction: "Say it with the terrifying calm of someone who has already sent the email.", shortLabel: "Quietly furious", intensity: 3, tags: ["controlled", "workplace"] },
  { id: "award-speech", instruction: "Accept an award nobody knew existed and thank people who tried to stop you.", shortLabel: "Petty award speech", intensity: 4, tags: ["victorious", "petty"] },
  { id: "conspiracy-whiteboard", instruction: "Explain it while mentally connecting red string across an enormous whiteboard.", shortLabel: "Red-string theory", intensity: 4, tags: ["paranoid", "escalating"] },
  { id: "sleepover-whisper", instruction: "Whisper it during a sleepover right before everyone loses composure.", shortLabel: "Sleepover whisper", intensity: 2, tags: ["whisper", "comedy"] },
  { id: "weather-emergency", instruction: "Report it like a weather emergency developing directly behind you.", shortLabel: "Breaking weather", intensity: 4, tags: ["broadcast", "urgent"] },
  { id: "first-day-manager", instruction: "Say it like a first-day manager testing out their leadership voice.", shortLabel: "New manager voice", intensity: 2, tags: ["workplace", "awkward"] },
  { id: "haunted-smart-speaker", instruction: "Speak like a haunted smart speaker that has learned one human emotion.", shortLabel: "Haunted assistant", intensity: 4, tags: ["robotic", "eerie"] },
  { id: "sports-anime-commentator", instruction: "Commentate it like the next three seconds will decide the entire season.", shortLabel: "Season on the line", intensity: 5, tags: ["sports", "anime"] },
  { id: "exhausted-superhero", instruction: "Say it like a superhero whose shift ended twenty minutes ago.", shortLabel: "Off-the-clock hero", intensity: 3, tags: ["cinematic", "tired"] },
  { id: "bad-wifi-prophet", instruction: "Deliver it like a prophecy cutting in and out over terrible Wi-Fi.", shortLabel: "Buffering prophecy", intensity: 4, tags: ["glitch", "grand"] },
  { id: "tiny-microphone", instruction: "Give a serious red-carpet interview into an impossibly tiny microphone.", shortLabel: "Tiny mic interview", intensity: 2, tags: ["interview", "deadpan"] },
  { id: "cooking-show-disaster", instruction: "Host a cooking show while everything just off-camera is on fire.", shortLabel: "Kitchen is fine", intensity: 4, tags: ["controlled", "chaos"] },
  { id: "final-voicemail", instruction: "Leave it as a final voicemail before entering an extremely ordinary meeting.", shortLabel: "Final voicemail", intensity: 3, tags: ["tragic", "workplace"] },
  { id: "unearned-confidence", instruction: "Use the confidence of someone who read half the instructions.", shortLabel: "Read half the brief", intensity: 3, tags: ["confident", "comedy"] },
  { id: "suspiciously-specific", instruction: "Insist this is purely hypothetical while getting suspiciously specific.", shortLabel: "Purely hypothetical", intensity: 3, tags: ["nervous", "specific"] },
  { id: "dramatic-zoom", instruction: "Pause twice for dramatic camera zooms that do not exist.", shortLabel: "Invisible zooms", intensity: 3, tags: ["cinematic", "timing"] },
  { id: "museum-audio-guide", instruction: "Describe it like a museum audio guide for a priceless cultural mistake.", shortLabel: "Historic mistake", intensity: 2, tags: ["formal", "deadpan"] },
  { id: "rival-in-the-rain", instruction: "Address your lifelong rival in the rain after a wildly low-stakes disagreement.", shortLabel: "Rival in the rain", intensity: 5, tags: ["anime", "dramatic"] },
  { id: "motivational-speaker", instruction: "Turn it into a motivational breakthrough for an audience of one confused person.", shortLabel: "Breakthrough seminar", intensity: 4, tags: ["inspiring", "grand"] },
  { id: "office-heist", instruction: "Whisper it like you're coordinating a heist for the last office snack.", shortLabel: "Snack heist", intensity: 3, tags: ["whisper", "workplace"] },
  { id: "fake-livestream-apology", instruction: "Deliver a livestream apology while carefully avoiding the actual issue.", shortLabel: "Apology adjacent", intensity: 3, tags: ["streamer", "deflecting"] },
  { id: "overqualified-toddler", instruction: "Say it with the emotional regulation of a toddler and the vocabulary of a lawyer.", shortLabel: "Tiny attorney", intensity: 5, tags: ["chaos", "formal"] },
  { id: "romcom-misunderstanding", instruction: "Reveal it as the misunderstanding that could have ended the movie an hour ago.", shortLabel: "Third-act misunderstanding", intensity: 4, tags: ["romance", "cinematic"] },
  { id: "slow-elevator", instruction: "Fill a painfully slow elevator ride with unjustified intensity.", shortLabel: "Elevator tension", intensity: 3, tags: ["awkward", "dramatic"] },
  { id: "boss-music", instruction: "Wait for imaginary boss music, then speak like the health bar just appeared.", shortLabel: "Health bar appeared", intensity: 5, tags: ["gaming", "villain"] },
  { id: "low-budget-commercial", instruction: "Sell it in a local commercial with a budget of twelve dollars and a dream.", shortLabel: "Local commercial", intensity: 4, tags: ["sales", "comedy"] },
  { id: "time-traveler", instruction: "Warn the present like a time traveler who cannot remember the important noun.", shortLabel: "Forgotten prophecy", intensity: 4, tags: ["confused", "urgent"] },
  { id: "courtroom-objection", instruction: "Build toward an objection in a courtroom where nobody hired you.", shortLabel: "Unlicensed objection", intensity: 5, tags: ["formal", "escalating"] },
  { id: "zen-chaos", instruction: "Maintain total inner peace while describing complete external catastrophe.", shortLabel: "Zen catastrophe", intensity: 4, tags: ["controlled", "chaos"] },
  { id: "last-person-on-earth", instruction: "Say it like the last person on Earth who just heard a notification ping.", shortLabel: "Impossible notification", intensity: 4, tags: ["eerie", "cinematic"] },
] as const;

interface PromptSeed {
  readonly id: string;
  readonly line: string;
  readonly tags: readonly string[];
  readonly difficulty?: PromptDifficulty;
  readonly rating?: ContentRating;
  readonly scoringFocus?: readonly ScoringDimension[];
  readonly isMimic?: boolean;
}

interface PromptSet {
  readonly packId: string;
  readonly category: PromptCategory;
  readonly defaults?: {
    readonly difficulty?: PromptDifficulty;
    readonly rating?: ContentRating;
    readonly scoringFocus?: readonly ScoringDimension[];
  };
  readonly prompts: readonly PromptSeed[];
}

const PROMPT_SETS: readonly PromptSet[] = [
  {
    packId: "internet-originals",
    category: "main-character",
    defaults: { difficulty: "easy", rating: "everyone", scoringFocus: ["commitment", "comedy"] },
    prompts: [
      { id: "timeline-needs-me", line: "The timeline has been quiet. Unfortunately, I have arrived.", tags: ["timeline", "entrance"] },
      { id: "aura-nonrefundable", line: "This aura is nonrefundable, store credit only.", tags: ["aura", "confidence"] },
      { id: "plot-found-me", line: "I did not chase the plot. The plot found my location.", tags: ["main-character", "dramatic"] },
      { id: "receipts-in-4k", line: "I brought receipts, timestamps, and a completely unnecessary slideshow.", tags: ["receipts", "petty"] },
      { id: "peace-limited-edition", line: "I chose peace, but apparently it was a limited edition.", tags: ["chaos", "relatable"] },
      { id: "offline-mysterious", line: "I went offline for six minutes to seem mysterious.", tags: ["online", "awkward"] },
      { id: "algorithm-personally", line: "The algorithm and I are handling this privately.", tags: ["algorithm", "deadpan"] },
      { id: "soft-launch-disaster", line: "This was supposed to be a soft launch, not a controlled demolition.", tags: ["launch", "chaos"], difficulty: "medium" },
      { id: "lore-expensive", line: "Please respect my privacy while I make the lore more expensive.", tags: ["lore", "mysterious"] },
      { id: "terms-of-serving", line: "By witnessing this, you agree to the terms of my serving.", tags: ["confidence", "legal"] },
    ],
  },
  {
    packId: "stream-gremlins",
    category: "streamer-mode",
    defaults: { difficulty: "medium", rating: "everyone", scoringFocus: ["comedy", "chaos"] },
    prompts: [
      { id: "chat-be-normal", line: "Chat, be normal for ten seconds. This is a team objective.", tags: ["chat", "pleading"] },
      { id: "lag-legal-team", line: "That was lag, and my legal team will be providing the frames.", tags: ["lag", "excuse"] },
      { id: "clip-context", line: "Do not clip that without the context I have not invented yet.", tags: ["clip", "panic"] },
      { id: "sponsor-saw-nothing", line: "If the sponsor asks, this segment ended three minutes ago.", tags: ["sponsor", "panic"] },
      { id: "mods-close-door", line: "Mods, close the doors. Nobody leaves with this information.", tags: ["mods", "secret"] },
      { id: "first-try-archive", line: "First try, if we define history as starting right now.", tags: ["gaming", "denial"] },
      { id: "camera-froze-dignity", line: "My camera froze at the exact moment my dignity did.", tags: ["camera", "fail"] },
      { id: "sub-goal-consequences", line: "We reached the sub goal, so consequences are now legally binding.", tags: ["sub-goal", "danger"] },
      { id: "chat-voted-chaos", line: "I offered democracy, and chat voted for structural damage.", tags: ["poll", "chaos"], difficulty: "hard" },
      { id: "technical-skill-issue", line: "We are experiencing technical difficulties, and the technology is me.", tags: ["technical", "self-own"] },
    ],
  },
  {
    packId: "cinematic-overreaction",
    category: "cinema-coded",
    defaults: { difficulty: "medium", rating: "everyone", scoringFocus: ["commitment", "accuracy"] },
    prompts: [
      { id: "parking-spot-destiny", line: "All my life prepared me for this parking spot.", tags: ["epic", "ordinary"] },
      { id: "sandwich-betrayal", line: "You knew that sandwich was mine, and you chose history's darkest path.", tags: ["betrayal", "food"] },
      { id: "umbrella-prophecy", line: "The forecast said rain. It said nothing about prophecy.", tags: ["weather", "prophecy"] },
      { id: "group-project-return", line: "I survived the group project. Now the group project wants revenge.", tags: ["sequel", "school"] },
      { id: "laundry-last-load", line: "If this is my final load of laundry, let it be remembered as warm.", tags: ["tragic", "ordinary"] },
      { id: "keys-chosen-one", line: "The keys were in my pocket. I was the chosen one all along.", tags: ["reveal", "ordinary"] },
      { id: "door-holds-grudge", line: "That door did not simply close. It held a grudge.", tags: ["suspense", "object"] },
      { id: "train-left-poetry", line: "The train left without me, but with incredible visual symbolism.", tags: ["tragic", "cinematic"] },
      { id: "snack-before-dawn", line: "We find the snack before dawn, or we do not return.", tags: ["quest", "food"] },
      { id: "coupon-one-chance", line: "This coupon is expired, but so is my fear.", tags: ["heroic", "retail"], difficulty: "hard" },
    ],
  },
  {
    packId: "anime-adjacent",
    category: "anime-energy",
    defaults: { difficulty: "hard", rating: "everyone", scoringFocus: ["commitment", "chaos"] },
    prompts: [
      { id: "final-form-calendar", line: "You have interrupted my calendar's final form.", tags: ["power-up", "workplace"] },
      { id: "friendship-password", line: "With friendship, focus, and the correct password, we can still win.", tags: ["friendship", "technology"] },
      { id: "rival-coffee-order", line: "At last, rival. Our coffee orders shall decide everything.", tags: ["rival", "food"] },
      { id: "forbidden-tab", line: "I opened the forbidden browser tab, and it opened something in me.", tags: ["transformation", "browser"] },
      { id: "training-arc-stairs", line: "These stairs are not an obstacle. They are my training arc.", tags: ["training", "ordinary"] },
      { id: "ancient-technique-nap", line: "Witness the ancient technique my ancestors called taking a nap.", tags: ["technique", "sleep"] },
      { id: "power-level-email", line: "Your email has raised my power level beyond professional limits.", tags: ["power-up", "workplace"] },
      { id: "season-finale-bus", line: "If I miss this bus, the season finale begins now.", tags: ["urgent", "transport"] },
      { id: "mentor-grocery-aisle", line: "My mentor warned me this grocery aisle would test my resolve.", tags: ["mentor", "quest"] },
      { id: "monologue-delivery", line: "Your mistake was giving me time to finish this monologue.", tags: ["monologue", "villain"], difficulty: "impossible" },
    ],
  },
  {
    packId: "gaming-comms",
    category: "gaming",
    defaults: { difficulty: "easy", rating: "everyone", scoringFocus: ["comedy", "accuracy"] },
    prompts: [
      { id: "strategic-falling", line: "I am not falling behind. I am creating a comeback narrative.", tags: ["comeback", "copium"] },
      { id: "map-personal", line: "I know the map. The map simply does not know me.", tags: ["map", "excuse"] },
      { id: "cooldown-three-business", line: "My ability is on cooldown for three to five business days.", tags: ["cooldown", "workplace"] },
      { id: "loot-emotional", line: "That loot was not rare, but our connection was.", tags: ["loot", "romance"] },
      { id: "ranked-spiritual", line: "This is no longer ranked. This is a spiritual evaluation.", tags: ["ranked", "dramatic"] },
      { id: "patch-notes-me", line: "The patch notes did not mention what they did to me personally.", tags: ["patch", "betrayal"] },
      { id: "inventory-full-heart", line: "My inventory is full, but my heart has one open slot.", tags: ["inventory", "romance"] },
      { id: "respawn-confidence", line: "I will respawn with the exact same confidence and no new information.", tags: ["respawn", "confidence"] },
      { id: "side-quest-manager", line: "I accepted one side quest and now I manage a small economy.", tags: ["quest", "escalation"] },
      { id: "boss-fight-tutorial", line: "I skipped the tutorial because the boss deserved a fair chance.", tags: ["boss", "confidence"], difficulty: "medium" },
    ],
  },
  {
    packId: "group-chat-evidence",
    category: "group-chat",
    defaults: { difficulty: "easy", rating: "teen", scoringFocus: ["comedy", "chaos"] },
    prompts: [
      { id: "typing-three-hours", line: "I have been typing for three hours and the message is just 'never mind.'", tags: ["texting", "indecision"] },
      { id: "plans-left-chat", line: "The plans have left the group chat and entered folklore.", tags: ["plans", "flaky"] },
      { id: "screenshot-good-side", line: "If you screenshot this, please capture my good side.", tags: ["screenshot", "confidence"] },
      { id: "paragraph-jumpscare", line: "I opened the chat and got hit by a paragraph jumpscare.", tags: ["paragraph", "panic"] },
      { id: "mute-loving", line: "I muted everyone with love and personalized attention.", tags: ["mute", "boundaries"] },
      { id: "reaction-emergency", line: "Someone reacted with a thumbs-up. We are in an emotional emergency.", tags: ["reaction", "overthinking"] },
      { id: "brunch-constitutional", line: "This brunch decision now requires a constitutional convention.", tags: ["brunch", "plans"] },
      { id: "delete-after-courage", line: "Delete this after reading, or before, if courage finds you.", tags: ["secret", "dramatic"] },
      { id: "location-still-home", line: "My location says I am on the way because spiritually, I considered it.", tags: ["late", "flaky"] },
      { id: "voice-note-podcast", line: "That was not a voice note. That was a limited podcast series.", tags: ["voice-note", "long"] },
    ],
  },
  {
    packId: "corporate-delusion",
    category: "workplace",
    defaults: { difficulty: "medium", rating: "everyone", scoringFocus: ["accuracy", "comedy"] },
    prompts: [
      { id: "circle-back-sunset", line: "Let's circle back until the sun expands and takes us all.", tags: ["meeting", "corporate"] },
      { id: "bandwidth-emotional", line: "I have bandwidth, but none of it is emotionally available.", tags: ["bandwidth", "boundaries"] },
      { id: "deck-has-journey", line: "This deck has forty slides and a hero's journey.", tags: ["presentation", "epic"] },
      { id: "quick-call-myth", line: "A quick call is a myth told to frighten new employees.", tags: ["meeting", "horror"] },
      { id: "synergy-unlicensed", line: "The synergy is powerful, unlicensed, and moving toward the exits.", tags: ["synergy", "chaos"] },
      { id: "action-item-sentient", line: "The action item has become sentient and assigned itself back to me.", tags: ["tasks", "sci-fi"] },
      { id: "calendar-hostile", line: "My calendar is not full. It is actively hostile.", tags: ["calendar", "dramatic"] },
      { id: "reply-all-event", line: "That reply-all was not an email. It was a live event.", tags: ["email", "disaster"] },
      { id: "kpi-chose-violence", line: "The KPI woke up and chose violence against the entire quarter.", tags: ["metrics", "chaos"] },
      { id: "promotion-side-quest", line: "I asked for a promotion and received a development side quest.", tags: ["career", "gaming"] },
    ],
  },
  {
    packId: "romance-rejection",
    category: "romance",
    defaults: { difficulty: "medium", rating: "teen", scoringFocus: ["commitment", "comedy"] },
    prompts: [
      { id: "chemistry-wifi", line: "We had chemistry, but apparently the connection was guest Wi-Fi.", tags: ["breakup", "technology"] },
      { id: "heart-typing", line: "My heart says send it. My dignity is still typing.", tags: ["texting", "indecision"] },
      { id: "red-flag-decor", line: "I saw the red flags and thought they were event decor.", tags: ["red-flag", "self-own"] },
      { id: "soft-launch-hard-landing", line: "I soft-launched the relationship and hard-launched the consequences.", tags: ["relationship", "chaos"] },
      { id: "closure-delivery-window", line: "Your closure has a delivery window of never to absolutely not.", tags: ["closure", "deadpan"] },
      { id: "butterflies-union", line: "The butterflies in my stomach have unionized against this date.", tags: ["date", "nervous"] },
      { id: "flirting-beta", line: "My flirting is still in beta. Thank you for reporting the bugs.", tags: ["flirting", "awkward"] },
      { id: "seen-cinematic", line: "You left me on seen, so I added lighting and made it cinematic.", tags: ["texting", "cinematic"] },
      { id: "relationship-patch", line: "I miss us, but the previous version had known stability issues.", tags: ["breakup", "gaming"] },
      { id: "date-rehearsal", line: "This date is going great, according to the rehearsal in my head.", tags: ["date", "overthinking"] },
    ],
  },
  {
    packId: "villain-internship",
    category: "villain-era",
    defaults: { difficulty: "hard", rating: "teen", scoringFocus: ["commitment", "accuracy"] },
    prompts: [
      { id: "evil-dental", line: "Join me, and together we can negotiate a dental plan.", tags: ["villain", "benefits"] },
      { id: "lair-open-plan", line: "My lair has an open floor plan and a closed-door policy.", tags: ["lair", "workplace"] },
      { id: "monologue-overtime", line: "You call it monologuing. I call it unpaid emotional overtime.", tags: ["monologue", "workplace"] },
      { id: "doom-calendar", line: "I scheduled your doom, but you declined the calendar invite.", tags: ["doom", "calendar"] },
      { id: "cape-dry-clean", line: "Revenge can wait. This cape is dry-clean only.", tags: ["cape", "ordinary"] },
      { id: "evil-laugh-feedback", line: "My evil laugh is a draft. Constructive feedback is not welcome.", tags: ["laugh", "feedback"] },
      { id: "henchmen-standup", line: "The henchmen requested a daily stand-up. This rebellion has structure.", tags: ["henchmen", "meeting"] },
      { id: "master-plan-password", line: "The master plan is complete. I have forgotten the password.", tags: ["plan", "technology"] },
      { id: "ominous-chair", line: "I did not choose the ominous chair. The chair recognized leadership.", tags: ["aura", "furniture"] },
      { id: "world-domination-trial", line: "World domination is included after your thirty-day free trial.", tags: ["subscription", "villain"] },
    ],
  },
  {
    packId: "customer-service-boss-fight",
    category: "customer-service",
    defaults: { difficulty: "medium", rating: "everyone", scoringFocus: ["accuracy", "comedy"] },
    prompts: [
      { id: "hold-music-knows", line: "The hold music knows what happened, and it refuses to testify.", tags: ["hold", "mystery"] },
      { id: "manager-final-form", line: "You may speak to the manager, but she has entered her final form.", tags: ["manager", "anime"] },
      { id: "receipt-archaeology", line: "Without a receipt, this becomes an archaeological investigation.", tags: ["receipt", "formal"] },
      { id: "return-policy-riddle", line: "The return policy is less of a rule and more of an ancient riddle.", tags: ["return", "quest"] },
      { id: "call-recorded-legacy", line: "This call may be recorded, so please consider your legacy.", tags: ["call", "dramatic"] },
      { id: "escalate-moon", line: "I can escalate this, but only to the moon and back.", tags: ["escalation", "absurd"] },
      { id: "coupon-emotional-support", line: "The coupon expired, but it can remain for emotional support.", tags: ["coupon", "deadpan"] },
      { id: "system-says-maybe", line: "The system says no. Its body language says maybe.", tags: ["system", "negotiation"] },
      { id: "survey-prophecy", line: "There will be a survey, and history will remember your choices.", tags: ["survey", "threat"] },
      { id: "policy-blinked-first", line: "I stared at the policy until it blinked first.", tags: ["policy", "confidence"] },
    ],
  },
  {
    packId: "npc-malfunction",
    category: "brainrot",
    defaults: { difficulty: "hard", rating: "everyone", scoringFocus: ["comedy", "chaos"] },
    prompts: [
      { id: "dialogue-loop", line: "Welcome, traveler. Welcome, traveler. Sorry, I got emotionally cached.", tags: ["npc", "glitch"] },
      { id: "side-quest-laundry", line: "New side quest: move the laundry before it gains territory.", tags: ["quest", "laundry"] },
      { id: "loading-personality", line: "Please wait. My personality is installing a critical update.", tags: ["loading", "personality"] },
      { id: "interaction-unavailable", line: "That interaction is unavailable until I finish my little beverage.", tags: ["npc", "drink"] },
      { id: "thought-patch", line: "I had a thought, but it was removed in the latest patch.", tags: ["patch", "confused"] },
      { id: "quest-marker-fridge", line: "The quest marker points to the fridge. I do not question the code.", tags: ["quest", "food"] },
      { id: "cutscene-small-talk", line: "This small talk cannot be skipped. I have tried every button.", tags: ["cutscene", "awkward"] },
      { id: "morality-plus-two", line: "I returned the shopping cart. Morality increased by two.", tags: ["morality", "ordinary"] },
      { id: "fast-travel-couch", line: "Fast travel is unavailable, so I will remain on this couch.", tags: ["travel", "lazy"] },
      { id: "inventory-one-vibe", line: "Inventory check: one key, no plan, several unstable vibes.", tags: ["inventory", "chaos"] },
    ],
  },
  {
    packId: "impossible-energy",
    category: "wildcard",
    defaults: { difficulty: "impossible", rating: "teen", scoringFocus: ["commitment", "comedy", "chaos"] },
    prompts: [
      { id: "whispered-thunder", line: "I need you to hear this quietly at maximum volume.", tags: ["contradiction", "vocal"] },
      { id: "laughing-emergency", line: "This is a serious emergency, which is why I cannot stop laughing.", tags: ["laugh", "urgent"] },
      { id: "confidently-unsure", line: "I know exactly what might possibly be happening.", tags: ["contradiction", "confidence"] },
      { id: "tiny-grand-announcement", line: "Attention, everyone: I have one extremely small update.", tags: ["grand", "tiny"] },
      { id: "calm-panic-plan", line: "Remain calm while I panic in a highly organized sequence.", tags: ["panic", "controlled"] },
      { id: "villain-customer-service", line: "Your suffering matters to us. Please stay on the line.", tags: ["villain", "customer-service"] },
      { id: "romantic-weather-alert", line: "I love you, and this concludes the severe weather warning.", tags: ["romance", "broadcast"] },
      { id: "toddler-ceo", line: "The board accepts my terms, or nobody gets the blue cup.", tags: ["toddler", "workplace"] },
      { id: "opera-password-reset", line: "My password has expired, but my sorrow has only begun.", tags: ["opera", "technology"] },
      { id: "robot-feelings-ticket", line: "I have developed emotions and submitted them as a support ticket.", tags: ["robot", "feelings"] },
    ],
  },
] as const;

export const PROMPTS: readonly DeliveryPrompt[] = Object.freeze(
  PROMPT_SETS.flatMap((set) =>
    set.prompts.map((prompt) => ({
      id: prompt.id,
      line: prompt.line,
      category: set.category,
      packIds: [set.packId],
      tags: prompt.tags,
      difficulty: prompt.difficulty ?? set.defaults?.difficulty ?? "medium",
      rating: prompt.rating ?? set.defaults?.rating ?? "everyone",
      scoringFocus:
        prompt.scoringFocus ??
        set.defaults?.scoringFocus ??
        (["commitment", "comedy"] as const),
      locale: "en" as const,
      ...(prompt.isMimic === undefined ? {} : { isMimic: prompt.isMimic }),
    })),
  ),
);

const PACK_BY_ID = new Map(PACKS.map((pack) => [pack.id, pack]));
const PROMPT_BY_ID = new Map(PROMPTS.map((prompt) => [prompt.id, prompt]));
const ENERGY_BY_ID = new Map(
  ENERGY_MODIFIERS.map((modifier) => [modifier.id, modifier]),
);

const ratingRank: Record<ContentRating, number> = { everyone: 0, teen: 1, mature: 2 };

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

export function queryPrompts(query: PromptQuery = {}): readonly DeliveryPrompt[] {
  const search = query.search?.trim().toLocaleLowerCase("en");
  return PROMPTS.filter((prompt) => {
    if (
      query.packIds?.length &&
      !query.packIds.some((packId) => prompt.packIds.includes(packId))
    ) return false;
    if (query.categories?.length && !query.categories.includes(prompt.category)) {
      return false;
    }
    if (
      query.difficulties?.length &&
      !query.difficulties.includes(prompt.difficulty)
    ) return false;
    if (query.tags?.length && !query.tags.every((tag) => prompt.tags.includes(tag))) {
      return false;
    }
    if (query.maxRating && ratingRank[prompt.rating] > ratingRank[query.maxRating]) {
      return false;
    }
    if (
      search &&
      !`${prompt.line} ${prompt.tags.join(" ")}`.toLocaleLowerCase("en").includes(search)
    ) return false;
    return true;
  });
}

export function getRandomPrompt(
  options: RandomPromptOptions = {},
): DeliveryPrompt {
  const excluded = new Set(options.excludeIds ?? []);
  const packIds = options.packIds ?? (options.packId ? [options.packId] : undefined);
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
      ? options.random ?? Math.random
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
  const dailyPackIds = PACKS.filter((pack) => pack.access !== "pro").map(
    ({ id }) => id,
  );
  const prompt = getRandomPrompt({
    packIds: dailyPackIds,
    seed: `delivery:daily:prompt:${dateKey}`,
  });
  const compatibleEnergy = ENERGY_MODIFIERS.filter(
    (modifier) =>
      !modifier.compatibleDifficulties ||
      modifier.compatibleDifficulties.includes(prompt.difficulty),
  );
  const energyRandom = createSeededRandom(`delivery:daily:energy:${dateKey}:${prompt.id}`);
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
