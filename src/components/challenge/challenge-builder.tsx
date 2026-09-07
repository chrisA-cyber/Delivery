"use client";

import { Check, Copy, Dices, LoaderCircle, Search, Send } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ENERGY_MODIFIERS, PACKS, PROMPTS, isEnergyCompatible, isRatingAllowed, queryPrompts } from "@/data/content";
import { useApp } from "@/components/providers/app-provider";
import { ContentControl } from "@/components/content/content-control";

export function ChallengeBuilder({ initialPromptId = "", initialEnergyId = "" }: { initialPromptId?: string; initialEnergyId?: string }) {
  const { tier, contentRating, updatePreferences } = useApp();
  const [promptId, setPromptId] = useState(initialPromptId);
  const [energyId, setEnergyId] = useState(initialEnergyId);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState<{ key: string; url: string } | null>(null);
  const pendingRef = useRef<Promise<string> | null>(null);
  const availablePrompts = useMemo(() => queryPrompts({ maxRating: contentRating }).filter((item) => tier === "pro" || item.packIds.every((id) => PACKS.find((pack) => pack.id === id)?.access !== "pro")), [tier, contentRating]);
  const requestedPrompt = PROMPTS.find((item) => item.id === promptId);
  const needsContentConsent = requestedPrompt && !isRatingAllowed(requestedPrompt.rating, contentRating);
  const prompt = needsContentConsent ? undefined : availablePrompts.find((item) => item.id === promptId) ?? availablePrompts[0];
  const directions = prompt ? ENERGY_MODIFIERS.filter((direction) => isEnergyCompatible(prompt, direction)) : [];
  const energy = directions.find((item) => item.id === energyId) ?? directions[0];
  const filtered = availablePrompts.filter((item) => !query.trim() || `${item.line} ${item.tags.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pack = PACKS.find((item) => prompt?.packIds.includes(item.id));

  function randomize() {
    const alternatives = availablePrompts.filter((item) => item.id !== prompt?.id);
    const next = alternatives[Math.floor(Math.random() * alternatives.length)] ?? prompt;
    if (!next) return;
    const compatible = ENERGY_MODIFIERS.filter((direction) => isEnergyCompatible(next, direction));
    setPromptId(next.id);
    setEnergyId(compatible[Math.floor(Math.random() * compatible.length)]?.id ?? "");
    setNotice("");
  }

  async function link() {
    if (!prompt || !energy) throw new Error("Choose a line and direction first.");
    const key = `${prompt.id}:${energy.id}:${contentRating}`;
    if (invite?.key === key) return invite.url;
    if (pendingRef.current) return pendingRef.current;
    setCreating(true); setError(""); setNotice("");
    const pending = (async () => {
      const response = await fetch("/api/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptId: prompt.id, energyId: energy.id, maxRating: contentRating }) });
      const body = await response.json() as { data?: { inviteUrl?: string }; error?: { message?: string } };
      if (!response.ok || !body.data?.inviteUrl) throw new Error(body.error?.message ?? "Challenge link could not be created.");
      setInvite({ key, url: body.data.inviteUrl });
      return body.data.inviteUrl;
    })();
    pendingRef.current = pending;
    try { return await pending; } finally { pendingRef.current = null; setCreating(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(await link()); setNotice("Link copied. Send it to your friend when you are ready."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Challenge link could not be copied."); }
  }

  async function share() {
    try {
      const url = await link();
      if (navigator.share) await navigator.share({ title: "Your Delivery challenge", text: `Your line is picked. Your delivery is your problem. ${energy?.shortLabel}.`, url });
      else { await navigator.clipboard.writeText(url); setNotice("Link copied. Send it to your friend when you are ready."); }
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Challenge link could not be shared."); }
  }

  return <div>
    <div className="mb-6 flex flex-col gap-4 border-b border-white/15 pb-6 sm:flex-row sm:items-end sm:justify-between"><ContentControl value={contentRating} onChange={(contentRating) => { updatePreferences({ contentRating }); setNotice(""); }} disabled={creating} /><p className="max-w-sm text-sm leading-6 text-white/65">Two people. The same line and direction. A signed invite keeps your matchup together.</p></div>
    {needsContentConsent && <p role="status" className="mb-6 rounded-xl border border-acid/30 bg-acid/5 p-4 text-sm leading-6 text-white/75">The selected line is above your current content setting. Adjust the control to view it, or choose another line below.</p>}
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <section className="panel-solid min-w-0 p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><p className="mono-label text-acid">01 / Their line</p><h2 className="mt-2 text-2xl font-bold">Make it personal.</h2></div><button onClick={randomize} disabled={creating} className="button-secondary px-3"><Dices className="size-4" /> Surprise me</button></div>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/20 px-3"><span className="sr-only">Search challenge lines</span><Search className="size-4 shrink-0 text-white/60" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lines" className="min-w-0 w-full bg-transparent py-3 text-sm outline-none placeholder:text-white/55" /></label>
        <div className="mt-4 grid max-h-[480px] gap-2 overflow-y-auto pr-1" aria-label="Choose a challenge line">{filtered.map((item) => <button key={item.id} disabled={creating} onClick={() => { setPromptId(item.id); setNotice(""); }} aria-pressed={item.id === prompt?.id} className={`rounded-xl border p-4 text-left transition ${item.id === prompt?.id ? "border-acid bg-acid/10" : "border-white/10 hover:border-white/40"}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold leading-6">“{item.line}”</p>{item.id === prompt?.id && <Check className="mt-1 size-4 shrink-0 text-acid" />}</div><p className="mono-label mt-3 text-white/50">{item.difficulty} · {item.rating === "mature" ? "18+ mature" : item.rating}</p></button>)}{!filtered.length && <p className="py-8 text-center text-sm text-white/65">No lines match. Try another search.</p>}</div>
      </section>
      <div className="grid content-start gap-5">
        <section className="panel-solid p-5 sm:p-6"><p className="mono-label text-electric">02 / Their direction</p><h2 className="mt-2 text-2xl font-bold">The second joke.</h2><label htmlFor="challenge-direction" className="sr-only">Delivery direction</label><select id="challenge-direction" value={energy?.id ?? ""} disabled={creating} onChange={(event) => { setEnergyId(event.target.value); setNotice(""); }} className="mt-5 min-h-12 w-full rounded-xl border border-white/20 bg-surface px-3 text-sm font-bold text-white">{directions.map((item) => <option key={item.id} value={item.id}>{item.shortLabel}</option>)}</select><p className="mt-4 border-l-2 border-electric pl-4 text-sm leading-6 text-white/75">{energy?.instruction}</p></section>
        <section className="rounded-2xl bg-paper p-5 text-ink sm:p-6"><p className="mono-label text-black/60">03 / The invite · {pack?.name}</p><p className="mt-6 text-2xl font-bold leading-8 tracking-tight">“{prompt?.line ?? "Choose a line to begin."}”</p><p className="mt-4 text-sm font-semibold text-black/65">{energy?.shortLabel}</p><div className="mt-7 grid gap-2 sm:grid-cols-2"><button onClick={() => void share()} disabled={creating || !prompt || !energy} className="button-primary">{creating ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Share invite</button><button onClick={() => void copy()} disabled={creating || !prompt || !energy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-black/25 px-4 text-sm font-bold disabled:opacity-50"><Copy className="size-4" /> Copy link</button></div>{error && <p role="alert" className="mt-4 rounded-xl bg-red-900/10 p-3 text-sm leading-6 text-red-950">{error}</p>}{notice && <p role="status" className="mt-4 text-sm leading-6 text-black/75">{notice}</p>}<p className="mt-4 border-t border-black/15 pt-4 text-xs leading-5 text-black/65">Invite expires in 7 days. Each person gets one scored entry. {contentRating === "mature" ? "Your friend must opt into mature content to view this line." : "Recordings stay private within the matchup unless separately published."}</p></section>
      </div>
    </div>
  </div>;
}
