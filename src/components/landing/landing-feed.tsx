"use client";

import { Heart, MessageCircle, Play, Volume2 } from "lucide-react";
import { useState } from "react";

const clips = [
  { user: "@aurafarming", score: 96, verdict: "OSCAR BAIT", color: "from-hot to-violet", line: "The group chat will hear about this." },
  { user: "@desktopgremlin", score: 41, verdict: "WITNESS PROTECTION", color: "from-electric to-cyan-400", line: "I have a system. The system is panic." },
  { user: "@finalfinal_v3", score: 88, verdict: "DEEPLY CONCERNING", color: "from-orange-400 to-hot", line: "Circle back? I never left." },
];

export function LandingFeed() {
  const [playing, setPlaying] = useState<number | null>(null);
  const [liked, setLiked] = useState<number[]>([0]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {clips.map((clip, index) => (
        <article key={clip.user} className="panel group overflow-hidden">
          <div className={`relative aspect-[4/3] overflow-hidden bg-gradient-to-br ${clip.color}`}>
            <div className="absolute inset-0 grid-fade opacity-40" />
            <div className="absolute inset-0 grid place-items-center">
              {playing === index ? (
                <div className="flex h-20 items-end gap-1" aria-label="Audio playing">
                  {Array.from({ length: 12 }).map((_, bar) => (
                    <span key={bar} className="w-1.5 animate-pulse rounded-full bg-white" style={{ height: `${24 + ((bar * 19) % 54)}px`, animationDelay: `${bar * 70}ms` }} />
                  ))}
                </div>
              ) : (
                <button onClick={() => setPlaying(index)} className="grid size-16 place-items-center rounded-full bg-black/80 text-white shadow-xl transition group-hover:scale-110" aria-label={`Play ${clip.user}'s delivery`}>
                  <Play className="ml-1 size-6" fill="currentColor" />
                </button>
              )}
            </div>
            <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1.5 backdrop-blur">
              <span className="mono-label text-white">{clip.user}</span>
            </div>
            <div className="absolute bottom-4 right-4 grid size-16 place-items-center rounded-2xl bg-acid text-black shadow-lg">
              <span className="display-type text-3xl tracking-[-0.07em]">{clip.score}</span>
            </div>
          </div>
          <div className="p-4">
            <p className="mono-label text-hot">{clip.verdict}</p>
            <p className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-white/75">“{clip.line}”</p>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-white/40">
              <div className="flex gap-4">
                <button onClick={() => setLiked((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])} className="flex items-center gap-1.5 text-xs font-bold transition hover:text-hot" aria-label="React with fire">
                  <Heart className={`size-4 ${liked.includes(index) ? "fill-hot text-hot" : ""}`} /> {128 + (liked.includes(index) ? 1 : 0)}
                </button>
                <button className="flex items-center gap-1.5 text-xs font-bold transition hover:text-white" aria-label="View replies">
                  <MessageCircle className="size-4" /> {14 + index * 9}
                </button>
              </div>
              <Volume2 className="size-4" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
