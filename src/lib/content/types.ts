export type PromptCategory =
  | "main-character"
  | "group-chat"
  | "gaming"
  | "anime-energy"
  | "cinema-coded"
  | "workplace"
  | "romance"
  | "villain-era"
  | "brainrot"
  | "customer-service"
  | "streamer-mode"
  | "wildcard";

export type PromptDifficulty = "easy" | "medium" | "hard" | "impossible";
export type ContentRating = "everyone" | "teen" | "mature";
export type PackAccess = "free" | "pro" | "rotating";

export type ScoringDimension =
  | "commitment"
  | "comedy"
  | "accuracy"
  | "chaos";

export interface ContentPack {
  readonly id: string;
  readonly name: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly access: PackAccess;
  readonly categories: readonly PromptCategory[];
  readonly color: string;
  readonly accent: string;
  readonly icon: string;
  readonly coverTone: string;
  readonly sortOrder: number;
  readonly featured?: boolean;
}

export interface DeliveryPrompt {
  readonly id: string;
  readonly line: string;
  readonly category: PromptCategory;
  readonly packIds: readonly string[];
  readonly tags: readonly string[];
  readonly difficulty: PromptDifficulty;
  readonly rating: ContentRating;
  readonly scoringFocus: readonly ScoringDimension[];
  readonly locale: "en";
  readonly isMimic?: boolean;
}

export interface EnergyModifier {
  readonly id: string;
  readonly instruction: string;
  readonly shortLabel: string;
  readonly intensity: 1 | 2 | 3 | 4 | 5;
  readonly tags: readonly string[];
  readonly compatibleDifficulties?: readonly PromptDifficulty[];
}

export interface RandomPromptOptions {
  readonly packId?: string;
  readonly packIds?: readonly string[];
  readonly categories?: readonly PromptCategory[];
  readonly difficulties?: readonly PromptDifficulty[];
  readonly maxRating?: ContentRating;
  readonly tags?: readonly string[];
  readonly excludeIds?: readonly string[];
  /** A stable seed makes the same input return the same prompt. */
  readonly seed?: string | number;
  /** Supply a testable/custom random source. Ignored when `seed` is present. */
  readonly random?: () => number;
}

export interface DailyPrompt {
  readonly dateKey: string;
  readonly prompt: DeliveryPrompt;
  readonly energy: EnergyModifier;
  readonly shareSlug: string;
}

export interface PromptQuery {
  readonly search?: string;
  readonly packIds?: readonly string[];
  readonly categories?: readonly PromptCategory[];
  readonly difficulties?: readonly PromptDifficulty[];
  readonly tags?: readonly string[];
  readonly maxRating?: ContentRating;
}

export interface TrendingPromptInjection {
  /** Stable identifier supplied by the editorial system. */
  readonly id: string;
  readonly prompt: DeliveryPrompt;
  readonly energyIds?: readonly string[];
  readonly startsAt: string;
  readonly endsAt: string;
  readonly markets?: readonly string[];
  readonly priority: number;
  readonly label?: string;
}

export interface ActiveTrend {
  readonly injection: TrendingPromptInjection;
  readonly compatibleEnergy: readonly EnergyModifier[];
}

export interface FavoritePromptRef {
  readonly promptId: string;
  readonly favoritedAt?: string;
}
