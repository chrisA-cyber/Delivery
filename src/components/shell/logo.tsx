import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";

export function Logo({
  compact = false,
  gradientId = "delivery-header-spectrum",
  className,
}: {
  compact?: boolean;
  gradientId?: string;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "brand-link group inline-flex min-h-11 items-center gap-2",
        className,
      )}
      aria-label="Delivery home"
    >
      <BrandMark className="brand-mark shrink-0" gradientId={gradientId} />
      {!compact && (
        <span className="brand-wordmark">
          delivery
        </span>
      )}
    </Link>
  );
}
