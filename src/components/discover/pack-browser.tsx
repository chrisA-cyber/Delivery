"use client";

import { ArrowRight, Crown, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ContentPack } from "@/data/content";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers/app-provider";

const filters = ["all", "free", "pro", "rotating"] as const;

export function PackBrowser({ packs, promptCounts }: { packs: readonly ContentPack[]; promptCounts: Record<string, number> }) {
  const { tier } = useApp();
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => packs.filter((pack) => {
    const matchesFilter = filter === "all" || pack.access === filter;
    const search = query.trim().toLowerCase();
    return matchesFilter && (!search || `${pack.name} ${pack.description} ${pack.eyebrow}`.toLowerCase().includes(search));
  }), [filter, packs, query]);

  return (
    <>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button key={item} onClick={() => setFilter(item)} className={cn("rounded-full border px-4 py-2 text-xs font-black capitalize transition", filter === item ? "border-acid bg-acid text-black" : "border-white/10 bg-white/5 text-white/50 hover:text-white")}>
              {item === "all" ? "All packs" : item}
            </button>
          ))}
        </div>
        <label className="flex min-w-64 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-white/55 focus-within:border-white/25">
          <span className="sr-only">Search prompt packs</span>
          <Search className="size-4" />
          <span className="sr-only">Search packs</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find your flavor…" className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/55" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((pack, index) => (
          <article key={pack.id} className={cn("group relative min-h-[330px] overflow-hidden rounded-[26px] border border-white/10 p-6 transition duration-300 hover:-translate-y-1 hover:border-white/25", index === 0 && filter === "all" && "sm:col-span-2 lg:col-span-2")} style={{ background: `linear-gradient(145deg, ${pack.color}22, #111114 58%)` }}>
            <div className="absolute -right-16 -top-16 size-52 rounded-full blur-3xl transition duration-500 group-hover:scale-125" style={{ background: `${pack.color}35` }} />
            <div className="relative flex items-start justify-between">
              <span className="mono-label rounded-full px-3 py-1.5" style={{ background: pack.color, color: pack.accent }}>{pack.eyebrow}</span>
              {pack.access === "pro" ? <Crown className="size-5 text-yellow-300" /> : pack.featured ? <Sparkles className="size-5" style={{ color: pack.color }} /> : null}
            </div>
            <div className="absolute inset-x-6 bottom-6">
              <p className="mono-label mb-3 text-white/30">{promptCounts[pack.id] ?? 0} lines · {pack.access}</p>
              <h2 className="text-3xl font-black tracking-[-0.055em] sm:text-4xl">{pack.name}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/50">{pack.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href={pack.access === "pro" && tier !== "pro" ? `/pricing?pack=${pack.id}` : `/play?pack=${pack.id}`} className="button-primary min-h-10 px-4 py-2">{pack.access === "pro" && tier !== "pro" ? "Unlock pack" : "Play pack"} <ArrowRight className="size-3.5" /></Link>
                <Link href={`/discover/${pack.id}`} className="button-ghost min-h-10 px-4 py-2">Preview lines</Link>
              </div>
            </div>
          </article>
        ))}
      </div>
      {visible.length === 0 && <div className="panel grid min-h-64 place-content-center text-center"><p className="text-lg font-black">No pack matches that energy.</p><button onClick={() => { setQuery(""); setFilter("all"); }} className="button-ghost mt-3">Reset filters</button></div>}
    </>
  );
}
