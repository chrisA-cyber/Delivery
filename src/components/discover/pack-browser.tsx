"use client";

import { ArrowRight, Crown, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { queryPrompts, type ContentPack } from "@/data/content";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers/app-provider";
import { ContentControl } from "@/components/content/content-control";

const filters = ["all", "free", "pro", "rotating"] as const;
const colors = ["#f4f0e7", "#c9b7ef", "#c9edbc", "#ff745c", "#f0caa4", "#d9d9cd"];

export function PackBrowser({ packs }: { packs: readonly ContentPack[]; promptCounts?: Record<string, number> }) {
  const { tier, billing, contentRating, updatePreferences } = useApp();
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [query, setQuery] = useState("");
  const allowed = useMemo(() => queryPrompts({ maxRating: contentRating }), [contentRating]);
  const visible = useMemo(() => packs.filter((pack) => {
    const matchesFilter = filter === "all" || pack.access === filter;
    const search = query.trim().toLowerCase();
    return matchesFilter && (!search || `${pack.name} ${pack.description} ${pack.eyebrow}`.toLowerCase().includes(search));
  }), [filter, packs, query]);

  return (
    <>
      <div className="mb-7 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <ContentControl value={contentRating} onChange={(contentRating) => updatePreferences({ contentRating })} />
        <label className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-white/20 bg-white/[.03] px-4 text-white/65 focus-within:border-acid">
          <span className="sr-only">Search packs</span><Search className="size-4 shrink-0" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search packs" className="min-w-0 w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/50" />
        </label>
      </div>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-white/15 pb-4" aria-label="Pack access filter">
        {filters.map((item) => <button key={item} onClick={() => setFilter(item)} aria-pressed={filter === item} className={cn("min-h-11 rounded-lg px-4 text-sm font-bold capitalize transition", filter === item ? "bg-white text-black" : "text-white/65 hover:bg-white/5 hover:text-white")}>{item === "all" ? "All packs" : item}</button>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((pack) => {
          const prompts = allowed.filter((prompt) => prompt.packIds.includes(pack.id));
          const color = colors[Math.max(0, packs.findIndex((candidate) => candidate.id === pack.id)) % colors.length];
          const locked = pack.access === "pro" && tier !== "pro";
          return <article key={pack.id} className="flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/[.025]">
            <div className="flex min-h-52 flex-col p-5 text-[#171715] sm:p-6" style={{ background: color }}>
              <div className="flex items-center justify-between gap-3"><p className="mono-label text-black/65">{pack.eyebrow}</p>{pack.access === "pro" && <Crown className="size-4 shrink-0" />}</div>
              <h2 className="display-type mt-auto pt-8 text-4xl leading-none">{pack.name}</h2>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <p className="text-sm leading-6 text-white/65">{pack.description}</p>
              <p className="mono-label mt-5 text-white/55">{prompts.length} lines at your setting · {pack.access}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {prompts.length > 0 ? <Link href={locked ? `/pricing?pack=${pack.id}` : `/play?pack=${pack.id}`} className="button-primary flex-1 px-4">{locked ? billing.checkoutAvailable ? "Unlock pack" : "Pro unavailable" : "Play pack"}<ArrowRight className="size-4" /></Link> : <span className="py-3 text-sm text-white/65">Choose a higher intensity to play.</span>}
                <Link href={`/discover/${pack.id}`} className="button-secondary px-4">Preview</Link>
              </div>
            </div>
          </article>;
        })}
      </div>
      {visible.length === 0 && <div className="panel grid min-h-64 place-content-center px-5 text-center"><p className="text-xl font-bold">No packs found.</p><p className="mt-2 text-sm text-white/65">Try a different name or access filter.</p><button onClick={() => { setQuery(""); setFilter("all"); }} className="button-secondary mx-auto mt-5">Reset filters</button></div>}
    </>
  );
}
