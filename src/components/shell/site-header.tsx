"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/shell/logo";
import { useApp } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";
const links = [
  { href: "/play", label: "Classic" },
  { href: "/say-it-back", label: "Say It Back" },
  { href: "/daily", label: "Daily" },
  { href: "/discover", label: "Packs" },
  { href: "/rounds", label: "Friends" },
  { href: "/stream", label: "For hosts" },
];
export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { profile, authenticated, authReady } = useApp();
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);
  if (pathname.startsWith("/stream/stage")) return null;
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/15 bg-ink/95 backdrop-blur-lg">
      <div className="mx-auto flex h-[72px] max-w-[1248px] items-center justify-between gap-3 px-4 sm:px-8">
        <div className="flex items-center gap-10">
          <Logo />
          <nav
            className="hidden items-center gap-1 lg:flex"
            aria-label="Main navigation"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={
                  pathname.startsWith(link.href) ? "page" : undefined
                }
                className={cn(
                  "inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-bold transition-colors",
                  pathname.startsWith(link.href)
                    ? "bg-paper text-ink"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="icon-button hidden sm:grid"
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </Link>
          {!authReady ? (
            <span
              className="size-11 rounded-lg bg-white/5"
              aria-label="Checking account"
            />
          ) : authenticated ? (
            <Link
              href="/profile"
              className="grid size-11 place-items-center rounded-lg bg-hot text-sm font-bold text-ink"
              aria-label="Your profile"
            >
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
            onClick={() => setOpen((value) => !value)}
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
        <nav
          id="mobile-menu"
          aria-label="Menu"
          className="grid max-h-[calc(100dvh-72px)] gap-1 overflow-y-auto border-t border-white/15 bg-ink p-3 lg:hidden"
        >
          {[
            ...links,
            { href: "/feed", label: "Public performances" },
            { href: "/leaderboard", label: "Leaderboards" },
            { href: "/settings", label: "Settings" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-bold hover:bg-white/10"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
