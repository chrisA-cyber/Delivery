"use client";

import { ArrowRight, Copy, Headphones, RefreshCw, Share2, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { ReportAction } from "@/components/safety/report-action";
import { ContentControl } from "@/components/content/content-control";
import { useApp } from "@/components/providers/app-provider";
import { isRatingAllowed, type ContentRating } from "@/data/content";
import { SavedAudio } from "@/components/game/saved-audio";

type MatchEntry = {
  entrantId: string; displayName: string; handle: string; deliveryId: string; createdAt: string; audioUrl: string | null;
  overall: number; commitment: number; comedy: number; accuracy: number; chaos: number; headline: string; verdict: string;
};

export function ChallengeMatchView({ entries, complete, invitePath, currentUserId, rating }: { entries: MatchEntry[]; complete: boolean; invitePath: string; currentUserId: string; rating: ContentRating }) {
  const { contentRating, updatePreferences } = useApp();
  const [notice, setNotice] = useState("");
  const winningScore = entries.length ? Math.max(...entries.map((entry) => entry.overall)) : 0;

  async function shareInvite() {
    const url = `${window.location.origin}${invitePath}`;
    const text = "Your mic is required for this Delivery challenge.";
    try {
      if (navigator.share) await navigator.share({ title: "Delivery challenge", text, url });
      else { await navigator.clipboard.writeText(url); setNotice("Challenge link copied"); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) { try { await navigator.clipboard.writeText(url); setNotice("Challenge link copied"); } catch { setNotice("Sharing is unavailable. Copy the invite address from your browser."); } }
    }
  }

  const contentControl = <ContentControl value={contentRating} onChange={(contentRating) => updatePreferences({ contentRating })} compact />;
  if (!isRatingAllowed(rating, contentRating)) return <section className="panel-solid mx-auto max-w-2xl p-6 sm:p-9"><p className="mono-label text-acid">{rating === "mature" ? "Mature challenge · 18+" : "Spicy challenge"}</p><h1 className="mt-4 text-3xl font-bold tracking-tight">This matchup is behind your filter.</h1><p className="my-5 text-sm leading-6 text-white/70">Choose a content setting before revealing the verdicts or listening to these recordings. The original challenge and its results stay unchanged.</p>{contentControl}<Link href="/play" className="button-secondary mt-6">Play a clean round<ArrowRight className="size-4" /></Link></section>;

  return <section className="mx-auto max-w-4xl"><div className="mb-5">{contentControl}</div><div className="panel-solid relative overflow-hidden p-6 sm:p-8"><div className="absolute inset-x-0 top-0 h-1 bg-hot" /><div className="relative text-center"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-hot/10 text-hot">{complete ? <Trophy className="size-7" /> : <Swords className="size-7" />}</div><p className="mono-label mt-5 text-hot">{complete ? "Matchup complete" : "Your answer is locked"}</p><h1 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-5xl">{complete ? (entries.filter((entry) => entry.overall === winningScore).length > 1 ? "A tie. Extremely diplomatic." : `${entries.find((entry) => entry.overall === winningScore)?.displayName} takes it.`) : "Waiting for the other mic."}</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/65">{complete ? "Same line. Same energy. Two completely different decisions." : "Your invite stays available until its expiry. Share it with your friend, then check back for their answer."}</p></div><div className={`relative mt-8 grid gap-4 ${entries.length > 1 ? "md:grid-cols-2" : "mx-auto max-w-lg"}`}>{entries.map((entry) => { const winner = complete && entry.overall === winningScore; return <article key={entry.deliveryId} className={`rounded-2xl border p-5 ${winner ? "border-acid/35 bg-acid/[0.08] " : "border-white/10 bg-white/[0.025]"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">{entry.displayName} {entry.entrantId === currentUserId && <span className="text-white/60">· you</span>}</p><p className="text-xs font-bold text-white/60">@{entry.handle}</p></div><div className={`grid size-16 place-items-center rounded-2xl ${winner ? "bg-acid text-black" : "bg-white/10"}`}><span className="display-type text-3xl">{entry.overall}</span></div></div><p className="mono-label mt-5 text-hot">{entry.headline}</p><p className="mt-2 text-sm font-black leading-5">{entry.verdict}</p>{entry.audioUrl && <div className="mt-4 rounded-xl border border-electric/15 bg-electric/[0.06] p-3"><p className="mb-2 flex items-center gap-2 text-[10px] font-black text-electric"><Headphones className="size-3.5" /> Hear the evidence</p><ChallengeAudio url={entry.audioUrl} /></div>}<div className="mt-4 grid grid-cols-4 gap-2">{[["COM", entry.commitment], ["FUN", entry.comedy], ["ACC", entry.accuracy], ["CHA", entry.chaos]].map(([label, score]) => <div key={String(label)} className="rounded-lg bg-black/25 p-2 text-center"><p className="font-mono text-sm font-black">{score}</p><p className="mono-label mt-1 text-[7px] text-white/55">{label}</p></div>)}</div>{entry.entrantId !== currentUserId && <ReportAction deliveryId={entry.deliveryId} label={`Report @${entry.handle}`} context="Challenge delivery" className="button-ghost mt-4 w-full" />}</article>; })}</div></div><div className={`mt-4 grid gap-3 ${complete ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>{!complete && <button onClick={() => void shareInvite()} className="button-secondary"><Share2 className="size-4" /> Share invite again</button>}{!complete && <button onClick={() => window.location.reload()} className="button-secondary"><RefreshCw className="size-4" /> Check for answer</button>}{complete && <Link href="/challenge" className="button-secondary"><Swords className="size-4" /> Run it back</Link>}<Link href="/play" className="button-primary">Fresh line <ArrowRight className="size-4" /></Link></div>{notice && <p role="status" className="mono-label mt-4 text-center text-acid"><Copy className="mr-1 inline size-3.5" /> {notice}</p>}</section>;
}

function ChallengeAudio({ url }: { url: string }) {
  return <SavedAudio key={url} url={url} label="Challenge take playback" reloadOnRetry />;
}
