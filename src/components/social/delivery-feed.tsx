"use client";

import { Flag, Flame, Heart, LoaderCircle, MoreHorizontal, Pause, Play, Share2, Sparkles, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/utils";
import { useApp } from "@/components/providers/app-provider";

type FeedItem = {
  id: string; user_id?: string; handle: string; display_name: string; prompt_body: string; energy_label?: string | null;
  published_at: string; overall: number; headline: string; verdict: string; reaction_count: number; viewer_reaction?: string | null; preview?: boolean;
};

export function DeliveryFeed() {
  const [filter, setFilter] = useState<"for-you" | "fresh" | "following">("for-you");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const { muted, updatePreferences } = useApp();
  const [reacted, setReacted] = useState<string[]>([]);
  const [menu, setMenu] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackRequestRef = useRef(0);
  const reactingRef = useRef(new Set<string>());

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setMenu(null);
    playbackRequestRef.current += 1; audioRef.current?.pause(); setPlaying(null);
    void fetch(`/api/feed?filter=${filter}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { configured?: boolean; signedIn?: boolean; items?: FeedItem[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Feed could not load.");
        setConfigured(body.configured !== false); setSignedIn(body.signedIn !== false);
        const nextItems = body.items ?? [];
        setItems(nextItems);
        setReacted(nextItems.filter((item) => Boolean(item.viewer_reaction)).map((item) => item.id));
      })
      .catch((cause) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Feed could not load."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filter]);

  useEffect(() => () => { playbackRequestRef.current += 1; if (audioRef.current) { audioRef.current.onended = null; audioRef.current.onerror = null; audioRef.current.pause(); } }, []);
  useEffect(() => { if (audioRef.current) audioRef.current.muted = muted; }, [muted]);

  async function play(item: FeedItem) {
    const request = ++playbackRequestRef.current;
    if (playing === item.id) { audioRef.current?.pause(); setPlaying(null); return; }
    setNotice("");
    try {
      const response = await fetch(`/api/share/${item.id}`, { cache: "no-store" });
      const body = await response.json() as { ok?: boolean; data?: { audioUrl?: string | null }; error?: { message?: string } };
      if (request !== playbackRequestRef.current) return;
      if (!response.ok || !body.data?.audioUrl) throw new Error(body.error?.message ?? "Audio is unavailable.");
      audioRef.current?.pause(); setPlaying(null);
      const audio = new Audio(body.data.audioUrl); audio.muted = muted; audioRef.current = audio;
      audio.onended = () => { if (request === playbackRequestRef.current) setPlaying(null); };
      audio.onerror = () => { if (request === playbackRequestRef.current) { setPlaying(null); setNotice("Playback was interrupted. Try opening this take again."); } };
      await audio.play();
      if (request !== playbackRequestRef.current) { audio.pause(); return; }
      setPlaying(item.id);
    } catch (cause) { if (request === playbackRequestRef.current) setNotice(cause instanceof Error ? cause.message : "Audio is unavailable."); }
  }

  async function react(item: FeedItem) {
    if (reactingRef.current.has(item.id)) return;
    reactingRef.current.add(item.id);
    try {
      const active = reacted.includes(item.id);
      const response = await fetch(`/api/deliveries/${item.id}/reaction`, active
        ? { method: "DELETE" }
        : { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "fire" }) });
      if (response.status === 401) { setNotice("Sign in to react to deliveries."); return; }
      const body = await response.json() as { ok?: boolean; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Reaction could not be saved.");
      setReacted((current) => active ? current.filter((id) => id !== item.id) : [...new Set([...current, item.id])]);
      setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, reaction_count: Math.max(0, Number(candidate.reaction_count) + (active ? -1 : 1)), viewer_reaction: active ? null : "fire" } : candidate));
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Reaction could not be saved."); }
    finally { reactingRef.current.delete(item.id); }
  }

  async function report(item: FeedItem) {
    try {
      const response = await fetch(`/api/deliveries/${item.id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "other", details: "Reported from the community feed for moderator review." }) });
      if (response.status === 401) { setNotice("Sign in to send a report."); return; }
      if (!response.ok) throw new Error("Report could not be submitted.");
      setNotice("Report received. Thank you for helping keep the stage good."); setMenu(null);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Report could not be submitted."); }
  }

  async function share(item: FeedItem) {
    const url = `${window.location.origin}/d/${item.id}`;
    const text = `${item.display_name} scored ${item.overall} on Delivery. Hear the evidence.`;
    try { if (navigator.share) await navigator.share({ title: "A Delivery just dropped", text, url }); else { await navigator.clipboard.writeText(url); setNotice("Delivery link copied"); } } catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) setNotice("Share canceled."); }
  }

  function toggleMute() { const next = !muted; updatePreferences({ muted: next }); if (audioRef.current) audioRef.current.muted = next; }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start"><div className="min-w-0">
    <div className="mb-6 flex flex-wrap gap-1 border-b border-white/15 pb-4" aria-label="Feed filter">{(["for-you", "fresh", "following"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} aria-pressed={filter === item} className={`min-h-11 rounded-lg px-4 text-sm font-bold capitalize ${filter === item ? "bg-white text-black" : "text-white/65 hover:bg-white/5"}`}>{item === "for-you" ? "Highlights" : item.replace("-", " ")}</button>)}</div>
    {notice && <p role="status" className="mb-4 rounded-xl border border-white/20 p-4 text-sm leading-6 text-white/75">{notice}</p>}
    {loading ? <div className="panel grid min-h-80 place-content-center"><LoaderCircle className="size-7 animate-spin text-acid" /><span className="sr-only">Loading feed</span></div> : error || !configured ? <div className="panel p-7"><p className="mono-label text-electric">Community feed</p><h2 className="mt-4 text-2xl font-bold">The feed is unavailable.</h2><p className="mt-3 max-w-md text-sm leading-6 text-white/65">{error || "Public deliveries will appear here when the community service is connected. You can still play a round."}</p><Link href="/play" className="button-primary mt-6">Play Classic</Link></div> : !items.length ? <div className="panel grid min-h-72 place-content-center px-6 py-8 text-center"><Sparkles className="mx-auto size-6 text-hot" /><h2 className="mt-4 text-2xl font-bold">{filter === "following" && !signedIn ? "Build your front row." : "No public takes here yet."}</h2><p className="mt-3 max-w-md text-sm leading-6 text-white/65">{filter === "following" ? "Follow performers from their public profiles to see their published takes." : "Record a performance, see the result, and decide whether to publish it."}</p><Link href={filter === "following" && !signedIn ? "/login?next=/feed" : "/play"} className="button-primary mx-auto mt-6">{filter === "following" && !signedIn ? "Sign in" : "Play Classic"}</Link></div> : <div className="grid gap-5">{items.map((item) => {
      const active = reacted.includes(item.id);
      return <article key={item.id} className="panel-solid overflow-hidden"><header className="flex items-center justify-between gap-3 p-4 sm:p-5"><Link href={`/u/${item.handle}`} className="flex min-w-0 items-center gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-hot text-sm font-bold text-black">{item.display_name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2)}</div><div className="min-w-0"><p className="break-words text-sm font-bold">{item.display_name}</p><p className="mt-1 break-all text-xs text-white/60">@{item.handle} · {formatDate(item.published_at)}</p></div></Link><div className="relative"><button onClick={() => setMenu(menu === item.id ? null : item.id)} aria-expanded={menu === item.id} className="grid size-11 place-items-center rounded-lg text-white/65 hover:bg-white/10" aria-label="More options"><MoreHorizontal className="size-5" /></button>{menu === item.id && <button onClick={() => void report(item)} className="absolute right-0 top-12 z-10 flex min-w-max items-center gap-2 rounded-xl border border-white/20 bg-surface px-4 py-3 text-sm"><Flag className="size-4" /> Report this take</button>}</div></header>
        <div className="bg-paper p-5 text-ink sm:p-7"><p className="mono-label text-black/60">The line</p><p className="mt-4 text-2xl font-bold leading-8 tracking-tight">“{item.prompt_body}”</p>{item.energy_label && <p className="mt-5 border-t border-black/20 pt-4 text-sm font-semibold leading-6 text-black/70">{item.energy_label}</p>}<div className="mt-7 flex items-center justify-between gap-4"><button onClick={() => void play(item)} className="inline-flex min-h-12 items-center gap-3 rounded-xl bg-ink px-5 text-sm font-bold text-white">{playing === item.id ? <Pause className="size-4" /> : <Play className="size-4" />} {playing === item.id ? "Pause take" : "Hear the take"}</button><p className="display-type text-4xl">{item.overall}<span className="ml-1 font-sans text-xs font-semibold text-black/60">/100</span></p></div></div>
        <div className="p-5 sm:p-6"><p className="mono-label text-acid">{item.headline}</p><p className="mt-3 text-base leading-7 text-white/80">{item.verdict}</p><div className="mt-5 flex items-center justify-between gap-3 border-t border-white/15 pt-4"><button onClick={() => void react(item)} className={`button-ghost px-3 ${active ? "text-hot" : ""}`} aria-label={active ? "Remove fire reaction" : "React with fire"}><Heart className="size-4" fill={active ? "currentColor" : "none"} /> {Number(item.reaction_count)}</button><div className="flex gap-1"><button onClick={toggleMute} className="grid size-11 place-items-center rounded-lg text-white/65 hover:bg-white/10" aria-label={muted ? "Unmute playback" : "Mute playback"}>{muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}</button><button onClick={() => void share(item)} className="grid size-11 place-items-center rounded-lg text-white/65 hover:bg-white/10" aria-label="Share delivery"><Share2 className="size-5" /></button></div></div></div></article>;
    })}</div>}
  </div><aside className="grid gap-4 lg:sticky lg:top-28"><div className="rounded-2xl bg-electric p-6 text-ink"><p className="mono-label text-black/60">The Daily</p><h2 className="display-type mt-4 text-4xl">Same line.<br />Different choices.</h2><p className="mt-4 text-sm leading-6 text-black/70">A new round at midnight UTC. Your first eligible take is your ranked entry.</p><Link href="/daily" className="button-primary mt-6 w-full">Play the Daily <Flame className="size-4" /></Link></div><div className="panel p-6"><h2 className="text-lg font-bold">Good bits. Good boundaries.</h2><p className="mt-3 text-sm leading-6 text-white/65">Celebrate the performance. Report harm. Sharing a take is always the performer&apos;s choice.</p><Link href="/guidelines" className="button-ghost mt-3 px-0">Community rules</Link></div></aside></div>;
}
