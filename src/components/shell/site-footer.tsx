import Link from "next/link";
import { Logo } from "@/components/shell/logo";

const groups: Array<{ title: string; links: Array<[string, string]> }> = [
  {
    title: "Play",
    links: [
      ["Switch", "/switch"],
      ["Classic", "/play"],
      ["Say It Back", "/say-it-back"],
      ["Roast Off", "/roast-off"],
      ["Friends", "/rounds"],
      ["Daily", "/daily"],
      ["Impossible", "/impossible"],
      ["For hosts", "/stream"],
    ],
  },
  {
    title: "Explore",
    links: [
      ["Saved performances", "/profile"],
      ["Packs", "/discover"],
      ["Submit a line", "/submit"],
      ["Feed", "/feed"],
      ["Leaderboards", "/leaderboard"],
      ["Pricing", "/pricing"],
    ],
  },
  {
    title: "About",
    links: [
      ["Guidelines", "/guidelines"],
      ["Safety", "/guidelines#safety"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 px-5 pb-28 pt-10 md:pb-10">
      <div className="mx-auto grid max-w-[1184px] gap-8 lg:grid-cols-[1.4fr_2fr]">
        <div>
          <Logo gradientId="delivery-footer-spectrum" />
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">
            Same phrase. Different energy.
          </p>
          <p className="mono-label mt-5 text-white/50">
            © {new Date().getFullYear()} Delivery Game
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mono-label mb-3 text-white/55">{group.title}</p>
              <div className="grid gap-1">
                {group.links.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="inline-flex min-h-11 items-center text-sm font-bold text-white/65 transition hover:text-mint"
                  >
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
