import { describe, expect, it } from "vitest";
import { audioLevelAt, avatarFrame, avatarSvg, clipEditSettingsSchema, compositionSvg, defaultClipEditSettings, measureAudioLevels, sceneFrame, type CompositionScene } from "./video-composition";
import { SWITCH_CHALLENGES } from "./switch/catalog";
import { SAY_CLIPS } from "./say-it-back/catalog";

describe("saved clip composition", () => {
  it("uses measured speech and silence, with the same original-clock envelope after a cut", () => {
    const samples = new Float32Array(8000);
    samples.fill(0.125, 3200, 4800);
    const levels = measureAudioLevels(samples, 8000);
    expect(audioLevelAt(levels, 0.2)).toBe(0);
    expect(audioLevelAt(levels, 0.5)).toBeGreaterThan(0.7);
    expect(audioLevelAt(levels, 0.8)).toBe(0);
    expect(audioLevelAt(levels, -0.1)).toBe(0);
    expect(avatarSvg({ kind: "builtin", id: "fox" }, { level: 0 })).not.toBe(avatarSvg({ kind: "builtin", id: "fox" }, { level: 1 }));
    expect(avatarSvg({ kind: "builtin", id: "fox" }, { level: 1, reducedMotion: true })).toContain("scale(1.0000)");
  });
  it("preserves source Switch boundaries when the trim starts inside a cue", () => {
    const challenge = SWITCH_CHALLENGES[0]!;
    const scene: CompositionScene = { mode: "switch", duration: 20, switch: challenge };
    const settings = { ...defaultClipEditSettings("switch"), trimStart: 3.5, trimEnd: 11.5 };
    expect(compositionSvg(scene, settings, { time: 3.5, layer: "content" })).toContain("Laughing");
    expect(compositionSvg(scene, settings, { time: 4, layer: "content" })).toContain("Angry");
    expect(compositionSvg(scene, settings, { time: 8, layer: "content" })).toContain("Sad");
    expect(challenge.cues[1]?.start).toBe(4);
  });
  it("labels stored Say dialogue honestly and keeps it off outside its interval", () => {
    const clip = SAY_CLIPS.find((item) => item.id === "hgf-perfect-fiance")!;
    const cue = clip.cues[0]!;
    const scene: CompositionScene = { mode: "say-it-back", duration: clip.duration, say: { clip, roleId: clip.roles[0]!.id } };
    const settings = defaultClipEditSettings("say-it-back");
    const caption = compositionSvg(scene, settings, { time: (cue.start + cue.end) / 2, layer: "content" });
    expect(caption).toContain("SCENE SCRIPT");
    expect(caption).not.toContain("transcript");
    expect(compositionSvg(scene, { ...settings, captions: false }, { time: cue.start, layer: "content" })).not.toContain("SCENE SCRIPT");
    expect(sceneFrame(settings)).toMatchObject({ width: 952, height: 930 });
  });
  it("bounds avatar placement and preserves uploaded crop pixels", () => {
    const settings = { ...defaultClipEditSettings("classic"), avatarX: 0, avatarY: 1 };
    const frame = avatarFrame(settings);
    expect(frame.x).toBe(0);
    expect(frame.y + frame.height).toBe(1920);
    const source = "data:image/png;base64,aGVsbG8=";
    expect(avatarSvg({ kind: "upload", dataUrl: source })).toContain(source);
    expect(avatarSvg({ kind: "upload", dataUrl: source })).toContain("avatar-crop-uploaded");
  });
  it("rejects executable/remote avatar content and impossible trim ranges", () => {
    const settings = defaultClipEditSettings("classic");
    expect(clipEditSettingsSchema.safeParse({ ...settings, avatar: { kind: "upload", dataUrl: "https://example.com/track.png" } }).success).toBe(false);
    expect(clipEditSettingsSchema.safeParse({ ...settings, avatar: { kind: "upload", dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" } }).success).toBe(false);
    expect(clipEditSettingsSchema.safeParse({ ...settings, trimStart: 2, trimEnd: 2.2 }).success).toBe(false);
    const scene: CompositionScene = { mode: "classic", duration: 5, classic: { phrase: "<script>alert(1)</script>", direction: "Quietly" } };
    expect(compositionSvg(scene, settings, { time: 0 })).not.toContain("<script>");
  });
});
