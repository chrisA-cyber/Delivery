import Link from "next/link";
import { Logo } from "@/components/shell/logo";

const groups: Array<{ title: string; links: Array<[string, string]> }> = [
  {
    title: "Play",
    links: [["Classic", "/play"], ["Daily", "/daily"], ["Impossible", "/impossible"], ["Stream mode", "/stream"]],
  },
  {
    title: "Explore",
    links: [["Packs", "/discover"], ["Submit a line", "/submit"], ["Feed", "/feed"], ["Leaderboards", "/leaderboard"], ["Pricing", "/pricing"]],
  },
  {
    title: "Keep it good",
    links: [["Guidelines", "/guidelines"], ["Safety", "/guidelines#safety"], ["Privacy", "/privacy"], ["Terms", "/terms"]],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 px-5 pb-28 pt-14 md:pb-12">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.4fr_2fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-sm text-sm leading-6 text-white/50">
            A microphone, a bad decision, and a brutally honest score. That&apos;s the whole game.
          </p>
          <p className="mono-label mt-8 text-white/25">© {new Date().getFullYear()} Delivery Game</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mono-label mb-4 text-white/35">{group.title}</p>
              <div className="grid gap-3">
                {group.links.map(([label, href]) => (
                  <Link key={href} href={href} className="text-sm font-bold text-white/65 transition hover:text-acid">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
