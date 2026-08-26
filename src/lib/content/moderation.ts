export const SUBMISSION_LIMITS = Object.freeze({
  minCharacters: 3,
  maxCharacters: 180,
  maxWords: 34,
  maxUrls: 0,
});

export type SubmissionRiskCode =
  | "too-short"
  | "too-long"
  | "too-many-words"
  | "contains-url"
  | "possible-email"
  | "possible-phone"
  | "excessive-caps"
  | "repeated-characters";

export interface SubmissionPreflightResult {
  readonly acceptedForReview: boolean;
  readonly normalizedLine: string;
  readonly risks: readonly SubmissionRiskCode[];
}

/**
 * UX preflight only. Server moderation, rate limits, abuse heuristics, and human
 * escalation remain mandatory; client checks must never be treated as enforcement.
 */
export function preflightSubmittedLine(input: string): SubmissionPreflightResult {
  const normalizedLine = input.normalize("NFKC").replace(/\s+/gu, " ").trim();
  const risks: SubmissionRiskCode[] = [];
  const words = normalizedLine ? normalizedLine.split(" ") : [];

  if (normalizedLine.length < SUBMISSION_LIMITS.minCharacters) risks.push("too-short");
  if (normalizedLine.length > SUBMISSION_LIMITS.maxCharacters) risks.push("too-long");
  if (words.length > SUBMISSION_LIMITS.maxWords) risks.push("too-many-words");
  if (/\b(?:https?:\/\/|www\.)\S+/iu.test(normalizedLine)) risks.push("contains-url");
  if (/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/u.test(normalizedLine)) risks.push("possible-email");
  if (/(?:\+?\d[\s().-]*){8,}/u.test(normalizedLine)) risks.push("possible-phone");
  const letters = normalizedLine.match(/[A-Za-z]/gu) ?? [];
  const uppercase = normalizedLine.match(/[A-Z]/gu) ?? [];
  if (letters.length >= 12 && uppercase.length / letters.length > 0.8) risks.push("excessive-caps");
  if (/(.)\1{7,}/u.test(normalizedLine)) risks.push("repeated-characters");

  return {
    acceptedForReview: risks.length === 0,
    normalizedLine,
    risks,
  };
}
