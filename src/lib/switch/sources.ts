/** Phrase references only. Delivery authors the timing and speed adaptations. */
const SWITCH_PHRASE_SOURCES: Readonly<Record<string, string>> = Object.freeze({
  "grandma-stop": "https://www.instagram.com/reel/DZhTcWXsB7q/",
  "shut-the-fuck-up": "https://www.instagram.com/reel/DZUgiwyseVF/",
  "absolute-air-mate": "https://www.instagram.com/reel/Dc4ACLksPVx/",
  "literally": "https://www.youtube.com/watch?v=7DXsGpHoolY",
  "i-missed-you": "https://www.facebook.com/PurpleStars02Official/videos/emoji-acting-challenge-challenge-acting-viral-funny-trending/932513232876529/",
  "you-look-tired": "https://www.youtube.com/shorts/u5Iu3YVCGMI",
  "give-me-a-second": "https://www.snapchat.com/@nessa20252624/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYcGZlc2p5eXlwAZ806lU-AZ806jheAAAAAQ",
  "im-coming": "https://www.instagram.com/reel/DFJVYv4S6Ar/",
});

export function switchPhraseSource(id: string): string | undefined {
  return SWITCH_PHRASE_SOURCES[id.replace(/^speed-/, "")];
}
