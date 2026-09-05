import { describe, expect, it } from "vitest";
import { comparableProfileHistory } from "@/lib/profile-statistics";
import type { DeliveryHistoryItem } from "@/types/game";

function receipt(id: string, source?: DeliveryHistoryItem["source"], scoringVersion?: string): DeliveryHistoryItem {
  return { id, source, scoringVersion, scores: { overall: 80, commitment: 80, comedy: 80, accuracy: 80, chaos: 80 }, verdict: "Fixture", title: "Fixture", moment: "Fixture", transcript: "Fixture", prompt: { id, line: "Fixture line", energy: "Fixture direction", category: "wildcard", difficulty: 1 }, createdAt: "2026-09-05" };
}

describe("comparable profile history", () => {
  it("keeps confirmed AI v1 receipts and compatible untagged AI receipts only", () => {
    const historicalAi = receipt("historical-ai", "ai");
    const versionedAi = receipt("versioned-ai", "ai", "delivery-voice-v1");
    const history = [receipt("preview", "fallback", "delivery-voice-v1"), historicalAi, receipt("unverified"), receipt("future-ai", "ai", "delivery-voice-v2"), versionedAi, receipt("unknown-version", "ai", "legacy-unversioned")];
    expect(comparableProfileHistory(history)).toEqual([historicalAi, versionedAi]);
    expect(history).toHaveLength(6);
    expect(history.map(({ id }) => id)).toContain("unknown-version");
  });

  it("never lets a perfect fixture score become the eligible best", () => {
    const fixture = receipt("fixture", "fallback");
    fixture.scores.overall = 100;
    const live = receipt("live", "ai", "delivery-voice-v1");
    const eligible = comparableProfileHistory([fixture, live]);
    expect(Math.max(...eligible.map(({ scores }) => scores.overall))).toBe(80);
    expect(comparableProfileHistory([fixture])).toEqual([]);
  });
});
