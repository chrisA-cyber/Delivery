import { Award, Lock } from "lucide-react";

import type { EarnedBadge } from "@/types/game";
import { formatDate } from "@/lib/utils";

const badgeGlyphs: Record<string, string> = {
  mic: "🎙️",
  flame: "🔥",
  warning: "🌀",
  spark: "💯",
  repeat: "🔁",
  calendar: "📅",
  crown: "👑",
  heart: "💚",
  versus: "⚔️",
  spectrum: "🌈",
};

export function BadgeShelf({ badges, publicView = false }: { badges: EarnedBadge[]; publicView?: boolean }) {
  return (
    <section className="mt-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mono-label text-hot">Milestones</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Bad decisions, commemorated</h2>
        </div>
        <span className="mono-label text-white/25">{badges.length} earned</span>
      </div>
      {badges.length ? (
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
          {badges.map((badge) => (
            <article
              key={badge.id}
              className="min-w-56 rounded-2xl border bg-white/[0.035] p-4"
              style={{ borderColor: `${badge.color}55`, boxShadow: `inset 0 1px 0 ${badge.color}22` }}
            >
              <span className="text-3xl" aria-hidden="true">{badgeGlyphs[badge.icon] ?? "🏆"}</span>
              <p className="mt-5 text-sm font-black">{badge.name}</p>
              <p className="mt-1 text-xs leading-5 text-white/40">{badge.description}</p>
              <p className="mono-label mt-4" style={{ color: badge.color }}>{badge.rarity}</p>
              <p className="mt-1 text-[10px] font-bold text-white/25">Earned {formatDate(badge.awardedAt)}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel flex min-h-40 items-center gap-4 p-5 sm:p-6">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/5 text-white/30">
            {publicView ? <Award className="size-5" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-sm font-black">The trophy shelf is waiting.</p>
            <p className="mt-1 text-xs leading-5 text-white/40">{publicView ? "No public milestones have landed yet." : "Your first judged take unlocks the first one."}</p>
          </div>
        </div>
      )}
    </section>
  );
}
