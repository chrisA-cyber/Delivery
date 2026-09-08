import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageShell({ eyebrow, title, description, children, className }: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("min-h-screen px-4 pb-28 pt-24 sm:px-6 sm:pt-28 lg:px-8", className)}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 grid gap-3 border-b border-white/15 pb-6 sm:mb-8 sm:gap-5 sm:pb-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div className="min-w-0">
            {eyebrow && <p className="mono-label mb-3 text-violet">{eyebrow}</p>}
            <h1 className="display-type break-words text-[clamp(2.6rem,6vw,4.8rem)] leading-[1.04] text-paper">{title}</h1>
          </div>
          {description && <p className="max-w-xl text-base leading-7 text-white/65 lg:pb-1">{description}</p>}
        </header>
        {children}
      </div>
    </main>
  );
}
