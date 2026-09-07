import { describe, expect, it } from "vitest";
import { SAY_CLIPS } from "./catalog";
import { sayClipSchema } from "./schema";

describe("Say scene boundaries", () => {
  it("allows dialogue and muting through 45 seconds and rejects longer scenes", () => {
    const clip = structuredClone(SAY_CLIPS[0]!);
    clip.duration = 45;
    clip.source.excerptEnd = clip.source.excerptStart + 45;
    clip.cues[0]!.start = 44;
    clip.cues[0]!.end = 45;
    clip.roles[0]!.muteIntervals = [{ start: 44, end: 45 }];
    expect(sayClipSchema.safeParse(clip).success).toBe(true);
    expect(sayClipSchema.safeParse({ ...clip, duration: 45.001 }).success).toBe(false);
    clip.roles[0]!.muteIntervals[0]!.end = 45.1;
    expect(sayClipSchema.safeParse(clip).success).toBe(false);
  });

  it("accepts only the specific private import media route among API paths", () => {
    const clip = structuredClone(SAY_CLIPS[0]!);
    const media = `/api/say-it-back/imports/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/media/video?key=${"b".repeat(48)}`;
    expect(sayClipSchema.safeParse({ ...clip, videoUrl: media }).success).toBe(true);
    expect(sayClipSchema.safeParse({ ...clip, videoUrl: media.replace("/video?", "/../../video?") }).success).toBe(false);
    expect(sayClipSchema.safeParse({ ...clip, videoUrl: media.replace("/imports/", "/attempts/") }).success).toBe(false);
    expect(sayClipSchema.safeParse({ ...clip, videoUrl: media.replace("?key=", "?token=") }).success).toBe(false);
  });
});
