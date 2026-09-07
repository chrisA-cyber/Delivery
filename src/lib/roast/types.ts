export const ROAST_LIMITS = {
  audience: 25, members: 28, queue: 12, chat: 100, chatRetentionMs: 15 * 60_000,
  reactions: 20, reactionRetentionMs: 6_000, history: 20, turnMs: 30_000,
  introMs: 3_000, mediaBufferMs: 3_000, voteMs: 15_000, resultsMs: 6_000,
  offerMs: 20_000, reconnectMs: 12_000, hostGraceMs: 20_000,
  hostCloseMs: 120_000, emptyCloseMs: 60_000, presenceMs: 25_000,
  roomLifetimeMs: 60 * 60_000, retainedMembers: 256, bans: 256,
} as const;

export type RoastPhase = "waiting" | "intro" | "turn" | "buffer" | "voting" | "results" | "paused" | "closed";
export type RoastReactionKind = "fire" | "laugh" | "clap" | "wow";
export type RoastResultKind = "completed" | "forfeit" | "no_contest";
export interface RoastMember {
  id: string; name: string; signedIn: boolean; joinedAt: number; lastSeenAt: number;
  mediaConnected: boolean; lastMediaSeenAt: number; adultAcknowledged: boolean;
  ready: boolean; cameraEnabled: boolean; muted: boolean; removed: boolean; left: boolean;
  blockedIds: string[];
}
export interface RoastMemberInput { id: string; name: string; signedIn: boolean; adultAcknowledged: boolean }
export interface RoastOffer { memberId: string; seat: 0 | 1; expiresAt: number }
export interface RoastChat { id: string; memberId: string; name: string; text: string; at: number }
export interface RoastReaction { id: string; memberId: string; kind: RoastReactionKind; at: number }
export interface RoastResult {
  id: string; performerIds: [string, string]; performerNames: [string, string];
  kind: RoastResultKind; winnerId: string | null; votes: [number, number];
  streak: number; reason: string; endedAt: number;
}
export interface RoastBattle {
  id: string; performerIds: [string, string]; turnIndex: number;
  startedAt: number | null; eligibleVoterIds: string[]; votes: Record<string, string>;
  result: RoastResult | null;
}
export interface RoastPause {
  phase: Exclude<RoastPhase, "paused" | "closed">; remainingMs: number | null;
  reason: "host" | "host_disconnected" | "performer_disconnected" | "media_unavailable";
  since: number;
}
/** Server-only state. Never return this object directly to clients. */
export interface RoastRoomState {
  id: string; name: string; visibility: "public" | "private"; hostId: string;
  createdAt: number; revision: number; phase: RoastPhase; deadline: number | null;
  members: Record<string, RoastMember>; queue: string[]; offers: RoastOffer[];
  stage: [string | null, string | null]; battle: RoastBattle | null;
  championId: string | null; streak: number; pause: RoastPause | null;
  history: RoastResult[]; chat: RoastChat[]; reactions: RoastReaction[];
  bannedIds: string[]; recentRequestIds: string[]; recentChatRequestIds: string[]; sequence: number;
  mediaHealthy: boolean; lastMediaCheckAt: number; emptySince: number | null;
  closedReason: string | null;
}
export type RoastAction = (
  | { type: "heartbeat" }
  | { type: "ready"; adultAcknowledged: boolean; microphoneReady: boolean; cameraEnabled?: boolean }
  | { type: "queue_join" }
  | { type: "queue_leave" }
  | { type: "offer_accept"; offerExpiresAt: number }
  | { type: "offer_decline" }
  | { type: "step_down" }
  | { type: "leave" }
  | { type: "camera"; enabled: boolean }
  | { type: "vote"; candidateId: string }
  | { type: "chat"; text: string }
  | { type: "react"; kind: RoastReactionKind }
  | { type: "block"; memberId: string; blocked: boolean }
  | { type: "host_pause" }
  | { type: "host_resume" }
  | { type: "host_skip" }
  | { type: "host_end" }
  | { type: "host_queue_move"; memberId: string; position: number }
  | { type: "host_queue_remove"; memberId: string }
  | { type: "host_mute"; memberId: string; muted: boolean }
  | { type: "host_remove"; memberId: string; ban?: boolean }
  | { type: "host_chat_remove"; messageId: string }
) & { requestId?: string; expectedRevision?: number; battleId?: string };
export interface RoastPublicMember {
  id: string; name: string; mediaConnected: boolean; cameraEnabled: boolean;
  muted: boolean; online: boolean; role: "host" | "performer" | "queued" | "spectator";
}
export interface RoastRoomSnapshot {
  id: string; name: string; visibility: "public" | "private"; hostId: string;
  revision: number; serverNow: number; phase: RoastPhase; deadline: number | null;
  phaseLabel: string; activeSpeakerId: string | null; turnIndex: number | null;
  battleId: string | null; stage: [RoastPublicMember | null, RoastPublicMember | null];
  queue: RoastPublicMember[]; offers: RoastOffer[]; members: RoastPublicMember[];
  viewer: { id: string | null; isHost: boolean; signedIn: boolean; ready: boolean;
    adultAcknowledged: boolean; queuePosition: number | null; offer: RoastOffer | null;
    canVote: boolean; vote: string | null; blockedIds: string[]; removed: boolean };
  memberCount: number; spectatorCount: number; capacity: number; queueCapacity: number;
  result: RoastResult | null; history: RoastResult[]; championId: string | null; streak: number;
  chat: RoastChat[]; reactions: RoastReaction[]; mediaHealthy: boolean;
  pauseReason: RoastPause["reason"] | null; closedReason: string | null;
}
export interface RoastPublishPolicy { canPublish: boolean; audio: boolean; video: boolean }
export interface RoastMediaObservation { connectedIds: string[]; providerHealthy: boolean }
