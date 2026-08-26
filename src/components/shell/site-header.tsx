"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, Flame, Menu, Trophy, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/shell/logo";
import { useApp } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";

const links = [
  { href: "/play", label: "Play" },
  { href: "/discover", label: "Packs" },
  { href: "/feed", label: "Feed" },
  { href: "/leaderboard", label: "Ranks" },
  { href: "/pricing", label: "Pro" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { profile, authenticated, authReady, tier } = useApp();

  if (pathname.startsWith("/stream/stage")) return null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between rounded-2xl border border-white/10 bg-black/65 px-3 shadow-2xl shadow-black/25 backdrop-blur-2xl sm:px-4">
        <div className="flex items-center gap-7">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-2 text-xs font-extrabold transition-colors",
                  pathname.startsWith(link.href)
                    ? "bg-white text-black"
                    : "text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 sm:flex">
            <Flame className="size-3.5 text-orange-400" fill="currentColor" />
            <span className="text-xs font-black">{profile.streak}</span>
            <span className="text-[10px] font-bold text-white/40">STREAK</span>
          </div>
          <Link
            href="/leaderboard"
            className="hidden size-9 place-items-center rounded-full border border-white/10 text-white/65 transition hover:bg-white/10 hover:text-white sm:grid"
            aria-label="Leaderboard"
          >
            <Trophy className="size-4" />
          </Link>
          {!authReady ? <span className="size-9 animate-pulse rounded-full bg-white/10" aria-label="Checking account" /> : authenticated ? <Link
            href="/profile"
            className="relative grid size-9 place-items-center rounded-full bg-gradient-to-br from-hot to-violet text-xs font-black text-white shadow-hot"
            aria-label="Your profile"
          >
            {profile.avatar}{tier === "pro" && <Crown className="absolute -right-1 -top-1 size-3.5 rounded-full bg-black p-0.5 text-acid" />}
          </Link> : <Link href="/login" className="hidden min-h-9 items-center rounded-full border border-white/15 px-3 text-xs font-black text-white/70 hover:border-acid/40 hover:text-acid sm:inline-flex">Sign in</Link>}
          <button
            onClick={() => setOpen((value) => !value)}
            className="grid size-9 place-items-center rounded-full border border-white/10 text-white lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="mx-auto mt-2 grid max-w-7xl gap-1 rounded-2xl border border-white/10 bg-[#111]/95 p-2 shadow-2xl backdrop-blur-2xl lg:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-xl px-4 py-3 text-sm font-black",
                pathname.startsWith(link.href) ? "bg-acid text-black" : "text-white/70",
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/settings" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-black text-white/70">
            Settings
          </Link>
        </nav>
      )}
    </header>
  );
}
