import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/server/api-error";
import {
  audioJudgeFormatForMime,
  parseModelJudgmentArguments,
  transcriptAccuracy,
} from "@/lib/server/openai";

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

describe("parseModelJudgmentArguments", () => {
  it("reports no speech before validating performance-only highlights", () => {
    try {
      parseModelJudgmentArguments(
        JSON.stringify({
          speechDetected: false,
          transcript: "",
          commitment: 0,
          comedy: 0,
          chaos: 0,
          verdict: "No clear speech was audible in this take.",
          verdictTag: "NEEDS_MORE_SAUCE",
          highlights: [],
          coachNote: "Check the microphone and try the line again.",
        }),
      );
      throw new Error("Expected no-speech judgment to be rejected.");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("NO_SPEECH_DETECTED");
      expect((error as AppError).status).toBe(422);
    }
  });

  it("accepts a complete spoken-performance scorecard", () => {
    const parsed = parseModelJudgmentArguments(
      JSON.stringify({
        speechDetected: true,
        transcript: "We find the snack before dawn.",
        commitment: 87,
        comedy: 79,
        chaos: 72,
        verdict: "A pantry raid delivered like the season finale.",
        verdictTag: "COMMITTED_TO_THE_BIT",
        highlights: ["The opening landed with immediate conviction"],
        coachNote: "Hold the final word for one extra beat.",
      }),
    );

    expect(parsed.speechDetected).toBe(true);
    expect(parsed.transcript).toBe("We find the snack before dawn.");
    expect(parsed.highlights).toHaveLength(1);
  });

  it("treats detected speech without a transcript as a repairable format error", () => {
    expect(() =>
      parseModelJudgmentArguments(
        JSON.stringify({
          speechDetected: true,
          transcript: "",
          commitment: 75,
          comedy: 70,
          chaos: 65,
          verdict: "The voice arrived but the transcript did not.",
          verdictTag: "SENT_IT",
          highlights: ["Clear vocal energy was detected"],
          coachNote: "Try the scorecard again without losing the take.",
        }),
      ),
    ).toThrow("detected speech but omitted its transcript");
  });
});
