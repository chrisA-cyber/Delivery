import type { ContentPack, DeliveryPrompt } from "../lib/content/types";
import { VISUAL_THEME } from "../lib/visual-theme";

export const V4_PACKS: readonly ContentPack[] = [
  {
    id: "can-you-hear-me",
    name: "Can You Hear Me?",
    eyebrow: "Still on the call",
    description: "Meetings, customer service, and being professional against your will.",
    access: "free",
    categories: ["workplace", "customer-service"],
    color: VISUAL_THEME.blue,
    accent: VISUAL_THEME.ink,
    icon: "bubble",
    coverTone: "can-you-hear-me",
    sortOrder: 70,
    featured: true,
  },
  {
    id: "ordinary-emergency",
    name: "Ordinary Emergency",
    eyebrow: "Somebody get a towel",
    description: "Roommates, family dinners, and problems that did not need to escalate.",
    access: "free",
    categories: ["wildcard", "group-chat"],
    color: VISUAL_THEME.orange,
    accent: VISUAL_THEME.ink,
    icon: "warning",
    coverTone: "ordinary-emergency",
    sortOrder: 80,
    featured: true,
  },
];

type Line = readonly [
  slug: string,
  line: string,
  rating: DeliveryPrompt["rating"],
  tag: string,
];

const packLines = (
  packId: string,
  category: DeliveryPrompt["category"],
  lines: readonly Line[],
): DeliveryPrompt[] => lines.map(([slug, line, rating, tag]) => ({
  id: `v4-${slug}`,
  line,
  category,
  packIds: [packId],
  tags: [category, tag, ...(slug.startsWith("ref-") ? ["recognizable", "text-reference", "short-line"] : [])],
  difficulty: line.split(/\s+/).length < 12 ? "easy" : "medium",
  rating,
  scoringFocus: ["commitment", "comedy", "accuracy"],
  locale: "en",
  isMimic: false,
}));

