/** Opt-in disposable-loopback Auth/PostgREST/Storage + application HTTP check.
 * No paid providers. Synthetic receipts below are setup fixtures, NOT judge→save evidence.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const checks = [];
const users = [];
const objects = [];
let app;
let admin;
let fixtureStarted = false;
let failureStage = "preflight";
let failureCode;
const evidencePath = "docs/evidence/classic-step-1c/supabase-http.json";
function check(name, condition) { assert.ok(condition, name); checks.push({ name, passed: true }); }
function localOrigin(value, name) {
  assert.ok(typeof value === "string" && value.trim(), `${name} is missing; configure the disposable local stack first`);
  const url = new URL(value);
  assert.ok(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password, `${name} must be an exact loopback HTTP origin`);
  return url.origin;
}
function wav() {
  const bytes = Buffer.alloc(32044);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write("data", 36); bytes.writeUInt32LE(32000, 40);
  for (let n = 0; n < 16000; n++) bytes.writeInt16LE(Math.round(Math.sin(n * Math.PI * 440 / 8000) * 5000), 44 + n * 2);
  return bytes;
}
async function value(request) { const result = await request; assert.equal(result.error, null, `Supabase operation failed (${result.error?.code ?? "unknown"})`); return result.data; }

async function main() {
  assert.equal(process.env.DELIVERY_SUPABASE_HTTP_TEST, "1", "Opt in with DELIVERY_SUPABASE_HTTP_TEST=1 after starting a disposable local Supabase stack");
  const supabaseUrl = localOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL, "Supabase URL");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(anonKey && serviceKey, "Provide local CLI-generated keys via environment; never paste them into chat");
  const port = 3101;
  const base = `http://127.0.0.1:${port}`;
  try { await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }); throw new Error("Port 3101 is occupied; stop that server before this isolated run"); } catch (error) { if (!String(error.message).includes("fetch failed")) throw error; }
  admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await value(admin.from("prompts").select("id").limit(1));
  // Own the app process so the HTTP target cannot silently use a remote database or paid provider.
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    stdio: "ignore",
    env: { ...process.env, NODE_ENV: "development", NEXT_PUBLIC_APP_URL: base, NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      DELIVERY_AI_MODE: "mock", DELIVERY_AI_ALLOW_MOCK_FALLBACK: "false", OPENAI_API_KEY: "", ELEVENLABS_API_KEY: "",
      STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", STRIPE_PRO_MONTHLY_PRICE_ID: "", STRIPE_PRO_ANNUAL_PRICE_ID: "",
      UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "", DELIVERY_DEVICE_SECRET: crypto.randomUUID() + crypto.randomUUID() },
  });
  let health;
  for (let n = 0; n < 90; n++) {
    if (app.exitCode !== null) throw new Error("Isolated Next server exited during startup");
    try { health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }).then((r) => r.json()); if (health.data?.status === "ok") break; } catch { /* bounded startup */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  check("isolated application: real local Supabase, mock judging, no paid provider", health?.data?.services?.supabaseAdmin && !health.data.services.openai);
  failureStage = "integration";
  fixtureStarted = true;
  const audio = wav();
  async function session(pro = false) {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const email = `classic-http-${suffix}@example.invalid`;
    const password = crypto.randomUUID() + crypto.randomUUID();
    const created = await value(admin.auth.admin.createUser({ email, password, email_confirm: true }));
    users.push(created.user.id);
    if (pro) await value(admin.from("subscriptions").update({ tier: "pro", state: "active", current_period_end: new Date(Date.now() + 3600000).toISOString() }).eq("user_id", created.user.id));
    const jar = new Map();
    const client = createServerClient(supabaseUrl, anonKey, { cookies: { getAll: () => [...jar].map(([name, val]) => ({ name, value: val })), setAll: (items) => items.forEach(({ name, value: val }) => jar.set(name, val)) } });
    await value(client.auth.signInWithPassword({ email, password }));
    return { id: created.user.id, client, jar };
  }
  async function request(path, viewer, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("Origin", base);
    if (viewer?.jar.size) headers.set("Cookie", [...viewer.jar].map(([name, val]) => `${name}=${val}`).join("; "));
    const response = await fetch(`${base}${path}`, { ...init, headers, signal: AbortSignal.timeout(30000) });
    const body = await response.json();
    return { response, body };
  }
  function json(body, method = "POST") { return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }; }
  const owner = await session(true), rival = await session(), stranger = await session();
  check("real Auth cookies accepted by account HTTP", (await request("/api/account", owner)).body.user?.id === owner.id);
  const drawn = (await request("/api/prompts/random?maxRating=everyone&seed=step1c", owner)).body.data;
  check("catalog read through HTTP", Boolean(drawn?.prompt?.id && drawn.energy?.id));
  async function judge(viewer, key = crypto.randomUUID(), fields = {}, pair = drawn) {
    const form = new FormData();
    const entries = { promptId: pair.prompt.id, line: pair.prompt.line, energy: pair.energy.instruction, category: pair.prompt.category,
      mode: "classic", durationMs: "1000", attemptId: key, maxRating: "everyone", isPublic: "false", ...fields };
    for (const [name, val] of Object.entries(entries)) form.set(name, String(val));
    form.set("audio", new Blob([audio], { type: "audio/wav" }), "synthetic.wav");
    return request("/api/judge", viewer, { method: "POST", headers: { "Idempotency-Key": key }, body: form });
  }
  const guest = await judge(null);
  check("guest real HTTP transport with labeled ephemeral mock", guest.response.ok && guest.body.result.source === "fallback" && guest.body.delivery.persisted === false);
  const key = crypto.randomUUID();
  const concurrent = await Promise.all([judge(rival, key), judge(rival, key)]);
  const first = concurrent.find((r) => r.response.ok);
  check("concurrent request produces a successful receipt", Boolean(first));
  check("concurrent duplicate succeeds once or reports in-progress", concurrent.every((r) => r.response.ok || r.body.error?.code === "IDEMPOTENCY_IN_PROGRESS"));
  const retry = await judge(rival, key);
  check("lost-response retry replays same receipt and usage", retry.response.ok && retry.body.result.id === first.body.result.id && retry.body.usage.used === first.body.usage.used && retry.response.headers.get("Idempotency-Replayed") === "true");
  check("mock judging cannot create durable scores", first.body.delivery.persisted === false && (await value(admin.from("deliveries").select("id").eq("user_id", rival.id))).length === 0);
  const conflict = await judge(rival, key, { line: "Changed words must not reuse this receipt." });
  check("changed-body retry rejected", conflict.response.status === 409 && conflict.body.error?.code === "IDEMPOTENCY_CONFLICT");

  const today = new Date().toISOString().slice(0, 10);
  const beforeDaily = await value(admin.from("daily_challenges").select("*").eq("challenge_date", today).eq("market", "global").single());
  const daily1 = await request("/api/prompts/daily", owner), daily2 = await request("/api/prompts/daily", rival);
  const afterDaily = await value(admin.from("daily_challenges").select("*").eq("challenge_date", today).eq("market", "global").single());
  check("Daily HTTP reads preserve the existing database assignment", daily1.response.ok && daily2.response.ok && JSON.stringify(beforeDaily) === JSON.stringify(afterDaily) && daily1.body.data.prompt.id === daily2.body.data.prompt.id);
  const dailyTake = await judge(rival, crypto.randomUUID(), { mode: "daily", dailyDate: today, dailyMarket: "global" }, daily1.body.data);
  check("Daily request admitted but mock never creates ranked entry", dailyTake.response.ok && dailyTake.body.delivery.persisted === false);

  const invite = await request("/api/challenges", owner, json({ promptId: drawn.prompt.id, energyId: drawn.energy.id }));
  check("friend invite created through application HTTP", invite.response.status === 201 && Boolean(invite.body.data?.inviteUrl));
  const inviteUrl = new URL(invite.body.data.inviteUrl);
  const page = await fetch(inviteUrl, { headers: { Cookie: [...rival.jar].map(([name, val]) => `${name}=${val}`).join("; ") } });
  check("recipient opens real challenge page", page.ok && (await page.text()).includes(drawn.prompt.id));
  const challengeToken = inviteUrl.pathname.split(".").at(-1);
  const attempt = await judge(rival, crypto.randomUUID(), { mode: "challenge", challengeId: invite.body.data.id, challengeToken });
  check("challenge attempt admitted with mock result, no competitive completion", attempt.response.ok && attempt.body.delivery.persisted === false);

  // These direct setup writes deliberately do not claim judge→save validation.
  const active = await value(admin.from("prompts").select("*").eq("slug", drawn.prompt.id).single());
  const mature = (await value(admin.from("prompts").select("*").eq("rating", "mature").eq("state", "published").limit(1)))[0];
  const retired = (await value(admin.from("prompts").select("*").eq("draw_enabled", false).eq("state", "published").limit(1)))[0];
  const energy = await value(admin.from("energy_modifiers").select("*").eq("slug", drawn.energy.id).single());
  assert.ok(mature && retired, "Mature and historical catalog fixtures must exist after migrations/seed");
  const receipts = [];
  for (const prompt of [active, mature, retired]) {
    const id = crypto.randomUUID(), path = `${owner.id}/${id}.wav`;
    await value(admin.storage.from("delivery-audio").upload(path, audio, { contentType: "audio/wav" })); objects.push(path);
    await value(admin.from("deliveries").insert({ id, user_id: owner.id, prompt_id: prompt.id, energy_modifier_id: energy.id, state: "processing", visibility: "private", recording_path: path, mime_type: "audio/wav", duration_ms: 1000, byte_size: audio.length, transcript: prompt.body }));
    await value(admin.from("delivery_scores").insert({ delivery_id: id, overall: 50, commitment: 50, comedy: 50, accuracy: 50, chaos: 50, headline: "HTTP FIXTURE", verdict: "Synthetic setup receipt; no acting was evaluated.", rubric_version: "delivery-demo-v1", provider: "mock", model: "http-fixture", evidence: { scoring_version: "delivery-demo-v1", requested_energy: energy.instruction }, safety: {} }));
    receipts.push({ id, path, prompt });
  }
  const account = await request("/api/account", owner);
  check("history returns seeded private and retired receipts with mock labels", receipts.every((r) => account.body.history.some((h) => h.id === r.id && h.prompt.line === r.prompt.body && h.source === "fallback")));
  for (const receipt of receipts) {
    const owned = await request(`/api/deliveries/${receipt.id}`, owner);
    check(`private signed playback (${receipt.prompt === retired ? "retired" : receipt.prompt.rating})`, owned.response.ok && (await fetch(owned.body.data.audioUrl)).ok);
    check("anonymous owner-route access denied", (await request(`/api/deliveries/${receipt.id}`, null)).response.status === 401);
    check("other account owner-route access denied", (await request(`/api/deliveries/${receipt.id}`, stranger)).response.status === 404);
    check("private share URL denied", (await request(`/api/share/${receipt.id}`, null)).response.status === 404);
    check("private row hidden through real PostgREST RLS", (await value(stranger.client.from("deliveries").select("id").eq("id", receipt.id))).length === 0);
  }
  const matureReceipt = receipts[1];
  const publishMature = await request(`/api/deliveries/${matureReceipt.id}/visibility`, owner, json({ visibility: "public" }, "PATCH"));
  check("Mature publication rejected through HTTP", publishMature.response.status === 403 && publishMature.body.error?.code === "MATURE_PUBLICATION_UNAVAILABLE");
  const feed = await request("/api/feed", null);
  check("private Mature receipt absent from HTTP feed", feed.response.ok && !JSON.stringify(feed.body).includes(matureReceipt.id));
  const unsigned = await fetch(`${supabaseUrl}/storage/v1/object/public/delivery-audio/${receipts[0].path}`);
  check("raw private Storage public URL denied", !unsigned.ok);
  const expiring = await value(admin.storage.from("delivery-audio").createSignedUrl(receipts[0].path, 1));
  await new Promise((resolve) => setTimeout(resolve, 2200));
  check("expired Storage URL fails", !(await fetch(expiring.signedUrl)).ok);
  const refreshed = await request(`/api/deliveries/${receipts[0].id}`, owner);
  check("owner HTTP refresh restores playable signed URL", refreshed.response.ok && (await fetch(refreshed.body.data.audioUrl)).ok);
}

