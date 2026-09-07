import { describe, expect, it } from "vitest";
import catalog from "./catalog.json";
import type { SayClip } from "./types";
import { DEFAULT_SCENE_FILTERS, filterScenes, matchesSceneSearch, sceneCategory, sceneGenre } from "./library";

const base = catalog[0] as unknown as SayClip;
describe("scene library browsing", () => {
  it("groups the existing catalog without rewriting scene metadata", () => {
    expect(catalog.map((clip) => sceneCategory(clip as unknown as SayClip))).not.toContain("other");
    expect(sceneGenre({ ...base, category: "Classic comedy" })).toBe("Comedy");
    expect(sceneCategory({ ...base, category: "Your scenes", tags: ["custom"] })).toBe("custom");
    expect(sceneCategory({ ...base, category: "Future category" })).toBe("other");
  });

  it("finds words across creator and dialogue, ignoring accents and apostrophes", () => {
    expect(matchesSceneSearch("CAFE dont", "Café", "Don’t stop!")).toBe(true);
    const clip = { ...base, source: { ...base.source, creator: "Zoë" }, cues: [{ ...base.cues[0]!, text: "I can’t believe it." }] };
    expect(filterScenes([clip], { ...DEFAULT_SCENE_FILTERS, search: "zoe cant" })).toEqual([clip]);
    expect(filterScenes([clip], { ...DEFAULT_SCENE_FILTERS, search: "zoe missing" })).toEqual([]);
  });

  it("combines category, genre and difficulty with nonoverlapping length boundaries", () => {
    const clips: SayClip[] = [4.99, 5, 15, 15.01].map((duration) => ({ ...base, id: String(duration), category: "Comedy", difficulty: "easy", duration }));
    const filters = { ...DEFAULT_SCENE_FILTERS, category: "movies" as const, genre: "Comedy", difficulty: "easy" as const };
    expect(filterScenes(clips, { ...filters, length: "quick" }).map((clip) => clip.duration)).toEqual([4.99]);
    expect(filterScenes(clips, { ...filters, length: "short" }).map((clip) => clip.duration)).toEqual([5, 15]);
    expect(filterScenes(clips, { ...filters, length: "long" }).map((clip) => clip.duration)).toEqual([15.01]);
    expect(filterScenes(clips, { ...filters, difficulty: "hard" })).toEqual([]);
  });

  it("sorts a filtered copy and preserves server ordering for newest", () => {
    const clips: SayClip[] = [{ ...base, title: "B", duration: 8 }, { ...base, title: "A", duration: 12 }];
    expect(filterScenes(clips, { ...DEFAULT_SCENE_FILTERS, sort: "longest" }).map((clip) => clip.title)).toEqual(["A", "B"]);
    expect(filterScenes(clips, DEFAULT_SCENE_FILTERS)).toEqual(clips);
    expect(clips[0]!.title).toBe("B");
  });
});
