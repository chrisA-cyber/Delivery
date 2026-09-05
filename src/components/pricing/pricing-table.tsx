"use client";

import { Check, Crown, LoaderCircle, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers/app-provider";

const free = ["5 judged plays per day", "All rotating free packs", "Daily challenge", "Basic profile and history", "Shareable score cards & line links"];
const pro = ["Unlimited judged plays", "Every premium pack", "Performance fingerprint & category stats", "Signed custom friend challenges", "Stream stage & host-controlled vote overlay", "Cancel or manage billing anytime"];

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

  return <div>
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><p className="text-sm leading-6 text-white/65">Choose your billing interval. Both plans use the same judge.</p><div className="flex rounded-xl border border-white/20 p-1"><button onClick={() => setAnnual(false)} disabled={loading} aria-pressed={!annual} className={`min-h-11 rounded-lg px-4 text-sm font-bold ${!annual ? "bg-white text-black" : "text-white/65"}`}>Monthly</button><button onClick={() => setAnnual(true)} disabled={loading} aria-pressed={annual} className={`min-h-11 rounded-lg px-4 text-sm font-bold ${annual ? "bg-acid text-black" : "text-white/65"}`}>Annual · save 20%</button></div></div>
    <div className="grid gap-5 md:grid-cols-2"><article className="flex flex-col rounded-2xl border border-white/20 p-6 sm:p-8"><p className="mono-label text-electric">Delivery Free</p><h2 className="display-type mt-6 text-6xl">$0</h2><p className="mt-2 text-sm text-white/60">No card needed</p><p className="mt-5 text-base leading-7 text-white/70">A microphone, a questionable line, and five chances a day to commit to the bit.</p><Link href="/play" className="button-secondary mt-7 min-h-14 w-full">Start playing</Link><ul className="mt-7 grid gap-4 border-t border-white/15 pt-7">{free.map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-6 text-white/75"><Check className="mt-1 size-4 shrink-0 text-electric" />{item}</li>)}</ul></article>
    <article className="flex flex-col rounded-2xl bg-[#f4f0e7] p-6 text-[#171715] sm:p-8"><div className="flex items-center justify-between gap-4"><p className="mono-label text-black/60">Delivery Pro</p><Crown className="size-5" /></div><h2 className="display-type mt-6 text-6xl">${annual ? "8" : "10"}<span className="ml-2 font-sans text-sm font-semibold text-black/65">/ month</span></h2><p className="mt-2 text-sm font-semibold text-black/65">{annual ? "$96 billed annually" : "$10 billed monthly"}</p><p className="mt-5 text-base leading-7 text-black/75">For the person who has never meant it when they said “last round.”</p><button onClick={tier === "pro" ? manageBilling : checkout} disabled={loading} className="button-primary mt-7 min-h-14 w-full">{loading ? <LoaderCircle className="size-4 animate-spin" /> : tier === "pro" ? <Crown className="size-4" /> : <Zap className="size-4" />}{loading ? "Opening…" : tier === "pro" ? "Manage membership" : authenticated ? "Go Pro" : "Sign in & go Pro"}</button>{error && <p role="alert" className="mt-4 rounded-xl bg-red-900/10 p-4 text-sm leading-6 text-red-950">{error}</p>}<ul className="mt-7 grid gap-4 border-t border-black/20 pt-7">{pro.map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-6 text-black/75"><Check className="mt-1 size-4 shrink-0" />{item}</li>)}</ul></article></div>
    <div className="mt-7 flex items-start justify-center gap-3 rounded-xl border border-white/15 p-5"><Sparkles className="mt-1 size-4 shrink-0 text-hot" /><p className="text-sm leading-6 text-white/65">Pro changes your access and play allowance. It never adds points to your score. Manage or cancel your subscription from Settings.</p></div>
  </div>;
}
