"use client";

import { BarChart3, Bookmark, Crown, EyeOff, Flame, Globe2, Headphones, LoaderCircle, Share2, Sparkles, Trash2, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useApp } from "@/components/providers/app-provider";
import { BadgeShelf } from "@/components/profile/badge-shelf";
import { PROMPTS } from "@/data/content";
import type { DeliveryHistoryItem } from "@/types/game";
import { formatDate } from "@/lib/utils";

const scoreAxes = [
  ["commitment", "Commitment", "bg-acid"],
  ["comedy", "Comedy", "bg-hot"],
  ["accuracy", "Accuracy", "bg-electric"],
  ["chaos", "Chaos", "bg-orange-400"],
] as const;

function apiMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  }
  return fallback;
}

export function ProfileView() {
  const { profile, stats, history, badges, favorites, hydrated, authenticated, tier, refreshAccount, toggleFavorite } = useApp();
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<{ id: string; url: string } | null>(null);
  const localAverage = history.length ? Math.round(history.reduce((sum, item) => sum + item.scores.overall, 0) / history.length) : 0;
  const localBest = history.length ? Math.max(...history.map((item) => item.scores.overall)) : 0;
  const localChaos = history.length ? Math.round(history.reduce((sum, item) => sum + item.scores.chaos, 0) / history.length) : 0;
  const average = authenticated ? Math.round(Number(stats?.average_score ?? 0)) : localAverage;
  const best = authenticated ? Number(stats?.best_score ?? 0) : localBest;
  const chaos = authenticated ? Math.round(Number(stats?.average_chaos ?? 0)) : localChaos;
  const xpInLevel = profile.xp % 450;
  const axisAverages = useMemo(() => Object.fromEntries(scoreAxes.map(([key]) => [key, history.length ? Math.round(history.reduce((sum, item) => sum + item.scores[key], 0) / history.length) : 0])) as Record<(typeof scoreAxes)[number][0], number>, [history]);
  const strongestAxis = scoreAxes.reduce((winner, candidate) => axisAverages[candidate[0]] > axisAverages[winner[0]] ? candidate : winner)[1];
  const categoryStats = useMemo(() => {
    const groups = new Map<string, { total: number; count: number }>();
    history.forEach((item) => {
      const current = groups.get(item.prompt.category) ?? { total: 0, count: 0 };
      groups.set(item.prompt.category, { total: current.total + item.scores.overall, count: current.count + 1 });
    });
    return [...groups.entries()].map(([category, value]) => ({ category, average: Math.round(value.total / value.count), count: value.count })).sort((a, b) => b.average - a.average).slice(0, 3);
  }, [history]);
  const favoritePrompts = useMemo(() => favorites.flatMap((id) => {
    const prompt = PROMPTS.find((item) => item.id === id);
    return prompt ? [prompt] : [];
  }), [favorites]);

  if (!hydrated) return <div className="panel h-96 animate-pulse" />;

  async function shareProfile() {
    if (!authenticated) { window.location.href = "/login?next=/profile"; return; }
    const url = `${window.location.origin}/u/${encodeURIComponent(profile.handle)}`;
    try {
      if (navigator.share) await navigator.share({ title: `${profile.displayName} on Delivery`, text: "Judge the tape.", url });
      else { await navigator.clipboard.writeText(url); setNotice("Profile link copied"); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setNotice("Profile link ready — copy it from your address bar.");
    }
  }

  async function setVisibility(delivery: DeliveryHistoryItem, visibility: "public" | "private") {
    setBusyId(delivery.id); setNotice("");
    try {
      const response = await fetch(`/api/deliveries/${encodeURIComponent(delivery.id)}/visibility`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility }) });
      const body = await response.json() as unknown;
      if (!response.ok) throw new Error(apiMessage(body, "That visibility change did not stick."));
      await refreshAccount();
      setNotice(visibility === "public" ? "Published after a fresh safety check." : "Take moved back to private.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "That visibility change did not stick."); }
    finally { setBusyId(null); }
  }

  async function deleteDelivery(delivery: DeliveryHistoryItem) {
    setBusyId(delivery.id); setNotice("");
    try {
      const response = await fetch(`/api/deliveries/${encodeURIComponent(delivery.id)}`, { method: "DELETE" });
      const body = await response.json() as unknown;
      if (!response.ok) throw new Error(apiMessage(body, "That take could not be deleted."));
      if (playback?.id === delivery.id) setPlayback(null);
      setConfirmDeleteId(null);
      await refreshAccount();
      setNotice("Take permanently deleted.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "That take could not be deleted."); }
    finally { setBusyId(null); }
  }

  async function loadPlayback(delivery: DeliveryHistoryItem) {
    if (delivery.audioUrl) { setPlayback({ id: delivery.id, url: delivery.audioUrl }); return; }
    setBusyId(delivery.id); setNotice("");
    try {
      const response = await fetch(`/api/deliveries/${encodeURIComponent(delivery.id)}`, { cache: "no-store" });
      const body = await response.json() as { data?: { audioUrl?: string } };
      if (!response.ok || !body.data?.audioUrl) throw new Error(apiMessage(body, "Playback is unavailable."));
      setPlayback({ id: delivery.id, url: body.data.audioUrl });
    } catch (error) { setNotice(error instanceof Error ? error.message : "Playback is unavailable."); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      <section className="panel-solid relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-hot via-violet to-electric" />
        <div className="absolute -right-32 -top-32 size-80 rounded-full bg-hot/10 blur-3xl" />
        <div className="relative flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="grid size-24 place-items-center rounded-[30px] bg-gradient-to-br from-hot via-violet to-electric text-3xl font-black shadow-hot">{profile.avatar}</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black tracking-[-0.05em]">{profile.displayName}</h1>
                <span className="rounded-full bg-acid px-2 py-1 text-[9px] font-black text-black">LVL {profile.level}</span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-bold text-white/35">@{profile.handle}{profile.isPrivate && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-widest text-white/45">Private</span>}</p>
              {profile.bio && <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">{profile.bio}</p>}
              <div className="mt-4 flex gap-4 text-xs font-bold text-white/45">
                <span><b className="text-white">{profile.followers}</b> followers</span>
                <span><b className="text-white">{profile.following}</b> following</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void shareProfile()} className="button-secondary"><Share2 className="size-4" /> Share profile</button>
            <Link href="/settings" className="button-ghost">Edit</Link>
          </div>
        </div>
        <div className="relative mt-7">
          <div className="mb-2 flex justify-between">
            <span className="mono-label text-white/35">Level {profile.level}</span>
            <span className="mono-label text-acid">{xpInLevel} / 450 XP</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-electric via-hot to-acid" style={{ width: `${(xpInLevel / 450) * 100}%` }} />
          </div>
        </div>
      </section>

      {notice && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center text-sm font-bold text-white/65">{notice}</p>}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[{ label: "Average", value: average || "—", icon: BarChart3, color: "text-electric" }, { label: "Personal best", value: best || "—", icon: Trophy, color: "text-acid" }, { label: "Chaos rating", value: chaos || "—", icon: Zap, color: "text-hot" }, { label: "Daily streak", value: profile.streak, icon: Flame, color: "text-orange-400" }].map(({ label, value, icon: Icon, color }) => <div key={label} className="panel p-5"><Icon className={`size-4 ${color}`} /><p className="display-type mt-5 text-4xl">{value}</p><p className="mono-label mt-2 text-white/30">{label}</p></div>)}
      </div>

      {tier === "pro" && history.length > 0 && <section className="mt-8 overflow-hidden rounded-[26px] border border-acid/25 bg-gradient-to-br from-acid/[0.09] to-white/[0.025] p-6 sm:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mono-label flex items-center gap-2 text-acid"><Crown className="size-3.5" /> Pro performance fingerprint</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Your strongest signal is {strongestAxis.toLowerCase()}.</h2></div><span className="mono-label text-white/30">Last {history.length} judged takes</span></div><div className="mt-7 grid gap-5 sm:grid-cols-2">{scoreAxes.map(([key, label, color]) => <div key={key}><div className="mb-2 flex justify-between"><span className="mono-label text-white/45">{label}</span><span className="font-mono text-sm font-black">{axisAverages[key]}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${color}`} style={{ width: `${axisAverages[key]}%` }} /></div></div>)}</div>{categoryStats.length > 0 && <div className="mt-7 border-t border-white/10 pt-5"><p className="mono-label text-white/35">Best rooms</p><div className="mt-3 flex flex-wrap gap-2">{categoryStats.map((item) => <span key={item.category} className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-black capitalize">{item.category} · {item.average} <span className="text-white/30">({item.count})</span></span>)}</div></div>}</section>}

      <BadgeShelf badges={badges} />

      {favoritePrompts.length > 0 && <section className="mt-10"><div className="mb-5"><p className="mono-label text-electric">Saved lines</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Run the bit back</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{favoritePrompts.map((prompt) => <article key={prompt.id} className="panel flex flex-col p-4"><p className="mono-label text-electric">{prompt.category.replaceAll("-", " ")}</p><p className="mt-3 flex-1 text-sm font-black leading-5">“{prompt.line}”</p><div className="mt-4 flex gap-2"><Link href={`/play?prompt=${encodeURIComponent(prompt.id)}`} className="button-secondary min-h-9 flex-1 px-3 text-xs">Replay</Link><button onClick={() => toggleFavorite(prompt.id)} className="button-ghost min-h-9 px-3 text-xs" aria-label={`Remove ${prompt.line} from favorites`}>Remove</button></div></article>)}</div></section>}

      <section className="mt-10"><div className="mb-5 flex items-end justify-between"><div><p className="mono-label text-acid">Your tape</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Delivery history</h2></div><span className="flex items-center gap-1.5 text-xs font-black text-white/35"><Bookmark className="size-3.5" /> {favorites.length} saved lines</span></div>
        {history.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{history.map((delivery) => {
          const manageable = authenticated && Boolean(delivery.visibility);
          const busy = busyId === delivery.id;
          return <article key={delivery.id} className="panel group overflow-hidden"><div className="relative aspect-video bg-gradient-to-br from-electric/50 via-violet/40 to-hot/50"><div className="absolute inset-0 grid-fade" /><button onClick={() => void loadPlayback(delivery)} disabled={busy || (!delivery.audioUrl && !manageable)} className="absolute inset-0 m-auto grid size-12 place-items-center rounded-full bg-black/75 transition group-hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Load delivery audio">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Headphones className="size-4" />}</button><div className="absolute bottom-3 right-3 grid size-14 place-items-center rounded-2xl bg-acid text-black"><span className="display-type text-2xl">{delivery.scores.overall}</span></div>{delivery.visibility && <span className="mono-label absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[8px] text-white/60">{delivery.visibility}</span>}</div><div className="p-4"><p className="mono-label text-hot">{delivery.title}</p><p className="mt-2 line-clamp-2 text-sm font-black leading-5">“{delivery.prompt.line}”</p><div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold text-white/25"><span>{formatDate(delivery.createdAt)}</span>{delivery.dailyRanked === true && <span className="rounded-full bg-acid/10 px-2 py-1 text-acid">Ranked Daily</span>}{delivery.dailyRanked === false && <span className="rounded-full bg-white/5 px-2 py-1 text-white/35">Daily practice</span>}</div>{playback?.id === delivery.id && <audio controls autoPlay src={playback.url} className="mt-4 w-full" aria-label="Delivery playback" />}{manageable && <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void setVisibility(delivery, delivery.visibility === "public" ? "private" : "public")} disabled={busy} className="button-ghost min-h-8 px-2.5 text-[10px]">{delivery.visibility === "public" ? <EyeOff className="size-3.5" /> : <Globe2 className="size-3.5" />} {delivery.visibility === "public" ? "Unpublish" : "Publish"}</button>{delivery.visibility === "public" && <Link href={`/d/${delivery.id}`} className="button-ghost min-h-8 px-2.5 text-[10px]">View</Link>}{confirmDeleteId === delivery.id ? <><button onClick={() => void deleteDelivery(delivery)} disabled={busy} className="rounded-full bg-red-500 px-3 py-1.5 text-[10px] font-black">Delete now</button><button onClick={() => setConfirmDeleteId(null)} className="button-ghost min-h-8 px-2.5 text-[10px]">Cancel</button></> : <button onClick={() => setConfirmDeleteId(delivery.id)} className="button-ghost min-h-8 px-2.5 text-[10px] text-red-200"><Trash2 className="size-3.5" /> Delete</button>}</div>}</div></article>;
        })}</div> : <div className="panel grid min-h-64 place-content-center px-6 text-center"><Sparkles className="mx-auto size-6 text-hot" /><p className="mt-4 text-xl font-black">Your highlight reel is suspiciously quiet.</p><p className="mt-2 text-sm text-white/40">One take fixes that.</p><Link href="/play" className="button-primary mx-auto mt-6">Make your first delivery</Link></div>}
      </section>
    </div>
  );
}