/** September content drop: 72 original lines and eight brief spoken references. */
export const V4_PROMPTS: readonly DeliveryPrompt[] = [
  ...packLines("internet-originals", "main-character", [
    ["ref-literally", "Literally.", "everyone", "acting-challenge"],
    ["apology-sequel", "Before I apologize, which part did you hear?", "everyone", "apology"],
    ["chair-presentation", "Please stop spinning my chair. I am trying to look important.", "everyone", "authority"],
    ["dramatic-exit-bag", "Can somebody bring my bag? I already did the dramatic exit.", "everyone", "awkward"],
    ["apology-lighting", "I will take accountability as soon as we fix this lighting.", "teen", "apology"],
    ["terrible-third-option", "There were two good choices. I made a third one.", "teen", "confession"],
    ["apology-comments", "I said I was sorry. Why the fuck are you agreeing with the comments?", "mature", "apology"],
    ["calm-footage", "I was extremely calm until you showed me the fucking footage.", "mature", "denial"],
    ["humble-bastard", "I am trying to be humble, but these bastards keep being wrong.", "mature", "boast"],
    ["personal-growth-spite", "This is personal growth. I used to do this shit for free.", "mature", "boast"],
  ]),
  ...packLines("stream-gremlins", "streamer-mode", [
    ["ref-absolute-air", "Absolute air mate.", "everyone", "acting-challenge"],
    ["chat-doorbell", "Chat, that was the doorbell. Nobody donated a person.", "everyone", "chat"],
    ["chat-one-job", "Your one job was to act normal while my mom was here.", "everyone", "chat"],
    ["clip-the-comeback", "Can we clip the comeback? I have not done it yet, but stay ready.", "everyone", "stream"],
    ["mod-family", "Who gave my dad moderator? He is grounding people.", "teen", "chat"],
    ["chat-fact-check", "Stop fact-checking me. We are trying to have a moment.", "teen", "chat"],
    ["sponsor-shirt", "Do not show the sponsor my fucking shirt. Turn me around.", "mature", "stream"],
    ["chat-daddy", "I said the character was cool. Who the fuck typed daddy?", "mature", "innuendo"],
    ["clip-evidence", "Delete that clip. I was a different person forty fucking seconds ago.", "mature", "panic"],
    ["hot-mic-finish", "The mic was on? Which part of the sentence about my ass?", "mature", "hot-mic"],
  ]),
  ...packLines("gaming-comms", "gaming", [
    ["ref-surprise", "Surprise motherfucker!", "mature", "dubbing-reference"],
    ["healer-decorating", "I thought you were healing me. Why are you decorating the house?", "everyone", "teammate"],
    ["clutch-witnesses", "Everybody look away. I play better without witnesses.", "everyone", "clutch"],
    ["enemy-polite", "The enemy said nice try. That felt worse.", "everyone", "defeat"],
    ["crouch-negotiation", "Stop shooting. I am trying to communicate by crouching.", "everyone", "teammate"],
    ["settings-accountability", "Give me a minute. There has to be a setting that makes this your fault.", "teen", "excuse"],
    ["tutorial-judge", "Even the tutorial paused to watch me fail.", "teen", "defeat"],
    ["grenade-ownership", "Whose fucking grenade is that? Oh. Mine. Everybody run.", "mature", "panic"],
    ["boss-shoe", "I spent an hour building this character and died to a big fucking shoe.", "mature", "defeat"],
    ["enemy-dinner", "You can talk shit after the match. Right now I need you to revive me.", "mature", "teammate"],
  ]),
  ...packLines("group-chat-evidence", "group-chat", [
    ["ref-shut-up", "Shut the fuck up.", "mature", "acting-challenge"],
    ["ref-second", "Give me a second.", "everyone", "acting-challenge"],
    ["screenshot-sequel", "Why is there a second screenshot? I explained the first one.", "everyone", "receipts"],
    ["typing-committee", "Please stop helping me flirt. There are six people typing this message.", "everyone", "group-chat"],
    ["voice-note-arrival", "Before you play that voice note, tell me who is in the car.", "everyone", "voice-note"],
    ["wrong-chat-linger", "Wrong chat. Unless you agree. Then I meant to send it.", "teen", "awkward"],
    ["evidence-zoom", "You can zoom in. It will not make the story better.", "teen", "receipts"],
    ["airdrop-regret", "Who the fuck accepts a random AirDrop at a family wedding?", "mature", "awkward"],
    ["voice-note-advice", "I asked for advice, not a fucking dramatic reading of my texts.", "mature", "voice-note"],
    ["group-therapist", "Please stop sending my therapist the memes. She already knows I am a mess.", "mature", "oversharing"],
  ]),
  ...packLines("romance-rejection", "romance", [
    ["ref-missed-you", "I missed you.", "everyone", "acting-challenge"],
    ["date-gps", "You have beautiful eyes. Sorry, I was supposed to say turn left.", "everyone", "awkward"],
    ["date-bread-insurance", "If this goes badly, can we still order the garlic bread?", "everyone", "dating"],
    ["flirt-complaint", "Was that flirting? I need to know before I file a complaint.", "everyone", "flirting"],
    ["heart-receipt", "You hearted the message and answered the question I did not ask.", "teen", "dating"],
    ["date-light-switch", "I thought we had a spark. Turns out your lamp does that to everybody.", "teen", "rejection"],
    ["dirty-talk-password", "Talk dirty to me. Okay, that is my actual password. Stop.", "mature", "innuendo"],
    ["choke-rent", "I said choke me and you asked about my rent. That fucking worked.", "mature", "innuendo"],
    ["walk-of-shame", "This is a walk of shame. Why the fuck is the doorbell playing a fanfare?", "mature", "awkward"],
    ["sexy-sock", "I was trying to look sexy. My sock is stuck on your plant.", "mature", "innuendo"],
  ]),
  ...packLines("impossible-energy", "wildcard", [
    ["villain-hold-button", "Your doom is inevitable. Please hold while I find the button.", "everyone", "villain"],
    ["prophecy-parking", "The prophecy did not mention that parking would be this difficult.", "everyone", "dramatic"],
    ["pigeon-crown", "The pigeon has taken my crown. We are negotiating.", "everyone", "absurd"],
    ["evil-lair-socks", "Remove your shoes before entering my evil lair. I just mopped.", "everyone", "villain"],
    ["dramatic-cape", "Do not step on the cape. I am making a threat.", "teen", "villain"],
    ["tiny-council", "I have assembled my council. One of them is a very small dog.", "teen", "absurd"],
    ["haunted-sexy", "The house is haunted, but the ghost has a stupidly sexy voice.", "mature", "innuendo"],
    ["demon-landlord", "I summoned a demon. It asked if the landlord knows about the fucking candles.", "mature", "absurd"],
    ["villain-customer-support", "I will destroy you. As soon as customer support fixes this bullshit.", "mature", "villain"],
    ["raccoon-manners", "There is a raccoon in my bathrobe. Do not be rude. He lives here now, asshole.", "mature", "absurd"],
  ]),
  ...packLines("can-you-hear-me", "workplace", [
    ["ref-tired", "You look tired.", "everyone", "acting-challenge"],
    ["meeting-name", "Can you say my name again? I was not ready to be involved.", "everyone", "meeting"],
    ["on-hold-harmony", "Please put me back on hold. I was enjoying the song.", "everyone", "customer-service"],
    ["screen-share-desktop", "That is my desktop. We will not be taking questions about the folders.", "everyone", "meeting"],
    ["circle-back-exit", "When you say circle back, how big can the circle be?", "teen", "workplace"],
    ["customer-service-name", "I am happy to help. That is my customer service voice, not a promise.", "teen", "customer-service"],
    ["professional-unmute", "I said what the fuck very professionally. Unfortunately, I was not muted.", "mature", "hot-mic"],
    ["reply-all-goodbye", "If you reply all one more fucking time, I am coming to your desk.", "mature", "workplace"],
    ["printer-attitude", "The printer has a paper jam and a shitty fucking attitude.", "mature", "workplace"],
    ["corporate-plain-english", "By interesting approach, I meant what the fuck are you doing?", "mature", "customer-service"],
  ]),
  ...packLines("ordinary-emergency", "wildcard", [
    ["ref-grandma", "Grandma stop.", "everyone", "acting-challenge"],
    ["fridge-eye-contact", "Close the fridge. The cheese and I are having a private conversation.", "everyone", "absurd"],
    ["roommate-lid", "Whatever you do, do not lift that lid with confidence.", "everyone", "roommate"],
    ["doorbell-pajamas", "Everybody stay quiet. I am wearing the embarrassing pajamas.", "everyone", "everyday"],
    ["family-dinner-evidence", "Can we pass the potatoes before we discuss the evidence?", "teen", "family"],
    ["spider-new-lease", "The spider can keep the bathroom. I will brush my teeth outside.", "teen", "everyday"],
    ["roomba-pants", "Why is the fucking vacuum wearing my underwear?", "mature", "absurd"],
    ["toilet-confidence", "Nobody flush. I need everyone in this house to fucking believe in me.", "mature", "bathroom"],
    ["dinner-innuendo", "I said the sausage was impressive. Why are you making dinner weird?", "mature", "innuendo"],
    ["microwave-regret", "Who microwaved fish? Show yourself, you smelly little bastard.", "mature", "roommate"],
  ]),
];

