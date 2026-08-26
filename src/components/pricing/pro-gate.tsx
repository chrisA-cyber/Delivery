"use client";

import { Crown, LockKeyhole, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useApp } from "@/components/providers/app-provider";

export function ProGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { authReady, tier } = useApp();
  if (!authReady) return <div className="panel mx-auto h-80 max-w-4xl animate-pulse" />;
  if (tier === "pro") return children;
  return <div className="panel-solid relative mx-auto max-w-2xl overflow-hidden p-7 text-center sm:p-10"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-hot via-acid to-electric" /><div className="mx-auto grid size-16 place-items-center rounded-3xl bg-acid/10 text-acid"><LockKeyhole className="size-7" /></div><p className="mono-label mt-6 text-acid">Delivery Pro</p><h1 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl">Unlock {feature}.</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-white/50">Unlimited judging, every premium pack, performance fingerprints, signed challenges, and the creator stage. Scores stay exactly as ruthless.</p><Link href="/pricing" className="button-primary mt-7"><Crown className="size-4" /> See Pro</Link><Link href="/play" className="button-ghost ml-2 mt-7">Play a free round <Sparkles className="size-4" /></Link></div>;
}

export function ProPlayLink({ href, requiresPro, className, children }: { href: string; requiresPro: boolean; className?: string; children: ReactNode }) {
  const { tier } = useApp();
  return <Link href={requiresPro && tier !== "pro" ? `/pricing?next=${encodeURIComponent(href)}` : href} className={className}>{children}</Link>;
}
