// @vitest-environment node
/** Bounded, explicitly authorized synthetic-speech smoke. Never part of default CI. */
import { readFile } from "node:fs/promises";

import { expect, it } from "vitest";

import { validateAudio } from "@/lib/server/audio";
import { transcribeWithScribe } from "@/lib/server/elevenlabs";
import { transcriptAccuracy } from "@/lib/server/openai";

const sourcePath = process.env.DELIVERY_SCRIBE_SMOKE_WAV;
const enabled = Boolean(sourcePath) && process.env.DELIVERY_SCRIBE_SMOKE_LIVE === "1";

it.runIf(enabled)("transcribes one authorized neutral synthetic take through Scribe v2", async () => {
  const reference = process.env.DELIVERY_SCRIBE_SMOKE_EXPECTED;
  if (!reference) throw new Error("Supply the neutral synthetic phrase for the smoke check.");
  const bytes = await readFile(sourcePath!);
  const audio = new File([bytes], "neutral-synthetic-smoke.wav", { type: "audio/wav" });
  if (audio.size > 1_000_000) throw new Error("Smoke input must remain under 1 MB.");
  const validated = await validateAudio(audio, Number(process.env.DELIVERY_SCRIBE_SMOKE_DURATION_MS ?? 3_000));
  if (validated.durationMs > 10_000) throw new Error("Smoke input must remain under ten seconds.");
  const result = await transcribeWithScribe(audio, validated.durationMs);
  expect(result.provider).toBe("elevenlabs");
  expect(result.model).toBe("scribe_v2");
  expect(result.words.length).toBeGreaterThan(0);
  expect(transcriptAccuracy(reference, result.text)).toBe(100);
  // Print aggregate contract evidence only, never keys or provider account metadata.
  console.info(JSON.stringify({ evidence: "live-scribe-synthetic-smoke", durationMs: validated.durationMs, words: result.words.length, exactPhraseMatch: true, usedForAccuracy: result.usedForAccuracy }));
}, 20_000);
