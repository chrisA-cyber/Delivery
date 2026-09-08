import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, AudioLines, CalendarDays, Clapperboard, Flame, Radio, Users } from "lucide-react";
import { HeroDemo } from "@/components/landing/hero-demo";
import { SiteFooter } from "@/components/shell/site-footer";

export const metadata: Metadata = {
  title: { absolute: "Delivery — Same phrase. Different energy." },
  description: "Play Switch: repeat a phrase through five emotions or speeds. Record with an avatar or camera, replay your take, and challenge a friend. No account needed.",
};

const modes = [
  {
    href: "/play",
    icon: AudioLines,
    title: "Classic",
    label: "Make the line convincing.",
    copy: "One ridiculous line. One acting direction. All you.",
    color: "text-acid",
    surface: "border-acid/20 bg-acid/[.04] hover:border-acid/50 hover:bg-acid/[.07]",
    iconSurface: "bg-acid/10",
  },
  {
    href: "/say-it-back",
    icon: Clapperboard,
    title: "Say It Back",
    label: "Put yourself in the scene.",
    copy: "Watch the original. Record the dialogue. Play your dub.",
    color: "text-electric",
    surface: "border-electric/20 bg-electric/[.04] hover:border-electric/50 hover:bg-electric/[.07]",
    iconSurface: "bg-electric/10",
  },
  {
    href: "/roast-off",
    icon: Flame,
    title: "Roast Off",
    label: "Take the stage. Or take a seat.",
    copy: "Live battles. Join the crowd, vote, or grab the mic.",
    badge: "18+",
    color: "text-hot",
    surface: "border-hot/20 bg-hot/[.04] hover:border-hot/50 hover:bg-hot/[.07]",
    iconSurface: "bg-hot/10",
  },
];

const ways = [
  { href: "/rounds", icon: Users, title: "Play with friends", copy: "Same challenge. Your best takes.", color: "text-violet" },
  { href: "/daily", icon: CalendarDays, title: "Today’s Classic", copy: "A fresh line and a shared leaderboard.", color: "text-acid" },
  { href: "/stream", icon: Radio, title: "Host your community", copy: "Collect takes. Let the crowd decide.", color: "text-violet" },
];

export default function HomePage() {
  return (
    <>
      <main>
        <section className="home-wrap home-hero">
          <HeroDemo />
        </section>

        <section className="home-wrap scroll-mt-24 pb-8" id="games" aria-labelledby="games-title">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 id="games-title" className="text-2xl font-bold tracking-tight sm:text-3xl">More ways to make a scene.</h2>
            <Link href="/switch" className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-mint">All Switch phrases <ArrowRight className="size-3.5" /></Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {modes.map(({ href, icon: Icon, title, label, copy, badge, color, surface, iconSurface }) => (
              <Link href={href} key={href} className={`group flex flex-col rounded-2xl border p-5 transition-colors ${surface}`}>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className={`grid size-11 place-items-center rounded-xl ${iconSurface}`}><Icon className={`size-5 ${color}`} /></span>
                  {badge && <span className={`rounded-full border border-hot/20 px-2 py-1 text-[10px] font-bold ${color}`}>{badge}</span>}
                </div>
                <h3 className="text-xl font-bold tracking-tight">{title}</h3>
                <p className={`mt-2 text-xs font-bold ${color}`}>{label}</p>
                <p className="mb-4 mt-3 flex-1 text-sm leading-6 text-white/65">{copy}</p>
                <div className={`flex min-h-9 items-center justify-between gap-3 border-t border-white/10 pt-4 ${color}`}>
                  <span className="text-xs font-bold">{title === "Roast Off" ? "Enter Roast Off" : `Play ${title}`}</span>
                  <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-wrap pb-12" aria-label="Play together and daily challenges">
          <div className="grid gap-3 md:grid-cols-3">
            {ways.map(({ href, icon: Icon, title, copy, color }) => (
              <Link href={href} key={href} className="panel group flex items-center gap-3 p-4 transition-colors hover:border-white/30">
                <Icon className={`size-5 shrink-0 ${color}`} />
                <div className="flex-1">
                  <h2 className="text-sm font-bold">{title}</h2>
                  <p className="mt-1 text-xs leading-5 text-white/55">{copy}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-white/50 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
