"use client";

import { Check, MessageSquare, MonitorUp, Radio, SlidersHorizontal, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ContentControl, CONTENT_LABELS } from "@/components/content/content-control";
import { ENERGY_MODIFIERS, isEnergyCompatible, queryPrompts, type ContentRating } from "@/data/content";

export function StreamSetup() {
  const [chatVote, setChatVote] = useState(true);
  const [clean, setClean] = useState(true);
  const [delay, setDelay] = useState("5");
  const [maxRating, setMaxRating] = useState<ContentRating>("everyone");
  const prompt = queryPrompts({ maxRating })[0];
  const energy = ENERGY_MODIFIERS.find((item) => prompt && isEnergyCompatible(prompt, item));
  return <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr] lg:items-start">
    <section className="panel-solid p-5 sm:p-7"><p className="mono-label text-electric">Before you go on</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Your stage. Your controls.</h2><p className="mt-3 text-sm leading-6 text-white/65">You perform and operate the stage. If you run a poll in your streaming app, enter its winner here yourself.</p>
      <div className="mt-6 border-y border-white/15 py-6"><ContentControl value={maxRating} onChange={setMaxRating} /><p className="mt-3 text-xs leading-5 text-white/60">Every new setup starts with clean lines. The stage uses the setting you choose here.</p></div>
      <div className="mt-6 grid gap-3"><Toggle icon={MessageSquare} title="Host-controlled direction vote" description="Show three options. Press 1–3 to choose the winner from your own poll or chat." checked={chatVote} onChange={setChatVote} /><Toggle icon={MonitorUp} title="Hide stage navigation" description="Keep the prompt, microphone, and performance in focus when sharing your screen." checked={clean} onChange={setClean} /><label className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/15 p-4"><div className="flex items-start gap-3"><SlidersHorizontal className="mt-1 size-4 shrink-0 text-hot" /><div><p className="text-sm font-bold">Choice window</p><p className="mt-1 text-xs leading-5 text-white/65">Time before the host-selected direction locks.</p></div></div><select value={delay} onChange={(event) => setDelay(event.target.value)} disabled={!chatVote} className="min-h-11 rounded-lg border border-white/20 bg-[#232320] px-3 text-sm"><option value="3">3 seconds</option><option value="5">5 seconds</option><option value="10">10 seconds</option></select></label></div>
      <Link href={`/stream/stage?vote=${chatVote ? 1 : 0}&clean=${clean ? 1 : 0}&delay=${delay}&maxRating=${maxRating}`} onClick={() => { try { sessionStorage.setItem("delivery.stream.contentRating", maxRating); } catch { /* The stage will request explicit consent again if storage is unavailable. */ } }} className="button-primary mt-7 min-h-14 w-full"><Radio className="size-5" /> Open the stage</Link><p className="mt-3 text-center text-xs leading-5 text-white/60">Voice only. Use screen/window capture to show your stage in OBS.</p>
    </section>
    <aside className="grid gap-5">
      <div className="rounded-2xl bg-[#f4f0e7] p-6 text-[#171715]"><p className="mono-label text-black/60">Example stage · {CONTENT_LABELS[maxRating]}</p><p className="mt-8 text-3xl font-bold leading-9 tracking-tight">“{prompt?.line}”</p><div className="mt-7 border-t border-black/20 pt-5"><p className="mono-label text-black/60">Example direction</p><p className="mt-2 text-sm font-semibold leading-6">{energy?.instruction}</p></div></div>
      <div className="panel p-5 sm:p-6"><h3 className="text-lg font-bold">Keep one hand on the keys.</h3><dl className="mt-4">{[["Space", "Start / stop"], ["R", "Reroll prompt"], ["V", "Open direction vote"], ["1–3", "Select vote winner"], ["F", "Toggle fullscreen"]].map(([key, action]) => <div key={key} className="flex items-center justify-between gap-4 border-b border-white/15 py-3 last:border-0"><dt className="text-sm text-white/65">{action}</dt><dd><kbd className="rounded-md border border-white/25 bg-white/5 px-2 py-1 font-mono text-xs">{key}</kbd></dd></div>)}</dl><p className="mt-4 border-t border-white/15 pt-4 text-xs leading-5 text-white/60">Viewers use your existing stream chat or poll. Delivery does not collect remote votes.</p></div>
    </aside>
  </div>;
}

function Toggle({ icon: Icon, title, description, checked, onChange }: { icon: typeof Users; title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center justify-between gap-4 rounded-xl border border-white/15 p-4 text-left"><div className="flex min-w-0 items-start gap-3"><Icon className="mt-1 size-4 shrink-0 text-acid" /><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-white/65">{description}</p></div></div><span className={`grid size-7 shrink-0 place-items-center rounded-lg border ${checked ? "border-acid bg-acid text-black" : "border-white/25"}`}>{checked && <Check className="size-4" />}</span></button>;
}
