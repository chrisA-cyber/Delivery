export const DELIVERY_MODES = [
  "classic",
  "daily",
  "endless",
  "challenge",
  "stream",
  "impossible",
] as const;

export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const PROMPT_CATEGORIES = [
  "internet",
  "chaotic-chat",
  "cinema",
  "anime",
  "gaming",
  "streamer",
  "original",
] as const;

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export type JudgmentSource = "openai" | "mock";

export type VerdictTag =
  | "MAIN_CHARACTER"
  | "AURA_FARMING"
  | "COMMITTED_TO_THE_BIT"
  | "CHAOS_MERCHANT"
  | "CINEMA"
  | "NPC_DIALOGUE"
  | "SENT_IT"
  | "NEEDS_MORE_SAUCE";

export interface ScoreBreakdown {
  commitment: number;
  comedy: number;
  accuracy: number;
  chaos: number;
  overall: number;
}

export interface DeliveryJudgment {
  transcript: string;
  scores: ScoreBreakdown;
  verdict: string;
  verdictTag: VerdictTag;
  highlights: string[];
  coachNote: string;
  source: JudgmentSource;
  model: string;
  warning?: string;
}

export interface DeliveryPrompt {
  id: string;
  text: string;
  category: PromptCategory;
  difficulty: 1 | 2 | 3 | 4 | 5;
  defaultEnergy: string;
  energyOptions: string[];
  packSlug: string;
  featured?: boolean;
}

export interface ShareDelivery {
  id: string;
  promptText: string;
  energy: string | null;
  score: number;
  scores: Omit<ScoreBreakdown, "overall">;
  verdict: string;
  verdictTag: VerdictTag;
  audioUrl: string | null;
  createdAt: string;
  player: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  requestId: string;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
