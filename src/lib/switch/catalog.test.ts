import { describe, expect, it } from "vitest";
import { getSwitchChallenge, snapshotSwitchChallenge, SWITCH_CHALLENGES, switchChallengeKey, switchChallengesForRating, switchCueAt } from "@/lib/switch/catalog";
import { switchChallengeSchema } from "@/lib/switch/schema";

describe("Switch immutable timing and curated catalog", () => {
  it("ships four emotion and four speed challenges repeating one short phrase over 20 seconds", () => {
    expect(SWITCH_CHALLENGES).toHaveLength(8);
    expect(SWITCH_CHALLENGES.filter((challenge) => challenge.kind === "emotion")).toHaveLength(4);
    expect(SWITCH_CHALLENGES.filter((challenge) => challenge.kind === "speed")).toHaveLength(4);
    for (const challenge of SWITCH_CHALLENGES) {
      expect(switchChallengeSchema.safeParse(challenge).success).toBe(true);
      expect(challenge.duration).toBe(20);
      expect(challenge.cues).toHaveLength(5);
      expect(new Set(challenge.cues.map((cue) => cue.text)).size).toBe(1);
      expect(new Set(challenge.cues.map((cue) => cue.directionLabel)).size).toBe(5);
      if (challenge.kind === "speed") {
        expect(challenge.cues.map((cue) => cue.speed)).toEqual([1, 0.5, 0.25, 2, 4]);
        expect(challenge.cues.map((cue) => [cue.start, cue.end])).toEqual([[0, 4], [4, 9], [9, 15], [15, 18], [18, 20]]);
      }
      for (const cue of challenge.cues) {
        expect(cue.text.split(/\s+/).length).toBeLessThanOrEqual(4);
        expect(cue.emoji.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses media time after arbitrary seeking and keeps the last cue at the end", () => {
    const challenge = SWITCH_CHALLENGES[0]!;
    expect([0, 4, 15, 3, 12, 20].map((time) => switchCueAt(challenge, time).id))
      .toEqual([0, 1, 3, 0, 3, 4].map((index) => challenge.cues[index]!.id));
    expect(switchCueAt(challenge, Number.NaN)).toBe(challenge.cues[0]);
  });

  it("isolates a round snapshot from catalog mutation and rejects unknown versions", () => {
    const original = SWITCH_CHALLENGES[0]!;
    const snapshot = snapshotSwitchChallenge(original);
    snapshot.cues[0]!.text = "A different script.";
    snapshot.tags.push("new");
    expect(original.cues[0]!.text).not.toBe(snapshot.cues[0]!.text);
    expect(original.tags).not.toContain("new");
    expect(Object.isFrozen(original.cues[0])).toBe(true);
    expect(getSwitchChallenge(original.id, "missing")).toBeNull();
    expect(switchChallengeKey(original)).toContain(original.rubricVersion);
    expect(switchChallengesForRating("everyone").every((item) => item.rating === "everyone")).toBe(true);
  });

  it("rejects reordered, overlapping, duplicate, or missing cue timelines", () => {
    const snapshot = snapshotSwitchChallenge(SWITCH_CHALLENGES[0]!);
    snapshot.cues[1]!.start = 5;
    expect(switchChallengeSchema.safeParse(snapshot).success).toBe(false);
    snapshot.cues[1]!.start = 4;
    snapshot.cues[1]!.id = snapshot.cues[0]!.id;
    expect(switchChallengeSchema.safeParse(snapshot).success).toBe(false);
  });
});
