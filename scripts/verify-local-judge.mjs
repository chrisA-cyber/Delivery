/* Explicitly local synthetic PCM / mock-judge transport verification. No live AI. */
import fs from "node:fs";
(async () => {
  const base = "http://127.0.0.1:3000";
  const health = await fetch(`${base}/api/health`).then((r) => r.json());
  if (
    health.data?.environment !== "development" ||
    health.data.services.openai ||
    health.data.services.supabaseAdmin
  )
    throw new Error(
      "Run only against the unconfigured local development fixture server.",
    );
  const sampleRate = 16000,
    samples = sampleRate,
    bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVE", 8);
  bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples * 2, 40);
  for (let n = 0; n < samples; n++)
    bytes.writeInt16LE(
      Math.round(Math.sin((n * 2 * Math.PI * 440) / sampleRate) * 5000),
      44 + n * 2,
    );
  const key = crypto.randomUUID();
  let cookie = "";
  const evidence = [];
  for (let run = 0; run < 2; run++) {
    const form = new FormData();
    form.set("audio", new Blob([bytes], { type: "audio/wav" }), "delivery.wav");
    form.set("promptId", "v2-favorite-child");
    form.set("line", "I am my own emergency contact. We are both panicking.");
    form.set(
      "energy",
      "Sound outrageously confident while holding back tears; let one word wobble, then recover.",
    );
    form.set("category", "main-character");
    form.set("mode", "classic");
    form.set("durationMs", "1000");
    form.set("attemptId", key);
    form.set("isPublic", "false");
    form.set("maxRating", "everyone");
    const response = await fetch(`${base}/api/judge`, {
      method: "POST",
      headers: {
        Origin: base,
        "Idempotency-Key": key,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: form,
    });
    const body = await response.json();
    cookie = response.headers.get("set-cookie")?.split(";")[0] ?? cookie;
    if (
      !response.ok ||
      body.result?.source !== "fallback" ||
      body.delivery?.persisted !== false
    )
      throw new Error(
        `Unexpected fixture response: ${response.status} ${body.error?.code ?? "contract"}`,
      );
    evidence.push({
      status: response.status,
      source: body.result.source,
      scoringVersion: body.result.scoringVersion,
      rubricVersion: body.result.rubricVersion,
      persisted: body.delivery.persisted,
      id: body.result.id,
      headers: { replayed: response.headers.get("idempotency-replayed") },
    });
  }
  if (evidence[0].id !== evidence[1].id)
    throw new Error("Retry did not replay the same receipt");
  const evidenceDirectory = process.env.DELIVERY_EVIDENCE_DIR || "docs/evidence/classic-rework";
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(
    `${evidenceDirectory}/local-api.json`,
    JSON.stringify(
      {
        kind: "locally-exercised-real-api-with-explicit-mock-judge",
        audio: "one-second synthetic 440Hz PCM fixture, not speech",
        sameReceipt: true,
        runs: evidence,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      status: "passed",
      sameReceipt: true,
      source: "fallback",
      persisted: false,
      runs: 2,
    }),
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
