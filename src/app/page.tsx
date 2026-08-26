import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, AudioWaveform, Flame, Gamepad2, Radio, Share2, Sparkles, Trophy, Users } from "lucide-react";
import { HeroDemo } from "@/components/landing/hero-demo";
import { LandingFeed } from "@/components/landing/landing-feed";
import { ResultTicker } from "@/components/landing/result-ticker";
import { SiteFooter } from "@/components/shell/site-footer";

export const metadata: Metadata = {
  title: "Delivery — Say the line. Get judged.",
};

const modes = [
  { href: "/daily", title: "Daily Drop", label: "Same line. Whole internet.", icon: Flame, accent: "text-orange-400", glow: "bg-orange-400/10" },
  { href: "/challenge", title: "Friend Fight", label: "Pick their poison.", icon: Users, accent: "text-hot", glow: "bg-hot/10" },
  { href: "/endless", title: "Hot Streak", label: "Stop only when the aura dies.", icon: Trophy, accent: "text-acid", glow: "bg-acid/10" },
  { href: "/stream", title: "Stream Mode", label: "Big type. Chat chaos. No dead air.", icon: Radio, accent: "text-electric", glow: "bg-electric/10" },
];

export default function HomePage() {
  return (
    <>
      <main>
        <section className="relative overflow-hidden px-4 pb-20 pt-28 sm:px-6 sm:pt-36 lg:min-h-[820px] lg:px-8 lg:pb-28 lg:pt-28">
          <div className="pointer-events-none absolute inset-0 grid-fade opacity-60" />
          <div className="pointer-events-none absolute left-[8%] top-36 size-48 rounded-full bg-acid/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.08fr_.92fr]">
            <div>
              <div className="mb-7 inline-flex rotate-[-1.5deg] items-center gap-2 rounded-full border border-acid/25 bg-acid/10 px-3 py-2 text-acid">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-acid opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-acid" />
                </span>
                <span className="mono-label">Your mic is hot</span>
              </div>
              <h1 className="display-type max-w-[780px] text-[clamp(4rem,7vw,7rem)] text-white">
                SAY THE LINE.<br />
                <span className="text-gradient">GET JUDGED.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg font-medium leading-7 text-white/58 sm:text-xl sm:leading-8">
                One line. One energy. One wildly overqualified AI critic. Give it everything or become content for everyone else.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/play" className="button-primary min-h-14 px-7 text-sm">
                  <AudioWaveform className="size-5" /> Play now — no account <ArrowRight className="size-4" />
                </Link>
                <Link href="#the-chaos" className="button-secondary min-h-14 px-7 text-sm">
                  <Gamepad2 className="size-5" /> See the chaos
                </Link>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold text-white/35">
                <span>✓ 10-second setup</span>
                <span>✓ Retakes allowed</span>
                <span>✓ Dignity optional</span>
              </div>
            </div>
            <HeroDemo />
          </div>
        </section>

        <ResultTicker />

        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr] lg:items-end">
              <div>
                <p className="mono-label text-acid">Three taps to fame</p>
                <h2 className="display-type mt-4 text-5xl sm:text-7xl">NO RULEBOOK.<br />JUST COMMIT.</h2>
              </div>
              <p className="max-w-xl text-lg leading-8 text-white/50 lg:justify-self-end">
                Delivery turns the thing your friends already do—making each other say ridiculous things—into a game with receipts.
              </p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                ["01", "Get the line", "Fresh prompts, cursed modifiers, and exactly enough context to make a bad choice."],
                ["02", "Perform it", "Record in-browser. Retake until it feels dangerous—or submit the first take like a legend."],
                ["03", "Face judgment", "Get scored on commitment, comedy, accuracy, and chaos. Share the verdict, not your excuses."],
              ].map(([number, title, description], index) => (
                <article key={number} className="panel relative overflow-hidden p-6 sm:p-7">
                  <span className="display-type absolute -right-2 -top-4 text-8xl text-white/[0.035]">{number}</span>
                  <span className={`mono-label ${index === 0 ? "text-acid" : index === 1 ? "text-hot" : "text-electric"}`}>{number}</span>
                  <h3 className="mt-10 text-2xl font-black tracking-[-0.04em]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/50">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-y border-white/10 bg-[#0d0d0f] px-4 py-24 sm:px-6 lg:px-8">
          <div className="absolute inset-0 grid-fade opacity-40" />
          <div className="relative mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="mono-label text-hot">Choose your chaos</p>
                <h2 className="display-type mt-4 text-5xl sm:text-7xl">ONE MIC. SIX BAD IDEAS.</h2>
              </div>
              <Link href="/discover" className="button-ghost self-start sm:self-auto">Browse every pack <ArrowRight className="size-4" /></Link>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {modes.map(({ href, title, label, icon: Icon, accent, glow }) => (
                <Link key={href} href={href} className="panel group relative min-h-56 overflow-hidden p-5 transition duration-300 hover:-translate-y-1 hover:border-white/25">
                  <div className={`absolute -right-10 -top-10 size-36 rounded-full ${glow} blur-3xl transition group-hover:scale-150`} />
                  <Icon className={`size-6 ${accent}`} />
                  <div className="absolute inset-x-5 bottom-5">
                    <h3 className="text-2xl font-black tracking-[-0.045em]">{title}</h3>
                    <p className="mt-2 text-sm leading-5 text-white/45">{label}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-xs font-black text-white/75 group-hover:text-white">Enter mode <ArrowRight className="size-3.5 transition group-hover:translate-x-1" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="the-chaos" className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-11 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="mono-label text-acid">Fresh from the feed</p>
                <h2 className="display-type mt-4 text-5xl sm:text-7xl">WATCH PEOPLE COMMIT.</h2>
              </div>
              <Link href="/feed" className="button-secondary">Open the feed <ArrowRight className="size-4" /></Link>
            </div>
            <LandingFeed />
          </div>
        </section>

        <section className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="relative mx-auto grid max-w-7xl overflow-hidden rounded-[32px] border border-electric/25 bg-electric p-7 text-white shadow-2xl sm:p-12 lg:grid-cols-[1fr_.65fr] lg:items-center">
            <div className="absolute inset-0 grid-fade opacity-30" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-2">
                <Radio className="size-4" /> <span className="mono-label">Built for streamers</span>
              </div>
              <h2 className="display-type mt-6 text-5xl sm:text-7xl">ZERO DEAD AIR.<br />MAXIMUM CLIPS.</h2>
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-white/75">Full-screen prompts, keyboard controls, an on-screen energy vote, and clean browser-source views. Your next bit is already waiting.</p>
              <Link href="/stream" className="button-primary mt-8">Set up stream mode <ArrowRight className="size-4" /></Link>
            </div>
            <div className="relative mt-10 lg:mt-0 lg:justify-self-end">
              <div className="animate-float rounded-3xl border-4 border-black bg-[#111] p-5 shadow-[14px_14px_0_#caff33]">
                <p className="mono-label text-hot">Chat chose</p>
                <p className="mt-4 text-2xl font-black leading-tight">“Say it like your Wi‑Fi just developed free will.”</p>
                <div className="mt-6 flex items-end gap-1">
                  {Array.from({ length: 18 }).map((_, index) => <span key={index} className="w-1.5 rounded-full bg-acid" style={{ height: `${10 + ((index * 17) % 42)}px` }} />)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-28 text-center sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <Sparkles className="mx-auto size-8 text-hot" />
            <h2 className="display-type mt-6 text-[clamp(3.4rem,9vw,7.8rem)]">YOUR GROUP CHAT<br />NEEDS THIS.</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-7 text-white/50">No download. No tutorial. No reason to sound that confident—and yet.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/play" className="button-primary min-h-14 px-8"><AudioWaveform className="size-5" /> Take the mic</Link>
              <Link href="/challenge" className="button-secondary min-h-14 px-8"><Share2 className="size-5" /> Challenge someone</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
