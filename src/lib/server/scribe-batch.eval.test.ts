// @vitest-environment node
/** Explicit bounded evaluation. Default CI cannot call either provider. */
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { z } from "zod";
import { validateAudio } from "@/lib/server/audio";
import { transcribeWithScribe } from "@/lib/server/elevenlabs";
import { getServerEnv } from "@/lib/server/env";
import { transcriptAccuracy } from "@/lib/server/openai";

const manifestPath = process.env.DELIVERY_SCRIBE_BATCH_MANIFEST;
const live = process.env.DELIVERY_SCRIBE_BATCH_LIVE === "1";
const schema = z
  .object({
    schemaVersion: z.literal("delivery-scribe-synthetic-v1"),
    kind: z.literal("synthetic-contract"),
    origin: z.string(),
    targetLine: z.string(),
    maxCalls: z.number().int().min(1).max(12),
    maxAudioMs: z.number().int().max(120_000),
    costLimitUsd: z.number().positive().max(0.1),
    cases: z
      .array(
        z
          .object({
            id: z.string(),
            audioPath: z.string(),
            durationMs: z.number().min(250).max(20_000),
            referenceTranscript: z.string(),
            originNote: z.string(),
            expected: z.string(),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

it.runIf(Boolean(manifestPath))(
  "evaluates at most 12 authorized synthetic Scribe samples",
  async () => {
    const location = await realpath(path.resolve(manifestPath!));
    const directory = path.dirname(location);
    const manifest = schema.parse(JSON.parse(await readFile(location, "utf8")));
    if (
      manifest.cases.length > manifest.maxCalls ||
      new Set(manifest.cases.map((c) => c.id)).size !== manifest.cases.length
    )
      throw new Error("Invalid batch count or duplicate IDs.");
    if (
      manifest.cases.reduce((sum, c) => sum + c.durationMs, 0) >
      manifest.maxAudioMs
    )
      throw new Error("Batch audio duration exceeds authorization.");
    const prepared = [];
    for (const entry of manifest.cases) {
      const filePath = await realpath(path.resolve(directory, entry.audioPath));
      if (!filePath.startsWith(directory + path.sep))
        throw new Error("Fixture path escaped its private directory.");
      const bytes = await readFile(filePath);
      if (
        bytes.length > 1_000_000 ||
        createHash("sha256").update(bytes).digest("hex") !== entry.sha256
      )
        throw new Error("Fixture size/hash mismatch.");
      const audio = new File([bytes], "synthetic-contract.wav", {
        type: "audio/wav",
      });
      // Validate every waveform before any network call. Expected silent input is
      // retained as a local rejection and never sent to the paid provider.
      try {
        const validated = await validateAudio(audio, entry.durationMs);
        prepared.push({ entry, audio, validated });
      } catch (error) {
        prepared.push({
          entry,
          audio,
          errorCode:
            error && typeof error === "object" && "code" in error
              ? String(error.code)
              : "UNEXPECTED_ERROR",
        });
      }
    }
    const measuredAudioMs = prepared.reduce(
      (sum, p) => sum + (p.validated?.durationMs ?? p.entry.durationMs),
      0,
    );
    if (
      prepared.some((p) => p.validated && p.validated.durationMs > 20_000) ||
      measuredAudioMs > manifest.maxAudioMs
    ) {
      throw new Error("Measured audio exceeds authorization.");
    }
    // Conservative list-price guard, not a promise about a provider invoice.
    const maximumEstimatedCostUsd = (measuredAudioMs / 3_600_000) * 0.4;
    if (maximumEstimatedCostUsd > manifest.costLimitUsd) {
      throw new Error(
        "Estimated Scribe cost exceeds the approved dollar limit.",
      );
    }
    if (!live) {
      console.info(
        JSON.stringify({
          kind: "scribe-batch-preflight",
          cases: prepared.length,
          providerCalls: 0,
          maximumEstimatedCostUsd,
          validation: prepared.map((p) => ({
            id: p.entry.id,
            outcome: p.errorCode ?? "ready",
          })),
        }),
      );
      return;
    }
    if (!getServerEnv().ELEVENLABS_API_KEY)
      throw new Error("Existing authorized Scribe key is required.");
    // A crash or uncertain response still consumes this batch authorization.
    await writeFile(`${location}.live-started`, new Date().toISOString(), {
      mode: 0o600,
      flag: "wx",
    });
    const results = [];
    let providerCalls = 0;
    let sentAudioMs = 0;
    for (const item of prepared) {
      const start = Date.now();
      if (item.errorCode) {
        results.push({
          id: item.entry.id,
          originNote: item.entry.originNote,
          outcome: item.errorCode,
          phase: "local-validation",
          providerCalled: false,
          latencyMs: Date.now() - start,
          matchedExpectation: item.errorCode === item.entry.expected,
        });
        continue;
      }
      providerCalls += 1;
      sentAudioMs += item.validated!.durationMs;
      try {
        const transcript = await transcribeWithScribe(
          item.audio,
          item.validated!.durationMs,
        );
        results.push({
          id: item.entry.id,
          originNote: item.entry.originNote,
          outcome: "transcribed",
          phase: "live-scribe",
          providerCalled: true,
          latencyMs: Date.now() - start,
          matchedExpectation: item.entry.expected === "transcribed",
          referenceAccuracy: transcriptAccuracy(
            item.entry.referenceTranscript,
            transcript.text,
          ),
          targetAccuracy: transcriptAccuracy(
            manifest.targetLine,
            transcript.text,
          ),
          transcript,
        });
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "UNEXPECTED_ERROR";
        results.push({
          id: item.entry.id,
          originNote: item.entry.originNote,
          outcome: code,
          phase: "live-scribe",
          providerCalled: true,
          latencyMs: Date.now() - start,
          matchedExpectation: code === item.entry.expected,
        });
      }
      // No automatic retry, including after uncertain/failed provider responses.
    }
    const report = {
      schemaVersion: "delivery-scribe-batch-report-v1",
      generatedAt: new Date().toISOString(),
      origin: manifest.origin,
      evidence:
        "live transcription of synthetic contract signals; no OpenAI judging or human performance validation",
      providerCalls,
      sentAudioMs,
      estimatedListCostUsd: (sentAudioMs / 3_600_000) * 0.4,
      costBasis:
        "Conservative $0.40/audio-hour; not a provider billing receipt",
      costLimitUsd: manifest.costLimitUsd,
      results,
    };
    const reportPath = `${location}.report-${Date.now()}.json`;
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    console.info(
      JSON.stringify({
        kind: "live-scribe-synthetic-batch",
        reportPath,
        providerCalls,
        sentAudioMs,
        expectationMismatches: results
          .filter((r) => !r.matchedExpectation)
          .map((r) => r.id),
      }),
    );
    expect(
      results.filter((r) => !r.matchedExpectation).map((r) => r.id),
    ).toEqual([]);
  },
  180_000,
);
