// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { scoreSayAttempt } from "@/lib/say-it-back/scoring";
import type { SayClip, SayWord } from "@/lib/say-it-back/types";
import { refineSayWordTiming } from "@/lib/server/say-it-back-timing";

// Real regression from the first live Say It Back check, using an authorized
// offline synthetic voice. The recorded Whisper response included leading
// silence in "You're" and returned a zero-duration final word. These tests use
// the exact audio bytes and captured response; they make no paid/network calls.
const fixture = readFileSync(new URL("../../test/fixtures/say-timing-onset.wav", import.meta.url));
const AUDIO_HASH = "a011e16d04024532f0a2bf6a2018d26c6f1e2752e855158e81d2233eb75edaa0";
const rawWords: SayWord[] = [
  { text: "You're", start: 0, end: 1.1200000047683716 },
  { text: "a", start: 1.1200000047683716, end: 1.440000057220459 },
  { text: "jerk", start: 1.440000057220459, end: 1.4600000381469727 },
  { text: "Tom", start: 1.8600000143051147, end: 1.8600000143051147 },
];

// Freeze the historical cue, independently of future catalog versions. The
// waveform refinement receives neither this reference nor its timing.
const regressionClip: SayClip = {
  id: "tos-youre-a-jerk",
  version: "v1-a1664e1509a2",
  title: "You're a jerk, Thom.",
  description: "Captured onset regression.",
  duration: 2.29,
  difficulty: "easy",
  rating: "everyone",
  category: "Sci-fi",
  tags: [],
  videoUrl: "/fixture-scene.mp4",
  posterUrl: "/fixture-poster.jpg",
  roles: [{ id: "celia", name: "Celia", description: "Deadpan.", muteIntervals: [{ start: 0.55, end: 2.29 }] }],
  cues: [{ id: "cue-1", roleId: "celia", text: "You're a jerk, Thom.", start: 0.808, end: 2.108 }],
  source: {
    title: "Tears of Steel (2012)", creator: "Blender Foundation",
    url: "https://mango.blender.org/", license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    attribution: "Tears of Steel © Blender Foundation. CC BY 3.0.",
    reuseNote: "This WAV fixture is separately generated synthetic dialogue, not source-film audio.",
    excerptStart: 22.08, excerptEnd: 24.37,
  },
};

function score(words: SayWord[], bytes: Uint8Array = fixture) {
  return scoreSayAttempt({
    clip: regressionClip,
    roleId: "celia",
    transcript: "You're a jerk, Tom.",
    words,
    recordingOffsetMs: 0,
    audioHash: createHash("sha256").update(bytes).digest("hex"),
  });
}

// Fixture-only PCM editing. Assert its canonical header before transforming
// samples so the test cannot silently mistake metadata bytes for voice audio.
function pcmFixture() {
  expect(fixture.toString("ascii", 0, 4)).toBe("RIFF");
  expect(fixture.toString("ascii", 8, 12)).toBe("WAVE");
  expect(fixture.toString("ascii", 12, 16)).toBe("fmt ");
  expect(fixture.readUInt32LE(16)).toBe(16);
  expect(fixture.readUInt16LE(20)).toBe(1);
  expect(fixture.readUInt16LE(22)).toBe(1);
  expect(fixture.readUInt32LE(24)).toBe(24_000);
  expect(fixture.readUInt16LE(34)).toBe(16);
  expect(fixture.toString("ascii", 36, 40)).toBe("data");
  expect(fixture.readUInt32LE(40)).toBe(fixture.length - 44);
  return { header: fixture.subarray(0, 44), samples: fixture.subarray(44), bytesPerSecond: 48_000 };
}

