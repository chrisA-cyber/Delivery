import { describe, expect, it } from "vitest";

import { audioJudgeFormatForMime, transcriptAccuracy } from "@/lib/server/openai";

describe("transcriptAccuracy", () => {
  it("scores exact delivery at 100 despite punctuation and case", () => {
    expect(transcriptAccuracy("I have arrived!", "i have arrived")).toBe(100);
  });

  it("penalizes omitted and replaced words", () => {
    expect(transcriptAccuracy("the timeline has been quiet", "the timeline exploded")).toBe(40);
  });

  it("handles empty transcripts without division errors", () => {
    expect(transcriptAccuracy("say this", "")).toBe(0);
  });
});

describe("audioJudgeFormatForMime", () => {
  it("maps the PCM WAV recorder contract to OpenAI input audio", () => {
    expect(audioJudgeFormatForMime("audio/wav")).toBe("wav");
    expect(audioJudgeFormatForMime("audio/x-wav; codecs=1")).toBe("wav");
  });

  it("supports MP3 imports but refuses codecs the audio judge cannot hear", () => {
    expect(audioJudgeFormatForMime("audio/mpeg")).toBe("mp3");
    expect(audioJudgeFormatForMime("audio/webm;codecs=opus")).toBeNull();
    expect(audioJudgeFormatForMime("audio/mp4")).toBeNull();
    expect(audioJudgeFormatForMime("audio/ogg")).toBeNull();
  });
});
