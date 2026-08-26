export type GameMode =
  | "classic"
  | "daily"
  | "endless"
  | "impossible"
  | "challenge"
  | "stream";

export type ScoreKey = "commitment" | "comedy" | "accuracy" | "chaos";

export interface Prompt {
  id: string;
  line: string;
  energy: string;
  category: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  pack?: string;
  tags?: string[];
  source?: "editorial" | "community" | "trend";
}

export interface DeliveryScores {
  commitment: number;
  comedy: number;
  accuracy: number;
  chaos: number;
  overall: number;
}

export interface JudgeResult {
  id: string;
  scores: DeliveryScores;
  verdict: string;
  title: string;
  moment: string;
  transcript: string;
  badge?: string;
  percentile?: number;
  xp?: number;
  source?: "ai" | "fallback";
}

export interface DeliveryReference {
  id: string | null;
  persisted: boolean;
  dailyRanked?: boolean;
  dailyRank?: number;
  dailyParticipants?: number;
  visibility?: "public" | "private" | "unlisted";
  publishedAt?: string | null;
}

export interface DeliveryHistoryItem extends JudgeResult {
  prompt: Prompt;
  createdAt: string;
  audioUrl?: string;
  liked?: boolean;
  visibility?: "public" | "private" | "unlisted";
  dailyRanked?: boolean;
  dailyRank?: number;
  dailyParticipants?: number;
}

export interface EarnedBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rarity: string;
  awardedAt: string;
}

export interface DeliveryProfile {
  handle: string;
  displayName: string;
  bio?: string;
  isPrivate?: boolean;
  avatar: string;
  level: number;
  xp: number;
  streak: number;
  followers: number;
  following: number;
  avatarUrl?: string;
}
