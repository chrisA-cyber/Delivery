import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  CalendarDays,
  Headphones,
  Radio,
  Users,
} from "lucide-react";
import { HeroDemo } from "@/components/landing/hero-demo";
import { SiteFooter } from "@/components/shell/site-footer";

export const metadata: Metadata = {
  title: "Delivery — Terrible lines. Incredible commitment.",
};
const ways = [
  {
    href: "/daily",
    icon: CalendarDays,
    number: "01",
    title: "The Daily",
    copy: "One line. One direction. Everyone gets the same assignment. Your first signed-in score counts.",
  },
  {
    href: "/challenge",
    icon: Users,
    number: "02",
    title: "Make it personal",
    copy: "Choose a line and direction for a friend. Send a challenge. Let the performances settle it.",
  },
  {
    href: "/stream",
    icon: Radio,
    number: "03",
    title: "Take it on stream",
    copy: "A host-operated stage with big prompts and keyboard controls. Clean content starts on. Available with Pro.",
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
                <span className="text-acid">
                  Incredible
                  <br />
                  commitment.
                </span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-white/70 sm:text-lg">
                Get a ridiculous line. Sell the delivery. Face the verdict. Your
                voice is the whole show.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/play" className="button-primary min-h-14 px-7">
                <AudioLines className="size-5" />
                Play Classic
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/say-it-back" className="button-secondary min-h-14">
                Say It Back
                <ArrowRight className="size-4" />
              </Link>
              </div>
              <p className="mt-4 text-xs leading-6 text-white/60">
                No account needed. Retakes encouraged. Private until you share.
              </p>
            </div>
            <HeroDemo />
          </div>
        </section>
        <div className="home-wrap">
          <div className="hero-strip">
            <span className="mono-label text-electric">
              Your voice. Your interpretation.
            </span>
            <span className="mono-label">20 seconds per take</span>
            <span className="mono-label">Zero camera pressure</span>
            <span className="mono-label">Clean → Spicy → Mature 18+</span>
          </div>
        </div>
        <section className="home-wrap home-section" id="how-to-play">
          <div className="mb-10 grid gap-5 md:grid-cols-2 md:items-end">
            <h2 className="display-type text-5xl sm:text-7xl">
              It’s all
              <br />
              in the delivery.
            </h2>
            <p className="max-w-md text-base leading-7 text-white/70 md:justify-self-end">
              The line is only half the joke. Whisper the meltdown. Fight tears
              during the victory speech. Mean every terrible word.
            </p>
          </div>
          {[
            [
              "01",
              "Read the room. Badly.",
              "Your line comes with a playable direction. Take a breath, rehearse privately, and find your version of the bit.",
            ],
            [
              "02",
              "Give us the performance.",
              "Record your voice in the browser. Listen back immediately. Keep it, or take another swing before you submit.",
            ],
            [
              "03",
              "Collect your consequences.",
              "Get a verdict and a note for your next take. Try the same direction again, draw another line, or challenge a friend.",
            ],
          ].map(([n, title, copy]) => (
            <article className="feature-row" key={n}>
              <span className="display-type text-4xl text-acid">{n}</span>
              <h3 className="text-xl font-bold tracking-tight sm:text-2xl">
                {title}
              </h3>
              <p className="text-sm leading-7 text-white/70">{copy}</p>
            </article>
          ))}
        </section>
        <section className="border-y border-white/15 bg-[#20201d]">
          <div className="home-wrap home-section">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="mono-label mb-3 text-hot">
                  Six new packs. Many questionable choices.
                </p>
                <h2 className="display-type text-5xl sm:text-7xl">
                  The group chat
                  <br />
                  has evidence.
                </h2>
              </div>
              <Link href="/discover" className="button-secondary">
                Find your next line
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                [
                  "Public Apology",
                  "Confessions and delusions. Somehow, the apology makes it worse.",
                  "internet-originals",
                  "bg-electric",
                ],
                [
                  "Clip That",
                  "Familiar phrases and streamer meltdowns. The microphone was definitely on.",
                  "stream-gremlins",
                  "bg-hot",
                ],
                [
                  "Do Not Forward",
                  "Voice notes with no plausible deniability. Keep the receipts.",
                  "group-chat-evidence",
                  "bg-acid",
                ],
              ].map(([name, copy, id, color]) => (
                <Link
                  key={id}
                  href={`/discover/${id}`}
                  className={`group rounded-2xl p-6 text-ink ${color}`}
                >
                  <p className="mono-label mb-12">Classic line pack</p>
                  <h3 className="display-type text-4xl">{name}</h3>
                  <p className="mt-3 text-sm leading-6">{copy}</p>
                  <span className="mt-7 inline-flex min-h-11 items-center gap-2 text-xs font-bold">
                    Open pack
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
            <p className="mt-6 max-w-2xl text-sm leading-6 text-white/65">
              Start Clean. Turn up to Spicy for sharper lines, or explicitly opt
              in to Mature (18+) for profanity and adult jokes. Hosts get a
              separate Clean default.
            </p>
          </div>
        </section>
        <section className="home-wrap home-section">
          <div className="mb-10">
            <p className="mono-label mb-3 text-electric">
              Bring someone into the bit
            </p>
            <h2 className="display-type text-5xl sm:text-7xl">
              Your mic. More possibilities.
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {ways.map(({ href, icon: Icon, number, title, copy }) => (
              <Link
                href={href}
                key={href}
                className="panel group flex flex-col p-6"
              >
                <div className="flex items-center justify-between">
                  <Icon className="size-6 text-acid" />
                  <span className="mono-label text-white/55">{number}</span>
                </div>
                <h3 className="mt-10 text-2xl font-bold tracking-tight">
                  {title}
                </h3>
                <p className="mb-6 mt-3 flex-1 text-sm leading-6 text-white/70">
                  {copy}
                </p>
                <span className="inline-flex min-h-11 items-center gap-2 text-xs font-bold">
                  {title === "The Daily"
                    ? "Play today’s line"
                    : title === "Make it personal"
                      ? "Create a challenge"
                      : "Set up your stage"}
                  <ArrowRight className="size-4" />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="home-wrap pb-16">
          <div className="rounded-2xl bg-paper p-7 text-ink sm:p-12">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div>
                <Headphones className="mb-5 size-7" />
                <h2 className="display-type text-5xl sm:text-7xl">
                  Say it like
                  <br />
                  you mean it.
                </h2>
                <p className="mt-5 max-w-md text-sm leading-6 text-ink/70">
                  One ridiculous line is a good place to start.
                </p>
              </div>
              <Link
                href="/play"
                className="button-primary min-h-14 self-start px-7 md:self-end"
              >
                Take the mic
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
