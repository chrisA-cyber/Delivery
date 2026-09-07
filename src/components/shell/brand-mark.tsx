import { BRAND_MARK_PATH, BRAND_GRADIENT_STOPS } from "@/lib/brand";

export function BrandMark({ className, size = 40, gradientId = "delivery-og-spectrum" }: {
  className?: string;
  size?: number;
  gradientId?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          {BRAND_GRADIENT_STOPS.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={color} />)}
        </linearGradient>
      </defs>
      <path d={BRAND_MARK_PATH} fill={`url(#${gradientId})`} fillRule="evenodd" />
    </svg>
  );
}
