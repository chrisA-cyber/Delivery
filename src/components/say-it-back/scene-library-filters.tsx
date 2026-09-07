"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SayClip } from "@/lib/say-it-back/types";
import { DEFAULT_SCENE_FILTERS, filterScenes, hasSceneFilters, SCENE_CATEGORIES, sceneCategory, sceneGenre, type SceneLibraryFilters } from "@/lib/say-it-back/library";

const SELECT = "min-h-11 min-w-0 rounded-lg border border-white/15 bg-surface px-3 text-xs font-bold text-paper";

export function SceneLibraryControls({ clips, value, onChange, resultCount, loading }: {
  clips: SayClip[]; value: SceneLibraryFilters; onChange: (value: SceneLibraryFilters) => void; resultCount: number; loading: boolean;
}) {
  const update = (changes: Partial<SceneLibraryFilters>) => onChange({ ...value, ...changes });
  const genres = [...new Set([...clips.flatMap((clip) => sceneGenre(clip) ?? []), ...(value.genre === "all" ? [] : [value.genre])])].sort();
  // Category counts reflect the other filters, so switching a category is predictable.
  const categoryMatches = filterScenes(clips, { ...value, category: "all", genre: "all" });
  const active = hasSceneFilters(value);

  return <section className="mb-5 space-y-3" aria-label="Filter scenes">
    <div className="flex gap-2 sm:gap-3">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-white/45" />
        <input type="search" aria-label="Search scenes" placeholder="Search scenes, creators, or dialogue" value={value.search} onChange={(event) => update({ search: event.target.value })} className="min-h-11 w-full rounded-lg border border-white/20 bg-surface pl-10 pr-10 text-sm text-paper placeholder:text-white/45" />
        {value.search && <button type="button" aria-label="Clear search" onClick={() => update({ search: "" })} className="absolute right-0 top-0 grid size-11 place-items-center text-white/60"><X className="size-4" /></button>}
      </div>
      <select aria-label="Sort scenes" value={value.sort} onChange={(event) => update({ sort: event.target.value as SceneLibraryFilters["sort"] })} className={cn(SELECT, "w-32 sm:w-40")}>
        <option value="newest">Newest first</option><option value="shortest">Shortest first</option><option value="longest">Longest first</option><option value="title">Title A–Z</option>
      </select>
    </div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Scene categories">
      {SCENE_CATEGORIES.filter((category) => category.value === "all" || category.value === value.category || clips.some((clip) => sceneCategory(clip) === category.value)).map((category) => {
        const count = category.value === "all" ? categoryMatches.length : categoryMatches.filter((clip) => sceneCategory(clip) === category.value).length;
        return <button type="button" key={category.value} aria-pressed={value.category === category.value} onClick={() => update({ category: category.value, genre: "all" })} className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-xs font-bold transition-colors", value.category === category.value ? "border-acid bg-acid/10 text-acid" : "border-white/15 bg-surface text-white/65 hover:border-white/40 hover:text-paper")}>
          {category.label}<span className="text-[10px] tabular-nums opacity-60">{loading ? "…" : count}</span>
        </button>;
      })}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <SlidersHorizontal className="mr-1 hidden size-4 text-white/40 sm:block" aria-hidden="true" />
      <select aria-label="Scene length" value={value.length} onChange={(event) => update({ length: event.target.value as SceneLibraryFilters["length"] })} className={cn(SELECT, "flex-1 sm:flex-none")}>
        <option value="all">Any length</option><option value="quick">Under 5 seconds</option><option value="short">5–15 seconds</option><option value="long">Over 15 seconds</option>
      </select>
      <select aria-label="Scene difficulty" value={value.difficulty} onChange={(event) => update({ difficulty: event.target.value as SceneLibraryFilters["difficulty"] })} className={cn(SELECT, "flex-1 sm:flex-none")}>
        <option value="all">Any difficulty</option><option value="easy">Easy</option><option value="medium">A little acting</option><option value="hard">Bring your A-game</option>
      </select>
      {(value.category === "all" || value.category === "movies") && (genres.length > 1 || value.genre !== "all") && <select aria-label="Movie genre" value={value.genre} onChange={(event) => update({ genre: event.target.value })} className={SELECT}>
        <option value="all">All movie genres</option>{genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
      </select>}
      {active && <button type="button" className="button-ghost min-h-11 px-2 text-xs" onClick={() => onChange({ ...DEFAULT_SCENE_FILTERS, sort: value.sort })}><X className="size-3.5" />Clear filters</button>}
      <p role="status" aria-live="polite" aria-atomic="true" className="ml-auto text-xs tabular-nums text-white/50">{loading ? "Loading scenes…" : `${resultCount} ${resultCount === 1 ? "scene" : "scenes"}`}</p>
    </div>
  </section>;
}
