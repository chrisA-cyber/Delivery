import "server-only";

import { AccessToken, ParticipantInfo_State, RoomConfiguration, RoomServiceClient, TrackSource, type ParticipantInfo, type ParticipantPermission } from "livekit-server-sdk";
import { AppError } from "@/lib/server/api-error";

export const ROAST_MEDIA_PARTICIPANT_CAP = 28;
const REQUEST_TIMEOUT_SECONDS = 4;

function configuration() {
  const rawUrl = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!rawUrl || !apiKey || !apiSecret) return null;
  try {
    const url = new URL(rawUrl);
    const cloud = url.hostname.endsWith(".livekit.cloud") && ["https:", "wss:"].includes(url.protocol);
    const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && ["http:", "ws:"].includes(url.protocol);
    // Production relies on Cloud's token revocation; a generic self-hosted URL
    // must not silently weaken removal/reconnect permissions.
    if ((!cloud && !local) || url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null;
    const websocket = new URL(url);
    websocket.protocol = cloud ? "wss:" : "ws:";
    url.protocol = cloud ? "https:" : "http:";
    return { url: websocket.origin, apiUrl: url.origin, apiKey, apiSecret };
  } catch { return null; }
}

export function roastMediaConfigured(): boolean { return configuration() !== null; }

function provider() {
  const config = configuration();
  if (!config) throw new AppError("ROAST_MEDIA_NOT_CONFIGURED", "Live Roast Off is not connected yet. The host needs to finish live media setup.", 503);
  return { config, client: new RoomServiceClient(config.apiUrl, config.apiKey, config.apiSecret, { requestTimeout: REQUEST_TIMEOUT_SECONDS, failover: false }) };
}

export function roastMediaRoomName(roomId: string): string {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(roomId)) throw new AppError("INVALID_ROAST_ROOM", "That stage could not be found.", 400);
  return `delivery-roast-${roomId}`;
}

function notFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "not_found";
}

async function mediaCall<T>(call: () => Promise<T>): Promise<T> {
  try { return await call(); }
  catch (error) {
    if (error instanceof AppError) throw error;
    // Do not expose provider response bodies, tokens, endpoints, or credentials.
    throw new AppError("ROAST_MEDIA_UNAVAILABLE", "The live connection is unavailable. The stage is paused while it recovers.", 503);
  }
}

export async function createRoastMediaRoom(roomId: string, maxParticipants = ROAST_MEDIA_PARTICIPANT_CAP): Promise<void> {
  const { client } = provider();
  await mediaCall(() => client.createRoom({ name: roastMediaRoomName(roomId), maxParticipants: Math.max(2, Math.min(ROAST_MEDIA_PARTICIPANT_CAP, Math.floor(maxParticipants))), emptyTimeout: 60, departureTimeout: 30, maxPlayoutDelay: 500 }));
}

export async function deleteRoastMediaRoom(roomId: string): Promise<void> {
  const { client } = provider();
  await mediaCall(async () => { try { await client.deleteRoom(roastMediaRoomName(roomId)); } catch (error) { if (!notFound(error)) throw error; } });
}

export async function issueRoastMediaToken(input: { roomId: string; identity: string; name: string }): Promise<{ url: string; token: string; identity: string }> {
  const { config } = provider();
  if (!/^[a-zA-Z0-9_-]{1,140}$/.test(input.identity)) throw new AppError("INVALID_ROAST_MEMBER", "Rejoin the stage to connect.", 400);
  const token = new AccessToken(config.apiKey, config.apiSecret, { identity: input.identity, name: input.name.slice(0, 40), ttl: 60 });
  // A room may have expired while its host was away. Any legitimate rejoin
  // which auto-creates it must retain the same capacity and idle expiry.
  token.roomConfig = new RoomConfiguration({ name: roastMediaRoomName(input.roomId), maxParticipants: ROAST_MEDIA_PARTICIPANT_CAP, emptyTimeout: 60, departureTimeout: 30, maxPlayoutDelay: 500 });
  token.addGrant({ room: roastMediaRoomName(input.roomId), roomJoin: true, canSubscribe: true, canPublish: false, canPublishSources: [], canPublishData: false, canUpdateOwnMetadata: false, roomAdmin: false, roomCreate: false, roomRecord: false, hidden: false });
  return { url: config.url, token: await token.toJwt(), identity: input.identity };
}

export interface RoastMediaGrant { identity: string; microphone: boolean; camera: boolean }
export interface RoastMediaParticipant {
  identity: string;
  sid: string;
  connected: boolean;
  tracks: Array<{ sid: string; source: "microphone" | "camera" | "other"; muted: boolean }>;
}

function presentParticipant(participant: ParticipantInfo): RoastMediaParticipant {
  return { identity: participant.identity, sid: participant.sid, connected: participant.state === ParticipantInfo_State.ACTIVE, tracks: participant.tracks.map((track) => ({ sid: track.sid, source: track.source === TrackSource.MICROPHONE ? "microphone" : track.source === TrackSource.CAMERA ? "camera" : "other", muted: track.muted })) };
}

