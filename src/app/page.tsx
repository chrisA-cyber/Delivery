import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  CalendarDays,
  Clapperboard,
  Flame,
  Radio,
  Shuffle,
  Users,
} from "lucide-react";
import { HeroDemo } from "@/components/landing/hero-demo";
import { SiteFooter } from "@/components/shell/site-footer";

export const metadata: Metadata = {
  title: "Delivery — Terrible lines. Incredible commitment.",
};

const modes = [
  {
    href: "/play",
    icon: AudioLines,
    title: "Classic",
    label: "One line. All you.",
    copy: "Get a ridiculous line and a direction. Make it convincing.",
    cue: "Give it everything.",
    color: "text-acid",
    surface: "border-acid/25 bg-acid/5 hover:border-acid/60",
  },
  {
    href: "/say-it-back",
    icon: Clapperboard,
    title: "Say It Back",
    label: "Your voice. Their scene.",
    copy: "Watch a scene, record the dialogue, and play your dub.",
    cue: "You’re in the scene.",
    color: "text-electric",
    surface: "border-electric/25 bg-electric/5 hover:border-electric/60",
  },
  {
    href: "/switch",
    icon: Shuffle,
    title: "Switch",
    label: "Same phrase. New energy.",
    copy: "Repeat one phrase as the emotion or speaking speed changes.",
    cue: "😄  😢  😠  😳",
    badge: "Beta",
    color: "text-hot",
    surface: "border-hot/25 bg-hot/5 hover:border-hot/60",
  },
  {
    href: "/roast-off",
    icon: Flame,
    title: "Roast Off",
    label: "A live stage. A loud crowd.",
    copy: "Watch, chat, and vote. Or step up and take the mic.",
    cue: "Step up or spectate.",
    badge: "18+",
    color: "text-acid",
    surface: "border-acid/25 bg-acid/5 hover:border-acid/60",
  },
];

const ways = [
  {
    href: "/rounds",
    icon: Users,
    title: "Play with friends",
    copy: "One invite. Everyone brings a take.",
  },
  {
    href: "/daily",
    icon: CalendarDays,
    title: "Try today’s line",
    copy: "Same assignment. A fresh leaderboard.",
  },
  {
    href: "/stream",
    icon: Radio,
    title: "Host your community",
    copy: "Collect performances. Run the show.",
  },
];

export default function HomePage() {
  return (
    <>
      <main>
        <section className="home-wrap home-hero">
          <div className="home-grid">
            <div>
              <p className="mono-label mb-5 flex items-center gap-2 text-electric">
                <AudioLines className="size-4" />
                The voice performance game
              </p>
              <h1 className="display-type home-headline">
                Terrible lines.
                <br />
                <span className="text-gradient">Incredible commitment.</span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-white/70 sm:text-lg">
                Make a scene with just your voice. Record, replay, and share your best take.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/play" className="button-primary min-h-14 px-7">
                  <AudioLines className="size-5" />
                  Play Classic
                  <ArrowRight className="size-4" />
                </Link>
                <Link href="#games" className="button-secondary min-h-14">
                  Choose a mode
                </Link>
              </div>
              <p className="mt-4 text-xs leading-6 text-white/60">
                No account needed. Private until you share.
              </p>
            </div>
            <HeroDemo />
          </div>
        </section>

        <section className="home-wrap scroll-mt-24 pb-10" id="games" aria-labelledby="games-title">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 id="games-title" className="display-type text-4xl sm:text-5xl">
              Pick your performance.
            </h2>
            <span className="mono-label text-white/55">Solo, with friends, or live</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modes.map(({ href, icon: Icon, title, label, copy, cue, badge, color, surface }) => (
              <Link
                href={href}
                key={href}
                className={`group flex flex-col rounded-2xl border p-5 transition-colors ${surface}`}
              >
                <div className="mb-6 flex items-center justify-between gap-3">
                  <Icon className={`size-6 ${color}`} />
                  {badge && <span className={`mono-label rounded-full border border-white/15 px-2 py-1 ${color}`}>{badge}</span>}
                </div>
                <p className="text-xs text-white/60">{label}</p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight">{title}</h3>
                <p className="mb-5 mt-3 flex-1 text-sm leading-6 text-white/70">{copy}</p>
                <div className={`flex min-h-11 items-center justify-between gap-3 border-t border-white/10 pt-4 ${color}`}>
                  <span className={title === "Switch" ? "text-xl" : "text-xs font-bold"} aria-hidden={title === "Switch" ? true : undefined}>{cue}</span>
                  <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-wrap pb-12" aria-label="More ways to play">
          <div className="grid gap-3 md:grid-cols-3">
            {ways.map(({ href, icon: Icon, title, copy }) => (
              <Link href={href} key={href} className="panel group flex items-center gap-4 p-5 transition-colors hover:border-electric/40">
                <Icon className="size-5 shrink-0 text-electric" />
                <div className="flex-1">
                  <h2 className="text-sm font-bold">{title}</h2>
                  <p className="mt-1 text-xs leading-5 text-white/60">{copy}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-white/50 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 bg-surface/50">
          <div className="home-wrap py-10 sm:py-12">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <h2 className="display-type text-3xl sm:text-4xl">Find your next line.</h2>
              <Link href="/discover" className="button-secondary">
                All packs <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Public Apology", "Confessions and delusions.", "internet-originals", "bg-electric"],
                ["Clip That", "The microphone was definitely on.", "stream-gremlins", "bg-hot"],
                ["Do Not Forward", "Keep the voice notes. Keep the receipts.", "group-chat-evidence", "bg-acid"],
              ].map(([name, copy, id, color]) => (
                <Link key={id} href={`/discover/${id}`} className={`group rounded-xl p-5 text-ink ${color}`}>
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-xl font-bold tracking-tight">{name}</h3>
                    <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink/75">{copy}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
