import { SAY_SCORING_VERSION, type SayClip, type SayScore, type SayWord } from "@/lib/say-it-back/types";

/** V1 measures lexical and temporal matching, never voice identity or acting.
 * Words: 50%, timing: 30%, rhythm: 20%. Word error rate includes additions.
 * Timing: phrase entry (75%) and exit (25%), with 120 ms ASR tolerance.
 * Rhythm: phrase durations (70%) and inter-phrase gaps (30%). A single phrase
 * uses duration only. Missing phrase boundaries earn zero, not perfect timing.
 * Unavailable timestamp components are explicitly null and weights rebalanced.
 * These are game calibration constants, not a validated measure of acting skill.
 */
export interface ScoreSayAttemptInput {
  clip: SayClip;
  roleId: string;
  transcript: string;
  words: SayWord[];
  /** Audio time at scene zero, measured during capture; never fitted to the take. */
  recordingOffsetMs: number;
  audioHash: string;
}

// Normalize written forms that ASR may choose for the same spoken word. Keep
// this deliberately narrow: no fuzzy phonetic matching that forgives a genuinely
// different word (for example, "to" versus "two"). Thom/Tom is the documented
// character-name spelling in the curated Tears of Steel dialogue.
const spokenNumberTokens = new Map<string, string>(
  ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]
    .map((word, value): [string, string] => [word, String(value)]),
);

