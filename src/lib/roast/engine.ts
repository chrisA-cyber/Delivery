import {
  ROAST_LIMITS as LIMITS,
  type RoastAction, type RoastMediaObservation, type RoastMember,
  type RoastMemberInput, type RoastPause, type RoastPublicMember, type RoastPublishPolicy,
  type RoastResultKind, type RoastRoomSnapshot, type RoastRoomState,
} from "./types";

export class RoastError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); this.name = "RoastError"; }
}
function demand(condition: unknown, code: string, message: string, status = 400): asserts condition {
  if (!condition) throw new RoastError(code, message, status);
}
const activePhases = new Set(["intro", "turn", "buffer", "voting"]);
const connected = (member: RoastMember | undefined, now: number) => Boolean(member && !member.removed && !member.left && member.lastSeenAt + LIMITS.presenceMs > now);
const mediaConnected = (state: RoastRoomState, id: string, now: number) => connected(state.members[id], now) && Boolean(state.members[id]?.mediaConnected);
function memberFrom(input: RoastMemberInput, now: number): RoastMember {
  demand(input.id && input.id.length <= 160, "INVALID_MEMBER", "A valid member identity is required.");
  const name = input.name.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 32);
  demand(name, "NAME_REQUIRED", "Enter a name.");
  return { id: input.id, name, signedIn: input.signedIn, adultAcknowledged: input.adultAcknowledged,
    joinedAt: now, lastSeenAt: now, mediaConnected: false, lastMediaSeenAt: 0,
    ready: false, cameraEnabled: false, muted: false, removed: false, left: false, blockedIds: [] };
}
function commit(original: RoastRoomState, next: RoastRoomState): RoastRoomState {
  if (JSON.stringify(original) !== JSON.stringify(next)) next.revision = original.revision + 1;
  return next;
}
export function createRoom(input: { id: string; name: string; visibility: "public" | "private"; host: RoastMemberInput }, now: number): RoastRoomState {
  demand(input.host.signedIn, "SIGN_IN_REQUIRED", "Hosts must be signed in.", 403);
  demand(input.host.adultAcknowledged, "ADULT_ACK_REQUIRED", "Confirm that you are 18 or older.", 403);
  const host = memberFrom(input.host, now);
  return { id: input.id, name: input.name.trim().slice(0, 64) || "Roast Off", visibility: input.visibility,
    hostId: host.id, createdAt: now, revision: 1, phase: "waiting", deadline: null,
    members: { [host.id]: host }, queue: [], offers: [], stage: [null, null], battle: null,
    championId: null, streak: 0, pause: null, history: [], chat: [], reactions: [], bannedIds: [],
    recentRequestIds: [], recentChatRequestIds: [], sequence: 0, mediaHealthy: false, lastMediaCheckAt: 0, emptySince: null, closedReason: null };
}
/** Call only with identity/account facts resolved by the server, never raw request fields. */
export function addMember(original: RoastRoomState, input: RoastMemberInput, now: number): RoastRoomState {
  const state = structuredClone(original);
  demand(state.phase !== "closed", "ROOM_CLOSED", "This room is closed.", 410);
  demand(!state.bannedIds.includes(input.id), "ROOM_BANNED", "You cannot join this room.", 403);
  prune(state, now);
  const existing = state.members[input.id];
  demand(!existing?.removed, "ROOM_REMOVED", "The host removed you from this room.", 403);
  if (!connected(existing, now)) demand(Object.values(state.members).filter((m) => connected(m, now)).length < LIMITS.members,
    "ROOM_FULL", "This room is full. Try again when someone leaves.", 409);
  if (existing) {
    existing.name = memberFrom(input, now).name;
    existing.signedIn = input.signedIn;
    existing.adultAcknowledged = input.adultAcknowledged || existing.adultAcknowledged;
    existing.lastSeenAt = now;
    existing.left = false;
  } else {
    demand(Object.keys(state.members).length < LIMITS.retainedMembers, "ROOM_FULL", "This room is full. Try again shortly.", 409);
    state.members[input.id] = memberFrom(input, now);
  }
  state.emptySince = null;
  return commit(original, state);
}
function prune(state: RoastRoomState, now: number) {
  state.chat = state.chat.filter((m) => m.at + LIMITS.chatRetentionMs > now).slice(-LIMITS.chat);
  state.reactions = state.reactions.filter((r) => r.at + LIMITS.reactionRetentionMs > now).slice(-LIMITS.reactions);
  for (const member of Object.values(state.members)) {
    if (member.id !== state.hostId && !member.removed && member.lastSeenAt + LIMITS.hostCloseMs < now &&
      !state.stage.includes(member.id) && !state.queue.includes(member.id) && !state.battle?.eligibleVoterIds.includes(member.id)) {
      delete state.members[member.id];
    }
  }
}
function pause(state: RoastRoomState, reason: RoastPause["reason"], now: number) {
  if (state.phase === "closed") return;
  if (state.phase === "paused") {
    if (reason === "host" || (reason === "host_disconnected" && state.pause?.reason !== "host")) state.pause = { ...state.pause!, reason, since: now };
    return;
  }
  state.pause = { phase: state.phase, remainingMs: state.deadline === null ? null : Math.max(0, state.deadline - now), reason, since: now };
  state.phase = "paused";
  state.deadline = null;
}
function resume(state: RoastRoomState, now: number) {
  if (state.phase !== "paused" || !state.pause) return;
  const saved = state.pause;
  state.phase = saved.phase;
  state.deadline = saved.remainingMs === null ? null : now + saved.remainingMs;
  // Invitations remain bounded, including while the room is paused.
  state.pause = null;
}
function finish(state: RoastRoomState, kind: RoastResultKind, winnerId: string | null, reason: string, now: number) {
  const battle = state.battle;
  if (!battle || battle.result) return;
  const votes: [number, number] = [0, 0];
  for (const choice of Object.values(battle.votes)) {
    if (choice === battle.performerIds[0]) votes[0]++;
    if (choice === battle.performerIds[1]) votes[1]++;
  }
  const streak = winnerId ? (state.championId === winnerId ? state.streak + 1 : 1) : 0;
  const result = { id: battle.id, performerIds: battle.performerIds,
    performerNames: battle.performerIds.map((id) => state.members[id]?.name ?? "Performer") as [string, string],
    kind, winnerId, votes, streak, reason, endedAt: now };
  battle.result = result;
  state.history = [...state.history.filter((r) => r.id !== battle.id), result].slice(-LIMITS.history);
  state.championId = winnerId;
  state.streak = streak;
  state.phase = "results";
  state.deadline = now + LIMITS.resultsMs;
  state.pause = null;
}
function close(state: RoastRoomState, reason: string, now: number) {
  if (state.battle && !state.battle.result) finish(state, "no_contest", null, reason, now);
  state.phase = "closed";
  state.deadline = null;
  state.pause = null;
  state.closedReason = reason;
  state.queue = [];
  state.offers = [];
  state.stage = [null, null];
}
/** Server recovery only: an uncertain revocation ends the room without a verdict. */
export function closeRoomForMediaFailure(original: RoastRoomState, now: number): RoastRoomState {
  const state = structuredClone(original);
  close(state, "The stage closed because media access could not be revoked.", now);
  return commit(original, state);
}
function detach(state: RoastRoomState, memberId: string, now: number, reason: string) {
  state.queue = state.queue.filter((id) => id !== memberId);
  state.offers = state.offers.filter((offer) => offer.memberId !== memberId);
  if (!state.stage.includes(memberId)) return;
  if (state.battle && !state.battle.result) {
    const other = state.battle.performerIds.find((id) => id !== memberId)!;
    const started = state.battle.startedAt !== null;
    finish(state, started && mediaConnected(state, other, now) && state.mediaHealthy ? "forfeit" : "no_contest",
      started && mediaConnected(state, other, now) && state.mediaHealthy ? other : null, reason, now);
  }
  state.stage = state.stage.map((id) => id === memberId ? null : id) as RoastRoomState["stage"];
  if (state.championId === memberId) { state.championId = null; state.streak = 0; }
}
function fillOffers(state: RoastRoomState, now: number) {
  state.offers = state.offers.filter((offer) => {
    if (offer.expiresAt <= now || !connected(state.members[offer.memberId], now)) {
      state.queue = state.queue.filter((id) => id !== offer.memberId);
      return false;
    }
    return true;
  });
  for (const seat of [0, 1] as const) {
    if (state.stage[seat] || state.offers.some((o) => o.seat === seat)) continue;
    const next = state.queue.find((id) => !state.offers.some((o) => o.memberId === id));
    if (next) state.offers.push({ memberId: next, seat, expiresAt: now + LIMITS.offerMs });
  }
}
function begin(state: RoastRoomState, now: number) {
  const ids = state.stage as [string, string];
  state.sequence++;
  state.battle = { id: crypto.randomUUID(), performerIds: [...ids], turnIndex: 0,
    startedAt: null, eligibleVoterIds: [], votes: {}, result: null };
  state.phase = "intro";
  state.deadline = now + LIMITS.introMs;
}
function tick(state: RoastRoomState, now: number, observation?: RoastMediaObservation) {
  if (state.phase === "closed") return;
  prune(state, now);
  if (observation) {
    state.mediaHealthy = observation.providerHealthy;
    state.lastMediaCheckAt = now;
    const ids = new Set(observation.connectedIds);
    for (const member of Object.values(state.members)) {
      member.mediaConnected = ids.has(member.id) && !member.removed && !member.left;
      if (member.mediaConnected) member.lastMediaSeenAt = now;
    }
  }
  if (now >= state.createdAt + LIMITS.roomLifetimeMs) { close(state, "This stage reached its one-hour session limit.", now); return; }
  const anyonePresent = Object.values(state.members).some((member) => connected(member, now));
  if (!anyonePresent) {
    state.emptySince ??= now;
    if (now >= state.emptySince + LIMITS.emptyCloseMs) { close(state, "Everyone left the room.", now); return; }
  } else state.emptySince = null;
  const hostLastSeen = state.members[state.hostId]?.lastSeenAt ?? state.createdAt;
  if (now >= hostLastSeen + LIMITS.hostCloseMs) { close(state, "The host did not return.", now); return; }
  if (now >= hostLastSeen + LIMITS.hostGraceMs) { pause(state, "host_disconnected", now); return; }
  // Stale queued people are removed, even if the room is paused.
  state.queue = state.queue.filter((id) => connected(state.members[id], now) && state.members[id]?.ready);
  state.offers = state.offers.filter((offer) => state.queue.includes(offer.memberId));
  if (state.phase === "paused" && state.pause?.reason === "host_disconnected") resume(state, now);
  if (state.phase === "paused") {
    const saved = state.pause!;
    if (saved.reason === "host") return;
    const ids = state.battle?.performerIds ?? [];
    const missing = ids.filter((id) => !mediaConnected(state, id, now));
    if (state.mediaHealthy && missing.length === 0) { resume(state, now); }
    else if (now >= saved.since + LIMITS.reconnectMs) {
      if (state.battle && state.battle.startedAt !== null && state.mediaHealthy && missing.length === 1) {
        finish(state, "forfeit", ids.find((id) => id !== missing[0])!, "A performer did not reconnect in time.", now);
      } else finish(state, "no_contest", null, state.mediaHealthy ? "The live connection could not be restored." : "The media service became unavailable.", now);
      return;
    } else return;
  }
  if (activePhases.has(state.phase)) {
    if (!state.mediaHealthy) { pause(state, "media_unavailable", now); return; }
    if (state.phase !== "voting" && state.battle!.performerIds.some((id) => !mediaConnected(state, id, now))) {
      pause(state, "performer_disconnected", now); return;
    }
  }
  if (state.phase === "waiting") {
    // Accepted challengers who disappear before the introduction cannot occupy a seat forever.
    for (const id of state.stage) {
      const member = id ? state.members[id] : undefined;
      if (id && (!connected(member, now) || (member && !member.mediaConnected &&
        now >= member.lastMediaSeenAt + LIMITS.offerMs))) detach(state, id, now, "The challenger did not connect.");
    }
    fillOffers(state, now);
    if (state.stage[0] && state.stage[1] && state.mediaHealthy && state.stage.every((id) => mediaConnected(state, id!, now))) begin(state, now);
    return;
  }
  if (state.deadline === null || now < state.deadline) return;
  // Advance one phase per server tick. A delayed worker must not skip actual speaking time.
  const battle = state.battle!;
  if (state.phase === "intro") {
    battle.startedAt = now;
    state.phase = "turn";
    state.deadline = now + LIMITS.turnMs;
  } else if (state.phase === "turn") {
    if (battle.turnIndex < 3) { battle.turnIndex++; state.deadline = now + LIMITS.turnMs; }
    else { state.phase = "buffer"; state.deadline = now + LIMITS.mediaBufferMs; }
  } else if (state.phase === "buffer") {
    battle.eligibleVoterIds = Object.values(state.members)
      .filter((m) => connected(m, now) && !battle.performerIds.includes(m.id)).map((m) => m.id);
    state.phase = "voting";
    state.deadline = now + LIMITS.voteMs;
  } else if (state.phase === "voting") {
    const totals = battle.performerIds.map((id) => Object.values(battle.votes).filter((choice) => choice === id).length) as [number, number];
    const winner = totals[0] === totals[1] ? null : battle.performerIds[totals[0] > totals[1] ? 0 : 1];
    finish(state, "completed", winner, totals[0] + totals[1] === 0 ? "No audience votes. Both performers rotate out." :
      winner ? "The audience chose the winner." : "A draw. Both performers rotate out.", now);
  } else if (state.phase === "results") {
    const winner = battle.result?.winnerId ?? null;
    const keep = winner && state.streak < 3 && state.stage.includes(winner) && connected(state.members[winner], now);
    state.stage = keep ? [winner, null] : [null, null];
    if (!keep) { state.championId = null; state.streak = 0; }
    state.battle = null;
    state.phase = "waiting";
    state.deadline = null;
    fillOffers(state, now);
  }
}
export function tickRoom(original: RoastRoomState, now: number, observation?: RoastMediaObservation): RoastRoomState {
  const state = structuredClone(original);
  tick(state, now, observation);
  return commit(original, state);
}
function requireBattle(state: RoastRoomState, action: RoastAction) {
  demand(Boolean(state.battle), "NO_BATTLE", "There is no current battle.", 409);
  demand(action.battleId === state.battle?.id, "STALE_BATTLE", "The battle has changed. Refresh the room.", 409);
}
export function applyAction(original: RoastRoomState, actorId: string, action: RoastAction, now: number): RoastRoomState {
  const requestKey = action.requestId && action.type !== "heartbeat" ? `${actorId}:${action.requestId}` : null;
  const chatRequest = action.type === "chat" || action.type === "react";
  demand(!action.requestId || action.requestId.length <= 100, "INVALID_REQUEST_ID", "Invalid request identifier.");
  if (requestKey && (chatRequest ? original.recentChatRequestIds : original.recentRequestIds).includes(requestKey)) return original;
  demand(action.expectedRevision === undefined || original.revision === action.expectedRevision,
    "STALE_ROOM", "The room changed. Try again with its current state.", 409);
  const state = structuredClone(original);
  const member = state.members[actorId];
  demand(member && !member.removed && !member.left && !state.bannedIds.includes(actorId), "NOT_A_MEMBER", "Join this room first.", 403);
  demand((state.phase as RoastRoomState["phase"]) !== "closed", "ROOM_CLOSED", "This room is closed.", 410);
  if (action.type.startsWith("host_")) demand(actorId === state.hostId, "HOST_REQUIRED", "Only this room's host can do that.", 403);
  member.lastSeenAt = now;
  // Only the worker's fresh provider observation may advance timed phases.
  // A delayed chat/heartbeat must never conclude a vote from stale media health.
  prune(state, now);
  if (action.battleId) requireBattle(state, action);
  switch (action.type) {
    case "heartbeat": break;
    case "ready":
      demand(member.signedIn, "SIGN_IN_REQUIRED", "Sign in to perform.", 403);
      demand(action.adultAcknowledged && action.microphoneReady, "READINESS_REQUIRED", "Confirm you are 18 or older and check your microphone.");
      member.adultAcknowledged = true; member.ready = true; member.cameraEnabled = Boolean(action.cameraEnabled); break;
    case "queue_join":
      demand(member.signedIn && member.ready && member.adultAcknowledged, "READINESS_REQUIRED", "Sign in, acknowledge the rules, and check your microphone before queuing.", 403);
      demand(!state.stage.includes(actorId), "ALREADY_ON_STAGE", "You are already on stage.", 409);
      if (!state.queue.includes(actorId)) {
        demand(state.queue.length < LIMITS.queue, "QUEUE_FULL", "The queue is full. Try again shortly.", 409);
        state.queue.push(actorId);
      }
      break;
    case "queue_leave": case "offer_decline":
      state.queue = state.queue.filter((id) => id !== actorId); state.offers = state.offers.filter((o) => o.memberId !== actorId); break;
    case "offer_accept": {
      const offer = state.offers.find((o) => o.memberId === actorId);
      demand(offer && offer.expiresAt > now, "OFFER_EXPIRED", "That stage invitation expired. Join the queue again.", 409);
      demand(offer.expiresAt === action.offerExpiresAt, "OFFER_EXPIRED", "That stage invitation expired. Accept the current invitation.", 409);
      demand(state.phase === "waiting" && !state.stage[offer.seat], "STAGE_UNAVAILABLE", "The stage is unavailable right now.", 409);
      demand(member.ready && member.signedIn && member.adultAcknowledged, "READINESS_REQUIRED", "Complete the microphone check before accepting.", 403);
      state.stage[offer.seat] = actorId;
      state.queue = state.queue.filter((id) => id !== actorId); state.offers = state.offers.filter((o) => o.memberId !== actorId);
      member.lastMediaSeenAt = now; // Give an explicitly accepted participant time to connect.
      break;
    }
    case "step_down": detach(state, actorId, now, "A performer stepped down."); break;
    case "leave":
      member.left = true; member.mediaConnected = false; member.ready = false;
      detach(state, actorId, now, "A performer left the room."); break;
    case "camera": member.cameraEnabled = action.enabled; break;
    case "vote":
      requireBattle(state, action);
      demand(state.phase === "voting" && state.deadline !== null && now < state.deadline, "VOTING_CLOSED", "Audience voting is closed.", 409);
      demand(state.battle!.eligibleVoterIds.includes(actorId) && !state.battle!.performerIds.includes(actorId),
        "NOT_ELIGIBLE", "Only spectators present before voting opened can vote.", 403);
      demand(state.battle!.performerIds.includes(action.candidateId), "INVALID_VOTE", "Choose one of the two performers.");
      state.battle!.votes[actorId] = action.candidateId;
      break;
    case "chat": {
      const content = action.text.trim().replace(/[\u0000-\u001f\u007f]/g, " ");
      demand(content.length > 0 && content.length <= 280, "INVALID_MESSAGE", "Messages must contain 1–280 characters.");
      demand(!member.muted, "MEMBER_MUTED", "The host has muted you in this room.", 403);
      state.sequence++; state.chat.push({ id: `${state.id}:chat:${state.sequence}`, memberId: actorId, name: member.name, text: content, at: now });
      state.chat = state.chat.slice(-LIMITS.chat); break;
    }
    case "react":
      demand(["fire", "laugh", "clap", "wow"].includes(action.kind), "INVALID_REACTION", "Choose one of the room reactions.");
      demand(!member.muted, "MEMBER_MUTED", "The host has muted you in this room.", 403);
      state.sequence++; state.reactions.push({ id: `${state.id}:reaction:${state.sequence}`, memberId: actorId, kind: action.kind, at: now });
      state.reactions = state.reactions.slice(-LIMITS.reactions); break;
    case "block":
      demand(action.memberId !== actorId && Boolean(state.members[action.memberId]), "INVALID_MEMBER", "Choose another room participant.");
      member.blockedIds = member.blockedIds.filter((id) => id !== action.memberId);
      if (action.blocked) { demand(member.blockedIds.length < LIMITS.bans, "BLOCK_LIMIT", "Your room block list is full."); member.blockedIds.push(action.memberId); }
      break;
    case "host_pause": pause(state, "host", now); break;
    case "host_resume":
      demand(state.phase === "paused", "NOT_PAUSED", "The room is not paused.", 409);
      demand(state.mediaHealthy || state.pause?.phase === "waiting", "MEDIA_UNAVAILABLE", "Wait for the media connection to recover.", 409);
      demand(!state.battle || state.battle.result || state.battle.performerIds.every((id) => mediaConnected(state, id, now)),
        "PERFORMER_DISCONNECTED", "Wait for both performers to reconnect, or skip this battle.", 409);
      resume(state, now); break;
    case "host_skip":
      if (state.battle && !state.battle.result) {
        requireBattle(state, action);
        finish(state, "no_contest", null, "The host ended this disrupted battle without a verdict.", now);
      }
      else if (state.phase === "waiting" || (state.phase === "paused" && state.pause?.phase === "waiting")) {
        state.queue = state.queue.filter((id) => !state.offers.some((o) => o.memberId === id)); state.offers = [];
        state.stage = [null, null]; state.championId = null; state.streak = 0;
      }
      break;
    case "host_end": close(state, "The host closed the stage.", now); break;
    case "host_queue_move": {
      demand(state.queue.includes(action.memberId), "NOT_QUEUED", "That participant is no longer queued.", 409);
      demand(Number.isInteger(action.position) && action.position >= 0 && action.position < state.queue.length, "INVALID_POSITION", "Choose an existing queue position.");
      state.queue = state.queue.filter((id) => id !== action.memberId); state.queue.splice(action.position, 0, action.memberId); break;
    }
    case "host_queue_remove":
      state.queue = state.queue.filter((id) => id !== action.memberId); state.offers = state.offers.filter((o) => o.memberId !== action.memberId); break;
    case "host_mute": {
      const target = state.members[action.memberId];
      demand(target, "INVALID_MEMBER", "That participant left the room.", 404);
      target.muted = action.muted; break;
    }
    case "host_remove": {
      demand(action.memberId !== state.hostId, "HOST_CANNOT_REMOVE_SELF", "Use Close stage to leave as host.");
      const target = state.members[action.memberId]; demand(target, "INVALID_MEMBER", "That participant left the room.", 404);
      if (action.ban && !state.bannedIds.includes(action.memberId)) {
        demand(state.bannedIds.length < LIMITS.bans, "BAN_LIMIT", "The room ban limit is reached. Close and reopen the room.", 409);
        state.bannedIds.push(action.memberId);
      }
      target.removed = true; target.mediaConnected = false; target.ready = false;
      detach(state, action.memberId, now, action.ban ? "The host banned a performer." : "The host removed a performer."); break;
    }
    case "host_chat_remove": state.chat = state.chat.filter((m) => m.id !== action.messageId); break;
  }
  if (state.phase === "waiting") fillOffers(state, now);
  if (requestKey) {
    if (chatRequest) state.recentChatRequestIds = [...state.recentChatRequestIds, requestKey].slice(-256);
    else state.recentRequestIds = [...state.recentRequestIds, requestKey].slice(-1024);
  }
  return commit(original, state);
}
export function desiredPublish(state: RoastRoomState, memberId: string): RoastPublishPolicy {
  const member = state.members[memberId];
  const accepted = Boolean(member && !member.removed && !member.left && !state.bannedIds.includes(memberId) &&
    member.signedIn && member.ready && member.adultAcknowledged && state.stage.includes(memberId) && state.phase !== "closed");
  const audio = accepted && !member?.muted && state.mediaHealthy && state.phase === "turn" &&
    state.battle?.performerIds[state.battle.turnIndex % 2] === memberId;
  const video = accepted && Boolean(member?.cameraEnabled);
  return { canPublish: audio || video, audio, video };
}
export function snapshotRoom(state: RoastRoomState, viewerId: string | null, now: number): RoastRoomSnapshot {
  const storedViewer = viewerId ? state.members[viewerId] : undefined;
  const viewer = storedViewer?.left ? undefined : storedViewer;
  const publicMember = (member: RoastMember): RoastPublicMember => ({ id: member.id, name: member.name,
    mediaConnected: member.mediaConnected, cameraEnabled: member.cameraEnabled, muted: member.muted,
    online: connected(member, now), role: state.stage.includes(member.id) ? "performer" : member.id === state.hostId ? "host" :
      state.queue.includes(member.id) ? "queued" : "spectator" });
  const members = Object.values(state.members).filter((m) => connected(m, now)).map(publicMember);
  const activeSpeakerId = state.phase === "turn" && state.battle ? state.battle.performerIds[state.battle.turnIndex % 2] ?? null : null;
  const labels: Record<RoastRoomState["phase"], string> = { waiting: "Waiting for challengers", intro: "Meet your performers",
    turn: `${state.members[activeSpeakerId ?? ""]?.name ?? "Performer"}'s turn`, buffer: "Final words · voting opens next",
    voting: "Audience vote", results: "Battle result", paused: "Stage paused", closed: "Stage closed" };
  const blocked = new Set(viewer?.blockedIds ?? []);
  const queueIndex = viewerId ? state.queue.indexOf(viewerId) : -1;
  return { id: state.id, name: state.name, visibility: state.visibility, hostId: state.hostId, revision: state.revision,
    serverNow: now, phase: state.phase, deadline: state.deadline, phaseLabel: labels[state.phase], activeSpeakerId,
    turnIndex: state.battle?.turnIndex ?? null, battleId: state.battle?.id ?? null,
    stage: state.stage.map((id) => id && state.members[id] ? publicMember(state.members[id]) : null) as RoastRoomSnapshot["stage"],
    queue: state.queue.filter((id) => state.members[id]).map((id) => publicMember(state.members[id]!)),
    offers: structuredClone(state.offers), members,
    viewer: { id: viewer?.id ?? null, isHost: viewer?.id === state.hostId, signedIn: viewer?.signedIn ?? false,
      ready: viewer?.ready ?? false, adultAcknowledged: viewer?.adultAcknowledged ?? false,
      queuePosition: queueIndex >= 0 ? queueIndex + 1 : null, offer: structuredClone(state.offers.find((o) => o.memberId === viewerId) ?? null),
      canVote: Boolean(viewer && !viewer.removed && state.phase === "voting" && state.deadline !== null && now < state.deadline &&
        state.battle?.eligibleVoterIds.includes(viewer.id) && !state.battle.performerIds.includes(viewer.id)),
      vote: viewerId ? state.battle?.votes[viewerId] ?? null : null, blockedIds: [...blocked], removed: viewer?.removed ?? false },
    memberCount: members.length, spectatorCount: members.filter((m) => m.role !== "performer").length,
    capacity: LIMITS.members, queueCapacity: LIMITS.queue,
    result: structuredClone(state.battle?.result ?? null), history: structuredClone(state.history),
    championId: state.championId, streak: state.streak,
    chat: structuredClone(state.chat.filter((m) => m.at + LIMITS.chatRetentionMs > now && !blocked.has(m.memberId))),
    reactions: structuredClone(state.reactions.filter((r) => r.at + LIMITS.reactionRetentionMs > now && !blocked.has(r.memberId))),
    mediaHealthy: state.mediaHealthy, pauseReason: state.pause?.reason ?? null, closedReason: state.closedReason };
}
