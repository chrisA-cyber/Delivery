/** Bounded deployed transport/access check. Never calls a judge or paid provider.
 * Prepare: node scripts/verify-switch-rounds.mjs --prepare
 * Run only after deployment confirmation: node scripts/verify-switch-rounds.mjs --run --revision SHA
 * A failed run leaves private checkpoints in /tmp; --resume reuses passed calls.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const base = process.env.SWITCH_VERIFY_ORIGIN || "https://delivery-production-0577.up.railway.app";
const scratch = process.env.SWITCH_VERIFY_SCRATCH || "/tmp/delivery-switch-rounds";
const reportPath = path.resolve("docs/evidence/switch/live-rounds.json");
fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });
const fixture = path.join(scratch, "synthetic-transport.wav");
if (!fs.existsSync(fixture)) {
  // Offline synthetic voice: transport fixture only, no judgment/quality claim.
  const unit = path.join(scratch, "synthetic-unit.wav");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "flite=text='Not my problem.':voice=slt", "-af", "apad=whole_dur=4", "-t", "4", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", "-y", unit]);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-stream_loop", "4", "-i", unit, "-t", "20", "-c:a", "pcm_s16le", "-y", fixture]);
}
if (args.includes("--prepare")) { console.log("Prepared offline 20-second synthetic speech fixture; no HTTP calls."); process.exit(0); }
const revision = args[args.indexOf("--revision") + 1];
if (!args.includes("--run") || !args.includes("--revision") || !/^[a-f0-9]{7,40}$/.test(revision || "")) throw new Error("Run requires explicit --run --revision SHA after deployment confirmation.");
assert.equal(new URL(base).protocol, "https:");
const checkpointPath = path.join(scratch, "checkpoint.json");
const resume = args.includes("--resume");
if (!resume && fs.existsSync(checkpointPath)) throw new Error("Checkpoint exists; use --resume to avoid repeating successful live checks.");
const state = resume ? JSON.parse(fs.readFileSync(checkpointPath, "utf8")) : {
  base, startedAt: new Date().toISOString(), revisions: [], saved: {}, calls: [], assertions: [],
  ids: Object.fromEntries(["private", "community", "rematch", "p1", "p2", "replacement", "speed"].map((name) => [name, randomUUID()])),
};
assert.equal(state.base, base);
if (!state.revisions.includes(revision)) state.revisions.push(revision);
const persist = () => fs.writeFileSync(checkpointPath, JSON.stringify(state), { mode: 0o600 });
persist();
const safeRoute = (route) => route.split("?")[0].replace(/[A-Za-z0-9_-]{43}/g, "CAPABILITY").replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, "ID");
const check = (name, condition) => {
  assert.ok(condition, name);
  if (!state.assertions.includes(name)) state.assertions.push(name);
  persist();
};
function call(name, actor, route, options = {}) {
  if (state.saved[name]) return state.saved[name];
  if (state.calls.length >= 50) throw new Error("The 50-request live-check cap was reached. Do not repeat passed checks.");
  if (/judge|score|speech|moderation/.test(route)) throw new Error("Paid evaluation routes are prohibited in this verifier.");
  const method = options.method || (options.body || options.form ? "POST" : "GET");
  const jar = path.join(scratch, `${actor}.cookies`);
  if (!fs.existsSync(jar)) fs.writeFileSync(jar, "", { mode: 0o600 });
  const bodyPath = path.join(scratch, "response.body");
  const headerPath = path.join(scratch, "response.headers");
  const curl = ["--silent", "--show-error", "--max-time", "50", "--retry", "0", "--request", method, "--cookie", jar, "--cookie-jar", jar, "--header", `Origin: ${base}`, "--output", bodyPath, "--dump-header", headerPath, "--write-out", "%{http_code}"];
  if (options.body) curl.push("--header", "Content-Type: application/json", "--data-binary", JSON.stringify(options.body));
  if (options.form) {
    for (const [key, value] of Object.entries(options.form)) curl.push("--form-string", `${key}=${value}`);
    curl.push("--form", `audio=@${fixture};type=audio/wav;filename=synthetic-transport.wav`);
  }
  if (options.range) curl.push("--header", "Range: bytes=0-43");
  curl.push(base + route);
  const started = performance.now();
  let status = 0;
  try { status = Number(execFileSync("curl", curl, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 })); }
  catch { /* Record transport failure without exposing URLs or cookies. */ }
  const record = { name, actor, method, route: safeRoute(route), status, expected: options.expect ?? 200, ms: Math.round(performance.now() - started), revision };
  state.calls.push(record);
  console.log(`${state.calls.length}. ${name}: ${status}`);
  persist();
  assert.equal(status, record.expected, `${name}: unexpected HTTP status`);
  const bytes = fs.readFileSync(bodyPath);
  let result;
  if (options.range) {
    const headers = fs.readFileSync(headerPath, "utf8");
    result = { bytes: bytes.length, riff: bytes.subarray(0, 4).toString() === "RIFF", contentRange: /content-range:\s*bytes 0-43\/\d+/i.test(headers) };
    check(`${name}: valid seekable WAV range`, result.bytes === 44 && result.riff && result.contentRange);
  } else {
    const json = JSON.parse(bytes.toString());
    result = json.data ?? json;
    if (status >= 400) record.errorCode = json.error?.code ?? null;
  }
  state.saved[name] = result;
  persist();
  return result;
}
const roundRoute = (r) => `/api/rounds/${r.token}`;
const action = (name, actor, r, verb, body = {}, expect = 200) => call(name, actor, `${roundRoute(r)}/${verb}`, { body: { maxRating: "everyone", ...body }, expect }).round;
const createInput = (key, challenge, community = false) => ({ requestId: state.ids[key], name: `Engineering fixture: Switch ${community ? "community" : "friends"}`, displayName: "Fixture host", mode: "switch", challengeId: challenge.id, challengeVersion: challenge.version, closesInHours: 1, maxRating: "everyone", community, submissionLimit: 10, audienceVoting: true });
const upload = (name, actor, r, key, expect = 201) => call(name, actor, "/api/switch/attempts", { expect, form: { attemptId: state.ids[key], challengeId: r.assignment.challenge.id, challengeVersion: r.assignment.challenge.version, durationMs: "20000", recordingOffsetMs: "0", maxRating: "everyone", shareAudio: "false", roundToken: r.token } }).attempt;
const submit = (name, actor, r, attempt, broadcast = false, expect = 200) => action(name, actor, r, "submit", { switchAttemptId: attempt.id, consent: true, ...(broadcast ? { broadcastConsent: true } : {}) }, expect);
const snapshot = (name, actual, expected) => { assert.deepEqual(actual, expected, name); check(name, true); };
let passed = false;
let failure = null;
try {
  const catalog = call("catalog includes both Switch variants", "host", "/api/switch/catalog?maxRating=everyone");
  check("catalog offers eight unranked beta challenges", catalog.challenges.length === 8 && catalog.beta === true && catalog.ranked === false);
  const emotion = catalog.challenges.find((item) => item.id === "not-my-problem");
  const speed = catalog.challenges.find((item) => item.id === "speed-not-my-problem");
  check("emotion and speed use the same short phrase with five immutable cues", emotion.kind === "emotion" && speed.kind === "speed" && [emotion, speed].every((c) => c.cues.length === 5 && new Set(c.cues.map((cue) => cue.text)).size === 1));
  check("speed snapshot has requested ratios", JSON.stringify(speed.cues.map((cue) => cue.speed)) === "[1,0.5,0.25,2,4]");
  const privateRound = call("create private emotion round", "host", "/api/rounds", { body: createInput("private", emotion), expect: 201 }).round;
  snapshot("private invitation has exact catalog snapshot", privateRound.assignment.challenge, emotion);
  const privateP1 = action("first guest joins private round", "performer1", privateRound, "join", { displayName: "Fixture one" });
  action("second guest joins private round", "performer2", privateRound, "join", { displayName: "Fixture two" });
  const first = upload("upload first continuous take", "performer1", privateRound, "p1");
  const duplicate = upload("duplicate upload returns existing take", "performer1", privateRound, "p1", 200);
  check("upload retry keeps one immutable attempt", first.id === duplicate.id && first.recordingOffsetMs === 0 && first.score === null);
  snapshot("saved attempt contains exact cue snapshot", first.challenge, emotion);
  const reopened = call("guest reopens persisted private take", "performer1", `/api/switch/attempts/${first.id}`).attempt;
  snapshot("reopened take preserves cue timeline", reopened.challenge, first.challenge);
  call("foreign guest cannot read private attempt audio", "performer2", `/api/switch/attempts/${first.id}/audio`, { expect: 404 });
  submit("first guest submits private take", "performer1", privateRound, first);
  const second = upload("second guest records matching take", "performer2", privateRound, "p2");
  submit("second guest submits private take", "performer2", privateRound, second);
  call("private performance hidden before reveal", "performer2", `${roundRoute(privateRound)}/performances/${privateP1.viewerMemberId}/audio`, { expect: 404 });
  const revealed = action("host reveals private round", "host", privateRound, "close");
  check("private reveal exposes both unscored performances", revealed.members.filter((m) => m.performance?.mode === "switch" && m.performance.scoreGroup === "unscored").length === 2);
  call("friend seeks revealed Switch audio", "performer2", `${roundRoute(privateRound)}/performances/${privateP1.viewerMemberId}/audio`, { range: true, expect: 206 });

  const community = call("create community with equivalent emotion snapshot", "host", "/api/rounds", { body: createInput("community", emotion, true), expect: 201 }).round;
  snapshot("community assignment equals private assignment", community.assignment, privateRound.assignment);
  const p1 = action("first guest joins community", "performer1", community, "join", { displayName: "Fixture one" }).viewerMemberId;
  const p2 = action("second guest joins community", "performer2", community, "join", { displayName: "Fixture two" }).viewerMemberId;
  submit("community rejects missing broadcast consent", "performer1", community, first, false, 422);
  submit("reuse equivalent private take with broadcast consent", "performer1", community, first, true);
  action("host selects consented first take", "host", community, "select", { memberId: p1 });
  const replacement = upload("record full replacement take", "performer1", community, "replacement");
  const replaced = submit("replace submission with full new take", "performer1", community, replacement, true);
  check("replacement clears previous showcase selection", !replaced.community.selectedIds.includes(p1));
  submit("stale submission retry cannot overwrite replacement", "performer1", community, first, true, 409);
  submit("second guest reuses equivalent take", "performer2", community, second, true);
  action("host selects replacement", "host", community, "select", { memberId: p1 });
  call("host previews private consented Switch audio", "host", `${roundRoute(community)}/performances/${p1}/audio`, { range: true, expect: 206 });
  action("host closes community submissions", "host", community, "close");
  const displayToken = community.community.displayUrl.split("/").pop();
  const displayPath = `/api/broadcast/${displayToken}`;
  const review = call("broadcast hides private review queue", "audience", displayPath).round;
  check("review contains no private performer media", review.members.length === 0 && !review.isHost && !review.community.displayUrl);
  action("host starts selected showcase", "host", community, "showcase");
  const showcase = call("broadcast presents exact Switch cue snapshot", "audience", displayPath).round;
  check("broadcast includes only selected performance", showcase.members.length === 1 && showcase.members[0].id === p1);
  snapshot("broadcast replay snapshot matches original recording", showcase.members[0].performance.switchAttempt.challenge, replacement.challenge);
  check("broadcast uses dedicated audio capability", showcase.members[0].performance.switchAttempt.audioUrl.startsWith(displayPath + "/audio/"));
  call("broadcast seeks selected recording", "audience", `${displayPath}/audio/${p1}`, { range: true, expect: 206 });
  call("broadcast rejects unselected recording", "audience", `${displayPath}/audio/${p2}`, { expect: 404 });
  action("audience joins without recording", "audience", community, "join", { displayName: "Fixture audience" });
  action("host controls Switch display playback", "host", community, "display", { memberId: p1, command: "play", revision: showcase.community.revision });
  action("host opens audience voting", "host", community, "start-voting");
  action("performer cannot vote for self", "performer1", community, "vote", { memberId: p1 }, 409);
  action("audience chooses selected performer", "audience", community, "vote", { memberId: p1 });
  // One retry is intentional; database primary key retains one effective vote.
  action("duplicate audience vote remains one effective vote", "audience", community, "vote", { memberId: p1 });
  const results = action("host closes audience voting", "host", community, "end-voting");
  check("audience result is one vote with no invented judge score", results.members.find((m) => m.id === p1)?.votes === 1 && results.members.find((m) => m.id === p1)?.performance.score === null);
  action("late audience vote rejected", "audience", community, "vote", { memberId: p1 }, 409);
  const rematchInput = createInput("rematch", speed, true);
  const next = call("host rematches into speed Switch", "host", `${roundRoute(community)}/rematch`, { body: rematchInput, expect: 201 }).round;
  const retryNext = call("rematch retry reuses the same next round", "host", `${roundRoute(community)}/rematch`, { body: rematchInput, expect: 201 }).round;
  check("rematch is linked and duplicate safe", next.id === retryNext.id && next.previousRoundId === community.id);
  snapshot("speed rematch invitation preserves exact ratios and timings", next.assignment.challenge, speed);
  action("guest joins speed rematch", "performer1", next, "join", { displayName: "Fixture one" });
  const speedTake = upload("upload continuous speed transport take", "performer1", next, "speed");
  snapshot("speed recording stores its immutable invitation snapshot", speedTake.challenge, speed);
  submit("submit speed performance", "performer1", next, speedTake, true);
  call("owner deletes submitted speed source", "performer1", `/api/switch/attempts/${speedTake.id}`, { method: "DELETE" });
  const afterDelete = call("deletion removes host playback without fallback", "host", roundRoute(next)).round;
  check("deleted source has no accessible performance", afterDelete.members.every((m) => !m.performance));
  call("delete original source from both rounds", "performer1", `/api/switch/attempts/${first.id}`, { method: "DELETE" });
  call("delete replacement source", "performer1", `/api/switch/attempts/${replacement.id}`, { method: "DELETE" });
  call("delete second performer source", "performer2", `/api/switch/attempts/${second.id}`, { method: "DELETE" });
  passed = true;
} catch (error) {
  failure = { code: error.code || "VERIFY_FAILED", message: String(error.message).replace(/[A-Za-z0-9_-]{43}/g, "CAPABILITY") };
  console.error(failure.message);
  process.exitCode = 1;
} finally {
  const report = {
    kind: "deployed-switch-guest-round-verification", origin: base, startedAt: state.startedAt, finishedAt: new Date().toISOString(),
    deploymentRevisions: state.revisions, passed, requestCount: state.calls.length, requestCap: 50,
    fixture: { kind: "offline ffmpeg flite synthetic transport speech", durationSeconds: 20, sha256: createHash("sha256").update(fs.readFileSync(fixture)).digest("hex") },
    paidCalls: 0, providerSpendUsd: 0, assertions: state.assertions, checks: state.calls,
    limitations: ["Unjudged transport fixture; no tone, transition, speed or score-quality claim.", "HTTP/SQL evidence does not demonstrate real OAuth, physical phone capture or audible OBS playback."],
    ...(failure ? { failure } : {}),
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  persist();
}
