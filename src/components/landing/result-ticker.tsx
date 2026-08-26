const items = [
  "@mayhem · 94 · FULL COMMIT",
  "@tinyvoice · 38 · MIC FRIGHT",
  "@unc_jpeg · 87 · WEIRDLY MOVING",
  "@lagqueen · 99 · LEGALLY CINEMA",
  "@softlaunch · 72 · AURA DETECTED",
  "@chairperson · 44 · HR HAS QUESTIONS",
];

export function ResultTicker() {
  return (
    <div className="overflow-hidden border-y border-white/10 bg-white/[0.03] py-3" aria-label="Recent delivery results">
      <div className="flex w-max animate-marquee motion-reduce:animate-none">
        {[...items, ...items].map((item, index) => (
          <div key={`${item}-${index}`} className="flex items-center gap-5 px-5">
            <span className="size-1.5 rounded-full bg-acid" />
            <span className="mono-label whitespace-nowrap text-white/50">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
