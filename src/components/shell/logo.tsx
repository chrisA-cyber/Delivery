import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="Delivery home"
    >
      <span className="relative grid size-9 shrink-0 -rotate-3 place-items-center overflow-hidden rounded-[11px] bg-acid text-ink shadow-acid transition-transform duration-200 group-hover:rotate-3 group-hover:scale-105">
        <svg viewBox="0 0 34 34" className="size-7" aria-hidden="true">
          <path d="M11.7 7.4h6.9c5.4 0 8.7 3.2 8.7 9.4 0 6.5-3.4 10-9.1 10h-6.5V7.4Z" fill="none" stroke="currentColor" strokeWidth="3.2" />
          <path d="M5.8 12.1h7.7M4.2 17h8.1M6.5 21.9h7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="absolute right-1 top-0.5 size-1.5 rounded-full bg-hot" />
      </span>
      {!compact && (
        <span className="display-type text-[1.2rem] tracking-[-0.075em] text-white">Delivery</span>
      )}
    </Link>
  );
}
