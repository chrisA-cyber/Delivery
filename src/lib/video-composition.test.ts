import { describe, expect, it } from "vitest";
import { audioLevelAt, cameraFrame, cameraCrop, defaultCameraSettings, avatarFrame, avatarSpeechPose, avatarSvg, clipEditSettingsSchema, compositionSvg, contentFrame, defaultClipEditSettings, layoutClipEditSettings, measureAudioLevels, sceneFrame, waveformSvg, type CompositionScene } from "./video-composition";
import { SWITCH_CHALLENGES } from "./switch/catalog";
import { SAY_CLIPS } from "./say-it-back/catalog";

describe("saved clip composition", () => {
  it("fills the camera canvas with a matching portrait crop while retaining a framed option", () => {
    const settings = defaultCameraSettings("switch");
    expect(settings.captions).toBe(false);
    expect(cameraFrame(settings)).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
    expect(cameraCrop(720, 1280, settings)).toEqual({ x: 0, y: 0, width: 720, height: 1280 });
    const landscape = cameraCrop(1280, 720, settings);
    expect(landscape.width / landscape.height).toBeCloseTo(9 / 16, 2);
    expect(landscape.x * 2 + landscape.width).toBe(1280);
    const framed = { ...settings, layout: "duet" as const };
    expect(cameraFrame(framed)).toEqual(avatarFrame(framed));
    expect(cameraCrop(1280, 720, framed).width).toBe(720);
    const scene: CompositionScene = { mode: "switch", duration: 20, switch: SWITCH_CHALLENGES[0]! };
    expect(compositionSvg(scene, settings, { time: 4.1, layer: "base" })).not.toContain("CHALLENGE LINE");
    expect(compositionSvg(scene, { ...settings, captions: true }, { time: 4.1, layer: "base" })).toContain("CHALLENGE LINE");
    expect(contentFrame(scene, settings).y + contentFrame(scene, settings).height).toBeLessThan(500);
    expect(compositionSvg(scene, settings, { time: 4.1, layer: "content" })).toContain("Angry");
    expect(compositionSvg(scene, settings, { time: 4.1, layer: "avatar" })).not.toContain("data-avatar-body");
    expect(sceneFrame(defaultCameraSettings("say-it-back"))).toEqual({ x: 64, y: 250, width: 480, height: 360 });
  });

  it("uses measured speech and silence, with the same original-clock envelope after a cut", () => {
    const samples = new Float32Array(8000);
    samples.fill(0.125, 3200, 4800);
    const levels = measureAudioLevels(samples, 8000);
    expect(audioLevelAt(levels, 0.2)).toBe(0);
    expect(audioLevelAt(levels, 0.5)).toBeGreaterThan(0.7);
    expect(audioLevelAt(levels, 0.8)).toBe(0);
    expect(audioLevelAt(levels, -0.1)).toBe(0);
    expect(avatarSvg({ kind: "builtin", id: "fox" }, { level: 0 })).not.toBe(avatarSvg({ kind: "builtin", id: "fox" }, { level: 1 }));
    expect(avatarSpeechPose({ kind: "builtin", id: "fox" }, 1, true)).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
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
  it("puts emotion and speed changes above the portrait in both Switch presets", () => {
    for (const layout of ["spotlight", "duet"] as const) {
      const settings = { ...defaultClipEditSettings("switch"), ...layoutClipEditSettings("switch", layout) };
      for (const kind of ["emotion", "speed"] as const) {
        const challenge = SWITCH_CHALLENGES.find((item) => item.kind === kind)!;
        const scene: CompositionScene = { mode: "switch", duration: 20, switch: challenge };
        const card = contentFrame(scene, settings), portrait = avatarFrame(settings);
        expect(card.y + card.height).toBeLessThan(portrait.y);
        expect(portrait.y + portrait.height).toBeLessThan(1350);
        expect(compositionSvg(scene, settings, { time: 4.1, layer: "content" })).toContain(challenge.cues[1]!.directionLabel);
        expect(compositionSvg(scene, settings, { time: 4.1, layer: "base" })).toContain('y="1370"');
      }
    }
  });
  it("moves actual characters noticeably only with sound and keeps uploaded photos rigid", () => {
    const fox = { kind: "builtin", id: "fox" } as const;
    const still = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    expect(avatarSpeechPose(fox, 0)).toEqual(still);
    const speaking = avatarSpeechPose(fox, 1);
    expect(speaking.y).toBeLessThan(-7);
    expect(Math.abs(speaking.rotation)).toBeGreaterThan(4);
    expect(speaking.scaleY).toBeGreaterThan(1.08);
    expect(avatarSpeechPose(fox, 1 / 7 + 0.001)).toEqual(avatarSpeechPose(fox, 1 / 7));
    const photo = { kind: "upload", dataUrl: "data:image/png;base64,aGVsbG8=" } as const;
    const photoPose = avatarSpeechPose(photo, 1);
    expect(photoPose.scaleX).toBe(photoPose.scaleY);
    expect(photoPose.scaleX).toBeGreaterThan(1.05);
    expect(avatarSpeechPose(photo, 1, true)).toEqual(still);
    expect(avatarSvg(fox, { level: 1 })).toContain('data-avatar-body="true"');
  });
  it("animates a rolling speech window, settles in silence and respects trim/offset", () => {
    const scene: CompositionScene = { mode: "classic", duration: 3, classic: { phrase: "Hello", direction: "Quietly" } };
    const settings = { ...defaultClipEditSettings("classic"), trimStart: 0.4, trimEnd: 2.9 };
    const levels = Array.from({ length: 45 }, (_, i) => i >= 6 && i <= 8 ? 1 : 0);
    const frame = (time: number, audioOffset = 0) => waveformSvg(scene, settings, levels, { time, audioOffset });
    expect(frame(0.4).match(/<rect/g)).toHaveLength(32);
    expect(frame(0.4)).not.toBe(frame(0.7));
    expect(frame(0.7)).toContain('fill="#5d7cff"');
    expect(frame(1.5)).not.toMatch(/fill="#(?:5d7cff|ffe16a)"/);
    expect(frame(0.7, 1)).not.toContain('fill="#5d7cff"');
    const discarded = Array.from({ length: 45 }, (_, i) => i < 3 ? 1 : 0);
    expect(waveformSvg(scene, settings, discarded, { time: 0.4 })).not.toContain('fill="#5d7cff"');
    expect(compositionSvg(scene, { ...settings, avatarVisible: false }, { time: 0.7, audioLevels: levels })).toContain('fill="#5d7cff"');
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