let passed = false;
try { await main(); passed = true; }
catch {
  // Never serialize SDK/provider error bodies or credentials.
  failureCode = failureStage === "preflight" ? "LOCAL_SUPABASE_PREFLIGHT_UNAVAILABLE" : "HTTP_INTEGRATION_ASSERTION_FAILED";
  console.error(failureCode);
}
finally {
  let cleanupPassed = true;
  if (admin) {
    if (objects.length) {
      try { const result = await admin.storage.from("delivery-audio").remove(objects); cleanupPassed &&= !result.error; } catch { cleanupPassed = false; }
    }
    for (const id of users) {
      try { const result = await admin.auth.admin.deleteUser(id); cleanupPassed &&= !result.error; } catch { cleanupPassed = false; }
    }
  }
  if (app) app.kill("SIGTERM");
  fs.mkdirSync("docs/evidence/classic-step-1c", { recursive: true });
  fs.writeFileSync(evidencePath, JSON.stringify({ kind: "supabase-http-integration-run", status: passed ? "passed" : fixtureStarted ? "failed" : "blocked-preflight", failureCode, executedAt: new Date().toISOString(), passed, cleanupPassed, checks,
    sample: fixtureStarted ? "one-second synthetic 440Hz PCM; no human acting evidence" : null, providerCalls: 0,
    boundary: "Real loopback HTTP/Auth/PostgREST/Storage only when passed; judge is mock and durable receipts are direct test setup fixtures",
    unresolved: ["Live audio judgment→save→ranked Daily/challenge completion", "Multi-instance distributed cache", "Human/device playback and recording", "Mature invite/recipient consent on real sessions", "Existing deployed rows before migration rollout"] }, null, 2) + "\n");
  console.log(JSON.stringify({ passed, cleanupPassed, checks: checks.length, evidencePath }));
  if (!passed || !cleanupPassed) process.exitCode = 1;
}
