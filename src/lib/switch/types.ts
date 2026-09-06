import type { ContentRating } from "@/lib/content/types";

/** Switch stays separate from all historical Classic and Say It Back scores. */
export const SWITCH_SCORING_VERSION = "switch-audio-v1-beta" as const;
export const SWITCH_RUBRIC_VERSION = "switch-audio-v1.0" as const;
export const SWITCH_TIMING_TOLERANCE_MS = 750;

export interface SwitchCue {
  id: string;
  text: string;
  emoji: string;
  /** Requested performed pace, never a playback or time-stretch setting. */
  speed?: number;
  direction: string;
  directionLabel: string;
  /** Seconds on the uninterrupted recording's media clock. */
  start: number;
  end: number;
}

/** Persist the entire snapshot. Never reconstruct an old take from today's catalog. */
export interface SwitchChallenge {
  id: string;
  version: string;
  title: string;
  description: string;
  kind: "emotion" | "speed";
  duration: number;
  difficulty: "easy" | "medium";
  rating: ContentRating;
  tags: string[];
  scoringVersion: string;
  rubricVersion: string;
  cues: SwitchCue[];
}

export interface SwitchScore {
  version: string;
  rubricVersion: string;
  beta: true;
  ranked: false;
  overall: number | null;
  words: number | null;
  delivery: number | null;
  transitions: number | null;
  transcript: string;
  segments: {
    cueId: string;
    words: number | null;
    delivery: number | null;
    feedback: string;
  }[];
  transitionFeedback: string;
  coachNote: string;
  limitations: string[];
  evidence: {
    source: "audio";
    audioHash: string;
    model: string;
    timing: "approximate" | "uncertain";
    timingToleranceMs: number;
    recordingOffsetMs: number;
  };
}

export interface SwitchAttempt {
  id: string;
  mode: "switch";
  challenge: SwitchChallenge;
  status: "ready" | "judging" | "scored" | "failed";
  score: SwitchScore | null;
  audioUrl: string;
  audioExpiresAt: string;
  durationMs: number;
  /** Measured capture startup offset only; never alignment to the player's words. */
  recordingOffsetMs: number;
  scoringVersion: string;
  createdAt: string;
  saved: boolean;
  owned: boolean;
  warning?: string;
  previousBest?: number | null;
  challengeId?: string | null;
}

export interface SwitchInvitation {
  id: string;
  token: string;
  url: string;
  challenge: SwitchChallenge;
  scoringVersion: string;
  expiresAt: string;
  challengerName: string;
  challengerAttempt: SwitchAttempt;
  recipientAttempts: SwitchAttempt[];
}
