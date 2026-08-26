import type { ReactNode } from "react";
import { Logo } from "@/components/shell/logo";

export function LegalPage({ title, updated = "August 25, 2026", children }: { title: string; updated?: string; children: ReactNode }) { return <main className="min-h-screen px-4 pb-24 pt-28 sm:px-6"><article className="mx-auto max-w-3xl"><Logo /><p className="mono-label mt-12 text-acid">Last updated {updated}</p><h1 className="display-type mt-4 text-5xl sm:text-7xl">{title}</h1><div className="mt-10 space-y-8 text-sm leading-7 text-white/60 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-black [&_h2]:tracking-[-0.03em] [&_h2]:text-white [&_ul]:ml-5 [&_ul]:list-disc [&_li]:mt-2 [&_a]:text-acid [&_a]:underline">{children}</div></article></main>; }
