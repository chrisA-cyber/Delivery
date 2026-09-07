"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioLines, Clapperboard, Shuffle, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/switch", label: "Switch", icon: Shuffle },
  { href: "/rounds", label: "Friends", icon: Users },
  { href: "/play", label: "Classic", icon: AudioLines, primary: true },
  { href: "/say-it-back", label: "Say It Back", icon: Clapperboard },
  { href: "/profile", label: "You", icon: UserRound },
];

export function MobileDock() {
  const pathname = usePathname();
  const activeGame =
    pathname.startsWith("/play") ||
    pathname.startsWith("/say-it-back") ||
    pathname.startsWith("/switch") ||
    pathname.startsWith("/roast-off") ||
    pathname.startsWith("/daily") ||
    pathname.startsWith("/endless") ||
    pathname.startsWith("/impossible") ||
    (pathname.startsWith("/stream/stage") || pathname.startsWith("/broadcast/")) ||
    pathname.startsWith("/challenge/") ||
    (pathname.startsWith("/rounds/") && pathname.endsWith("/record"));
  if (activeGame) return null;

  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-50 flex h-16 items-center justify-around rounded-2xl border border-white/10 bg-ink/95 px-2 shadow-2xl backdrop-blur-2xl md:hidden"
      aria-label="Mobile navigation"
    >
      {items.map(({ href, label, icon: Icon, primary }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            href={href}
            key={href}
            className={cn(
              "relative flex min-h-12 min-w-12 justify-center flex-col items-center gap-1 text-[9px] font-black uppercase tracking-wide",
              active ? "text-white" : "text-white/55",
            )}
          >
            <span
              className={cn(
                "grid size-8 place-items-center rounded-full",
                primary && "size-8 rounded-lg bg-acid text-black",
              )}
            >
              <Icon className={cn(primary ? "size-5" : "size-4")} />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
