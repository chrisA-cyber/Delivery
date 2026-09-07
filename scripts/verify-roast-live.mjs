/** One explicitly gated, disposable Roast Off transport acceptance session.
 * Run inside the deployed app with its existing environment. The ordinary HTTP
 * APIs, real Supabase password sign-in and app-issued SFU tokens are the only
 * path into the room. Native generated media does not verify browser devices.
 * No account roles, provider permissions, application state or clocks are edited.
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { RoomServiceClient } from "livekit-server-sdk";
import { createRoastRtcClients } from "./roast-rtc-clients.mjs";

const runId = process.env.ROAST_VERIFY_RUN_ID;
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId || "")) {
  throw new Error("A valid explicit ROAST_VERIFY_RUN_ID is required.");
}
const beganAt = Date.now();
const workDeadline = beganAt + 6 * 60_000;
const hardDeadline = beganAt + 8 * 60_000;
const evidence = {
  runId, startedAt: new Date(beganAt).toISOString(), success: false, checks: [],
  method: "Real application HTTP, ordinary Supabase password-auth cookie jars, native LiveKit RTC with generated audio/video; no browser or physical capture.",
  limits: { maxHttpCalls: 400, maxNativeClients: 5, mainMinutes: 6, hardMinutesIncludingCleanup: 8, maxParticipantMinutes: 40 },
  httpCalls: { application: 0, auth: 0, providerRead: 0 }, phases: [], cleanup: { roomClosed: false, mediaRoomReleased: false, usersCreated: 0, usersDeleted: 0 },
};
const fixtures = [];
const people = [];
let admin, suite, host, roomId, invitation, mediaRoomName;
let cleanup = false, stopping = false, heartbeatTimer, heartbeatWork = Promise.resolve(), heartbeatBusy = false;
let heartbeatFailure = null, requestChain = Promise.resolve(), lastPhase = null, snapshot = null;
let stage = "preflight", wroteReport = false;

function totalCalls() { return Object.values(evidence.httpCalls).reduce((sum, count) => sum + count, 0); }
function guard(cleanupMode = false) {
  // Cancellation remains permanent for the main flow. Only explicitly marked
  // cleanup calls may proceed after an unexpected native callback failure.
  if (Date.now() >= hardDeadline || (!cleanupMode && (stopping || Date.now() >= workDeadline))) throw new Error("VERIFY_TIME_LIMIT");
  if (totalCalls() >= (cleanupMode ? 400 : 380)) throw new Error("VERIFY_HTTP_LIMIT");
}
function check(name, condition, detail) {
  assert.ok(condition, name);
  evidence.checks.push({ name, passed: true, ...(detail === undefined ? {} : { detail }) });
}
function safeError(error) {
  // Never log SDK errors or response bodies: either can contain private tokens.
  if (error?.name === "AssertionError") return { code: "VERIFY_ASSERTION", check: String(error.message).split("\n")[0].slice(0, 180) };
  return { code: /^[A-Z0-9_:-]{1,100}$/.test(error?.message || "") ? error.message : "VERIFY_OPERATION_FAILED" };
}
function writeReport() {
  if (wroteReport) return;
  wroteReport = true;
  evidence.endedAt = new Date().toISOString();
  evidence.elapsedMs = Date.now() - beganAt;
  evidence.totalHttpCalls = totalCalls();
  evidence.cleanup.remainingFixtureUserIds = fixtures.filter(f => !f.deleted).map(f => f.id);
  const text = JSON.stringify(evidence);
  writeFileSync(`/tmp/roast-live-${runId}.json`, text + "\n", { mode: 0o600 });
  process.stdout.write(`ROAST_VERIFY_RESULT ${text}\n`);
}
const hardTimer = setTimeout(() => {
  evidence.success = false;
  evidence.failure ??= { stage, code: "VERIFY_HARD_TIMEOUT" };
  writeReport();
  process.exit(1);
}, hardDeadline - Date.now());

const target = new URL(process.env.ROAST_VERIFY_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && target.protocol === "http:" && target.pathname === "/" && !target.username && !target.password, "Verifier target must be this app's loopback origin");
const base = target.origin;
const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || base).origin;
const makeAuthFetch = (cleanupMode = false) => async (input, init = {}) => {
  guard(cleanupMode); evidence.httpCalls.auth++;
  return fetch(input, { ...init, signal: AbortSignal.timeout(Math.min(10_000, hardDeadline - Date.now())) });
};
const authFetch = makeAuthFetch();
function absorbCookies(person, response) {
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";", 1)[0]; const equals = pair.indexOf("=");
    if (equals > 0) person.jar.set(pair.slice(0, equals), pair.slice(equals + 1));
  }
}
async function request(person, path, body, expected = [200], { raw = false, cleanupMode = false } = {}) {
  const execute = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      guard(cleanupMode); evidence.httpCalls.application++;
      const headers = { Origin: origin, "Content-Type": "application/json" };
      if (person?.jar.size) headers.Cookie = [...person.jar].map(([key, value]) => `${key}=${value}`).join("; ");
      const response = await fetch(`${base}${path}`, { method: body ? "POST" : "GET", headers,
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(Math.min(10_000, hardDeadline - Date.now())) });
      if (person) absorbCookies(person, response);
      const payload = await response.json();
      if (response.status === 409 && payload.error?.code === "ROAST_BUSY" && attempt < 2) { await delay(800 * (attempt + 1)); continue; }
      if (!expected.includes(response.status)) throw new Error(`HTTP_${response.status}:${String(payload.error?.code || "UNEXPECTED").replace(/[^A-Z0-9_]/g, "").slice(0, 65)}`);
      if (raw) return { status: response.status, data: payload.data, code: payload.error?.code };
      return payload.data;
    }
    throw new Error("VERIFY_BUSY_RETRIES_EXHAUSTED");
  };
  // Browser commands would overlap; this bounded verifier avoids creating its
  // own lease contention while the autonomous worker continues independently.
  const pending = requestChain.catch(() => {}).then(execute);
  requestChain = pending.catch(() => {});
  return pending;
}
const roomPath = () => `/api/roast/${roomId}`;
async function action(person, type, fields = {}, expected = [200], options) {
  return request(person, roomPath(), { action: type, requestId: randomUUID(), inviteToken: invitation, ...fields }, expected, options);
}
async function read(person = host) {
  const result = await request(person, `${roomPath()}?invite=${encodeURIComponent(invitation)}`);
  return result.room;
}
async function signedPerson(label) {
  const email = `roast-verify-${runId}-${label.toLowerCase()}@example.invalid`;
  const password = randomBytes(32).toString("base64url");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { display_name: `Roast verify ${label}`, full_name: `Roast verify ${label}`, roast_verify_run_id: runId } });
  if (created.error || !created.data?.user) throw new Error("VERIFY_FIXTURE_CREATE_FAILED");
  fixtures.push({ id: created.data.user.id, deleted: false }); evidence.cleanup.usersCreated++;
  const person = { label, userId: created.data.user.id, jar: new Map(), memberId: null, active: false, rtc: null, camera: label !== "B" && label !== "Host" };
  const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: authFetch },
    cookies: { getAll: () => [...person.jar].map(([name, value]) => ({ name, value })), setAll: cookies => cookies.forEach(({ name, value }) => person.jar.set(name, value)) },
  });
  const signed = await auth.auth.signInWithPassword({ email, password });
  if (signed.error || signed.data.user?.id !== person.userId || person.jar.size === 0) throw new Error("VERIFY_ORDINARY_SIGN_IN_FAILED");
  people.push(person);
  return person;
}
async function join(person) {
  const data = await action(person, "join", { name: `Roast verify ${person.label}`, adult: true });
  person.memberId = data.room.viewer.id; person.active = true;
  check(`${person.label} joins through the room API`, Boolean(person.memberId));
}
async function connect(person) {
  const token = await request(person, `${roomPath()}/media`, { requestId: randomUUID(), inviteToken: invitation });
  assert.equal(token.identity, person.memberId, "App-issued media identity matches the authenticated member");
  // Read only our own token's room claim to inspect resource release later.
  const claim = JSON.parse(Buffer.from(token.token.split(".")[1], "base64url").toString("utf8"));
  mediaRoomName ??= claim.video?.room;
  person.rtc = await suite.connect({ ...token, label: person.label });
}
async function heartbeat() {
  if (heartbeatBusy || stopping) return;
  heartbeatBusy = true;
  heartbeatWork = (async () => {
    for (const person of people.filter(p => p.active)) {
      if (stopping) return;
      try { await action(person, "heartbeat"); }
      catch (error) { if (person.active && !stopping) heartbeatFailure ??= safeError(error); }
    }
  })().finally(() => { heartbeatBusy = false; });
  await heartbeatWork;
}
function startHeartbeats() { heartbeatTimer = setInterval(() => { void heartbeat(); }, 5000); }
function notePhase(room) {
  const key = `${room.battleId}:${room.phase}:${room.turnIndex}`;
  if (key !== lastPhase) {
    lastPhase = key;
    evidence.phases.push({ phase: room.phase, battleId: room.battleId, turnIndex: room.turnIndex, observedAt: Date.now(), deadline: room.deadline, activeSpeakerId: room.activeSpeakerId });
  }
}
async function mediaFor(room) {
  for (const person of people.filter(p => p.rtc && p.active)) {
    const onStage = room.stage.some(member => member?.id === person.memberId);
    await person.rtc.setPublishing({ audio: room.activeSpeakerId === person.memberId, video: onStage && person.camera });
  }
}
async function until(predicate, label, maxMs = 30_000) {
  const deadline = Math.min(Date.now() + maxMs, workDeadline);
  while (Date.now() < deadline) {
    guard();
    if (heartbeatFailure) throw new Error(heartbeatFailure.code);
    snapshot = await read(); notePhase(snapshot); await mediaFor(snapshot);
    if (predicate(snapshot)) return snapshot;
    await delay(2200);
  }
  throw new Error(`VERIFY_WAIT_${label.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`);
}
async function accept(person, room) {
  const offer = room.offers.find(item => item.memberId === person.memberId);
  check(`${person.label} receives an explicit bounded offer`, Boolean(offer && offer.expiresAt > room.serverNow));
  return action(person, "offer_accept", { offerExpiresAt: offer.expiresAt });
}
function distribution(samples) {
  const values = samples.filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return { samples: 0 };
  return { samples: values.length, minMs: values[0], medianMs: values[Math.floor(values.length / 2)], p95Ms: values[Math.min(values.length - 1, Math.floor(values.length * .95))], maxMs: values.at(-1) };
}
async function providerRooms(cleanupMode = false) {
  guard(cleanupMode); evidence.httpCalls.providerRead++;
  const endpoint = new URL(process.env.LIVEKIT_URL); endpoint.protocol = endpoint.protocol === "ws:" ? "http:" : "https:";
  const client = new RoomServiceClient(endpoint.origin, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { requestTimeout: 4, failover: false });
  return client.listRooms([mediaRoomName]);
}
async function providerMembers() {
  guard(); evidence.httpCalls.providerRead++;
  const endpoint = new URL(process.env.LIVEKIT_URL); endpoint.protocol = endpoint.protocol === "ws:" ? "http:" : "https:";
  const client = new RoomServiceClient(endpoint.origin, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { requestTimeout: 4, failover: false });
  return client.listParticipants(mediaRoomName);
}

async function main() {
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"]) {
    if (!process.env[name]) throw new Error("VERIFY_REQUIRED_CONFIGURATION_MISSING");
  }
  const preflight = { jar: new Map() };
  let lobby;
  for (let attempt = 0; attempt < 5; attempt++) {
    lobby = await request(preflight, "/api/roast");
    if (lobby.available) break;
    await delay(3000);
  }
  check("Existing deployed application and live worker are available", lobby?.available === true);
  admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: authFetch },
  });
  suite = await createRoastRtcClients({ maxDurationMs: Math.max(30_000, workDeadline - Date.now()) });
  stage = "ordinary_accounts_and_room";
  host = await signedPerson("Host");
  const a = await signedPerson("A"), b = await signedPerson("B"), c = await signedPerson("C");
  const guest = { label: "Guest", jar: new Map(), active: false, memberId: null, rtc: null, camera: false };
  people.push(guest);
  const deniedPublic = await request(host, "/api/roast", { kind: "public", name: "Roast verification", adult: true, requestId: randomUUID() }, [403], { raw: true });
  check("Ordinary account cannot become public moderator", deniedPublic.code === "ROAST_HOST_FORBIDDEN");
  const created = await request(host, "/api/roast", { kind: "private", name: "Disposable transport check", adult: true, requestId: randomUUID() }, [201]);
  roomId = created.roomId; invitation = created.inviteToken; host.memberId = created.room.viewer.id; host.active = true;
  evidence.roomId = roomId;
  check("Signed-in host creates exactly one private live room", Boolean(roomId && invitation && created.room.viewer.isHost));
  startHeartbeats();
  for (const person of [a, b, c, guest]) await join(person);
  for (const person of people) await connect(person);
  check("Five independent native RTC clients connect with app-issued tokens", people.every(p => p.rtc));
  for (const person of [a, b, c]) {
    await person.rtc.prepare({ camera: person.camera });
    await action(person, "ready", { adultAcknowledged: true, microphoneReady: true, cameraEnabled: person.camera });
  }
  check("Receive-only guest entry prepares no microphone or camera", guest.rtc.summary().publishRejected === 0);
  const unauthorized = await action(guest, "host_pause", {}, [403], { raw: true });
  check("Spectator cannot control the host's room", unauthorized.code === "HOST_REQUIRED");

  stage = "queue_and_absent_acceptance";
  await action(c, "queue_join"); await action(a, "queue_join"); await action(b, "queue_join");
  snapshot = await read();
  const absentOffer = snapshot.offers.find(offer => offer.memberId === c.memberId);
  assert.ok(absentOffer, "Challenger C gets the first offer");
  await accept(a, snapshot);
  check("Queued participant cannot publish an unauthorized microphone", await c.rtc.tryPublish("audio") === false);
  snapshot = await until(room => !room.queue.some(m => m.id === c.memberId) && room.offers.some(o => o.memberId === b.memberId), "absent_challenger_skipped", 30_000);
  check("Unaccepted challenger is skipped after the bounded window", snapshot.serverNow >= absentOffer.expiresAt);
  await accept(b, snapshot);
  await action(c, "queue_join");
  snapshot = await until(room => room.phase === "turn", "first_live_turn", 20_000);
  const firstBattle = snapshot.battleId;
  check("Both real media connections start the server countdown and first turn", Boolean(firstBattle && snapshot.stage.every(p => p?.mediaConnected)));
  const restored = await read(a);
  check("A fresh authenticated HTTP read restores the same live battle and deadline", restored.battleId === firstBattle && restored.deadline === snapshot.deadline && restored.viewer.id === a.memberId);

  stage = "real_live_battle";
  const chat = await action(guest, "chat", { text: "Generated-media transport check: the crowd is here." });
  check("Guest audience chat appears in authoritative room state", chat.room.chat.some(m => m.memberId === guest.memberId));
  const reaction = await action(guest, "react", { kind: "fire" });
  check("Guest audience reaction appears in authoritative room state", reaction.room.reactions.some(r => r.memberId === guest.memberId && r.kind === "fire"));
  const reconnectStarted = Date.now();
  const reconnectMs = await a.rtc.reconnect({ full: false });
  evidence.reconnect = { method: "Native SDK signal reconnect over actual SFU connection", elapsedMs: reconnectMs, beganAt: reconnectStarted };
  check("Actual RTC reconnect returns within the 12-second grace", reconnectMs < 12_000);
  snapshot = await until(room => room.battleId === firstBattle && room.phase === "voting", "four_turns_and_vote", 145_000);
  const turns = evidence.phases.filter(p => p.battleId === firstBattle && p.phase === "turn").map(p => p.turnIndex);
  check("Server advances four alternating real 30-second turns", [0, 1, 2, 3].every(turn => turns.includes(turn)), { observedTurnIndexes: turns });
  check("Audience hears decoded audio from both performers", [a, b].every(p => (guest.rtc.summary().remote[p.memberId]?.audibleFrames || 0) > 0));
  check("Audience receives the opted-in generated camera", (guest.rtc.summary().remote[a.memberId]?.videoFrames || 0) > 0);
  const selfVote = await action(a, "vote", { candidateId: a.memberId, battleId: firstBattle }, [403], { raw: true });
  check("Performer self-voting is rejected", selfVote.code === "NOT_ELIGIBLE");
  await action(guest, "vote", { candidateId: b.memberId, battleId: firstBattle });
  const changed = await action(guest, "vote", { candidateId: a.memberId, battleId: firstBattle });
  check("Eligible guest changes one effective vote while open", changed.room.viewer.vote === a.memberId);
  snapshot = await until(room => room.battleId === firstBattle && room.phase === "results", "audience_result", 25_000);
  check("One effective guest vote selects A consistently", snapshot.result?.kind === "completed" && snapshot.result.winnerId === a.memberId && snapshot.result.votes.reduce((sum, n) => sum + n, 0) === 1 && snapshot.result.streak === 1);
  evidence.firstResult = snapshot.result;
  const audienceResult = await read(guest);
  check("Host and audience see identical persisted result totals", JSON.stringify(audienceResult.result) === JSON.stringify(snapshot.result));
  const lateVote = await action(guest, "vote", { candidateId: b.memberId, battleId: firstBattle }, [409], { raw: true });
  check("Server rejects a vote after the audience deadline", lateVote.code === "VOTING_CLOSED");

  stage = "winner_stays_and_revocation";
  snapshot = await until(room => room.phase === "waiting" && room.offers.some(o => o.memberId === c.memberId), "next_challenger", 20_000);
  check("Winner stays and next challenger is offered the open seat", snapshot.stage.some(p => p?.id === a.memberId) && snapshot.streak === 1);
  await accept(c, snapshot);
  snapshot = await until(room => room.battleId !== firstBattle && room.phase === "turn" && (guest.rtc.summary().remote[c.memberId]?.videoFrames || 0) > 0, "next_live_battle", 20_000);
  check("Accepted next challenger actually publishes opted-in live video", (guest.rtc.summary().remote[c.memberId]?.videoFrames || 0) > 0);
  c.active = false;
  const removed = await action(host, "host_remove", { memberId: c.memberId, ban: true });
  check("Host removes the active challenger and records the explicit forfeit", removed.room.result?.kind === "forfeit" && removed.room.result.winnerId === a.memberId);
  await delay(1500);
  const currentMembers = await providerMembers();
  check("SFU confirms the removed publisher is absent", !currentMembers.some(member => member.identity === c.memberId));
  const deniedToken = await request(c, `${roomPath()}/media`, { requestId: randomUUID(), inviteToken: invitation }, [403], { raw: true });
  check("Removed member cannot obtain another media token", deniedToken.code === "ROAST_REMOVED");
  const revoked = await action(host, "revoke_invite");
  const previousInvitation = invitation; invitation = revoked.inviteToken;
  const newcomer = { jar: new Map() };
  const oldInvite = await request(newcomer, `${roomPath()}?invite=${encodeURIComponent(previousInvitation)}`, undefined, [404], { raw: true });
  check("Revoked private invitation cannot admit a new viewer", oldInvite.code === "ROAST_NOT_FOUND");
  evidence.rtc = suite.summaries();
  evidence.connection = distribution(evidence.rtc.map(client => client.connectMs));
  evidence.mediaDelay = { ...distribution([a, b].flatMap(p => guest.rtc.summary().remote[p.memberId]?.pulseDelaysMs || [])),
    method: "Generated pulse source to native receiver decoded PCM, same process clock; includes encoder, SFU, decode and source buffering; excludes browser/speaker playback." };
  evidence.estimatedParticipantMinutes = Number((5 * (Date.now() - beganAt) / 60_000).toFixed(2));
  evidence.limitations = ["Native RTC and HTTP sessions are not independent browsers.", "HTTP state restoration is not a browser refresh test.", "No physical microphone, camera, phone audio, browser autoplay or human enjoyment was verified."];
  suite.assertHealthy();
  evidence.success = true;
}

let rejectUnexpected;
const unexpectedFailure = new Promise((_, reject) => { rejectUnexpected = reject; });
function unexpected(kind) {
  // Async native callbacks run outside main()'s promise. Suppress their raw SDK
  // errors, cancel main permanently and funnel through the same bounded cleanup.
  evidence.success = false;
  evidence.failure ??= { stage, code: kind };
  if (cleanup) { evidence.cleanup.unexpectedFailure = kind; return; }
  stopping = true;
  clearInterval(heartbeatTimer);
  rejectUnexpected(new Error(kind));
}
const unexpectedException = () => unexpected("VERIFY_UNCAUGHT_CALLBACK");
const unexpectedRejection = () => unexpected("VERIFY_UNHANDLED_REJECTION");
const interrupted = () => unexpected("VERIFY_PROCESS_INTERRUPTED");
process.on("uncaughtException", unexpectedException);
process.on("unhandledRejection", unexpectedRejection);
process.on("SIGTERM", interrupted);
process.on("SIGINT", interrupted);

try {
  await Promise.race([main(), unexpectedFailure]);
} catch (error) {
  evidence.failure = { stage, ...safeError(error) };
  evidence.success = false;
} finally {
  cleanup = true; stopping = true; stage = "cleanup"; clearInterval(heartbeatTimer);
  await heartbeatWork.catch(() => {});
  if (host && roomId) {
    try {
      const closed = await action(host, "host_end", {}, [200], { cleanupMode: true });
      evidence.cleanup.roomClosed = closed.room.phase === "closed";
    } catch { evidence.cleanup.roomCloseFailed = true; }
  }
  if (suite) {
    evidence.rtc ??= suite.summaries();
    let disposeTimer;
    try {
      await Promise.race([suite.dispose(), new Promise((_, reject) => { disposeTimer = setTimeout(() => reject(new Error("VERIFY_RTC_CLEANUP_TIMEOUT")), 15_000); })]);
    } catch { evidence.cleanup.rtcDisposeFailed = true; }
    finally { clearTimeout(disposeTimer); }
  }
  if (mediaRoomName) {
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        if ((await providerRooms(true)).length === 0) { evidence.cleanup.mediaRoomReleased = true; break; }
        await delay(1000);
      }
    } catch { evidence.cleanup.mediaReleaseCheckFailed = true; }
  }
  if (admin) {
    const cleanupAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: makeAuthFetch(true) },
    });
    for (const fixture of fixtures) {
      try {
        const result = await cleanupAdmin.auth.admin.deleteUser(fixture.id);
        if (!result.error) { fixture.deleted = true; evidence.cleanup.usersDeleted++; }
      } catch { /* Report exact disposable IDs still needing cleanup, without credentials. */ }
    }
  }
  if ((roomId && (!evidence.cleanup.roomClosed || !evidence.cleanup.mediaRoomReleased)) || fixtures.some(f => !f.deleted)) evidence.success = false;
  clearTimeout(hardTimer);
  writeReport();
  // Native FFI handles can remain after disconnect. The complete report and
  // bounded cleanup above finish before this disposable subprocess exits.
  process.exit(evidence.success ? 0 : 1);
}