describe("Say It Back waveform timing: captured Whisper onset regression", () => {
  it("uses the exact hashed live fixture and removes the false 0.8-second early entry", () => {
    expect(createHash("sha256").update(fixture).digest("hex")).toBe(AUDIO_HASH);
    const originalWords = structuredClone(rawWords);
    const refined = refineSayWordTiming(fixture, rawWords);
    expect(rawWords).toEqual(originalWords);
    expect(refined.timing.status).not.toBe("unavailable");
    expect(refined.words.map((word) => word.text)).toEqual(rawWords.map((word) => word.text));
    expect(refined.words[0]!.start).toBeGreaterThanOrEqual(0.78);
    expect(refined.words[0]!.start).toBeLessThanOrEqual(0.95);
    expect(refined.words.at(-1)!.end).toBeGreaterThan(1.86);
    expect(refined.words.at(-1)!.end).toBeGreaterThan(refined.words.at(-1)!.start);
    expect(refined.words.at(-1)!.end).toBeLessThanOrEqual(2.29);

    const before = score(rawWords);
    const after = score(refined.words);
    expect(before.evidence.meanStartErrorMs).toBe(808);
    expect(after.evidence.meanStartErrorMs).toBeLessThan(150);
    expect(after.timing).toBeGreaterThan(80);
    expect(after.observations.join(" ")).not.toContain("early");
    expect(after.evidence.audioHash).toBe(AUDIO_HASH);
  });

  it("preserves an exact one-second PCM delay instead of fitting delivery to the reference", () => {
    const { header, samples, bytesPerSecond } = pcmFixture();
    const delayed = Buffer.concat([header, Buffer.alloc(bytesPerSecond), samples]);
    delayed.writeUInt32LE(delayed.length - 8, 4);
    delayed.writeUInt32LE(delayed.length - 44, 40);
    expect(delayed.subarray(44 + bytesPerSecond)).toEqual(samples);
    const delayedWords = rawWords.map((word) => ({ ...word, start: word.start + 1, end: word.end + 1 }));
    const baseline = refineSayWordTiming(fixture, rawWords);
    const refined = refineSayWordTiming(delayed, delayedWords);
    expect(refined.timing.status).not.toBe("unavailable");
    expect(refined.words.length).toBe(baseline.words.length);
    for (let index = 0; index < baseline.words.length; index++) {
      expect(refined.words[index]!.start - baseline.words[index]!.start).toBeCloseTo(1, 2);
      expect(refined.words[index]!.end - baseline.words[index]!.end).toBeCloseTo(1, 2);
    }
    const baselineScore = score(baseline.words);
    const delayedScore = score(refined.words, delayed);
    expect(delayedScore.words).toBe(baselineScore.words);
    expect(delayedScore.rhythm).toBe(baselineScore.rhythm);
    expect(delayedScore.timing).toBeLessThan(baselineScore.timing! - 60);
    expect(delayedScore.evidence.meanStartErrorMs).toBeGreaterThan(950);
    expect(delayedScore.evidence.audioHash).not.toBe(AUDIO_HASH);
    expect(delayedScore.observations.join(" ")).toContain("late");
  });

  it("locates a ten-times quieter version at substantially the same onset", () => {
    pcmFixture();
    const quiet = Buffer.from(fixture);
    for (let offset = 44; offset < quiet.length; offset += 2) {
      quiet.writeInt16LE(Math.round(fixture.readInt16LE(offset) * 0.1), offset);
    }
    const baseline = refineSayWordTiming(fixture, rawWords);
    const refined = refineSayWordTiming(quiet, rawWords);
    expect(refined.timing.status).not.toBe("unavailable");
    expect(refined.words[0]!.start).toBeGreaterThanOrEqual(0.78);
    expect(refined.words[0]!.start).toBeLessThanOrEqual(0.95);
    expect(Math.abs(refined.words[0]!.start - baseline.words[0]!.start)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(refined.words.at(-1)!.end - baseline.words.at(-1)!.end)).toBeLessThanOrEqual(0.03);
  });

  it("declines compressed MP3 timing rather than trusting the known-bad raw timestamps", () => {
    const mp3 = new Uint8Array(417 * 3);
    for (let frame = 0; frame < 3; frame++) mp3.set([0xff, 0xfb, 0x90, 0], frame * 417);
    const result = refineSayWordTiming(mp3, rawWords);
    expect(result.words).toEqual([]);
    expect(result.timing.status).toBe("unavailable");
    const wordsOnly = score(result.words);
    expect(wordsOnly.timing).toBeNull();
    expect(wordsOnly.rhythm).toBeNull();
  });
});
