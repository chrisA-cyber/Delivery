// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseScribeTranscript, transcribeWithScribe } from "@/lib/server/elevenlabs";
import { resetEnvCacheForTests } from "@/lib/server/env";

const fetchFixture = vi.fn();
const transcript = {
  text: "I regret nothing.",
  language_code: "en",
  language_probability: 0.99,
  words: [
    { text: "I", start: 0.1, end: 0.2, type: "word" },
    { text: " ", start: 0.2, end: 0.21, type: "spacing" },
    { text: "regret", start: 0.3, end: 0.6, type: "word" },
    { text: "nothing.", start: 0.8, end: 1.2, type: "word" },
  ],
};
const audio = new File([new Uint8Array([82, 73, 70, 70])], "private-name.wav", { type: "audio/wav" });

beforeEach(() => {
  vi.stubEnv("ELEVENLABS_API_KEY", "local-scribe-contract-fixture");
  vi.stubEnv("ELEVENLABS_ZERO_RETENTION", "false");
  resetEnvCacheForTests();
  fetchFixture.mockReset();
  vi.stubGlobal("fetch", fetchFixture);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});

describe("Scribe v2 contract (mocked fetch; no network)", () => {
  it("sends submitted bytes with word timing and no prompt bias, URL, or personal filename", async () => {
    fetchFixture.mockResolvedValue(Response.json(transcript));
    const result = await transcribeWithScribe(audio, 2_000);
    const [url, options] = fetchFixture.mock.calls[0]!;
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect(options.headers).toEqual({ "xi-api-key": "local-scribe-contract-fixture" });
    expect(options.redirect).toBe("error");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const form = options.body as FormData;
    expect([...form.keys()].sort()).toEqual(["diarize", "file", "model_id", "tag_audio_events", "timestamps_granularity"]);
    expect(form.get("model_id")).toBe("scribe_v2");
    expect(form.get("timestamps_granularity")).toBe("word");
    expect((form.get("file") as File).name).toBe("delivery-take.wav");
    expect(await (form.get("file") as File).arrayBuffer()).toEqual(await audio.arrayBuffer());
    expect(result).toMatchObject({ provider: "elevenlabs", model: "scribe_v2", usedForAccuracy: false, text: transcript.text });
    expect(result.words).toHaveLength(3);
  });

  it("requests zero retention only through the explicit enterprise setting", async () => {
    vi.stubEnv("ELEVENLABS_ZERO_RETENTION", "true");
    resetEnvCacheForTests();
    fetchFixture.mockResolvedValue(Response.json(transcript));
    await transcribeWithScribe(audio, 2_000);
    expect(fetchFixture.mock.calls[0]![0]).toContain("enable_logging=false");
  });

  it("rejects missing credentials before sending audio", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    resetEnvCacheForTests();
    await expect(transcribeWithScribe(audio)).rejects.toThrow("ELEVENLABS_API_KEY is required");
    expect(fetchFixture).not.toHaveBeenCalled();
  });

  it.each([
    [401, "TRANSCRIPTION_NOT_CONFIGURED"], [403, "TRANSCRIPTION_NOT_CONFIGURED"],
    [429, "TRANSCRIPTION_BUSY"], [500, "ELEVENLABS_UNAVAILABLE"],
  ])("maps provider status %s to a safe retry without leaking its body", async (status, code) => {
    fetchFixture.mockResolvedValue(new Response("secret provider details and transcript", { status: Number(status) }));
    await expect(transcribeWithScribe(audio)).rejects.toMatchObject({ code });
    expect(fetchFixture).toHaveBeenCalledTimes(1);
  });

  it("does not replace a timeout with an invented transcript", async () => {
    fetchFixture.mockRejectedValue(new DOMException("expired", "TimeoutError"));
    await expect(transcribeWithScribe(audio)).rejects.toMatchObject({ code: "ELEVENLABS_UNAVAILABLE" });
  });

  it("rejects an empty transcript and invalid or out-of-take word times", () => {
    expect(() => parseScribeTranscript({ ...transcript, text: " " })).toThrow("could not hear words");
    expect(() => parseScribeTranscript({ ...transcript, words: [{ text: "No", type: "word", start: 2, end: 1 }] })).toThrow("word timings");
    expect(() => parseScribeTranscript(transcript, 100)).toThrow("word timings");
    expect(() => parseScribeTranscript({ ...transcript, words: [] })).toThrow("word timings");
  });

  it("caps malformed and oversized provider responses", async () => {
    fetchFixture.mockResolvedValueOnce(new Response("{malformed")).mockResolvedValueOnce(new Response(" ".repeat(300_000)));
    await expect(transcribeWithScribe(audio)).rejects.toMatchObject({ code: "ELEVENLABS_UNAVAILABLE" });
    await expect(transcribeWithScribe(audio)).rejects.toMatchObject({ code: "ELEVENLABS_UNAVAILABLE" });
  });
});
