"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Flag, Flame, Heart, LoaderCircle, MoreHorizontal, Play, Share2, Sparkles, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/utils";

type FeedItem = {
  id: string; user_id?: string; handle: string; display_name: string; prompt_body: string; energy_label?: string | null;
  published_at: string; overall: number; headline: string; verdict: string; reaction_count: number; viewer_reaction?: string | null; preview?: boolean;
};

const rehearsalItems: FeedItem[] = [
  { id: "preview-1", handle: "mayhem", display_name: "Maya Mayhem", overall: 96, headline: "LEGALLY CINEMA", prompt_body: "The group chat will hear about this.", energy_label: "Like a final boss revealing phase two", verdict: "You turned a notification into an international incident.", reaction_count: 824, published_at: new Date().toISOString(), preview: true },
  { id: "preview-2", handle: "unc_jpeg", display_name: "Uncle JPEG", overall: 43, headline: "A BEAUTIFUL COLLAPSE", prompt_body: "I have a system. The system is panic.", energy_label: "Read half the instructions", verdict: "The system failed. The content succeeded.", reaction_count: 1180, published_at: new Date().toISOString(), preview: true },
  { id: "preview-3", handle: "softlaunch", display_name: "Soft Launch", overall: 88, headline: "AURA ON CREDIT", prompt_body: "I ran the numbers. The vibes are insolvent.", energy_label: "Financial analyst during the apocalypse", verdict: "Wall Street has never looked this moisturized.", reaction_count: 536, published_at: new Date().toISOString(), preview: true },
];

const gradients = ["from-fuchsia-500 via-hot to-orange-400", "from-electric via-indigo-500 to-cyan-400", "from-orange-500 via-red-500 to-hot", "from-cyan-400 via-electric to-violet"];

