"use client";

import { Crown, LockKeyhole, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useApp } from "@/components/providers/app-provider";

export function ProGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { authReady, tier, billing } = useApp();
  if (!authReady) return <div className="panel mx-auto h-80 max-w-4xl animate-pulse" />;
  if (tier === "pro") return children;
  if (!billing.checkoutAvailable) return <div className="panel-solid mx-auto max-w-2xl p-7 text-center sm:p-10"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-acid/10 text-acid"><LockKeyhole className="size-7" /></div><p className="mono-label mt-6 text-acid">Delivery Pro</p><h1 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl">{feature} needs Pro.</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-white/65">Pro upgrades are currently unavailable. Play the free Classic packs or dub a scene in Say It Back.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/play" className="button-primary">Play free Classic</Link><Link href="/say-it-back" className="button-secondary">Play Say It Back <Sparkles className="size-4" /></Link></div></div>;
  return <div className="panel-solid relative mx-auto max-w-2xl overflow-hidden p-7 text-center sm:p-10"><div className="absolute inset-x-0 top-0 h-1 bg-acid" /><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-acid/10 text-acid"><LockKeyhole className="size-7" /></div><p className="mono-label mt-6 text-acid">Delivery Pro</p><h1 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl">Unlock {feature}.</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-white/65">Pro includes more rounds, premium packs, private friend challenges, and host-operated Stream Mode. Every plan uses the same judge.</p><Link href="/pricing" className="button-primary mt-7"><Crown className="size-4" /> See Pro</Link><Link href="/play" className="button-ghost mt-3 sm:ml-2 sm:mt-7">Play a free round <Sparkles className="size-4" /></Link></div>;
}

export function ProPlayLink({ href, requiresPro, className, children }: { href: string; requiresPro: boolean; className?: string; children: ReactNode }) {
  const { tier } = useApp();
  return <Link href={requiresPro && tier !== "pro" ? `/pricing?next=${encodeURIComponent(href)}` : href} className={className}>{children}</Link>;
}
