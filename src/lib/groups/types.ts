import type { ContentRating } from "@/lib/content/types";
import type { SayAttempt, SayClip, SayScore } from "@/lib/say-it-back/types";
import type { DeliveryJudgment } from "@/lib/types";

export type GroupMode = "classic" | "say-it-back";
export type GroupAssignment = {
  mode: "classic"; promptId: string; promptSlug: string; promptText: string;
  energyId: string; energySlug: string; energy: string; category: string;
  difficulty: number; rating: ContentRating; scoringVersion: string; rubricVersion: string;
} | {
  mode: "say-it-back"; clip: SayClip; roleId: string;
  rating: ContentRating; scoringVersion: string;
};
export interface GroupPerformance {
  takeId: string; memberId: string; mode: GroupMode; audioUrl: string;
  durationMs: number; submittedAt: string | null; canSubmit: boolean;
  sharingStatus: "unreviewed" | "approved" | "pending" | "rejected" | "review";
  score: DeliveryJudgment | SayScore | null;
  scoreGroup: "classic" | "full-match" | "words-only" | "unscored";
  sayAttempt?: SayAttempt;
}
export interface GroupMember {
  id: string; displayName: string; isHost: boolean; isYou: boolean;
  submitted: boolean; joinedAt: string; votes: number;
  performance: GroupPerformance | null;
}
export interface CommunityState {
  phase: "submissions" | "review" | "showcase" | "voting" | "results";
  code: string; submissionLimit: number; votingEnabled: boolean;
  selectedIds: string[]; displayUrl?: string; displayRevoked: boolean;
  currentMemberId: string | null; command: "play" | "pause" | "replay"; revision: number;
  participantCount: number; nextRoundUrl: string | null;
}
export interface GroupRound {
  community?: CommunityState | null;
  id: string; token: string; name: string; url: string;
  state: "open" | "revealed" | "expired";
  assignment: GroupAssignment; createdAt: string; closesAt: string;
  closedAt: string | null; replayUntil: string; inviteRevoked: boolean;
  maxMembers: number; members: GroupMember[]; submittedCount: number;
  viewerMemberId: string | null; isHost: boolean; isGuest: boolean;
  canJoin: boolean; canClaim: boolean; viewerVoteMemberId: string | null;
  previousRoundId: string | null; previousRoundUrl?: string | null;
  /** Private uploaded Classic takes, or compatible saved Say takes for this viewer. */
  yourTakes: GroupPerformance[];
}
export interface CreateGroupRoundInput {
  requestId: string; name: string; displayName: string; mode: GroupMode;
  closesInHours: 1 | 24 | 72 | 168; maxRating: ContentRating;
  community?: boolean; submissionLimit?: number; audienceVoting?: boolean;
  clipId?: string; clipVersion?: string; roleId?: string;
  promptId?: string; energyId?: string;
}