export interface V4ReferenceSource {
  readonly sourceUrl: string;
  readonly creator: string;
  readonly verification: string;
  readonly reviewedAt: "2026-09-07";
}

/** Research provenance only: no first-origin, endorsement, or current popularity claim. */
export const V4_REFERENCE_SOURCES: Readonly<Record<string, V4ReferenceSource>> = {
  "v4-ref-missed-you": {
    sourceUrl: "https://www.facebook.com/PurpleStars02Official/videos/emoji-acting-challenge-challenge-acting-viral-funny-trending/932513232876529/",
    creator: "PurpleStars02",
    verification: "Short repeated phrase in the creator's indexed acting-challenge transcript; punctuation normalized.",
    reviewedAt: "2026-09-07",
  },
  "v4-ref-tired": {
    sourceUrl: "https://www.youtube.com/shorts/u5Iu3YVCGMI",
    creator: "Acting-challenge upload; no first-origin claim",
    verification: "Repeated short prompt identified in the September 7 research. No popularity ranking asserted.",
    reviewedAt: "2026-09-07",
  },
  "v4-ref-second": {
    sourceUrl: "https://www.snapchat.com/@nessa20252624/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYcGZlc2p5eXlwAZ806lU-AZ806jheAAAAAQ",
    creator: "nessa20252624; source attestation, not claimed original creator",
    verification: "Brief acting-challenge phrase attested in the September 7 research; no complete performance is reproduced.",
    reviewedAt: "2026-09-07",
  },
  "v4-ref-grandma": {
    sourceUrl: "https://www.instagram.com/reel/DZhTcWXsB7q/",
    creator: "Mia Mendes",
    verification: "Phrase confirmed on screen during the September 7 research; punctuation normalized.",
    reviewedAt: "2026-09-07",
  },
  "v4-ref-shut-up": {
    sourceUrl: "https://www.instagram.com/reel/DZUgiwyseVF/",
    creator: "Mia Mendes",
    verification: "On-screen prompt abbreviates the profanity; indexed speech provides the expanded wording used here.",
    reviewedAt: "2026-09-07",
  },
  "v4-ref-absolute-air": {
    sourceUrl: "https://www.instagram.com/reel/Dc4ACLksPVx/",
    creator: "Mia Mendes",
    verification: "Phrase confirmed on screen during the September 7 research; punctuation normalized.",
    reviewedAt: "2026-09-07",
  },
  "v4-ref-literally": {
    sourceUrl: "https://www.youtube.com/watch?v=7DXsGpHoolY",
    creator: "PurpleStars02",
    verification: "Single-word acting-challenge prompt identified in the primary upload during the September 7 research.",
    reviewedAt: "2026-09-07",
  },
  "v4-ref-surprise": {
    sourceUrl: "https://www.instagram.com/reel/DcEDYbliMyS/",
    creator: "Baz; dubbing a Dexter scene",
    verification: "Indexed transcript reads Surprise Mothafucka; spelling normalized. Text only, no scene or voice included.",
    reviewedAt: "2026-09-07",
  },
};
