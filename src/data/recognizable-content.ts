import type { DeliveryPrompt } from "../lib/content/types";

/** Reviewed text only. These references do not license voices, art, music, or endorsements. */
export const RECOGNIZABLE_REVIEW_DATE = "2026-09-05";

export interface RecognizableSource {
  readonly sourceUrl: string;
  readonly originalSourceUrl: string | null;
  /** Early/archival evidence when an original artifact or first coinage is not established. */
  readonly attestationUrl?: string;
  readonly speaker: string;
  readonly context: string;
  readonly wordingVerification: string;
  readonly recognitionEvidence: string;
  readonly recognitionSourceUrl: string;
  readonly publicationDecision: "publish-text-only";
  readonly publicationRationale: string;
  readonly limitations: string;
  readonly reviewedAt: string;
}

const phrase = (
  id: string,
  line: string,
  packId: string,
  category: DeliveryPrompt["category"],
  rating: DeliveryPrompt["rating"] = "everyone",
): DeliveryPrompt => ({
  id: `v3-ref-${id}`,
  line,
  category,
  packIds: [packId],
  tags: ["recognizable", "text-reference", "short-line"],
  difficulty: "easy",
  rating,
  scoringFocus: ["commitment", "comedy", "accuracy"],
  locale: "en",
  isMimic: false,
});

export const RECOGNIZABLE_PROMPTS: readonly DeliveryPrompt[] = [
  phrase(
    "this-is-fine",
    "This is fine.",
    "internet-originals",
    "main-character",
  ),
  phrase(
    "immeasurable-disappointment",
    "My disappointment is immeasurable and my day is ruined.",
    "internet-originals",
    "main-character",
  ),
  phrase(
    "wednesday",
    "It is Wednesday, my dudes.",
    "stream-gremlins",
    "streamer-mode",
  ),
  phrase(
    "emotional-damage",
    "Emotional damage!",
    "stream-gremlins",
    "streamer-mode",
  ),
  phrase(
    "chat-is-this-real",
    "Chat, is this real?",
    "stream-gremlins",
    "streamer-mode",
  ),
  phrase(
    "bite-of-87",
    "Was that the bite of '87?!",
    "gaming-comms",
    "gaming",
    "teen",
  ),
  phrase(
    "big-brain-time",
    "Yeah, this is big brain time.",
    "gaming-comms",
    "gaming",
  ),
  phrase("let-him-cook", "Let him cook.", "gaming-comms", "gaming"),
  phrase("touch-grass", "Touch grass.", "group-chat-evidence", "group-chat"),
  phrase(
    "weird-flex",
    "Weird flex, but OK.",
    "group-chat-evidence",
    "group-chat",
  ),
  phrase(
    "head-empty",
    "No thoughts, head empty.",
    "romance-rejection",
    "romance",
  ),
  phrase("i-like-turtles", "I like turtles.", "romance-rejection", "romance"),
  phrase(
    "double-rainbow",
    "Double rainbow all the way across the sky.",
    "impossible-energy",
    "wildcard",
  ),
  phrase(
    "find-out",
    "Fuck around and find out.",
    "impossible-energy",
    "wildcard",
    "mature",
  ),
];

const source = (
  details: Omit<RecognizableSource, "publicationDecision" | "reviewedAt">,
): RecognizableSource => ({
  ...details,
  publicationDecision: "publish-text-only",
  reviewedAt: RECOGNIZABLE_REVIEW_DATE,
});

/** Source evidence is attribution/provenance, never a claim of clearance or current popularity. */
export const RECOGNIZABLE_SOURCES: Readonly<
  Record<string, RecognizableSource>
