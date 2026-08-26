"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioLines, Compass, Home, Radio, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Packs", icon: Compass },
  { href: "/play", label: "Deliver", icon: AudioLines, primary: true },
  { href: "/feed", label: "Feed", icon: Radio },
  { href: "/profile", label: "You", icon: UserRound },
];

export function MobileDock() {
  const pathname = usePathname();
  const activeGame = pathname.startsWith("/play") || pathname.startsWith("/daily") || pathname.startsWith("/endless") || pathname.startsWith("/impossible") || pathname.startsWith("/stream/stage") || pathname.startsWith("/challenge/");
  if (activeGame) return null;

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 flex h-16 items-center justify-around rounded-2xl border border-white/10 bg-black/80 px-2 shadow-2xl backdrop-blur-2xl md:hidden" aria-label="Mobile navigation">
      {items.map(({ href, label, icon: Icon, primary }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            href={href}
            key={href}
            className={cn(
              "relative flex min-w-12 flex-col items-center gap-1 text-[9px] font-black uppercase tracking-wide",
              active ? "text-white" : "text-white/55",
            )}
          >
            <span className={cn("grid size-8 place-items-center rounded-full", primary && "-mt-6 size-12 bg-acid text-black shadow-acid")}>
              <Icon className={cn(primary ? "size-5" : "size-4")} />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
