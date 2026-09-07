"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Menu, Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/shell/logo";
import { useApp } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";

const mainLinks = [
  { href: "/play", label: "Classic" },
  { href: "/say-it-back", label: "Say It Back" },
  { href: "/switch", label: "Switch" },
  { href: "/roast-off", label: "Roast Off" },
  { href: "/rounds", label: "Friends" },
];
const moreLinks = [
  { href: "/daily", label: "Daily" },
  { href: "/discover", label: "Packs" },
  { href: "/stream", label: "For hosts" },
  { href: "/feed", label: "Public performances" },
  { href: "/leaderboard", label: "Leaderboards" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const more = useRef<HTMLDivElement>(null);
  const moreTrigger = useRef<HTMLButtonElement>(null);
  const { profile, authenticated, authReady } = useApp();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (moreOpen) {
        setMoreOpen(false);
        moreTrigger.current?.focus();
      } else if (open) {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!more.current?.contains(target)) setMoreOpen(false);
      if (!header.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("keydown", close);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open, moreOpen]);
  useEffect(() => {
    setOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  if (pathname.startsWith("/stream/stage") || pathname.startsWith("/broadcast/")) return null;

  const navClass = (href: string) => cn(
    "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold transition-colors",
    isActive(href) ? "bg-paper text-ink" : "text-white/70 hover:bg-white/10 hover:text-white",
  );

  return (
    <header ref={header} className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-ink/95 backdrop-blur-lg">
      <div className="mx-auto flex h-[72px] max-w-[1248px] items-center justify-between gap-3 px-4 sm:px-8">
        <div className="flex items-center gap-6">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {mainLinks.map((link) => (
              <Link key={link.href} href={link.href} aria-current={isActive(link.href) ? "page" : undefined} className={navClass(link.href)}>
                {link.label}
              </Link>
            ))}
            <div
              ref={more}
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMoreOpen(false);
              }}
            >
              <button
                ref={moreTrigger}
                type="button"
                onClick={() => setMoreOpen((value) => !value)}
                aria-expanded={moreOpen}
                aria-controls="more-navigation"
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition-colors",
                  moreOpen || moreLinks.some((link) => isActive(link.href)) ? "bg-white/10 text-paper" : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                More
                <ChevronDown className={cn("size-3.5 transition-transform", moreOpen && "rotate-180")} />
              </button>
              {moreOpen && (
                <div id="more-navigation" className="absolute right-0 top-full mt-2 grid w-56 gap-1 rounded-xl border border-white/15 bg-surface p-2 shadow-2xl">
                  {moreLinks.map((link) => (
                    <Link key={link.href} href={link.href} onClick={() => setMoreOpen(false)} aria-current={isActive(link.href) ? "page" : undefined} className={navClass(link.href)}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings" className="icon-button hidden sm:grid" aria-label="Settings">
            <Settings className="size-4" />
          </Link>
          {!authReady ? (
            <span className="size-11 rounded-lg bg-white/5" aria-label="Checking account" />
          ) : authenticated ? (
            <Link href="/profile" className="grid size-11 place-items-center rounded-lg bg-hot text-sm font-bold text-ink" aria-label="Your profile">
              {profile.avatar}
            </Link>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(pathname.startsWith("/auth/") || pathname === "/login" ? "/profile" : pathname)}`}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                const destination = pathname.startsWith("/auth/") || pathname === "/login" ? "/profile" : `${window.location.pathname}${window.location.search}${window.location.hash}`;
                router.push(`/login?next=${encodeURIComponent(destination)}`);
              }}
              className="button-secondary shrink-0 whitespace-nowrap px-3"
            >
              Sign in
            </Link>
          )}
          <button
            ref={trigger}
            type="button"
            onClick={() => {
              setOpen((value) => !value);
              setMoreOpen(false);
            }}
            className="icon-button lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label="Menu" className="grid max-h-[calc(100dvh-72px)] gap-1 overflow-y-auto border-t border-white/10 bg-ink p-3 pb-6 lg:hidden">
          {[...mainLinks, ...moreLinks, { href: "/settings", label: "Settings" }].map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(navClass(link.href), "px-4", index === mainLinks.length && "mt-2 border-t border-white/10")}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
