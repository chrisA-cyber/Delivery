import { describe, expect, it } from "vitest";
import { measureVideoPeaks, renderPerformanceVideo, VIDEO_LAYOUT_VERSION, wrapVideoText } from "@/lib/server/video-renderer";
import { SWITCH_CHALLENGES } from "@/lib/switch/catalog";

function pcm(values: number[]) { const buffer = Buffer.alloc(values.length * 4); values.forEach((value, i) => buffer.writeFloatLE(value, i * 4)); return buffer; }
const base = { layoutVersion: VIDEO_LAYOUT_VERSION, recordingPath: "/unopened-recording", outputPath: "/unopened-output", durationMs: 20_000, recordingOffsetMs: 0, invitationUrl: "https://deliverygame.netlify.app/a/Public1234" } as const;
describe("video source integrity", () => {
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
});
