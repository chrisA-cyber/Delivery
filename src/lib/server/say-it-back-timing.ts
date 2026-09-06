import "server-only";
import type { SayTimingEvidence, SayWord } from "@/lib/say-it-back/types";
import { getWavEnergyFrames } from "@/lib/server/audio";

/** Measure quiet edges in the capture itself. No reference, desired score or
 * playback offset is accepted here, so this cannot fit a take to its target.
 * ASR remains responsible for word identity and interior voiced boundaries.
 */
export function refineSayWordTiming(bytes: Uint8Array, rawWords: SayWord[]): { words: SayWord[]; timing: SayTimingEvidence } {
  const timing: SayTimingEvidence = { method: "pcm-energy-v1", status: "unavailable", frameMs: 10, adjustments: [] };
  const unavailable = (reason: string) => ({ words: [], timing: { ...timing, status: "unavailable" as const, reason } });
  const energy = getWavEnergyFrames(bytes);
  if (!energy) return unavailable("Acoustic boundary verification requires an uncompressed PCM recording; this result scores words only.");
  if (!rawWords.length) return unavailable("Word timestamps were unavailable.");
  const { rms, frameSeconds, durationSeconds } = energy;
  const sorted = [...rms].sort((a, b) => a - b);
  const noise = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
  const peak = sorted[sorted.length - 1] ?? 0;
  // Relative thresholds preserve quiet performances. Require a clear separation
  // from the quietest recording frames; a noisy boundary is left unscored.
  const threshold = Math.max(noise * 3.5, peak * 0.025, 0.00001);
  timing.noiseFloorRms = noise; timing.thresholdRms = threshold;
  if (peak < Math.max(noise * 5, 0.00005)) return unavailable("Background sound made the acoustic speech boundaries uncertain; this result scores words only.");
  const active = rms.map((value) => value >= threshold);
  // Three active frames within 50 ms rejects an isolated click without requiring
  // speech to be loud. Padding keeps soft consonants at the edges of the phrase.
  const sustained = active.map((value, index) => value && active.slice(index, index + 5).filter(Boolean).length >= 3);
  const audibleIndices = sustained.flatMap((value, index) => value ? [index] : []);
  if (audibleIndices.length < 5) return unavailable("There was not enough sustained acoustic evidence to verify timing.");
  const firstAudible = audibleIndices[0]!;
  const lastAudible = audibleIndices[audibleIndices.length - 1]!;
  const firstEdge = Math.max(0, firstAudible * frameSeconds - 0.03);
  const lastEdge = Math.min(durationSeconds, (lastAudible + 3) * frameSeconds + 0.03);
  const words = rawWords.map((word) => ({ ...word }));
  if (words.some((word, index) => !Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < 0 || word.end < word.start || word.end > durationSeconds + 0.5 || (index > 0 && word.start < words[index - 1]!.start))) return unavailable("The speech provider returned inconsistent word boundaries.");
  const adjust = (index: number, edge: "start" | "end", value: number) => {
    const word = words[index]!;
    const rounded = Math.round(value * 1000) / 1000;
    if (Math.abs(word[edge] - rounded) < 0.04) return;
    timing.adjustments.push({ wordIndex: index, edge, rawSeconds: word[edge], measuredSeconds: rounded });
    word[edge] = rounded;
  };
  // Outer edges are grounded in the entire capture. This repairs Whisper's
  // common start=0 over real leading silence and a zero-length terminal word.
  // Never cross a neighbouring word boundary or invent a word duration.
  const firstLimit = words.length > 1 ? Math.min(words[0]!.end, words[1]!.start) : durationSeconds;
  if (firstEdge < firstLimit) adjust(0, "start", firstEdge);
  else return unavailable("The first word could not be associated with the recorded acoustic onset.");
  const lastIndex = words.length - 1;
  if (lastEdge > words[lastIndex]!.start) adjust(lastIndex, "end", lastEdge);
  else return unavailable("The last word could not be associated with the recorded acoustic ending.");
  // Refine clear quiet prefixes/suffixes inside the remaining ASR windows. Do
  // not separate adjacent voiced words by guessing phoneme boundaries.
  for (let index = 0; index < words.length; index++) {
    const word = words[index]!;
    const low = Math.max(0, Math.ceil(word.start / frameSeconds));
    const high = Math.min(rms.length - 1, Math.floor(word.end / frameSeconds));
    const hits = audibleIndices.filter((frame) => frame >= low && frame <= high);
    if (!hits.length) continue;
    const onset = Math.max(word.start, hits[0]! * frameSeconds - 0.03);
    const ending = Math.min(word.end, (hits[hits.length - 1]! + 3) * frameSeconds + 0.03);
    if (index > 0 && onset - word.start >= 0.08 && onset < word.end) adjust(index, "start", onset);
    if (index < lastIndex && word.end - ending >= 0.08 && ending > word.start) adjust(index, "end", ending);
  }
  timing.status = timing.adjustments.length ? "refined" : "verified";
  return { words, timing };
}
