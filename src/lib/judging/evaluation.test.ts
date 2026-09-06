import { describe, expect, it } from "vitest";

import { assertEvaluationConsent, attenuatePcm16Wav, evaluationCoverage, evaluationManifestSchema, evaluationRepeatability, evaluationRequestBudget } from "@/lib/judging/evaluation";

const rawManifest = {
  schemaVersion: "delivery-audio-eval-v1",
  kind: "consented-human",
  consent: {
    adult: true, voiceOwnerApproved: true, providerProcessingApproved: true,
    receipt: "private-consent-fixture", expiresAt: "2099-01-01T00:00:00Z", deleteBy: "2099-01-01T00:00:00Z",
  },
  cases: [{
    id: "quiet-01", audioPath: "quiet.wav", promptText: "I regret nothing.",
    direction: "Whisper with impeccable manners.", durationMs: 2_000, tags: ["quiet"],
    expectedOutcome: "judged", referenceTranscript: "I regret nothing.",
  }],
};

describe("consented evaluation preflight", () => {
  it("requires explicit consent and rejects synthetic sets as human calibration", () => {
    expect(evaluationManifestSchema.safeParse({ ...rawManifest, kind: "synthetic-contract" }).success).toBe(false);
    expect(evaluationManifestSchema.safeParse({ ...rawManifest, consent: { ...rawManifest.consent, providerProcessingApproved: false } }).success).toBe(false);
    const manifest = evaluationManifestSchema.parse(rawManifest);
    expect(() => assertEvaluationConsent(manifest, Date.parse("2099-02-01"))).toThrow("expired");
  });

  it("reports missing categories instead of claiming the calibration set is complete", () => {
    const coverage = evaluationCoverage(evaluationManifestSchema.parse(rawManifest));
    expect(coverage.covered).toEqual(["quiet"]);
    expect(coverage.missing).toContain("spoken-injection");
    expect(coverage.missing).toContain("interpretation");
  });

  it("rejects duplicate receipt identities", () => {
    expect(evaluationManifestSchema.safeParse({ ...rawManifest, cases: [...rawManifest.cases, ...rawManifest.cases] }).success).toBe(false);
  });

  it("requires an explicit request ceiling that covers repairs and optional Scribe", () => {
    expect(() => evaluationRequestBudget(undefined, 3, false)).toThrow("explicitly approved");
    expect(() => evaluationRequestBudget("5", 3, false)).toThrow("may use 6 requests");
    expect(() => evaluationRequestBudget("6", 3, true)).toThrow("may use 9 requests");
    expect(evaluationRequestBudget("9", 3, true)).toEqual({ maximumRequests: 9, worstCaseRequests: 9 });
    expect(() => evaluationRequestBudget("Infinity", 3, false)).toThrow("explicitly approved");
  });

  it("measures only identical-byte repeats and preserves failed attempts in the summary", () => {
    const base = { id: "quiet", gainDb: 0, audioSha256: "same-bytes" };
    const judgment = { transcript: "I regret nothing.", scores: { commitment: 80, comedy: 70, accuracy: 100, chaos: 60, overall: 79 }, verdict: "A calm disaster.", coachNote: "Pause before nothing." };
    const summary = evaluationRepeatability([
      { ...base, judgment },
      { ...base, judgment: { ...judgment, scores: { ...judgment.scores, overall: 84 }, coachNote: "Hold nothing longer." } },
      base,
      { ...base, gainDb: -6, audioSha256: "different-bytes", judgment },
    ]);
    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({ attempts: 3, scored: 2, dimensions: { overall: { min: 79, max: 84, range: 5 } }, distinctTranscripts: 1, distinctVerdicts: 1, distinctCoachNotes: 2 });
  });
});

function wav() {
  const bytes = new Uint8Array(52);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((letter, index) => { bytes[offset + index] = letter.charCodeAt(0); });
  text(0, "RIFF"); view.setUint32(4, 44, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true); view.setUint32(28, 32_000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, 8, true);
  [10000, -10000, 32767, -32768].forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
  return bytes;
}

describe("gain-controlled copies", () => {
  it("changes amplitude without changing timing, headers, or original bytes", () => {
    const original = wav();
    const before = new Uint8Array(original);
    const attenuated = attenuatePcm16Wav(original, -6);
    expect(attenuated.length).toBe(original.length);
    expect(attenuated.subarray(0, 44)).toEqual(original.subarray(0, 44));
    expect(new DataView(attenuated.buffer).getInt16(44, true)).toBe(5012);
    expect(new DataView(attenuated.buffer).getInt16(46, true)).toBe(-5012);
    expect(original).toEqual(before);
    expect(attenuatePcm16Wav(original, 0)).toEqual(original);
  });

  it("refuses amplification, bad containers, and malformed chunks", () => {
    expect(() => attenuatePcm16Wav(wav(), 1)).toThrow("between -24 and 0");
    expect(() => attenuatePcm16Wav(new Uint8Array(50), -6)).toThrow("PCM16 WAV");
    expect(() => attenuatePcm16Wav(wav().subarray(0, 45), -6)).toThrow("Incomplete");
  });
});
