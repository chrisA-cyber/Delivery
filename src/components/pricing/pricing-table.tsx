"use client";

import { Check, Crown, LoaderCircle, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers/app-provider";

const free = ["5 judged plays per day", "All rotating free packs", "Daily challenge", "Basic profile and history", "Shareable score cards & line links"];
const pro = ["Unlimited judged plays", "Every premium pack", "Performance fingerprint & category stats", "Signed custom friend challenges", "Stream stage, hotkeys & vote overlay", "Cancel or manage billing anytime"];

export function PricingTable() {
  const { authenticated, tier } = useApp();
  const [annual, setAnnual] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interval: annual ? "annual" : "monthly" }) });
      const body = await response.json() as { data?: { url?: string }; error?: { message?: string } };
      if (response.status === 401) { window.location.href = "/login?next=/pricing"; return; }
      if (!response.ok || !body.data?.url) throw new Error(body.error?.message ?? "Checkout is not ready yet.");
      window.location.href = body.data.url;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Checkout could not open."); setLoading(false); }
  }

  async function manageBilling() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const body = await response.json() as { data?: { url?: string }; error?: { message?: string } };
      if (!response.ok || !body.data?.url) throw new Error(body.error?.message ?? "Billing is not ready yet.");
      window.location.href = body.data.url;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Billing could not open."); setLoading(false); }
  }

  return <div><div className="mb-9 flex justify-center"><div className="flex rounded-full border border-white/10 bg-white/5 p-1"><button onClick={() => setAnnual(false)} className={`rounded-full px-4 py-2 text-xs font-black ${!annual ? "bg-white text-black" : "text-white/60"}`}>Monthly</button><button onClick={() => setAnnual(true)} className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black ${annual ? "bg-acid text-black" : "text-white/60"}`}>Annual <span className="rounded-full bg-black/10 px-2 py-0.5 text-[9px]">Save 20%</span></button></div></div><div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-2"><article className="panel p-6 sm:p-8"><p className="mono-label text-white/35">Free forever</p><div className="mt-5 flex items-end gap-2"><span className="display-type text-6xl">$0</span><span className="mb-2 text-sm font-bold text-white/35">/ forever</span></div><p className="mt-4 text-sm leading-6 text-white/50">Enough chaos to become a regular. No card, no countdown, no sad locked home screen.</p><Link href="/play" className="button-secondary mt-7 w-full min-h-14">Start playing</Link><div className="mt-7 grid gap-3">{free.map((item) => <p key={item} className="flex items-center gap-2.5 text-sm font-bold text-white/65"><Check className="size-4 shrink-0 text-acid" /> {item}</p>)}</div></article><article className="relative overflow-hidden rounded-[26px] border border-acid/35 bg-gradient-to-b from-acid/[0.13] to-[#111113] p-6 shadow-acid sm:p-8"><div className="absolute -right-24 -top-24 size-64 rounded-full bg-acid/15 blur-3xl" /><div className="relative"><div className="flex items-center justify-between"><p className="mono-label text-acid">Delivery Pro</p><span className="flex items-center gap-1.5 rounded-full bg-acid px-2.5 py-1 text-[9px] font-black text-black"><Crown className="size-3" /> {tier === "pro" ? "ACTIVE" : "FULL SEND"}</span></div><div className="mt-5 flex items-end gap-2"><span className="display-type text-6xl">${annual ? "8" : "10"}</span><span className="mb-2 text-sm font-bold text-white/35">/ month</span></div><p className="mt-1 text-xs font-bold text-acid/70">{annual ? "$96 billed annually" : "Cancel anytime"}</p><p className="mt-4 text-sm leading-6 text-white/55">For the person who hears “one more round” as a legally binding obligation.</p><button onClick={tier === "pro" ? manageBilling : checkout} disabled={loading} className="button-primary mt-7 w-full min-h-14">{loading ? <LoaderCircle className="size-4 animate-spin" /> : tier === "pro" ? <Crown className="size-4" /> : <Zap className="size-4" />} {loading ? "Opening…" : tier === "pro" ? "Manage membership" : authenticated ? "Go Pro" : "Sign in & go Pro"}</button>{error && <div role="alert" className="mt-3 rounded-xl border border-orange-400/20 bg-orange-400/10 p-3 text-xs font-bold text-orange-200">{error}</div>}<div className="mt-7 grid gap-3">{pro.map((item) => <p key={item} className="flex items-center gap-2.5 text-sm font-bold text-white/75"><Check className="size-4 shrink-0 text-acid" /> {item}</p>)}</div></div></article></div><div className="mx-auto mt-8 flex max-w-4xl items-center justify-center gap-2 text-center text-xs font-bold text-white/30"><Sparkles className="size-3.5 text-hot" /> Scores are never pay-to-win. Pro buys more stage, not more points.</div></div>;
}
