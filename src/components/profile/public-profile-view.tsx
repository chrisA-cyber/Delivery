"use client";

import { ArrowRight, Ban, BarChart3, Flame, Heart, LoaderCircle, Share2, Sparkles, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeShelf } from "@/components/profile/badge-shelf";
import { ReportAction } from "@/components/safety/report-action";
import type { EarnedBadge } from "@/types/game";

type PublicProfileData = {
  profile: { id: string; handle: string; display_name: string; bio?: string | null; created_at: string };
  stats: Record<string, number> | null;
  deliveries: Array<{ id: string; prompt_body: string; energy_label?: string | null; published_at: string; overall: number; headline: string; verdict: string; reaction_count: number }>;
  badges: EarnedBadge[];
  viewer?: { signedIn: boolean; isSelf: boolean; following: boolean; blocked: boolean };
};

export function PublicProfileView({ handle }: { handle: string }) {
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [following, setFollowing] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/profiles/${encodeURIComponent(handle)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as PublicProfileData & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Profile unavailable.");
        setData(body); setFollowing(Boolean(body.viewer?.following)); setBlocked(Boolean(body.viewer?.blocked));
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Profile unavailable.");
      });
    return () => controller.abort();
  }, [handle]);

  async function shareProfile() {
    const url = window.location.href;
    const text = `See @${handle}'s best deliveries.`;
    try {
      if (navigator.share) await navigator.share({ title: `@${handle} on Delivery`, text, url });
      else { await navigator.clipboard.writeText(url); setNotice("Profile link copied"); }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
    }
  }

  async function toggleFollow() {
    if (!data?.viewer?.signedIn) { window.location.href = `/login?next=${encodeURIComponent(`/u/${handle}`)}`; return; }
    const response = await fetch(`/api/profiles/${encodeURIComponent(handle)}/follow`, { method: following ? "DELETE" : "POST" });
    const body = await response.json() as { following?: boolean; error?: string };
    if (!response.ok) { setNotice(body.error ?? "Follow could not be saved."); return; }
    setFollowing(Boolean(body.following)); setNotice(body.following ? "Now following" : "Unfollowed");
  }

  async function toggleBlock() {
    if (!data?.viewer?.signedIn) { window.location.href = `/login?next=${encodeURIComponent(`/u/${handle}`)}`; return; }
    const response = await fetch("/api/blocks", { method: blocked ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle }) });
    const body = await response.json() as { data?: { blocked?: boolean }; error?: { message?: string } };
    if (!response.ok) { setNotice(body.error?.message ?? "Block preference could not be saved."); return; }
    const next = Boolean(body.data?.blocked);
    setBlocked(next); if (next) setFollowing(false);
    setNotice(next ? `@${handle} blocked. Their content will be hidden.` : `@${handle} unblocked.`);
  }

  if (error) return <div className="panel-solid mx-auto max-w-xl p-8 text-center"><p className="mono-label text-hot">Offstage</p><h1 className="mt-4 text-3xl font-black">This profile is private or missing.</h1><p className="mt-3 text-sm text-white/45">{error}</p><Link href="/feed" className="button-primary mt-7">Browse the feed <ArrowRight className="size-4" /></Link></div>;
  if (!data) return <div className="panel mx-auto grid min-h-96 max-w-2xl place-content-center"><LoaderCircle className="size-7 animate-spin text-acid" /><span className="sr-only">Loading profile</span></div>;

  const stats = data.stats ?? {};
  const statCards = [
    { label: "Average", value: Math.round(Number(stats.average_score ?? 0)) || "—", icon: BarChart3, color: "text-electric" },
    { label: "Personal best", value: Number(stats.best_score ?? 0) || "—", icon: Trophy, color: "text-acid" },
    { label: "Chaos rating", value: Math.round(Number(stats.average_chaos ?? 0)) || "—", icon: Zap, color: "text-hot" },
    { label: "Daily streak", value: Number(stats.current_daily_streak ?? 0), icon: Flame, color: "text-orange-400" },
  ];

  return <div className="mx-auto max-w-6xl">
    <section className="panel-solid relative overflow-hidden p-6 sm:p-8"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-hot via-violet to-electric" /><div className="relative flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-5"><div className="grid size-24 place-items-center rounded-[30px] bg-gradient-to-br from-hot via-violet to-electric text-3xl font-black shadow-hot">{data.profile.display_name.slice(0, 2).toUpperCase()}</div><div><h1 className="text-3xl font-black tracking-[-0.05em]">{data.profile.display_name}</h1><p className="mt-1 text-sm font-bold text-white/35">@{data.profile.handle}</p>{data.profile.bio && <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">{data.profile.bio}</p>}<div className="mt-4 flex gap-4 text-xs font-bold text-white/45"><span><b className="text-white">{Number(stats.followers_count ?? 0)}</b> followers</span><span><b className="text-white">{Number(stats.following_count ?? 0)}</b> following</span></div></div></div><div className="flex flex-wrap gap-2">{!data.viewer?.isSelf && !blocked && <button onClick={() => void toggleFollow()} className={following ? "button-secondary" : "button-primary"}>{following ? "Following" : "Follow"}</button>}<button onClick={shareProfile} className="button-secondary"><Share2 className="size-4" /> Share</button>{!data.viewer?.isSelf && <><button onClick={() => void toggleBlock()} className="button-ghost"><Ban className="size-4" /> {blocked ? "Unblock" : "Block"}</button><ReportAction profileId={data.profile.id} context={`Profile @${data.profile.handle}`} /></>}</div></div></section>
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{statCards.map(({ label, value, icon: Icon, color }) => <div key={label} className="panel p-5"><Icon className={`size-4 ${color}`} /><p className="display-type mt-5 text-4xl">{value}</p><p className="mono-label mt-2 text-white/30">{label}</p></div>)}</div>
    <BadgeShelf badges={data.badges} publicView />
    <section className="mt-10"><div className="mb-5"><p className="mono-label text-acid">Public tape</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">The receipts</h2></div>{data.deliveries.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.deliveries.map((delivery) => <article key={delivery.id} className="panel flex min-h-64 flex-col p-5"><div className="flex items-start justify-between gap-3"><span className="mono-label text-hot">{delivery.headline}</span><span className="display-type text-4xl text-acid">{delivery.overall}</span></div><p className="mt-6 text-lg font-black leading-6">“{delivery.prompt_body}”</p>{delivery.energy_label && <p className="mt-3 text-xs font-bold leading-5 text-white/35"><Sparkles className="mr-1 inline size-3 text-hot" /> {delivery.energy_label}</p>}<p className="mt-4 line-clamp-2 text-sm leading-6 text-white/55">{delivery.verdict}</p><div className="mt-auto flex items-center justify-between border-t border-white/10 pt-4"><span className="flex items-center gap-1.5 text-xs font-black text-white/35"><Heart className="size-3.5" /> {delivery.reaction_count}</span><Link href={`/d/${delivery.id}`} className="button-ghost min-h-9 px-3">Hear it <ArrowRight className="size-3.5" /></Link></div></article>)}</div> : <div className="panel grid min-h-64 place-content-center text-center"><Sparkles className="mx-auto size-6 text-hot" /><p className="mt-4 text-lg font-black">No public takes yet.</p><p className="mt-2 text-sm text-white/40">The mic is warming up.</p></div>}</section>
    {notice && <p role="status" className="mono-label mt-5 text-center text-acid">{notice}</p>}
  </div>;
}