function tokenize(text: string): string[] {
  return (text.normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'").match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? [])
    .map((word) => {
      const token = word.replace(/'/g, "");
      return token === "thom" ? "tom" : spokenNumberTokens.get(token) ?? token;
    });
}

interface Alignment {
  matches: Map<number, number>;
  substitutions: number;
  omissions: number;
  additions: number;
}

/** Fixed diagonal/deletion/insertion tie-breaking makes every result reproducible. */
function align(expected: string[], actual: string[]): Alignment {
  const distances = Array.from({ length: expected.length + 1 }, () => new Uint16Array(actual.length + 1));
  for (let i = 0; i <= expected.length; i++) distances[i]![0] = i;
  for (let j = 0; j <= actual.length; j++) distances[0]![j] = j;
  for (let i = 1; i <= expected.length; i++) {
    for (let j = 1; j <= actual.length; j++) {
      distances[i]![j] = Math.min(
        distances[i - 1]![j - 1]! + Number(expected[i - 1] !== actual[j - 1]),
        distances[i - 1]![j]! + 1,
        distances[i]![j - 1]! + 1,
      );
    }
  }
  const result: Alignment = { matches: new Map(), substitutions: 0, omissions: 0, additions: 0 };
  let i = expected.length;
  let j = actual.length;
  while (i || j) {
    const equal = i > 0 && j > 0 && expected[i - 1] === actual[j - 1];
    if (i > 0 && j > 0 && distances[i]![j] === distances[i - 1]![j - 1]! + Number(!equal)) {
      if (equal) result.matches.set(i - 1, j - 1);
      else result.substitutions++;
      i--;
      j--;
    } else if (i > 0 && distances[i]![j] === distances[i - 1]![j]! + 1) {
      result.omissions++;
      i--;
    } else {
      result.additions++;
      j--;
    }
  }
  return result;
}

const percent = (value: number) => Math.round(Math.max(0, Math.min(100, value)));
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
const proximity = (error: number, horizon: number) => Math.max(0, 1 - Math.max(0, Math.abs(error) - 0.12) / horizon);

function timedTranscript(words: SayWord[], transcript: string[]): Map<number, SayWord> | null {
  if (!words.length || !transcript.length) return null;
  const timed: SayWord[] = [];
  let previousStart = -Infinity;
  for (const word of words) {
    if (!Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < 0 || word.end < word.start || word.start < previousStart) return null;
    previousStart = word.start;
    for (const token of tokenize(word.text)) timed.push({ ...word, text: token });
  }
  if (!timed.length || timed.filter((word) => word.end > word.start).length / timed.length < 0.5) return null;
  // The text response determines word accuracy. Timestamp text only supplies
  // evidence when it actually agrees with that independently obtained transcript.
  const alignment = align(transcript, timed.map((word) => word.text));
  if (alignment.matches.size / Math.max(transcript.length, timed.length) < 0.8) return null;
  return new Map([...alignment.matches].map(([textIndex, timedIndex]) => [textIndex, timed[timedIndex]!]));
}

export function scoreSayAttempt(input: ScoreSayAttemptInput): SayScore {
  const cues = input.clip.cues.filter((cue) => cue.roleId === input.roleId).sort((a, b) => a.start - b.start);
  if (!input.clip.roles.some((role) => role.id === input.roleId) || !cues.length || !Number.isFinite(input.recordingOffsetMs)) {
    throw new Error("A valid clip role and measured recording offset are required.");
  }
  const phrases = cues.map((cue) => ({ cue, tokens: tokenize(cue.text) }));
  if (phrases.some(({ cue, tokens }) => !tokens.length || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.end <= cue.start)) {
    throw new Error("Every scored phrase needs dialogue and valid reference boundaries.");
  }
  const expected = phrases.flatMap(({ tokens }) => tokens);
  const actual = tokenize(input.transcript);
  const alignment = align(expected, actual);
  const errors = alignment.substitutions + alignment.omissions + alignment.additions;
  const wordScore = percent(100 * (1 - errors / expected.length));
  const timestamps = timedTranscript(input.words, actual);
  const offset = input.recordingOffsetMs / 1_000;
  const startErrors: number[] = [];
  const entryScores: number[] = [];
  const durationScores: number[] = [];
  let tokenOffset = 0;
  const evidence = phrases.map(({ cue, tokens }) => {
    const firstActualIndex = alignment.matches.get(tokenOffset);
    const lastActualIndex = alignment.matches.get(tokenOffset + tokens.length - 1);
    const first = firstActualIndex === undefined ? undefined : timestamps?.get(firstActualIndex);
    const last = lastActualIndex === undefined ? undefined : timestamps?.get(lastActualIndex);
    const actualStart = first ? first.start - offset : null;
    const actualEnd = last ? last.end - offset : null;
    const duration = cue.end - cue.start;
    const coverage = tokens.filter((_, index) => alignment.matches.has(tokenOffset + index)).length / tokens.length;
    tokenOffset += tokens.length;
    if (actualStart !== null) startErrors.push(actualStart - cue.start);
    const horizon = Math.max(0.6, duration * 0.4);
    entryScores.push(coverage * (
      (actualStart === null ? 0 : 0.75 * proximity(actualStart - cue.start, horizon)) +
      (actualEnd === null ? 0 : 0.25 * proximity(actualEnd - cue.end, horizon))
    ));
    durationScores.push(actualStart === null || actualEnd === null || actualEnd <= actualStart
      ? 0 : coverage * proximity(actualEnd - actualStart - duration, Math.max(0.45, duration * 0.6)));
    return { cueId: cue.id, expectedStart: cue.start, actualStart, expectedEnd: cue.end, actualEnd };
  });
  const gapScores = evidence.slice(1).map((phrase, index) => {
    const previous = evidence[index]!;
    if (phrase.actualStart === null || previous.actualEnd === null) return 0;
    const expectedGap = phrase.expectedStart - previous.expectedEnd;
    const actualGap = phrase.actualStart - previous.actualEnd;
    return proximity(actualGap - expectedGap, Math.max(0.5, Math.abs(expectedGap) * 0.6));
  });
  const timing = timestamps ? percent(mean(entryScores) * 100) : null;
  const rhythm = timestamps ? percent((gapScores.length
    ? mean(durationScores) * 0.7 + mean(gapScores) * 0.3
    : mean(durationScores)) * 100) : null;
  const weights: SayScore["weights"] = timestamps
    ? { words: 50, timing: 30, rhythm: 20, delivery: 0 }
    : { words: 100, timing: 0, rhythm: 0, delivery: 0 };
  const overall = percent((wordScore * weights.words + (timing ?? 0) * weights.timing + (rhythm ?? 0) * weights.rhythm) / 100);
  const limitations = [
    "Words and approximate timing come from automatic transcription, which can mishear speech or background voices.",
    "Intonation, emotion, voice identity and volume are not scored. Rhythm measures phrase lengths and pauses, not every syllable.",
  ];
  if (!timestamps) limitations.unshift("Reliable word timestamps were unavailable. This result scores words only; timing and rhythm are unscored.");
  const observations = [wordScore === 100
    ? "Every scripted word matched the transcript."
    : `${alignment.substitutions} changed, ${alignment.omissions} missing and ${alignment.additions} extra ${errors === 1 ? "word" : "words"} in the transcript.`];
  const signedStartError = mean(startErrors);
  const absoluteStartError = mean(startErrors.map(Math.abs));
  if (timestamps) {
    if (!startErrors.length) observations.push("No scripted phrase entry could be aligned to this take.");
    else if (absoluteStartError <= 0.15) observations.push("Your matched phrase entries landed close to the scene cues.");
    else if (Math.abs(signedStartError) >= absoluteStartError * 0.75) {
      observations.push(`Matched phrase entries averaged about ${Math.max(0.1, Math.round(Math.abs(signedStartError) * 10) / 10)} seconds ${signedStartError > 0 ? "late" : "early"}.`);
    } else observations.push("Some matched phrase entries came early and others came late.");
  }
  const coachNote = wordScore < 85
    ? "Replay the original with captions, then keep every scripted word and leave out extra commentary."
    : timing !== null && timing < 80
      ? signedStartError > 0.15
        ? "Try entering on the caption cue instead of waiting for the line to begin."
        : signedStartError < -0.15
          ? "Wait for each caption cue before starting; keep your natural voice."
          : "Follow each phrase cue from its first word through its last."
      : rhythm !== null && rhythm < 80
        ? "Listen once for the length of each phrase and the silence between them; copy that pattern."
        : "Replay original versus your take, then try the same words and timing with a delivery you enjoy.";
  return {
    version: SAY_SCORING_VERSION,
    overall,
    words: wordScore,
    timing,
    rhythm,
    delivery: null,
    weights,
    transcript: input.transcript,
    observations,
    coachNote,
    limitations,
    evidence: {
      substitutions: alignment.substitutions,
      omissions: alignment.omissions,
      additions: alignment.additions,
      expectedWords: expected.length,
      matchedWords: alignment.matches.size,
      meanStartErrorMs: startErrors.length ? Math.round(absoluteStartError * 1_000) : null,
      phrases: evidence,
      transcriptionModel: "whisper-1",
      audioHash: input.audioHash,
    },
  };
}
