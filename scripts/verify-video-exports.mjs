/** Bounded live export verification. Zero judge, transcription, or paid-provider calls.
 * Prepare after offline render fixtures exist: node scripts/verify-video-exports.mjs --prepare
 * Run only once the revision is deployed: node scripts/verify-video-exports.mjs --run --revision SHA
 * A failed run keeps owner cookies/private checkpoints in /tmp; --resume reuses completed work.
 * --keep-fixtures leaves the four disposable attempts for UI checks; --cleanup removes them later.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const base = process.env.VIDEO_VERIFY_ORIGIN || "https://delivery-production-0577.up.railway.app";
const scratch = process.env.VIDEO_VERIFY_SCRATCH || "/tmp/delivery-video-verification";
const fixtures = process.env.VIDEO_VERIFY_FIXTURES || "/tmp/delivery-video-samples";
const reportPath = path.resolve("docs/evidence/video-exports/live-exports.json");
const checkpointPath = path.join(scratch, "checkpoint.json");
fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });
const manifest = JSON.parse(fs.readFileSync("src/lib/say-it-back/catalog.json", "utf8"));
const sayClip = manifest.find((clip) => clip.id === "hgf-perfect-fiance");
assert.ok(sayClip, "Longer reusable scene exists in the immutable catalog");
const probe = (file) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", file], { encoding: "utf8" }));
const fixtureConfig = [
  { key: "emotion", mode: "switch", path: path.join(fixtures, "emotion.wav"), challengeId: "not-my-problem", expectedDuration: 20 },
  { key: "speed", mode: "switch", path: path.join(fixtures, "speed.wav"), challengeId: "speed-not-my-problem", expectedDuration: 20 },
  { key: "say", mode: "say-it-back", path: path.join(fixtures, "say-retake.wav"), clip: sayClip, roleId: "walter", expectedDuration: sayClip.duration },
];
function verifyFixtures() {
  const evidence = JSON.parse(fs.readFileSync(path.join(fixtures, "fixtures.json"), "utf8"));
  const retake = evidence.partialRetake;
  assert.ok(retake && retake.outsideChanges === 0 && retake.retakeChanges > 0, "Partial retake changes only its actual line window");
  const actualHash = createHash("sha256").update(fs.readFileSync(path.join(fixtures, "say-retake.wav"))).digest("hex");
  assert.equal(actualHash, retake.assembledSha256, "Live Say fixture is the verified assembled partial retake");
  for (const fixture of fixtureConfig) {
    assert.ok(fs.existsSync(fixture.path), `Prepare ${fixture.key} offline speech fixture first`);
    assert.ok(Math.abs(Number(probe(fixture.path).format.duration) - fixture.expectedDuration) < 0.12, `${fixture.key} source has exact scene/cue duration`);
  }
}
if (args.includes("--prepare")) { verifyFixtures(); console.log("Prepared verifier paths and validated three offline fixtures. No HTTP calls or AI calls."); process.exit(0); }
const revision = args[args.indexOf("--revision") + 1];
if ((!args.includes("--run") && !args.includes("--cleanup")) || !args.includes("--revision") || !/^[a-f0-9]{7,40}$/.test(revision || "")) throw new Error("Use --run or --cleanup with --revision SHA only after deployment confirmation.");
assert.equal(new URL(base).protocol, "https:");
const resume = args.includes("--resume") || args.includes("--cleanup");
if (!resume && fs.existsSync(checkpointPath)) throw new Error("A checkpoint exists. Use --resume; do not repeat completed live checks.");
const state = resume ? JSON.parse(fs.readFileSync(checkpointPath, "utf8")) : {
  base, startedAt: new Date().toISOString(), revisions: [], saved: {}, calls: [], assertions: [], samples: [],
  ids: Object.fromEntries(["classic", "emotion", "speed", "say", "delete"].map((key) => [key, randomUUID()])),
};
assert.equal(state.base, base);
if (!state.revisions.includes(revision)) state.revisions.push(revision);
const persist = () => fs.writeFileSync(checkpointPath, JSON.stringify(state), { mode: 0o600 });
persist();
const safeRoute = (route) => route.split("?")[0].replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, "ID");
function check(name, value) { assert.ok(value, name); if (!state.assertions.includes(name)) state.assertions.push(name); persist(); }
function snapshot(name, actual, expected) { assert.deepEqual(actual, expected, name); check(name, true); }
function call(name, actor, route, options = {}) {
  if (!options.fresh && state.saved[name]) return state.saved[name];
  if (state.calls.length >= 180) throw new Error("The 180-request hard cap was reached. Reuse checkpoints and investigate the incomplete job.");
  if (!route.startsWith("/") || /judge|scor(?:e|ing)|speech|moderation|transcri/i.test(route)) throw new Error("This verifier only allows local gameplay and export routes; paid calls are prohibited.");
  const method = options.method || (options.form || options.body ? "POST" : "GET");
  const jar = path.join(scratch, `${actor}.cookies`);
  if (!fs.existsSync(jar)) fs.writeFileSync(jar, "", { mode: 0o600 });
  const bodyPath = options.download || path.join(scratch, "response.body");
  const headersPath = path.join(scratch, "response.headers");
  const command = ["--silent", "--show-error", "--max-time", "50", "--retry", "0", "--request", method, "--cookie", jar, "--cookie-jar", jar, "--header", `Origin: ${base}`, "--output", bodyPath, "--dump-header", headersPath, "--write-out", "%{http_code}"];
  if (options.body) command.push("--header", "Content-Type: application/json", "--data-binary", JSON.stringify(options.body));
  if (options.form) {
    for (const [key, value] of Object.entries(options.form)) command.push("--form-string", `${key}=${value}`);
    command.push("--form", `audio=@${options.audio};type=audio/wav;filename=disposable-performance.wav`);
  }
  if (options.range) command.push("--header", "Range: bytes=0-63");
  command.push(base + route);
  const started = performance.now();
  let status = 0;
  try { status = Number(execFileSync("curl", command, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 })); } catch { /* Record failure without printing cookies or signed media capabilities. */ }
  const headers = fs.readFileSync(headersPath, "utf8");
  const bytes = fs.readFileSync(bodyPath);
  let parsed = null;
  if (!options.download && !options.range && !options.html) { try { parsed = JSON.parse(bytes.toString()); } catch { /* Unexpected HTML/transport will fail below. */ } }
  const entry = { name, actor, method, route: safeRoute(route), status, expected: options.expect ?? 200, ms: Math.round(performance.now() - started), revision, ...(status >= 400 ? { errorCode: parsed?.error?.code ?? null } : {}) };
  state.calls.push(entry); persist(); console.log(`${state.calls.length}. ${name}: ${status}`);
  assert.ok((Array.isArray(entry.expected) ? entry.expected : [entry.expected]).includes(status), `${name}: unexpected status ${status} (${entry.errorCode || "no error code"})`);
  let result;
  if (options.download) {
    check(`${name}: private attachment headers`, /content-type:\s*video\/mp4/i.test(headers) && /cache-control:\s*private,\s*no-store/i.test(headers) && /content-disposition:\s*attachment/i.test(headers));
    result = { file: bodyPath, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  } else if (options.range) {
    check(`${name}: seekable private MP4`, bytes.length === 64 && /content-range:\s*bytes 0-63\/\d+/i.test(headers) && /cache-control:\s*private,\s*no-store/i.test(headers));
    result = { bytes: bytes.length };
  } else if (options.html) result = { bytes: bytes.length, isHtml: /<!doctype html/i.test(bytes.toString()) };
  else { assert.ok(parsed, `${name}: structured response`); result = parsed.data ?? parsed; }
  if (!options.fresh) { state.saved[name] = result; persist(); }
  return result;
}
const attemptRoute = (mode, id) => `/api/${mode === "classic" ? "classic" : mode}/attempts/${id}`;
const requestOptions = (mode, id, includeName = true, includeScore = true) => ({ mode, attemptId: id, includeName, includeScore, maxRating: "everyone" });
const request = (name, actor, input) => call(name, actor, "/api/exports", { expect: 202, body: input }).export;
async function waitReady(key, actor, job) {
  if (state.saved[`${key}:ready`]) return state.saved[`${key}:ready`];
  const started = Date.now(); let latest = job;
  while (latest.status !== "ready" && Date.now() - started < 5 * 60_000) {
    assert.ok(["queued", "rendering"].includes(latest.status), `${key}: job ended with ${latest.status}`);
    await new Promise((resolve) => setTimeout(resolve, 4500));
    latest = call(`${key}:poll`, actor, `/api/exports/${job.id}`, { fresh: true }).export;
  }
  assert.equal(latest.status, "ready", `${key}: five-minute render bound reached; keep the checkpoint and inspect this job`);
  latest.observedWaitMs = Date.now() - started;
  state.saved[`${key}:ready`] = latest; persist(); return latest;
}
function inspectFile(key, file, duration) {
  const info = probe(file), video = info.streams.find((stream) => stream.codec_type === "video"), audio = info.streams.find((stream) => stream.codec_type === "audio");
  check(`${key}: H.264/AAC 1080x1920 with preserved duration`, video?.codec_name === "h264" && video.width === 1080 && video.height === 1920 && audio?.codec_name === "aac" && Math.abs(Number(info.format.duration) - duration) < 0.15);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-f", "null", "-"], { stdio: "pipe", timeout: 60000 });
  check(`${key}: complete video and audio decode`, true);
  return { duration: Number(info.format.duration), videoCodec: video.codec_name, audioCodec: audio.codec_name, width: video.width, height: video.height, channels: audio.channels, sampleRate: Number(audio.sample_rate) };
}
function cleanup() {
  for (const key of ["classic", "emotion", "speed", "say"]) {
    const saved = state.saved[`${key}:upload`]?.attempt;
    if (!saved) continue;
    const mode = key === "classic" ? "classic" : key === "say" ? "say-it-back" : "switch";
    call(`${key}:cleanup`, key, attemptRoute(mode, saved.id), { method: "DELETE" });
    const job = state.saved[`${key}:create`]?.export;
    if (job) call(`${key}:deleted-video-denied`, key, `/api/exports/${job.id}/video`, { expect: 404 });
  }
  state.cleanedAt = new Date().toISOString(); persist();
}
let failure = null;
try {
  if (args.includes("--cleanup")) cleanup();
  else {
    verifyFixtures();
    const selected = call("classic:assignment", "classic", "/api/prompts/random?maxRating=everyone&seed=video-export-verification");
    const classicPath = path.join(scratch, "classic.wav");
    if (!fs.existsSync(classicPath)) {
      const speechPath = path.join(scratch, "classic-phrase.txt");
      fs.writeFileSync(speechPath, selected.prompt.line);
      execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", `flite=textfile=${speechPath}:voice=slt`, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", "-y", classicPath]);
    }
    const classicDuration = Number(probe(classicPath).format.duration);
    check("classic: exact spoken source remains within the recording limit", classicDuration <= 20);
    const catalog = call("switch:catalog", "emotion", "/api/switch/catalog?maxRating=everyone");
    const samples = [{ key: "classic", mode: "classic", path: classicPath, expectedDuration: classicDuration }, ...fixtureConfig];
    for (const item of samples) {
      const form = { attemptId: state.ids[item.key], durationMs: String(Math.round(item.expectedDuration * 1000)), maxRating: "everyone" };
      if (item.mode === "classic") Object.assign(form, { promptId: selected.prompt.id, promptText: selected.prompt.line, energy: selected.energy.instruction, category: selected.prompt.category, mode: "classic", displayName: "Delivery test voice" });
      if (item.mode === "switch") {
        item.challenge = catalog.challenges.find((challenge) => challenge.id === item.challengeId);
        assert.ok(item.challenge, "Exact Switch fixture exists");
        Object.assign(form, { challengeId: item.challenge.id, challengeVersion: item.challenge.version, recordingOffsetMs: "0", shareAudio: "false" });
      }
      if (item.mode === "say-it-back") Object.assign(form, { clipId: item.clip.id, clipVersion: item.clip.version, roleId: item.roleId, recordingOffsetMs: "0", shareAudio: "false" });
      const attempt = call(`${item.key}:upload`, item.key, `/api/${item.mode}/attempts`, { expect: [200, 201], form, audio: item.path }).attempt;
      check(`${item.key}: upload-only without fabricated result`, attempt.score === null && attempt.owned === true);
      const input = requestOptions(item.mode, attempt.id, item.key !== "emotion", item.key !== "emotion");
      const job = request(`${item.key}:create`, item.key, input);
      const repeat = request(`${item.key}:idempotent`, item.key, input);
      check(`${item.key}: exact request reuses one job`, repeat.id === job.id);
      const list = call(`${item.key}:reopen`, item.key, `/api/exports?mode=${item.mode}&attemptId=${attempt.id}&maxRating=everyone`);
      check(`${item.key}: saved attempt recovers its job`, list.eligible === true && list.exports.some((entry) => entry.id === job.id));
      call(`${item.key}:outsider-collection`, "outsider", `/api/exports?mode=${item.mode}&attemptId=${attempt.id}`, { expect: 404 });
      call(`${item.key}:outsider-id`, "outsider", `/api/exports/${job.id}`, { expect: 404 });
      call(`${item.key}:outsider-media`, "outsider", `/api/exports/${job.id}/video`, { expect: 404 });
      call(`${item.key}:outsider-create`, "outsider", "/api/exports", { expect: 404, body: input });
      const ready = await waitReady(item.key, item.key, job);
      check(`${item.key}: score/name options retained`, ready.includeName === input.includeName && ready.includeScore === input.includeScore);
      call(`${item.key}:seek`, item.key, ready.videoUrl, { expect: 206, range: true });
      const downloaded = call(`${item.key}:download`, item.key, `${ready.videoUrl}?download=1`, { download: path.join(scratch, `${item.key}.mp4`) });
      const media = inspectFile(item.key, downloaded.file, item.expectedDuration);
      const invitation = new URL(ready.assignmentUrl);
      check(`${item.key}: invitation has only a public assignment code`, invitation.hostname === "deliverygame.netlify.app" && /^\/a\/[a-f0-9]{12}$/.test(invitation.pathname) && !invitation.search);
      const publicData = call(`${item.key}:public-assignment`, "outsider", `/api/assignments/${invitation.pathname.split("/").at(-1)}?maxRating=everyone`);
      const expected = item.mode === "classic" ? attempt.assignment : item.mode === "switch" ? { mode: "switch", challenge: attempt.challenge, rating: attempt.challenge.rating, scoringVersion: attempt.scoringVersion, rubricVersion: attempt.challenge.rubricVersion } : { mode: "say-it-back", clip: attempt.clip, roleId: attempt.roleId, rating: attempt.clip.rating, scoringVersion: attempt.scoringVersion };
      snapshot(`${item.key}: invitation preserves exact assignment and rules`, publicData.assignment, expected);
      const page = call(`${item.key}:playable-entry`, "outsider", invitation.pathname, { html: true });
      check(`${item.key}: public playable page responds`, page.isHtml);
      if (!state.samples.some((entry) => entry.key === item.key)) state.samples.push({ key: item.key, ...media, bytes: downloaded.bytes, sha256: downloaded.sha256, observedRenderWaitMs: ready.observedWaitMs, assignmentUrl: ready.assignmentUrl, localFile: downloaded.file, syntheticVoice: "offline libflite stock voice", score: null, ...(item.key === "say" ? { partialRetake: "assembled offline with the same line-window/boundary-fade strategy as saved in-app line takes" } : {}) });
      persist();
    }
    const first = state.saved["classic:upload"].attempt;
    call("deletion:outsider-denied", "outsider", attemptRoute("classic", first.id), { method: "DELETE", expect: 404 });
    // Delete a separate queued/rendering source and confirm access/retry rejection.
    // SQL worker tests cover the atomic publication fence after deletion.
    const originalForm = { attemptId: state.ids.delete, durationMs: String(Math.round(classicDuration * 1000)), promptId: selected.prompt.id, promptText: selected.prompt.line, energy: selected.energy.instruction, mode: "classic", maxRating: "everyone", displayName: "Disposable deletion check" };
    const disposable = call("deletion:upload", "delete", "/api/classic/attempts", { expect: [200, 201], form: originalForm, audio: classicPath }).attempt;
    const deletionJob = request("deletion:create", "delete", requestOptions("classic", disposable.id, false, false));
    call("deletion:owner-removes-source", "delete", attemptRoute("classic", disposable.id), { method: "DELETE" });
    call("deletion:job-now-unavailable", "delete", `/api/exports/${deletionJob.id}`, { expect: 404 });
    call("deletion:video-now-unavailable", "delete", `/api/exports/${deletionJob.id}/video`, { expect: 404 });
    call("deletion:cannot-create-again", "delete", "/api/exports", { expect: 404, body: requestOptions("classic", disposable.id, false, false) });
    if (!args.includes("--keep-fixtures")) cleanup();
    state.passedAt = new Date().toISOString(); persist();
  }
} catch (error) { failure = error instanceof Error ? error.message : "Live verification interrupted"; console.error(failure); process.exitCode = 1; }
finally {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify({ origin: base, startedAt: state.startedAt, revisions: state.revisions, passed: Boolean(state.passedAt) && !failure, failure, calls: state.calls, assertions: state.assertions, samples: state.samples, fixtureCleanup: state.cleanedAt ? "removed through owner endpoints" : "private disposable fixtures retained for UI checks; --cleanup required", limitations: ["No physical phone share-sheet test or audible OBS acceptance.", "HTTP/decoded files cannot prove a native platform publication.", "Unscored fixtures intentionally contain no score; visible-score rendering is covered by deterministic local fixtures, never fabricated saved scores."], paidCalls: 0, testingBudgetBound: "$2.675 / $5 (unchanged)" }, null, 2)}\n`);
  console.log(`Sanitized evidence written to ${reportPath}`);
}
