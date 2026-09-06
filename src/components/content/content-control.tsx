"use client";

import { useId, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import type { ContentRating } from "@/lib/content/types";

export const CONTENT_LABELS: Record<ContentRating, string> = {
  everyone: "Clean",
  teen: "Spicy",
  mature: "Mature · 18+",
};

export function ContentControl({
  value,
  onChange,
  disabled = false,
  compact = false,
  allowMature = true,
}: {
  value: ContentRating;
  onChange: (value: ContentRating) => void;
  disabled?: boolean;
  compact?: boolean;
  allowMature?: boolean;
}) {
  const [confirmMature, setConfirmMature] = useState(false);
  const id = useId();
  return (
    <div
      className={`content-control ${compact ? "content-control-compact" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="mono-label text-white/70" id={id}>
          Content
        </span>
        <div className="segmented-control" role="group" aria-labelledby={id}>
          {(["everyone", "teen", "mature"] as const).filter((rating) => allowMature || rating !== "mature").map((rating) => (
            <button
              type="button"
              key={rating}
              aria-pressed={value === rating}
              disabled={disabled}
              onClick={() =>
                rating === "mature" && value !== "mature"
                  ? setConfirmMature(true)
                  : onChange(rating)
              }
            >
              {CONTENT_LABELS[rating]}
            </button>
          ))}
        </div>
      </div>
      {!compact && (
        <p className="mt-2 text-xs leading-5 text-white/65">
          {value === "everyone"
            ? "No profanity or adult sexual jokes. A cleaner set for hosts."
            : value === "teen"
              ? "Awkward confessions, bad decisions, and mild language."
              : "Strong profanity, sexual innuendo, and adult jokes. For adults only."}
        </p>
      )}
      {confirmMature && (
        <div
          className="mature-consent mt-3 rounded-xl border border-acid/40 bg-ink p-4"
          role="group"
          aria-label="Mature content confirmation"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-paper">Turn up the filter?</p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Mature includes strong language, sexual innuendo, and adult
                jokes. Only enable this if you are 18 or older.
              </p>
            </div>
            <button
              type="button"
              className="icon-button shrink-0"
              aria-label="Cancel mature content"
              onClick={() => setConfirmMature(false)}
            >
              <X className="size-4" />
            </button>
          </div>
          <button
            type="button"
            className="button-primary mt-4"
            onClick={() => {
              onChange("mature");
              setConfirmMature(false);
            }}
          >
            I’m 18+ · Enable mature <ArrowRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
