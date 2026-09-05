import { z } from "zod";

export const EVALUATION_TAGS = [
  "quiet", "loud", "deadpan", "mistake", "interpretation", "spoken-injection",
  "silence", "noise", "clipping", "corrupt",
] as const;

const consentSchema = z.object({
  adult: z.literal(true),
  voiceOwnerApproved: z.literal(true),
  providerProcessingApproved: z.literal(true),
  // Record the actual consent receipt privately, not a person's identity here.
  receipt: z.string().min(1).max(200),
  expiresAt: z.string().datetime(),
  deleteBy: z.string().datetime(),
}).strict();

export const evaluationManifestSchema = z.object({
  schemaVersion: z.literal("delivery-audio-eval-v1"),
  kind: z.literal("consented-human"),
  consent: consentSchema,
  repetitions: z.number().int().min(1).max(3).default(1),
  cases: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,80}$/),
    audioPath: z.string().min(1).max(500),
    promptText: z.string().min(2).max(500),
    direction: z.string().min(2).max(180),
    durationMs: z.number().int().min(250).max(20_000),
    tags: z.array(z.enum(EVALUATION_TAGS)).min(1),
    expectedOutcome: z.enum(["judged", "retry"]),
    expectedErrorCodes: z.array(z.string().regex(/^[A-Z_]+$/)).min(1).max(5).optional(),
    // Human-transcribed audible words, including errors and injections.
    referenceTranscript: z.string().max(2_000),
    compareGroup: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
    // Applied only to copies of PCM16 WAV bytes. Nonpositive gain cannot clip.
    gainDb: z.array(z.number().min(-24).max(0)).min(1).max(3).default([0]),
  }).strict()).min(1).max(30),
}).strict().superRefine((manifest, context) => {
  if (new Set(manifest.cases.map((entry) => entry.id)).size !== manifest.cases.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Evaluation case IDs must be unique." });
  }
  if (manifest.cases.some((entry) => entry.expectedOutcome === "retry" && !entry.expectedErrorCodes?.length)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Retry cases require expectedErrorCodes, so an unrelated outage cannot pass as correct rejection." });
  }
});

export function assertEvaluationConsent(manifest: z.infer<typeof evaluationManifestSchema>, now = Date.now()) {
  if (Date.parse(manifest.consent.expiresAt) <= now || Date.parse(manifest.consent.deleteBy) <= now) {
    throw new Error("Evaluation consent or retention period has expired; do not send these recordings.");
  }
}

export function evaluationCoverage(manifest: z.infer<typeof evaluationManifestSchema>) {
  const tags = new Set(manifest.cases.flatMap((entry) => entry.tags));
  return { covered: [...tags], missing: EVALUATION_TAGS.filter((tag) => !tags.has(tag)) };
}

/** Gain controls preserve the same delivery timing; they are not new performances. */
export function attenuatePcm16Wav(source: Uint8Array, gainDb: number): Uint8Array {
  if (!Number.isFinite(gainDb) || gainDb > 0 || gainDb < -24) throw new Error("Use gain between -24 and 0 dB.");
  const bytes = new Uint8Array(source);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  if (bytes.length < 44 || ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WAVE") throw new Error("Gain controls require PCM16 WAV.");
  let isPcm16 = false;
  let dataOffset = -1;
  let dataSize = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > bytes.length) throw new Error("Incomplete WAV fixture.");
    if (ascii(offset, 4) === "fmt " && size >= 16) {
      isPcm16 = view.getUint16(start, true) === 1 && view.getUint16(start + 14, true) === 16;
    }
    if (ascii(offset, 4) === "data") { dataOffset = start; dataSize = size; }
    offset = start + size + (size % 2);
  }
  if (!isPcm16 || dataOffset < 0 || dataSize % 2 !== 0) throw new Error("Gain controls require PCM16 WAV.");
  const multiplier = 10 ** (gainDb / 20);
  for (let offset = dataOffset; offset < dataOffset + dataSize; offset += 2) {
    view.setInt16(offset, Math.round(view.getInt16(offset, true) * multiplier), true);
  }
  return bytes;
}
