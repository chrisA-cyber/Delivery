import { describe, expect, it } from "vitest";
import { measureVideoPeaks, renderPerformanceVideo, renderVideoFooter, VIDEO_LAYOUT_VERSION, wrapVideoText } from "@/lib/server/video-renderer";
import { SWITCH_CHALLENGES } from "@/lib/switch/catalog";
import { SAY_CLIPS } from "@/lib/say-it-back/catalog";
import { tmpdir } from "node:os";
import { join } from "node:path";

function pcm(values: number[]) { const buffer = Buffer.alloc(values.length * 4); values.forEach((value, i) => buffer.writeFloatLE(value, i * 4)); return buffer; }
const base = { layoutVersion: VIDEO_LAYOUT_VERSION, recordingPath: "/unopened-recording", outputPath: "/unopened-output", durationMs: 20_000, recordingOffsetMs: 0, invitationUrl: "https://deliverygame.netlify.app/a/Public1234" } as const;
describe("video source integrity", () => {
  it("renders a private scene footer without inventing a public invitation and keeps attribution", () => {
    const clip = structuredClone(SAY_CLIPS[0]!);
    const body = renderVideoFooter({ ...base, invitationUrl: "", mode: "say-it-back", say: { clip, roleId: clip.roles[0]!.id, videoPath: "/unopened-scene" } });
    expect(body).toContain("Made on Delivery.");
    expect(body).not.toContain("Your turn.");
    expect(body).not.toContain("/a/");
    expect(body).toContain(clip.source.license);
  });
  it("keeps valid challenge invitations while rejecting malformed URLs and private tokens", () => {
    const input = { ...base, mode: "classic" as const, classic: { phrase: "Hello", direction: "Quietly" } };
    expect(renderVideoFooter(input)).toContain("/a/Public1234");
    for (const invitationUrl of ["not a URL", "https://delivery.example/a/Public1234?token=secret", "https://delivery.example/rounds/secret"]) {
      expect(() => renderVideoFooter({ ...input, invitationUrl })).toThrow(expect.objectContaining({ code: "RENDER_INVITATION" }));
    }
  });
  it("keeps silence silent and locates actual recorded peaks in their measured bins", () => {
    expect(measureVideoPeaks(pcm([0, 0, 0, 0]), 2)).toEqual([0, 0]);
    expect(measureVideoPeaks(pcm([0, -0.25, 0, 0.75, 0, 0]), 3)).toEqual([0.25, 0.75, 0]);
  });
  it("contains invalid decoder values without inventing a waveform", () => {
    expect(measureVideoPeaks(pcm([NaN, Infinity, -Infinity, 0]), 2)).toEqual([0, 0]);
    expect(measureVideoPeaks(pcm([4, -9]), 2)).toEqual([1, 1]);
  });
  it("wraps long and multilingual player text without losing dialogue", () => {
    const source = "Wait, what? \"I’m the manager.\" 你好 café ALONGLONGIDENTIFIERTHATNEEDSWRAPPING";
    expect(wrapVideoText(source, 50, 320).join("").replace(/\s/g, "")).toBe(source.replace(/\s/g, ""));
  });
  it("rejects a changing-script or discontinuous Switch timeline before accessing media", async () => {
    const challenge = structuredClone(SWITCH_CHALLENGES[0]!);
    challenge.cues[2]!.text = "A different phrase";
    await expect(renderPerformanceVideo({ ...base, mode: "switch", switch: challenge })).rejects.toMatchObject({ code: "RENDER_CUES" });
    challenge.cues[2]!.text = challenge.cues[0]!.text;
    challenge.cues[2]!.start += 0.1;
    await expect(renderPerformanceVideo({ ...base, mode: "switch", switch: challenge })).rejects.toMatchObject({ code: "RENDER_CUES" });
  });
  it("rejects unbounded duration and unrelated layout versions without starting FFmpeg", async () => {
    const input = { ...base, mode: "classic" as const, classic: { phrase: "Hello", direction: "Quietly" } };
    await expect(renderPerformanceVideo({ ...input, durationMs: 60_000 })).rejects.toMatchObject({ code: "RENDER_INPUT" });
    await expect(renderPerformanceVideo({ ...input, recordingOffsetMs: Infinity })).rejects.toMatchObject({ code: "RENDER_INPUT" });
  });
  it("admits a 45-second Say scene while retaining the shorter limits in other modes", async () => {
    const clip = { ...structuredClone(SAY_CLIPS[0]!), duration: 45 };
    const input = { ...base, mode: "say-it-back" as const, durationMs: 45_000, outputPath: join(tmpdir(), "delivery-duration-boundary.mp4"), say: { clip, roleId: clip.roles[0]!.id, videoPath: "/unopened-scene" } };
    // An already cancelled render passes validation, then stops before opening media.
    await expect(renderPerformanceVideo(input, { signal: AbortSignal.abort() })).rejects.toMatchObject({ code: "RENDER_INTERRUPTED" });
    await expect(renderPerformanceVideo({ ...input, durationMs: 45_001 })).rejects.toMatchObject({ code: "RENDER_INPUT" });
    await expect(renderPerformanceVideo({ ...input, say: { ...input.say, clip: { ...clip, duration: 45.001 } } })).rejects.toMatchObject({ code: "RENDER_SCENE" });
    await expect(renderPerformanceVideo({ ...base, mode: "classic", durationMs: 45_000, classic: { phrase: "Hello", direction: "Quietly" } })).rejects.toMatchObject({ code: "RENDER_INPUT" });
  });
});
