import { Award, Lock } from "lucide-react";

import type { EarnedBadge } from "@/types/game";
import { formatDate } from "@/lib/utils";
import { VISUAL_THEME } from "@/lib/visual-theme";

const badgeGlyphs: Record<string, string> = {
  mic: "🎙️",
  flame: "🔥",
  warning: "🌀",
  spark: "💯",
  repeat: "🔁",
  calendar: "📅",
  crown: "👑",
  heart: "💜",
  versus: "⚔️",
  spectrum: "🌈",
};

export function BadgeShelf({ badges, publicView = false }: { badges: EarnedBadge[]; publicView?: boolean }) {
  return (
    <section className="mt-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mono-label text-hot">Milestones</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Your milestones</h2>
        </div>
        <span className="mono-label text-white/55">{badges.length} earned</span>
      </div>
      {badges.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge) => (
            <article
              key={badge.id}
              className="rounded-xl border bg-white/[0.025] p-5"
              style={{ borderColor: `${badge.rarity === "legendary" ? VISUAL_THEME.accent : badge.rarity === "rare" ? VISUAL_THEME.pink : VISUAL_THEME.blue}55` }}
            >
              <span className="text-3xl" aria-hidden="true">{badgeGlyphs[badge.icon] ?? "🏆"}</span>
              <p className="mt-5 text-sm font-black">{badge.name}</p>
              <p className="mt-1 text-xs leading-5 text-white/65">{badge.description}</p>
              <p className="mono-label mt-4" style={{ color: badge.rarity === "legendary" ? VISUAL_THEME.accent : badge.rarity === "rare" ? VISUAL_THEME.pink : VISUAL_THEME.blue }}>{badge.rarity}</p>
              <p className="mt-1 text-[10px] font-bold text-white/55">Earned {formatDate(badge.awardedAt)}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel flex min-h-40 items-center gap-4 p-5 sm:p-6">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/5 text-white/60">
            {publicView ? <Award className="size-5" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-sm font-black">The trophy shelf is waiting.</p>
            <p className="mt-1 text-xs leading-5 text-white/65">{publicView ? "No public milestones have landed yet." : "Your first judged take unlocks the first one."}</p>
          </div>
        </div>
      )}
    </section>
  );
}
