// @vitest-environment node
/** Explicit opt-in only. Ordinary test runs never read recordings or call providers. */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, it } from "vitest";

import { assertEvaluationConsent, attenuatePcm16Wav, evaluationCoverage, evaluationManifestSchema, evaluationRepeatability, evaluationRequestBudget, type EvaluationRepeatResult } from "@/lib/judging/evaluation";
import { RUBRIC_VERSION, SCORING_VERSION } from "@/lib/judging/rubric";
import { validateAudio } from "@/lib/server/audio";
import { AppError } from "@/lib/server/api-error";
import { getServerEnv } from "@/lib/server/env";
import { judgeDelivery, transcriptAccuracy } from "@/lib/server/openai";

const manifestPath = process.env.DELIVERY_EVAL_MANIFEST;
const liveAuthorized = process.env.DELIVERY_EVAL_LIVE === "1";

it.runIf(Boolean(manifestPath))("evaluates an explicitly supplied consented audio manifest", async () => {
  const manifestLocation = await realpath(path.resolve(manifestPath!));
  const directory = path.dirname(manifestLocation);
  const manifestBytes = await readFile(manifestLocation, "utf8");
  const manifest = evaluationManifestSchema.parse(JSON.parse(manifestBytes));
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
      prepared.push({ entry, gainDb, audio, audioSha256: createHash("sha256").update(adjusted).digest("hex"), repetitions: entry.repetitions ?? manifest.repetitions });
    }
  }
  const plannedAttempts = prepared.reduce((total, entry) => total + entry.repetitions, 0);
  if (plannedAttempts > 36) throw new Error("Split this manifest: each evaluation is capped at 36 attempts.");
  const env = getServerEnv();
  const requestCeiling = process.env.DELIVERY_EVAL_MAX_PROVIDER_REQUESTS;
  const budget = liveAuthorized || requestCeiling
    ? evaluationRequestBudget(requestCeiling, plannedAttempts, env.DELIVERY_TRANSCRIPTION_PROVIDER === "elevenlabs")
    : null;
  if (!liveAuthorized) {
    console.info(JSON.stringify({ kind: "manifest-preflight-only", cases: prepared.length, plannedAttempts, coverage, budget, providerCalls: 0 }));
    return;
  }
  if (env.DELIVERY_AI_MODE !== "live" || !env.OPENAI_API_KEY || env.DELIVERY_AI_ALLOW_MOCK_FALLBACK) {
    throw new Error("Live evaluation requires explicit live mode, an authorized OpenAI key, and mock fallback disabled.");
  }
  if (env.DELIVERY_TRANSCRIPTION_PROVIDER === "elevenlabs" && !env.ELEVENLABS_API_KEY) {
    throw new Error("The selected Scribe evaluation requires an authorized ElevenLabs key.");
  }
  const results: (EvaluationRepeatResult & Record<string, unknown>)[] = [];
  const requests: { provider: "openai" | "elevenlabs"; startedAt: string; id: string; gainDb: number; repetition: number; durationMs: number; usage?: unknown }[] = [];
  const reportPath = `${manifestLocation}.report-${Date.now()}.json`;
  // A lost response or interrupted process does not authorize silently repeating
  // a paid run. A fresh run needs a newly approved manifest/location.
  await writeFile(`${manifestLocation}.live-started`, JSON.stringify({ startedAt: new Date().toISOString(), reportPath, budget }), { mode: 0o600, flag: "wx" });
  const report = {
    schemaVersion: "delivery-audio-eval-report-v2", generatedAt: new Date().toISOString(),
    evidence: "consented-human-audio; automated measurements require blind human review",
    manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
    model: env.OPENAI_AUDIO_JUDGE_MODEL, rubricVersion: RUBRIC_VERSION, scoringVersion: SCORING_VERSION,
    transcriptionProvider: env.DELIVERY_TRANSCRIPTION_PROVIDER,
    deleteBy: manifest.consent.deleteBy, coverage, budget, plannedAttempts, requests, results,
    providerRequests: { openai: 0, elevenlabs: 0, total: 0 },
    estimatedCostUsd: null,
    costNote: "Request-capped run; calculate cost using recorded OpenAI token usage, Scribe duration, and current provider pricing. Lost/failed responses may lack usage; reconcile with provider billing. No zero-cost claim is implied.",
    complete: false,
    repeatability: [] as ReturnType<typeof evaluationRepeatability>,
    outcomeMismatches: [] as string[],
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600, flag: "wx" });
  const checkpoint = () => writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  for (const { entry, gainDb, audio, audioSha256, repetitions } of prepared) {
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      assertEvaluationConsent(manifest);
      const start = Date.now();
      try {
        const validated = await validateAudio(audio, entry.durationMs);
        if (validated.durationMs > 20_000) throw new AppError("INVALID_AUDIO", "Takes must be 20 seconds or less.", 400);
        const judgment = await judgeDelivery({
          audio, promptText: entry.promptText, energy: entry.direction, mode: "classic", durationMs: validated.durationMs,
          onProviderRequest(provider) {
            assertEvaluationConsent(manifest);
            if (requests.length >= budget!.maximumRequests) {
              throw new AppError("EVALUATION_REQUEST_LIMIT", "Approved provider request ceiling reached.", 429);
            }
            requests.push({ provider, startedAt: new Date().toISOString(), id: entry.id, gainDb, repetition, durationMs: validated.durationMs });
            report.providerRequests[provider] += 1;
            report.providerRequests.total += 1;
            // Record before dispatch: include uncertain/lost responses conservatively.
            checkpoint();
          },
          onOpenAIUsage(usage) {
            requests[requests.length - 1]!.usage = usage ?? null;
            checkpoint();
          },
        });
        expect(judgment.source).toBe("openai");
        results.push({
          id: entry.id, compareGroup: entry.compareGroup, tags: entry.tags, gainDb, repetition, audioSha256,
          outcome: "judged", matchedExpectation: entry.expectedOutcome === "judged", expectedOutcome: entry.expectedOutcome, latencyMs: Date.now() - start,
          referenceTranscriptAccuracy: transcriptAccuracy(entry.referenceTranscript, judgment.transcript),
          scribeReferenceTranscriptAccuracy: judgment.transcription ? transcriptAccuracy(entry.referenceTranscript, judgment.transcription.text) : null,
          judgment,
        });
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "UNEXPECTED_ERROR";
        results.push({ id: entry.id, compareGroup: entry.compareGroup, tags: entry.tags, gainDb, repetition, audioSha256, outcome: "retry", matchedExpectation: entry.expectedOutcome === "retry" && Boolean(entry.expectedErrorCodes?.includes(code)), expectedOutcome: entry.expectedOutcome, code, latencyMs: Date.now() - start });
      }
      report.repeatability = evaluationRepeatability(results);
      report.outcomeMismatches = results.filter((result) => !result.matchedExpectation).map((result) => result.id);
      checkpoint();
    }
  }
  report.complete = true;
  checkpoint();
  console.info(JSON.stringify({ kind: "consented-human-evaluation", attempts: results.length, providerRequests: report.providerRequests, mismatches: report.outcomeMismatches.length, coverage }));
  expect(report.outcomeMismatches).toEqual([]);
}, 60 * 60 * 1_000);
