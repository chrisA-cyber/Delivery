import type { SayClip } from "./types";

export const SCENE_CATEGORIES = [
  { value: "all", label: "All scenes" },
  { value: "streamers", label: "Streamers" },
  { value: "movies", label: "Movies" },
  { value: "internet", label: "Internet" },
  { value: "custom", label: "Your creations" },
  { value: "other", label: "Other" },
] as const;

export type SceneCategory = typeof SCENE_CATEGORIES[number]["value"];
export type SceneLibraryFilters = {
  search: string;
  category: SceneCategory;
  genre: string;
  length: "all" | "quick" | "short" | "long";
  difficulty: "all" | SayClip["difficulty"];
  sort: "newest" | "shortest" | "longest" | "title";
};
export const DEFAULT_SCENE_FILTERS: SceneLibraryFilters = {
  search: "", category: "all", genre: "all", length: "all", difficulty: "all", sort: "newest",
};

const MOVIE_GENRES: Record<string, string> = {
  comedy: "Comedy", "classic comedy": "Comedy", "sci-fi": "Sci-fi",
  horror: "Horror", drama: "Drama", "cult movie": "Cult movies",
};

/** Browse labels only: immutable manifests and existing assignments stay intact. */
export function sceneGenre(clip: SayClip): string | null {
  return MOVIE_GENRES[clip.category.toLowerCase()] ?? null;
}

export function sceneCategory(clip: SayClip): SceneCategory {
  if (clip.tags.includes("custom") || clip.category === "Your scenes") return "custom";
  if (clip.category.toLowerCase() === "twitch") return "streamers";
  if (clip.category.toLowerCase() === "internet") return "internet";
  if (sceneGenre(clip)) return "movies";
  return "other";
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[’‘']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function matchesSceneSearch(search: string, ...fields: string[]): boolean {
  const haystack = normalizeSearch(fields.join(" "));
  return normalizeSearch(search).split(/\s+/).every((word) => haystack.includes(word));
}

export function filterScenes(clips: SayClip[], filters: SceneLibraryFilters): SayClip[] {
  const result = clips.filter((clip) => {
    if (filters.category !== "all" && sceneCategory(clip) !== filters.category) return false;
    if (filters.genre !== "all" && sceneGenre(clip) !== filters.genre) return false;
    if (filters.difficulty !== "all" && clip.difficulty !== filters.difficulty) return false;
    if (filters.length === "quick" && clip.duration >= 5) return false;
    if (filters.length === "short" && (clip.duration < 5 || clip.duration > 15)) return false;
    if (filters.length === "long" && clip.duration <= 15) return false;
    return matchesSceneSearch(filters.search, clip.title, clip.description, clip.category,
      clip.source.title, clip.source.creator, ...clip.tags, ...clip.roles.map((role) => role.name),
      ...clip.cues.map((cue) => cue.text));
  });
  // The catalog endpoint supplies newest-first order; do not invent popularity.
  if (filters.sort === "shortest") result.sort((a, b) => a.duration - b.duration);
  if (filters.sort === "longest") result.sort((a, b) => b.duration - a.duration);
  if (filters.sort === "title") result.sort((a, b) => a.title.localeCompare(b.title));
  return result;
}

export function hasSceneFilters(filters: SceneLibraryFilters): boolean {
  return Boolean(filters.search.trim() || filters.category !== "all" || filters.genre !== "all"
    || filters.length !== "all" || filters.difficulty !== "all");
}
