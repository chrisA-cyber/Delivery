import { describe, expect, it } from "vitest";
import { mapAccountHistoryItem } from "@/lib/server/account-history";

const delivery = { id: "saved-id", transcript: "The actual judged words.", created_at: "2026-09-05T12:00:00Z", visibility: "private" };
const prompt = { id: "prompt-id", slug: "v2-prompt", body: "The canonical line.", rating: "everyone", category: "group-chat", difficulty: 3 };
const score = { overall: 80, commitment: 81, comedy: 82, accuracy: 83, chaos: 71, headline: "COMMITTED TO THE BIT", verdict: "The pause sold it.", rubric_version: "delivery-voice-v1.1", provider: "openai", evidence: { highlights: ["A dry ending."], coach_note: "Pause before the last word.", scoring_version: "delivery-voice-v1" } };

describe("signed-in history receipt projection", () => {
  it("retains actual rating, scores, coaching, highlights and independent rubric/scale versions", () => {
    const row = mapAccountHistoryItem(delivery, score, { ...prompt, rating: "mature" }, { slug: "v2-dry", instruction: "Keep it dry." });
    expect(row).toMatchObject({ source: "ai", scores: { overall: 80 }, rubricVersion: "delivery-voice-v1.1", scoringVersion: "delivery-voice-v1", coachNote: "Pause before the last word.", highlights: ["A dry ending."], prompt: { rating: "mature", difficulty: 4, energyId: "v2-dry" } });
  });
  it("preserves a mature receipt after later catalog reclassification", () => {
    expect(mapAccountHistoryItem({ ...delivery, moderation_labels: ["mature-content"] }, score, prompt).prompt.rating).toBe("mature");
    expect(mapAccountHistoryItem(delivery, { ...score, evidence: { content_rating: "mature" } }, prompt).prompt.rating).toBe("mature");
  });
  it("projects bounded Scribe annotations without replacing the accuracy transcript or leaking other evidence", () => {
    const transcription = { text: "Scribe heard different words.", provider: "elevenlabs", model: "scribe_v2", usedForAccuracy: false, words: [{ text: "Scribe", start: 0.1, end: 0.4 }], raw_private_payload: "should not be exposed" };
    const row = mapAccountHistoryItem(delivery, { ...score, evidence: { ...score.evidence, transcription, arbitrary_provider_payload: "not public" } }, prompt);
    expect(row.transcript).toBe(delivery.transcript);
    expect(row.transcription?.text).toBe(transcription.text);
    expect(row.transcription?.usedForAccuracy).toBe(false);
    expect(JSON.stringify(row)).not.toContain("raw_private_payload");
    expect(JSON.stringify(row)).not.toContain("arbitrary_provider_payload");
  });
  it("drops malformed supplemental timestamps and does not invent compatibility for unknown historical rubrics", () => {
    const row = mapAccountHistoryItem(delivery, { ...score, rubric_version: "experimental-unknown", provider: "unknown", evidence: { transcription: { text: "Hello", provider: "elevenlabs", model: "scribe_v2", usedForAccuracy: false, words: [{ text: "Hello", start: 2, end: 1 }] } } }, prompt);
    expect(row.transcription).toBeUndefined(); expect(row.scoringVersion).toBe("legacy-unversioned"); expect(row.source).toBeUndefined();
  });
  it("keeps unlisted historical visibility truthful and recognizes the original known numerical scale", () => {
    const row = mapAccountHistoryItem({ ...delivery, visibility: "unlisted" }, { ...score, rubric_version: "delivery-voice-v1", evidence: {} }, prompt);
    expect(row.visibility).toBe("unlisted"); expect(row.scoringVersion).toBe("delivery-voice-v1"); expect(row.rubricVersion).toBe("delivery-voice-v1");
  });
});
