import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Crown, Sparkles } from "lucide-react";
import { getPackById, getPromptsForPack, PACKS } from "@/data/content";
import { ProPlayLink } from "@/components/pricing/pro-gate";

export function generateStaticParams() {
  return PACKS.map((pack) => ({ packId: pack.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ packId: string }> }): Promise<Metadata> {
  const { packId } = await params;
  const pack = getPackById(packId);
  return pack ? { title: pack.name, description: pack.description } : {};
}

export default async function PackPage({ params }: { params: Promise<{ packId: string }> }) {
  const { packId } = await params;
  const pack = getPackById(packId);
  if (!pack) notFound();
  const prompts = getPromptsForPack(pack.id);

  return (
    <main className="min-h-screen px-4 pb-28 pt-28 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/discover" className="button-ghost mb-7 min-h-9 px-2"><ArrowLeft className="size-4" /> All packs</Link>
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 p-6 sm:p-10" style={{ background: `linear-gradient(145deg, ${pack.color}30, #0e0e10 58%)` }}>
          <div className="absolute -right-20 -top-32 size-96 rounded-full blur-3xl" style={{ background: `${pack.color}35` }} />
          <div className="relative max-w-3xl">
            <div className="flex items-center gap-3"><span className="mono-label rounded-full px-3 py-1.5" style={{ background: pack.color, color: pack.accent }}>{pack.eyebrow}</span>{pack.access === "pro" && <Crown className="size-5 text-yellow-300" />}</div>
            <h1 className="display-type mt-6 text-6xl sm:text-8xl">{pack.name}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/55">{pack.description}</p>
            <div className="mt-8 flex flex-wrap gap-3"><ProPlayLink href={`/play?pack=${pack.id}`} requiresPro={pack.access === "pro"} className="button-primary">{pack.access === "pro" ? "Unlock or play" : "Play this pack"} <ArrowRight className="size-4" /></ProPlayLink><span className="button-secondary cursor-default">{prompts.length} original lines</span></div>
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-6 flex items-end justify-between"><div><p className="mono-label text-acid">Line preview</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">A taste of the trouble</h2></div><Sparkles className="size-5" style={{ color: pack.color }} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {prompts.slice(0, 10).map((prompt, index) => (
              <ProPlayLink key={prompt.id} href={`/play?prompt=${prompt.id}`} requiresPro={pack.access === "pro"} className="panel group flex min-h-32 items-start justify-between gap-4 p-5 transition hover:border-white/25">
                <div><span className="mono-label text-white/25">#{String(index + 1).padStart(2, "0")} · {prompt.difficulty}</span><p className="mt-3 text-lg font-black leading-6 tracking-[-0.025em]">“{prompt.line}”</p></div><ArrowRight className="mt-1 size-4 shrink-0 text-white/25 transition group-hover:translate-x-1 group-hover:text-white" />
              </ProPlayLink>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
