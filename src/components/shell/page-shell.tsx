import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageShell({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("min-h-screen px-4 pb-28 pt-28 sm:px-6 lg:px-8", className)}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-9 max-w-3xl">
          {eyebrow && <p className="mono-label mb-4 text-acid">{eyebrow}</p>}
          <h1 className="display-type text-5xl text-white sm:text-7xl">{title}</h1>
          {description && <p className="mt-5 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">{description}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
