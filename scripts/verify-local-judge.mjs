/* Real local HTTP and synthetic PCM / mock judging. No live AI or persistence. */
import fs from "node:fs";
import { spawn } from "node:child_process";

let app;
(async () => {
  const startLocal = process.env.DELIVERY_HTTP_START_LOCAL === "1";
  const missingLiveKey = startLocal && process.env.DELIVERY_HTTP_LIVE_NO_KEY === "1";
  const base = startLocal ? "http://127.0.0.1:3102" : "http://127.0.0.1:3000";
  if (startLocal) {
    app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3102"], {
      stdio: "ignore",
      env: { ...process.env, NODE_ENV: "development", NEXT_PUBLIC_APP_URL: base,
        NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "",
        OPENAI_API_KEY: "", ELEVENLABS_API_KEY: "", DELIVERY_AI_MODE: missingLiveKey ? "live" : "mock", DELIVERY_AI_ALLOW_MOCK_FALLBACK: "false",
        STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", STRIPE_PRO_MONTHLY_PRICE_ID: "", STRIPE_PRO_ANNUAL_PRICE_ID: "",
        UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "", DELIVERY_DEVICE_SECRET: crypto.randomUUID() + crypto.randomUUID() },
    });
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      if (app.exitCode !== null) throw new Error("Local Next server exited during startup");
      try { const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }); ready = response.ok || (missingLiveKey && response.status === 503); if (ready) break; } catch { /* bounded startup */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error("Local Next server did not become ready");
  }
  const health = await fetch(`${base}/api/health`).then((r) => r.json());
  if (!missingLiveKey && (health.data?.environment !== "development" || health.data.services.openai || health.data.services.supabaseAdmin))
    throw new Error("Run only against the unconfigured local development fixture server.");

  const bytes = Buffer.alloc(32044);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write("data", 36); bytes.writeUInt32LE(32000, 40);
  for (let n = 0; n < 16000; n++) bytes.writeInt16LE(Math.round(Math.sin(n * Math.PI * 440 / 8000) * 5000), 44 + n * 2);
  let cookie = "";
  const checks = [];
  const runs = [];
  function check(name, condition) { if (!condition) throw new Error(name); checks.push({ name, passed: true }); }
  async function judge(key, changes = {}, audio = bytes) {
    const form = new FormData();
    const fields = { promptId: "v2-favorite-child", line: "I am my own emergency contact. We are both panicking.",
      energy: "Sound outrageously confident while holding back tears; let one word wobble, then recover.",
      category: "main-character", mode: "classic", durationMs: "1000", attemptId: key, isPublic: "false", maxRating: "everyone", ...changes };
    for (const [name, value] of Object.entries(fields)) form.set(name, value);
    form.set("audio", new Blob([audio], { type: "audio/wav" }), "delivery.wav");
    const response = await fetch(`${base}/api/judge`, { method: "POST", headers: { Origin: base, "Idempotency-Key": key, ...(cookie ? { Cookie: cookie } : {}) }, body: form });
    const body = await response.json();
    cookie = response.headers.get("set-cookie")?.split(";")[0] ?? cookie;
    runs.push({ status: response.status, source: body.result?.source, scoringVersion: body.result?.scoringVersion,
      rubricVersion: body.result?.rubricVersion, persisted: body.delivery?.persisted,
      id: body.result?.id, error: body.error?.code, replayed: response.headers.get("idempotency-replayed"), used: body.usage?.used });
    return { response, body };
  }
  if (missingLiveKey) {
    const failed = await judge(crypto.randomUUID());
    check("live judging with a missing key fails visibly without a demo receipt", failed.response.status === 503 && failed.body.error?.code === "SERVER_NOT_CONFIGURED" && !failed.body.result);
    const evidenceDirectory = process.env.DELIVERY_EVIDENCE_DIR || "docs/evidence/classic-rework";
    fs.mkdirSync(evidenceDirectory, { recursive: true });
    fs.writeFileSync(`${evidenceDirectory}/local-live-no-key.json`, JSON.stringify({ kind: "real-local-http-live-configuration-failure", executedAt: new Date().toISOString(), providerCalls: 0, checks, runs }, null, 2) + "\n");
    console.log(JSON.stringify({ status: "passed", checks: checks.length, judgeRequests: runs.length, providerCalls: 0 }));
    return;
  }
  const key = crypto.randomUUID();
  const first = await judge(key), retry = await judge(key);
  check("labeled mock score remains ephemeral", first.response.ok && first.body.result?.source === "fallback" && first.body.delivery?.persisted === false);
  check("lost-response retry replays the same receipt without extra quota", retry.response.ok && retry.body.result.id === first.body.result.id && retry.body.usage.used === first.body.usage.used && retry.response.headers.get("idempotency-replayed") === "true");
  const concurrentKey = crypto.randomUUID();
  const concurrent = await Promise.all([judge(concurrentKey), judge(concurrentKey)]);
  check("concurrent requests either replay or report in-progress", concurrent.every((r) => r.response.ok || r.body.error?.code === "IDEMPOTENCY_IN_PROGRESS"));
  const completed = concurrent.find((r) => r.response.ok);
  const recovered = await judge(concurrentKey);
  check("concurrent operation recovers one result and one quota charge", completed && recovered.response.ok && recovered.body.result.id === completed.body.result.id && recovered.body.usage.used === completed.body.usage.used && recovered.body.usage.used === first.body.usage.used + 1);
  const conflict = await judge(key, { line: "Changed words must not reuse a completed receipt." });
  check("changed-body retry rejected", conflict.response.status === 409 && conflict.body.error?.code === "IDEMPOTENCY_CONFLICT");
  const silence = Buffer.from(bytes); silence.fill(0, 44);
  const silent = await judge(crypto.randomUUID(), {}, silence);
  check("silence rejected before invented scoring", silent.response.status === 422 && silent.body.error?.code === "NO_SPEECH_DETECTED" && !silent.body.result);
  const account = await fetch(`${base}/api/account`).then((r) => r.json());
  check("missing account service is explicit", account.authenticated === false && account.configured === false);
  const privateAudio = await fetch(`${base}/api/deliveries/00000000-0000-4000-8000-000000000001`);
  check("unconfigured private audio route fails closed", privateAudio.status === 503 && (await privateAudio.json()).error?.code === "AUTH_NOT_CONFIGURED");
  const draw = await fetch(`${base}/api/prompts/random?maxRating=everyone&seed=step1c-http`).then((r) => r.json());
  check("default draw is audience-safe", draw.data?.prompt?.rating === "everyone");
  const [dailyA, dailyB] = await Promise.all([fetch(`${base}/api/prompts/daily`).then((r) => r.json()), fetch(`${base}/api/prompts/daily`).then((r) => r.json())]);
  check("local Daily assignment remains stable across requests", dailyA.data?.prompt?.id && dailyA.data.prompt.id === dailyB.data?.prompt?.id && dailyA.data.energy.id === dailyB.data.energy.id);
  const evidenceDirectory = process.env.DELIVERY_EVIDENCE_DIR || "docs/evidence/classic-rework";
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(`${evidenceDirectory}/local-api.json`, JSON.stringify({
    kind: "locally-exercised-real-api-with-explicit-mock-judge", executedAt: new Date().toISOString(),
    audio: "one-second synthetic 440Hz PCM fixture plus zero PCM silence; neither is human speech",
    sameReceipt: true, providerCalls: 0, sameProcessConcurrencyOnly: true, checks, runs,
  }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "passed", checks: checks.length, judgeRequests: runs.length, source: "fallback", persisted: false }));
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => { app?.kill("SIGTERM"); });