export async function listRoastMediaParticipants(roomId: string, allowMissing = false): Promise<RoastMediaParticipant[]> {
  const { client } = provider();
  return mediaCall(async () => {
    try { return (await client.listParticipants(roastMediaRoomName(roomId))).map(presentParticipant); }
    catch (error) { if (allowMissing && notFound(error)) return []; throw error; }
  });
}

function permission(grant?: RoastMediaGrant): Partial<ParticipantPermission> {
  const sources = [...(grant?.microphone ? [TrackSource.MICROPHONE] : []), ...(grant?.camera ? [TrackSource.CAMERA] : [])];
  return { canSubscribe: true, canPublish: sources.length > 0, canPublishSources: sources, canPublishData: false, canUpdateMetadata: false, hidden: false, recorder: false };
}

function permissionMatches(current: ParticipantPermission | undefined, desired: Partial<ParticipantPermission>): boolean {
  return Boolean(current && current.canSubscribe === desired.canSubscribe && current.canPublish === desired.canPublish && !current.canPublishData && !current.canUpdateMetadata && !current.hidden && !current.recorder && current.canPublishSources.length === desired.canPublishSources?.length && current.canPublishSources.every((source) => desired.canPublishSources?.includes(source)));
}

/** Call only while holding the application's distributed room lock. SFU
 * permissions are authoritative: all joins start receive-only. Source revocation
 * first unpublishes excluded tracks before another microphone can be granted.
 * This never remotely unmutes or activates a device. */
export async function reconcileRoastMediaPermissions(roomId: string, desired: RoastMediaGrant[], assertLease?: () => Promise<void>): Promise<RoastMediaParticipant[]> {
  const { client } = provider();
  const roomName = roastMediaRoomName(roomId);
  if (desired.filter((entry) => entry.microphone).length > 1 || desired.filter((entry) => entry.camera || entry.microphone).length > 2) throw new AppError("INVALID_ROAST_MEDIA_GRANT", "The stage permissions could not be applied.", 500);
  return mediaCall(async () => {
    const participants = await client.listParticipants(roomName);
    const grants = new Map(desired.map((entry) => [entry.identity, entry]));
    const changed = participants.filter((participant) => !permissionMatches(participant.permission, permission(grants.get(participant.identity))));
    const intermediate = new Map<string, Partial<ParticipantPermission>>();
    // Complete every revocation before granting any new source. If revocation
    // fails, no new microphone is granted and the caller pauses the room.
    for (const participant of changed) {
      const next = grants.get(participant.identity);
      const current = participant.permission;
      const previouslyAllowed = (source: TrackSource) => Boolean(current?.canPublish && (current.canPublishSources.length === 0 || current.canPublishSources.includes(source)));
      const restricted = permission({ identity: participant.identity, microphone: Boolean(next?.microphone && previouslyAllowed(TrackSource.MICROPHONE)), camera: Boolean(next?.camera && previouslyAllowed(TrackSource.CAMERA)) });
      intermediate.set(participant.identity, restricted);
      // LiveKit ParticipantImpl.SetPermission removes published tracks whose
      // sources are no longer allowed. Intersecting grants keeps an unchanged
      // camera visible while revoking the outgoing microphone.
      if (!permissionMatches(current, restricted)) {
        await assertLease?.();
        await client.updateParticipant(roomName, participant.identity, { permission: restricted });
      }
    }
    for (const participant of changed) {
      const next = permission(grants.get(participant.identity));
      const restricted = intermediate.get(participant.identity)!;
      if (next.canPublish && (next.canPublishSources?.length !== restricted.canPublishSources?.length || next.canPublishSources?.some(source => !restricted.canPublishSources?.includes(source)))) {
        await assertLease?.();
        await client.updateParticipant(roomName, participant.identity, { permission: next });
      }
    }
    return participants.map(presentParticipant);
  });
}

export async function removeRoastMediaParticipant(roomId: string, identity: string): Promise<void> {
  const { client } = provider();
  await mediaCall(async () => {
    // Cloud revokes the token even if the participant disconnected just before
    // this call. Default cutoff includes its documented clock-skew buffer.
    try { await client.removeParticipant(roastMediaRoomName(roomId), identity); }
    catch (error) { if (!notFound(error)) throw error; }
  });
}

export async function muteRoastMediaParticipant(roomId: string, identity: string): Promise<void> {
  const { client } = provider();
  await mediaCall(async () => {
    const participant = await client.getParticipant(roastMediaRoomName(roomId), identity);
    for (const track of participant.tracks) {
      if (track.source === TrackSource.MICROPHONE) await client.mutePublishedTrack(roastMediaRoomName(roomId), identity, track.sid, true);
    }
  });
}
