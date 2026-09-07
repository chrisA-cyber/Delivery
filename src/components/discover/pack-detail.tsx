"use client";

import { ArrowLeft, ArrowRight, Crown } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/providers/app-provider";
import { ContentControl } from "@/components/content/content-control";
import { ProPlayLink } from "@/components/pricing/pro-gate";
import { queryPrompts, type ContentPack } from "@/data/content";

export function PackDetail({ pack }: { pack: ContentPack }) {
  const { contentRating, updatePreferences } = useApp();
  const prompts = queryPrompts({ packIds: [pack.id], maxRating: contentRating });
  return <main className="min-h-screen px-4 pb-28 pt-28 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl">
    <Link href="/discover" className="button-ghost mb-6 px-0"><ArrowLeft className="size-4" /> All packs</Link>
    <header className="grid gap-6 rounded-2xl bg-paper p-6 text-ink sm:p-9 lg:grid-cols-[1.2fr_1fr] lg:items-end">
      <div><p className="mono-label flex items-center gap-2 text-black/60">{pack.access === "pro" && <Crown className="size-4" />}{pack.eyebrow}</p><h1 className="display-type mt-6 text-[clamp(2.8rem,7vw,5.5rem)] leading-none">{pack.name}</h1></div>
      <div><p className="max-w-lg text-base leading-7 text-black/70">{pack.description}</p>{prompts.length > 0 && <ProPlayLink href={`/play?pack=${pack.id}`} requiresPro={pack.access === "pro"} className="button-primary mt-6">{pack.access === "pro" ? "Unlock or play" : "Play this pack"}<ArrowRight className="size-4" /></ProPlayLink>}</div>
    </header>
    <section className="mt-9">
      <div className="mb-6 grid gap-5 border-b border-white/15 pb-6 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="mono-label text-acid">Inside the pack</p><h2 className="mt-2 text-2xl font-bold">The lines. Your interpretation.</h2><p className="mt-2 text-sm text-white/65">{prompts.length} available at your content setting. Each draw adds a delivery direction.</p></div><ContentControl value={contentRating} onChange={(contentRating) => updatePreferences({ contentRating })} compact /></div>
      {prompts.length ? <div className="grid gap-3 md:grid-cols-2">{prompts.map((prompt, index) => <ProPlayLink key={prompt.id} href={`/play?prompt=${prompt.id}`} requiresPro={pack.access === "pro"} className="group flex min-h-36 items-start justify-between gap-4 rounded-xl border border-white/15 bg-white/[.025] p-5 transition hover:border-acid/70"><div><span className="mono-label text-white/50">{String(index + 1).padStart(2, "0")} · {prompt.difficulty} · {prompt.rating === "mature" ? "18+ mature" : prompt.rating}</span><p className="mt-3 text-lg font-bold leading-7">“{prompt.line}”</p></div><ArrowRight className="mt-1 size-4 shrink-0 text-acid" /></ProPlayLink>)}</div> : <div className="panel p-7 text-center"><h2 className="text-xl font-bold">This pack has no lines at your current setting.</h2><p className="mt-3 text-sm text-white/65">You can adjust the content control above or choose another pack.</p><Link href="/discover" className="button-secondary mt-5">Browse packs</Link></div>}
    </section>
  </div></main>;
}