> = {
  "v3-ref-this-is-fine": source({
    sourceUrl: "https://gunshowcomic.com/648",
    originalSourceUrl: "https://gunshowcomic.com/648",
    speaker: "KC Green; dialogue in Gunshow's On Fire comic",
    context:
      "A character calmly denies a room on fire; original comic published January 9, 2013.",
    wordingVerification:
      "Visually read the second panel on the creator's original page on September 5, 2026. Exact three words; sentence case normalized.",
    recognitionEvidence:
      "Documented meme history traces circulation from 2013; audience recognition has not been tested in Delivery.",
    recognitionSourceUrl: "https://en.wikipedia.org/wiki/Gunshow_(webcomic)",
    publicationRationale:
      "Three commonplace words used as a new player's spoken declaration. The comic, character, fire scene, design, and merchandise identity are not reproduced.",
    limitations:
      "Editorial publication assessment, not legal clearance. Art and character rights remain outside this decision.",
  }),
  "v3-ref-immeasurable-disappointment": source({
    sourceUrl: "https://www.youtube.com/watch?v=5d5NJgO38AE&t=363s",
    originalSourceUrl: "https://www.youtube.com/watch?v=5d5NJgO38AE",
    speaker: "TheReportOfTheWeek / Reviewbrah",
    context:
      "Reaction in Popeyes Cheddar Biscuit Butterfly Shrimp - Food Review, July 4, 2017.",
    wordingVerification:
      "Original upload's English transcript at 6:03; export identifies captions as authored or unspecified. Exact nine words; punctuation normalized.",
    recognitionEvidence:
      "Source-linked meme history documents reaction-image and text reuse in July-December 2017.",
    recognitionSourceUrl:
      "https://knowyourmeme.com/memes/my-disappointment-is-immeasurable-and-my-day-is-ruined",
    publicationRationale:
      "A short, self-contained disappointed declaration used for players' different performances. No review footage, restaurant branding, portrait, or creator imitation. The ordinary statement supports this narrow text-use decision; length alone is not the rationale.",
    limitations:
      "Creator has sold related merchandise. This is not a merchandise/branding license, endorsement, or general clearance of longer passages; rights assessment remains jurisdiction-dependent.",
  }),
  "v3-ref-wednesday": source({
    sourceUrl: "https://www.youtube.com/watch?v=du-TY1GUFGk",
    originalSourceUrl: "https://www.youtube.com/watch?v=du-TY1GUFGk",
    speaker: "Jimmy Here, performing an existing Wednesday meme",
    context:
      "Creator-owned upload on April 9, 2016 of his short Vine performance. The underlying frog-caption meme predates this upload.",
    wordingVerification:
      "Original creator upload's auto-generated English transcript at 0:00 reads the exact five words. Comma and capitalization normalized; scream omitted.",
    recognitionEvidence:
      "Know Your Meme documents the 2014 Tumblr predecessor, Jimmy Here's 2016 Vine, and more than 140 related Vine results as of March 2016.",
    recognitionSourceUrl:
      "https://knowyourmeme.com/memes/it-is-wednesday-my-dudes",
    publicationRationale:
      "A brief weekday announcement using ordinary language. Text-only performance excludes the costume, frog art, scream recording, and creator voice.",
    limitations:
      "Caption verification is not human listening. The linked YouTube upload is an authenticated creator copy, not the first publication of the meme or Vine.",
  }),
  "v3-ref-emotional-damage": source({
    sourceUrl: "https://www.youtube.com/watch?v=miD_TWmdGIY&t=66s",
    originalSourceUrl: "https://www.youtube.com/watch?v=miD_TWmdGIY",
    speaker: "Steven He",
    context:
      "Short reaction in his September 21, 2021 video-game comedy sketch.",
    wordingVerification:
      "The two words occur in the original upload's auto-generated transcript at 1:06 and in Steven He's own quoted explanation in YouTube's January 10, 2024 interview.",
    recognitionEvidence:
      "In YouTube's direct 2024 creator interview, He describes viewers repeating the phrase; this is qualitative creator testimony, not a recognition percentage.",
    recognitionSourceUrl:
      "https://blog.youtube/creator-and-artist-stories/steven-he-jeenie-weenie-collab/",
    publicationRationale:
      "Two common descriptive words. The player supplies an independent interpretation; no accent, ethnicity, character, imitation, soundbite, or targeted insult is part of the assignment.",
    limitations:
      "No use of the creator's branded merchandise, persona, or audiovisual sketch is authorized by this text decision.",
  }),
  "v3-ref-chat-is-this-real": source({
    sourceUrl:
      "https://www.urbandictionary.com/define.php?term=chat+is+this+real",
    originalSourceUrl: null,
    speaker: "Distributed streamer/chat phrase; no single author asserted",
    context:
      "A streamer-style request for confirmation, often applied to obviously fake content.",
    wordingVerification:
      "Exact four-word question is attested in the source's body and September 26, 2025 entry, with a June 3, 2023 'yo' variant. This is a documented idiom, not a verified quote from one iShowSpeed clip.",
    recognitionEvidence:
      "Know Your Meme's June 7, 2023 entry traces streamer clips and cross-platform caption use in March-June 2023.",
    recognitionSourceUrl: "https://knowyourmeme.com/memes/chat-is-this-real",
    publicationRationale:
      "Ordinary question plus a generic audience address, used as distributed slang without assigning a creator or reproducing a clip.",
    limitations:
      "Earliest coinage is not established; the commonly cited iShowSpeed example only establishes one use of a related question. No 2026 popularity claim.",
  }),
  "v3-ref-bite-of-87": source({
    sourceUrl: "https://www.youtube.com/watch?v=AZgnZSmbYn0&t=580s",
    originalSourceUrl: "https://www.youtube.com/watch?v=AZgnZSmbYn0",
    speaker: "Markiplier",
    context:
      "A surprised question while playing Five Nights at Freddy's 4, Part 5, July 27, 2015. The question is not a claim about the game's correct chronology.",
    wordingVerification:
      "Original upload's auto-generated English transcript at 9:40: exact six words. Apostrophe and punctuation normalized.",
    recognitionEvidence:
      "The source-linked meme entry documents remixes and quotations associated with this reaction.",
    recognitionSourceUrl:
      "https://knowyourmeme.com/memes/was-that-the-bite-of-87",
    publicationRationale:
      "A short factual-style question referencing an event name; no game dialogue sequence, game artwork, character, clip audio, or voice imitation is reproduced.",
    limitations:
      "Spicy rating acknowledges horror/injury context. This does not license Five Nights at Freddy's assets or imply Markiplier or game-owner endorsement; captions are not human listening.",
  }),
  "v3-ref-big-brain-time": source({
    sourceUrl:
      "https://www.wired.com/video/watch/markiplier-explores-his-impact-on-the-internet",
    originalSourceUrl: "https://www.youtube.com/watch?v=ByLrbLiSL6k",
    speaker: "Markiplier",
    context:
      "Boast recalled by Markiplier in WIRED's December 18, 2019 direct interview; earlier gameplay source is Baldi's Basics 1 Year Birthday Bash.",
    wordingVerification:
      "Exact six-word contiguous excerpt of the creator's spoken recollection in WIRED's published interview transcript. His preceding 'Oh' is outside the selected excerpt. The original gameplay transcript was unavailable; not verified from its title.",
    recognitionEvidence:
      "WIRED's interview explicitly discusses the phrase as a meme and Markiplier describes its spread. This is contemporary 2019 primary testimony.",
    recognitionSourceUrl:
      "https://www.wired.com/video/watch/markiplier-explores-his-impact-on-the-internet",
    publicationRationale:
      "Brief colloquial boast, without the edited head image, game visuals, or creator voice. Only the commonplace short expression is used.",
    limitations:
      "Source verifies the 2019 interview wording, not the first gameplay utterance. No claim that a source title verified speech or that the creator endorses Delivery.",
  }),
  "v3-ref-let-him-cook": source({
    sourceUrl: "https://www.dictionary.com/culture/slang/let-him-cook",
    originalSourceUrl: null,
    attestationUrl: "https://twitter.com/MrSmith120/status/27481570231",
    speaker: "Distributed slang; early use documented in Lil B fan culture",
    context:
      "Let someone continue an attempt, sincerely or with terrible confidence. Related 'let that boy cook' wording appears in Lil B posts in 2010.",
    wordingVerification:
      "Exact three-word phrase in the dictionary's body and embedded October 15, 2010 post. Direct historical Twitter fetch failed; not attributed as Lil B's exact personal quote or first coinage.",
    recognitionEvidence:
      "Dictionary.com, November 7, 2023, records use across music fandom, sports, and memes with dated examples.",
    recognitionSourceUrl:
      "https://www.dictionary.com/culture/slang/let-him-cook",
    publicationRationale:
      "An ordinary three-word imperative now used as an idiom. No lyrics, music, dance, branded image, or attributed invented quote.",
    limitations:
      "Original coinage remains uncertain; the historical post is an attestation lead, not proof of authorship. Dictionary wording, not its definition, is the playable text.",
  }),
  "v3-ref-touch-grass": source({
    sourceUrl:
      "https://dictionary.cambridge.org/dictionary/english/touch-grass",
    originalSourceUrl: null,
    speaker: "Distributed internet idiom; no individual credited",
    context:
      "A request to step away from the internet and return to the physical world.",
    wordingVerification:
      "Exact two-word idiom in Cambridge's entry and usage examples; this is text attestation, not a creator clip quote.",
    recognitionEvidence:
      "Cambridge and Dictionary.com include the idiom; the latter dates first recording to 2015-20 and includes dated 2025-26 usage.",
    recognitionSourceUrl: "https://www.dictionary.com/browse/touch-grass",
    publicationRationale:
      "A two-word common imperative/idiom, without any copied definition, personal attribution, or identity asset.",
    limitations:
      "No earliest original post established. Lexicographic inclusion is evidence of use, not a measured recognition rate among players.",
  }),
  "v3-ref-weird-flex": source({
    sourceUrl: "https://www.dictionary.com/culture/slang/weird-flex-but-okay",
    originalSourceUrl:
      "https://twitter.com/SJSchauer/status/1044353823769268227",
    speaker:
      "Distributed internet response; prominent 2018 use by Sarah Schauer",
    context:
      "A baffled response to an unusual boast. The game does not target the people discussed in the historical tweets.",
    wordingVerification:
      "Exact four-word phrase and OK/okay variants in Dictionary.com's entry body and embedded dated posts. Punctuation normalized; selected as an idiom, not a verbatim quote from the linked 'okay' tweet.",
    recognitionEvidence:
      "Dictionary.com published its entry November 21, 2018 and records spread during 2018; Cambridge also includes it under flex.",
    recognitionSourceUrl:
      "https://www.dictionary.com/culture/slang/weird-flex-but-okay",
    publicationRationale:
      "Short conversational response built from common slang. No copying the longer social-media jokes, targets, avatars, or product branding.",
    limitations:
      "The linked post is a popularization source, not original coinage or exact spelling of the selected variant. Historical post access may fail.",
  }),
  "v3-ref-head-empty": source({
    sourceUrl:
      "https://www.tumblr.com/fantastic-nonsense/673568579625582592/no-thoughts-head-empty-just-remembering-wally",
    originalSourceUrl: null,
    attestationUrl: "https://twitter.com/spruiko/status/965877427577630720",
    speaker: "Distributed internet caption; no creator quotation asserted",
    context:
      "A self-directed declaration of having nothing useful to say, useful for a painfully sincere or overconfident performance.",
    wordingVerification:
      "Exact four-word sequence appears in the readable body of the linked Tumblr user's post. The reported February 20, 2018 source tweet returns 404; no first-author claim.",
    recognitionEvidence:
      "Know Your Meme's May 20, 2020 entry documents 2018-19 caption variations and explicitly calls the origin unclear.",
    recognitionSourceUrl:
      "https://knowyourmeme.com/memes/no-thoughts-head-empty",
    publicationRationale:
      "Brief commonplace self-description used independently of the cartoon and game images associated with early captions. No attack on a named person or disability.",
    limitations:
      "The primary original post is unavailable. Published as an attested distributed phrase, not attributed to the Tumblr user as its inventor.",
  }),
  "v3-ref-i-like-turtles": source({
    sourceUrl:
      "https://shortyawards.com/16th/paramount-teenage-mutant-ninja-turtles-i-like-turtles",
    originalSourceUrl: null,
    attestationUrl: "https://www.youtube.com/watch?v=CMNry4PE93Y",
    speaker: "Jonathon Ware",
    context:
      "An unexpected answer to a KGW interview at Portland's Rose Festival in 2007; Ware reprised the phrase as an adult in 2023.",
    wordingVerification:
      "The producer's first-person 2023 campaign case study explicitly transcribes the three-word spoken answer. The 2007 link is an archival upload by CaptJax458, not the broadcaster's original account.",
    recognitionEvidence:
      "The 2023 campaign deliberately recreated the 2007 meme with Ware. Its award submission reports cross-platform response, which is self-reported promotional evidence, not an independent audience study.",
    recognitionSourceUrl:
      "https://shortyawards.com/16th/paramount-teenage-mutant-ninja-turtles-i-like-turtles",
    publicationRationale:
      "Three ordinary words expressing an animal preference. Player performance uses no child likeness, zombie makeup, broadcaster footage, movie characters, or endorsement; directions do not impersonate a child.",
    limitations:
      "The campaign's agreement with Ware does not confer rights to Delivery. Publication rests on narrow ordinary-text use, not that agreement or the archival uploader's authority.",
  }),
  "v3-ref-double-rainbow": source({
    sourceUrl: "https://www.youtube.com/watch?v=OQSNhk5ICTI&t=53s",
    originalSourceUrl: "https://www.youtube.com/watch?v=OQSNhk5ICTI",
    speaker: "Paul 'Bear' Vasquez / Yosemitebear62",
    context:
      "Describing a rainbow outside his home in the original January 8, 2010 upload.",
    wordingVerification:
      "Exact eight-word contiguous excerpt in the original upload's English transcript at 0:53. Captions labeled authored or unspecified. Preceding 'It's full on' is outside the excerpt.",
    recognitionEvidence:
      "YouTube's December 12, 2010 year-end report placed the original sixth among its non-major-label most-watched videos as of November 2010.",
    recognitionSourceUrl:
      "https://blog.youtube/culture-and-trends/double-rainbows-annoying-oranges-and/",
    publicationRationale:
      "A short descriptive observation of a natural phenomenon. No creator audio, crying, scenery, song/remix lyrics beyond the prior spoken phrase, or identity asset is used.",
    limitations:
      "Caption verification is not human listening. The estate and music/remix rights are not licensed; only this ordinary spoken text excerpt is included.",
  }),
  "v3-ref-find-out": source({
    sourceUrl: "https://www.suebutler.com.au/new-words/2026/1/12/fafo",
    originalSourceUrl: null,
    speaker: "Established vulgar idiom; no single speaker or origin claimed",
    context:
      "A warning about consequences, played as an absurd boast or restrained warning rather than a real threat toward anyone.",
    wordingVerification:
      "Exact five-word expansion in lexicographer Sue Butler's January 12, 2026 entry and in Wiktionary's phrase entry.",
    recognitionEvidence:
      "The dated lexicographer commentary treats the expression as established US colloquial language and discusses its acronym. That is attestation, not proof of 2026 popularity.",
    recognitionSourceUrl:
      "https://www.suebutler.com.au/new-words/2026/1/12/fafo",
    publicationRationale:
      "Common vulgar idiom with no creator attribution, quoted speech, logo, political endorsement, or copied explanatory text. Mature opt-in is required.",
    limitations:
      "Earliest coinage is disputed. Do not attach political imagery, a named target, or authentic-threat context to this performance assignment.",
  }),
};