export function DeliveryFeed() {
  const [filter, setFilter] = useState<"for-you" | "fresh" | "following">("for-you");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [reacted, setReacted] = useState<string[]>([]);
  const [menu, setMenu] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setMenu(null);
    void fetch(`/api/feed?filter=${filter}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { configured?: boolean; signedIn?: boolean; items?: FeedItem[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Feed could not load.");
        setConfigured(body.configured !== false); setSignedIn(body.signedIn !== false);
        const nextItems = body.configured === false ? rehearsalItems : body.items ?? [];
        setItems(nextItems);
        setReacted(nextItems.filter((item) => Boolean(item.viewer_reaction)).map((item) => item.id));
      })
      .catch((cause) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Feed could not load."); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filter]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  async function play(item: FeedItem) {
    if (item.preview) { setNotice("Preview cards have no recording. Configure Supabase to load live tapes."); return; }
    if (playing === item.id) { audioRef.current?.pause(); setPlaying(null); return; }
    setNotice("");
    try {
      const response = await fetch(`/api/share/${item.id}`, { cache: "no-store" });
      const body = await response.json() as { ok?: boolean; data?: { audioUrl?: string | null }; error?: { message?: string } };
      if (!response.ok || !body.data?.audioUrl) throw new Error(body.error?.message ?? "Audio is unavailable.");
      audioRef.current?.pause();
      const audio = new Audio(body.data.audioUrl); audio.muted = muted; audioRef.current = audio;
      audio.onended = () => setPlaying(null); await audio.play(); setPlaying(item.id);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Audio is unavailable."); }
  }

  async function react(item: FeedItem) {
    if (item.preview) return;
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
  }

  async function report(item: FeedItem) {
    if (item.preview) return;
    try {
      const response = await fetch(`/api/deliveries/${item.id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "other", details: "Reported from the community feed for moderator review." }) });
      if (response.status === 401) { setNotice("Sign in to send a report."); return; }
      if (!response.ok) throw new Error("Report could not be submitted.");
      setNotice("Report received. Thank you for helping keep the stage good."); setMenu(null);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Report could not be submitted."); }
  }

  async function share(item: FeedItem) {
    if (item.preview) return;
    const url = `${window.location.origin}/d/${item.id}`;
    const text = `${item.display_name} scored ${item.overall} on Delivery. Hear the evidence.`;
    try { if (navigator.share) await navigator.share({ title: "A Delivery just dropped", text, url }); else { await navigator.clipboard.writeText(url); setNotice("Delivery link copied"); } } catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) setNotice("Share canceled."); }
  }

  function toggleMute() { const next = !muted; setMuted(next); if (audioRef.current) audioRef.current.muted = next; }

  return <div className="grid gap-8 lg:grid-cols-[minmax(0,680px)_300px] lg:items-start lg:justify-center"><div>
    {!configured && <div className="mb-5 rounded-2xl border border-electric/20 bg-electric/10 p-4 text-sm font-bold leading-6 text-electric">Rehearsal reel · Connect Supabase to replace these clearly marked previews with live community deliveries.</div>}
    <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">{(["for-you", "fresh", "following"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full border px-4 py-2 text-xs font-black capitalize ${filter === item ? "border-acid bg-acid text-black" : "border-white/10 bg-white/5 text-white/45"}`}>{item.replace("-", " ")}</button>)}</div>
    {notice && <p role="status" className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-bold text-white/60">{notice}</p>}
    {loading ? <div className="panel grid min-h-80 place-content-center"><LoaderCircle className="size-7 animate-spin text-acid" /><span className="sr-only">Loading feed</span></div> : error ? <div className="panel p-7 text-center"><p className="text-lg font-black">The feed dropped the mic.</p><p className="mt-2 text-sm text-white/40">{error}</p></div> : !items.length ? <div className="panel grid min-h-72 place-content-center px-6 text-center"><Sparkles className="mx-auto size-6 text-hot" /><p className="mt-4 text-xl font-black">{filter === "following" && !signedIn ? "Sign in to build your front row." : "The stage is quiet—for now."}</p><p className="mt-2 text-sm text-white/40">{filter === "following" ? "Follow performers from their public profiles." : "Publish a judged take and become the first bad influence."}</p><Link href={filter === "following" && !signedIn ? "/login?next=/feed" : "/play"} className="button-primary mx-auto mt-6">{filter === "following" && !signedIn ? "Sign in" : "Take the mic"}</Link></div> : <div className="grid gap-5">{items.map((item, index) => {
      const active = reacted.includes(item.id); const gradient = gradients[index % gradients.length]!;
      return <article key={item.id} className="panel-solid overflow-hidden"><header className="flex items-center justify-between p-4 sm:p-5"><Link href={item.preview ? "#" : `/u/${item.handle}`} className="flex items-center gap-3"><div className={`grid size-10 place-items-center rounded-full bg-gradient-to-br ${gradient} text-xs font-black`}>{item.display_name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2)}</div><div><p className="text-sm font-black">{item.display_name}</p><p className="text-xs font-bold text-white/35">@{item.handle} · {item.preview ? "preview" : formatDate(item.published_at)}</p></div></Link><div className="relative"><button onClick={() => setMenu(menu === item.id ? null : item.id)} disabled={item.preview} className="grid size-9 place-items-center rounded-full text-white/35 hover:bg-white/10 hover:text-white disabled:opacity-30" aria-label="More options"><MoreHorizontal className="size-4" /></button><AnimatePresence>{menu === item.id && <motion.button initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} onClick={() => void report(item)} className="absolute right-0 top-10 z-10 flex min-w-max items-center gap-2 rounded-xl border border-white/10 bg-[#171719] px-4 py-3 text-xs font-black text-white/60 shadow-xl hover:text-white"><Flag className="size-3.5" /> Send to moderators</motion.button>}</AnimatePresence></div></header>
        <div className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${gradient}`}><div className="absolute inset-0 grid-fade opacity-40" /><div className="absolute left-4 top-4 max-w-[78%] rounded-2xl bg-black/65 p-3 backdrop-blur-md"><p className="mono-label text-acid">The line</p><p className="mt-1.5 text-sm font-black leading-5">“{item.prompt_body}”</p></div><div className="absolute inset-0 grid place-items-center"><button onClick={() => void play(item)} className="grid size-20 place-items-center rounded-full border border-white/25 bg-black/75 text-white shadow-2xl backdrop-blur transition hover:scale-105" aria-label={playing === item.id ? "Pause delivery" : item.preview ? "Preview has no audio" : "Play delivery"}>{playing === item.id ? <div className="flex h-7 items-center gap-1">{[12, 27, 18, 31, 15].map((height, bar) => <span key={bar} className="w-1 animate-pulse rounded-full bg-acid" style={{ height }} />)}</div> : <Play className="ml-1 size-7" fill="currentColor" />}</button></div><div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4"><div className="rounded-full bg-black/70 px-3 py-2 backdrop-blur"><p className="mono-label text-white/70">{item.headline}</p></div><div className="grid size-20 place-items-center rounded-3xl bg-acid text-black shadow-xl"><div className="text-center"><p className="display-type text-4xl">{item.overall}</p><p className="mono-label text-[8px]">Score</p></div></div></div></div>
        <div className="p-4 sm:p-5"><p className="text-base font-black leading-6 tracking-[-0.02em]">{item.verdict}</p>{item.energy_label && <p className="mt-2 text-xs font-bold text-white/35"><Sparkles className="mr-1 inline size-3 text-hot" /> {item.energy_label}</p>}<div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4"><button onClick={() => void react(item)} disabled={item.preview} className={`button-ghost min-h-9 px-3 ${active ? "text-hot" : ""}`} aria-label={active ? "Remove fire reaction" : "React with fire"}><Heart className="size-4" fill={active ? "currentColor" : "none"} /> {Number(item.reaction_count)}</button><div className="flex"><button onClick={toggleMute} className="grid size-9 place-items-center rounded-full text-white/35 hover:bg-white/10 hover:text-white" aria-label={muted ? "Unmute playback" : "Mute playback"}>{muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}</button><button onClick={() => void share(item)} disabled={item.preview} className="grid size-9 place-items-center rounded-full text-white/35 hover:bg-white/10 hover:text-white disabled:opacity-30" aria-label="Share delivery"><Share2 className="size-4" /></button></div></div></div></article>;
    })}</div>}
  </div><aside className="sticky top-24 hidden gap-4 lg:grid"><div className="panel p-5"><p className="mono-label text-acid">Daily pulse</p><p className="mt-3 text-3xl font-black tracking-[-0.05em]">One line. Everyone.</p><p className="mt-1 text-xs font-bold text-white/35">Resets at midnight UTC</p><Link href="/daily" className="button-secondary mt-5 w-full">Join the Daily <Flame className="size-4 text-orange-400" /></Link></div><div className="panel p-5"><p className="mono-label text-hot">Reaction philosophy</p><p className="mt-3 text-sm font-bold leading-6 text-white/45">Reward the bit. Report the harm. Never make cruelty the content.</p><Link href="/guidelines" className="button-ghost mt-3 px-0">Community rules</Link></div></aside></div>;
}
