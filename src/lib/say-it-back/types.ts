export const SAY_SCORING_VERSION = "say-match-v1.2" as const;

export interface SayCue { id: string; roleId: string; text: string; start: number; end: number }
export interface SayRole {
  id: string;
  name: string;
  description: string;
  /** Seconds relative to the excerpt. Selected dialogue is removed over these intervals. */
  muteIntervals: { start: number; end: number }[];
  /** Optional clean background + other speakers; takes precedence over interval muting. */
  dubAudioUrl?: string;
}
export interface SayClip {
  id: string;
  version: string;
  title: string;
  description: string;
  duration: number;
  difficulty: "easy" | "medium" | "hard";
  rating: "everyone" | "teen" | "mature";
  category: string;
  tags: string[];
  videoUrl: string;
  posterUrl: string;
  referenceAudioUrl?: string;
  assetIntegrity?: Record<string, string>;
  roles: SayRole[];
  cues: SayCue[];
  source: {
    title: string; creator: string; url: string; license: string;
    licenseUrl: string; attribution: string; reuseNote: string;
    excerptStart: number; excerptEnd: number;
  };
}
export interface SayWord { text: string; start: number; end: number }
export interface SayTimingEvidence {
  method: "pcm-energy-v1";
  status: "refined" | "verified" | "unavailable";
  frameMs: number;
  noiseFloorRms?: number;
  thresholdRms?: number;
  adjustments: { wordIndex: number; edge: "start" | "end"; rawSeconds: number; measuredSeconds: number }[];
  reason?: string;
}
export interface SayScore {
  version: string;
  overall: number;
  words: number;
  timing: number | null;
  rhythm: number | null;
  delivery: null;
  weights: { words: number; timing: number; rhythm: number; delivery: 0 };
  transcript: string;
  observations: string[];
  coachNote: string;
  limitations: string[];
  evidence: {
    substitutions: number; omissions: number; additions: number; expectedWords: number;
    matchedWords: number; meanStartErrorMs: number | null;
    phrases: { cueId: string; expectedStart: number; actualStart: number | null; expectedEnd: number; actualEnd: number | null }[];
    transcriptionModel: string; audioHash: string;
    timingRefinement?: SayTimingEvidence;
  };
}
export interface SayAttempt {
  id: string;
  mode: "say-it-back";
  clip: SayClip;
  roleId: string;
  status: "ready" | "judging" | "scored" | "failed";
  score: SayScore | null;
  audioUrl: string;
  audioExpiresAt: string;
  durationMs: number;
  /** Audio time at scene time zero; measured capture/playback startup only. */
  recordingOffsetMs: number;
  scoringVersion: string;
  createdAt: string;
  saved: boolean;
  owned: boolean;
  warning?: string;
  previousBest?: number | null;
  challengeId?: string | null;
}
export interface SayChallenge {
  id: string;
  token: string;
  url: string;
  clip: SayClip;
  roleId: string;
  scoringVersion: string;
  expiresAt: string;
  challengerName: string;
  challengerAttempt: SayAttempt;
  recipientAttempts: SayAttempt[];
}
