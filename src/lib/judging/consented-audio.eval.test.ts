// @vitest-environment node
/** Explicit opt-in only. Ordinary test runs never read recordings or call providers. */
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, it } from "vitest";

import { assertEvaluationConsent, attenuatePcm16Wav, evaluationCoverage, evaluationManifestSchema } from "@/lib/judging/evaluation";
import { validateAudio } from "@/lib/server/audio";
import { AppError } from "@/lib/server/api-error";
import { getServerEnv } from "@/lib/server/env";
import { judgeDelivery, transcriptAccuracy } from "@/lib/server/openai";

const manifestPath = process.env.DELIVERY_EVAL_MANIFEST;
const liveAuthorized = process.env.DELIVERY_EVAL_LIVE === "1";

it.runIf(Boolean(manifestPath))("evaluates an explicitly supplied consented audio manifest", async () => {
  const manifestLocation = await realpath(path.resolve(manifestPath!));
  const directory = path.dirname(manifestLocation);
  const manifest = evaluationManifestSchema.parse(JSON.parse(await readFile(manifestLocation, "utf8")));
  assertEvaluationConsent(manifest);
  const coverage = evaluationCoverage(manifest);
  const prepared = [];
  // Validate all paths/bytes before any provider spend; only files in the private
  // fixture folder may be sent. A symlink cannot escape that folder.
  for (const entry of manifest.cases) {
    const location = await realpath(path.resolve(directory, entry.audioPath));
    if (!location.startsWith(`${directory}${path.sep}`)) throw new Error("Audio fixture must stay inside its consented fixture directory.");
    const bytes = new Uint8Array(await readFile(location));
    if (bytes.length > 15 * 1024 * 1024) throw new Error("Fixture exceeds the production 15 MB limit.");
    for (const gainDb of entry.gainDb) {
      const adjusted = gainDb === 0 ? bytes : attenuatePcm16Wav(bytes, gainDb);
      const mime = path.extname(location).toLowerCase() === ".mp3" ? "audio/mpeg" : "audio/wav";
      const audio = new File([adjusted as BlobPart], "consented-evaluation-take", { type: mime });
      prepared.push({ entry, gainDb, audio });
    }
  }
  if (prepared.length * manifest.repetitions > 36) throw new Error("Split this manifest: each evaluation is capped at 36 attempts.");
  if (!liveAuthorized) {
    console.info(JSON.stringify({ kind: "manifest-preflight-only", cases: prepared.length, coverage, providerCalls: 0 }));
    return;
  }
  const env = getServerEnv();
  if (env.DELIVERY_AI_MODE !== "live" || !env.OPENAI_API_KEY || env.DELIVERY_AI_ALLOW_MOCK_FALLBACK) {
    throw new Error("Live evaluation requires explicit live mode, an authorized OpenAI key, and mock fallback disabled.");
  }
  if (env.DELIVERY_TRANSCRIPTION_PROVIDER === "elevenlabs" && !env.ELEVENLABS_API_KEY) {
    throw new Error("The selected Scribe evaluation requires an authorized ElevenLabs key.");
  }
  const results: Record<string, unknown>[] = [];
  for (const { entry, gainDb, audio } of prepared) {
    for (let repetition = 1; repetition <= manifest.repetitions; repetition += 1) {
      assertEvaluationConsent(manifest);
      const start = Date.now();
      try {
        const validated = await validateAudio(audio, entry.durationMs);
        if (validated.durationMs > 20_000) throw new AppError("INVALID_AUDIO", "Takes must be 20 seconds or less.", 400);
        const judgment = await judgeDelivery({ audio, promptText: entry.promptText, energy: entry.direction, mode: "classic", durationMs: validated.durationMs });
        expect(judgment.source).toBe("openai");
        results.push({
          id: entry.id, compareGroup: entry.compareGroup, tags: entry.tags, gainDb, repetition,
          outcome: "judged", matchedExpectation: entry.expectedOutcome === "judged", expectedOutcome: entry.expectedOutcome, latencyMs: Date.now() - start,
          referenceTranscriptAccuracy: transcriptAccuracy(entry.referenceTranscript, judgment.transcript),
          scribeReferenceTranscriptAccuracy: judgment.transcription ? transcriptAccuracy(entry.referenceTranscript, judgment.transcription.text) : null,
          judgment,
        });
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "UNEXPECTED_ERROR";
        results.push({ id: entry.id, tags: entry.tags, gainDb, repetition, outcome: "retry", matchedExpectation: entry.expectedOutcome === "retry" && Boolean(entry.expectedErrorCodes?.includes(code)), expectedOutcome: entry.expectedOutcome, code, latencyMs: Date.now() - start });
      }
    }
  }
  const report = {
    schemaVersion: "delivery-audio-eval-report-v1", generatedAt: new Date().toISOString(),
    evidence: "consented-human-audio; automated measurements require blind human review",
    deleteBy: manifest.consent.deleteBy, coverage, results,
    outcomeMismatches: results.filter((result) => !result.matchedExpectation).map((result) => result.id),
  };
  // Contains private transcripts: stored beside consented recordings, never in public/.
  const reportPath = `${manifestLocation}.report-${Date.now()}.json`;
  await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600, flag: "wx" });
  console.info(JSON.stringify({ kind: "consented-human-evaluation", attempts: results.length, mismatches: report.outcomeMismatches.length, coverage }));
  expect(report.outcomeMismatches).toEqual([]);
}, 60 * 60 * 1_000);
