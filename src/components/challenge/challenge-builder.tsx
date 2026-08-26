"use client";

import { Check, Copy, Dices, LoaderCircle, Search, Send, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { ENERGY_MODIFIERS, PACKS, PROMPTS } from "@/data/content";
import { useApp } from "@/components/providers/app-provider";

export function ChallengeBuilder() {
  const { tier } = useApp();
  const [promptId, setPromptId] = useState(PROMPTS[0]?.id ?? "");
  const [energyId, setEnergyId] = useState(ENERGY_MODIFIERS[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState<{ key: string; url: string } | null>(null);
  const prompt = PROMPTS.find((item) => item.id === promptId) ?? PROMPTS[0]!;
  const energy = ENERGY_MODIFIERS.find((item) => item.id === energyId) ?? ENERGY_MODIFIERS[0]!;
  const pack = PACKS.find((item) => prompt.packIds.includes(item.id));
  const availablePrompts = useMemo(() => tier === "pro" ? PROMPTS : PROMPTS.filter((item) => item.packIds.every((id) => PACKS.find((pack) => pack.id === id)?.access !== "pro")), [tier]);
  const filtered = useMemo(() => availablePrompts.filter((item) => !query.trim() || `${item.line} ${item.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0, 30), [availablePrompts, query]);

  function randomize() {
    setPromptId(availablePrompts[Math.floor(Math.random() * availablePrompts.length)]?.id ?? promptId);
    setEnergyId(ENERGY_MODIFIERS[Math.floor(Math.random() * ENERGY_MODIFIERS.length)]?.id ?? energyId);
  }

  async function link() {
    const key = `${prompt.id}:${energy.id}`;
    if (invite?.key === key) return invite.url;
    setCreating(true); setError("");
    try {
      const response = await fetch("/api/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptId: prompt.id, energyId: energy.id }) });
      const body = await response.json() as { ok?: boolean; data?: { inviteUrl?: string }; error?: { message?: string } };
      if (!response.ok || !body.data?.inviteUrl) throw new Error(body.error?.message ?? "Challenge link could not be created.");
      const created = { key, url: body.data.inviteUrl }; setInvite(created); return created.url;
    } finally { setCreating(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(await link()); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Challenge link could not be created."); }
  }

  async function share() {
    try {
      const url = await link();
      const text = `I picked your line on Delivery: “${prompt.line}” ${energy.shortLabel}. No backing out.`;
      if (navigator.share) await navigator.share({ title: "You have a Delivery challenge", text, url });
      else window.open(`https://x.com/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener,noreferrer");
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Challenge link could not be created."); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <section className="panel-solid p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between"><div><p className="mono-label text-hot">1. Pick their poison</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Choose a line</h2></div><button onClick={randomize} className="button-secondary min-h-10 px-3"><Dices className="size-4" /> Surprise me</button></div>
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"><span className="sr-only">Search challenge lines</span><Search className="size-4 text-white/55" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all lines…" className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-white/55" /></label>
        <div className="no-scrollbar mt-3 grid max-h-[380px] gap-2 overflow-y-auto pr-1">
          {filtered.map((item) => <button key={item.id} onClick={() => setPromptId(item.id)} className={`rounded-xl border p-3 text-left transition ${item.id === prompt.id ? "border-acid/40 bg-acid/10" : "border-white/[0.07] bg-white/[0.025] hover:border-white/20"}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-black leading-5">“{item.line}”</p>{item.id === prompt.id && <Check className="mt-0.5 size-4 shrink-0 text-acid" />}</div><p className="mono-label mt-2 text-[9px] text-white/25">{item.category.replaceAll("-", " ")} · {item.difficulty}</p></button>)}
        </div>
      </section>

      <div className="grid gap-5">
        <section className="panel-solid p-5 sm:p-7"><p className="mono-label text-electric">2. Set the energy</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">How must they say it?</h2><select value={energyId} onChange={(event) => setEnergyId(event.target.value)} className="mt-5 w-full rounded-xl border border-white/10 bg-[#161618] px-4 py-3 text-sm font-black text-white outline-none">{ENERGY_MODIFIERS.map((item) => <option key={item.id} value={item.id}>{item.shortLabel} · {"●".repeat(item.intensity)}</option>)}</select><div className="mt-4 flex items-start gap-3 rounded-xl border border-hot/20 bg-hot/10 p-4"><Sparkles className="mt-0.5 size-4 shrink-0 text-hot" /><p className="text-sm font-bold leading-6 text-white/75">{energy.instruction}</p></div></section>

        <section className="relative overflow-hidden rounded-[24px] border border-acid/25 bg-acid p-5 text-black shadow-acid sm:p-7"><div className="absolute -right-8 -top-12 display-type text-[9rem] text-black/[0.05]">D</div><div className="relative"><p className="mono-label">Challenge preview · {pack?.name}</p><p className="mt-5 text-2xl font-black leading-7 tracking-[-0.04em]">“{prompt.line}”</p><p className="mt-4 text-sm font-bold text-black/60">{energy.shortLabel}</p><div className="mt-7 grid gap-2 sm:grid-cols-2"><button onClick={() => void share()} disabled={creating} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-black text-white disabled:opacity-50">{creating ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Send challenge</button><button onClick={() => void copy()} disabled={creating} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/20 px-5 text-sm font-black disabled:opacity-50"><Copy className="size-4" /> {copied ? "Copied" : "Copy link"}</button></div>{error && <p role="alert" className="mt-3 rounded-xl bg-black/10 p-3 text-xs font-black text-red-950">{error}</p>}<p className="mt-3 text-[10px] font-bold text-black/45">Signed invite · expires in 7 days · two scored entries</p></div></section>
      </div>
    </div>
  );
}
