"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Flame, Headphones, LockKeyhole, Mic, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { roundApi, roundPost } from "@/components/rounds/round-api";

interface RoastLobbyState {
  available: boolean;
  reason?: string;
  signedIn: boolean;
  canHostPublic: boolean;
  main: null | { id: string; name: string; status: string; memberCount?: number; performers?: Array<{ name: string }> };
  capacity?: number;
  maxRooms?: number;
}

export function RoastRules({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "text-xs leading-6 text-white/60" : "text-sm leading-7 text-white/65"}>
    <p><strong className="text-white/85">Roast the people who opted in.</strong> No threats, doxxing, protected-trait abuse, or targeting uninvolved spectators.</p>
    <p className="mt-2">Adults 18+ only. Delivery does not record this stage. Other people may still capture a live session externally.</p>
  </div>;
}

export function RoastFormat({ compact = false }: { compact?: boolean }) {
  return <p className={`${compact ? "text-xs leading-6" : "text-sm leading-7"} text-white/65`}>Two performers. Two alternating 30-second turns each. Then the crowd gets 15 seconds to vote, after a short audio buffer. Winner stays for up to three wins. A draw or no votes rotates both out.</p>;
}

export function RoastLobby({ initialCreateOpen = false }: { initialCreateOpen?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<RoastLobbyState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adult, setAdult] = useState(false);
  const [name, setName] = useState("");
  const [createOpen, setCreateOpen] = useState(initialCreateOpen);
  const refresh = useCallback(async () => {
    try { setState(await roundApi<RoastLobbyState>("/api/roast")); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The stage status is unavailable. Please try again."); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function create(kind: "private" | "public") {
    if (busy || !adult) return;
    setBusy(true); setError("");
    try {
      const result = await roundPost<{ roomId: string; inviteToken?: string }>("/api/roast", { kind, name: name.trim() || (kind === "public" ? "The main stage" : "The group chat roast"), adult: true, requestId: crypto.randomUUID() });
      router.push(`/roast-off/${encodeURIComponent(result.roomId)}${result.inviteToken ? `?invite=${encodeURIComponent(result.inviteToken)}` : ""}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The room could not open. Please try again."); }
    finally { setBusy(false); }
  }
  const mainActive = Boolean(state?.available && state.main && state.main.status !== "closed");

  return <main className="roast-wrap">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="mono-label flex items-center gap-2 text-acid"><Flame className="size-4" />The live stage</p><span className="roast-tag bg-white/5 text-white/70">Live · 18+</span></div>
    <section className="roast-hero grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_1fr] lg:gap-12" aria-labelledby="roast-title">
      <div className="flex flex-col justify-center">
        <h1 id="roast-title" className="display-type text-6xl sm:text-7xl">Roast <span className="text-acid">Off.</span></h1>
        <p className="mt-4 max-w-md text-xl font-semibold leading-8 text-paper">Take the mic. Take the heat.</p>
        <p className="mt-3 max-w-md text-sm leading-7 text-white/70">Two performers. The crowd picks the winner.<br className="hidden sm:block" /> Watch for free or step up for your turn.</p>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-xs text-white/70"><span className="flex items-center gap-2"><Headphones className="size-4 text-electric" />Guest spectators</span><span className="flex items-center gap-2"><Mic className="size-4 text-acid" />Camera optional</span><span className="flex items-center gap-2"><Users className="size-4 text-hot" />Crowd voting</span></div>
      </div>
      <div className="rounded-2xl border border-white/15 bg-ink/75 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><p className="mono-label text-white/65">The main stage</p><span role="status" className={`roast-tag ${mainActive ? "bg-electric/10 text-electric" : "bg-white/5 text-white/65"}`}><span className="roast-live-dot" />{!state ? "Checking" : mainActive ? "Open" : "Offline"}</span></div>
        <div className="my-5 flex items-center justify-center gap-5" aria-hidden="true"><div className="grid size-14 place-items-center rounded-2xl border border-acid/30 bg-acid/5 text-acid"><Mic className="size-6" /></div><span className="display-type text-2xl text-white/40">VS</span><div className="grid size-14 place-items-center rounded-2xl border border-hot/30 bg-hot/5 text-hot"><Mic className="size-6" /></div></div>
        <h2 className="text-xl font-bold">{mainActive ? state?.main?.name : "The stage is taking a break."}</h2>
        <p className="mt-2 text-sm leading-6 text-white/65">{!state ? "Checking whether the stage is open…" : !state.available ? state.reason || "Live rooms are unavailable right now. Try a solo game while you wait." : mainActive ? state.main?.performers?.length ? `${state.main.performers.map((performer) => performer.name).join(" vs ")}. Come hear it for yourself.` : "The host is here. Join the crowd or get in line." : "Start a private room with friends, or play a solo game while the public stage is offline."}</p>
        {mainActive && state?.main ? <Link className="button-primary mt-5 w-full" href={`/roast-off/${encodeURIComponent(state.main.id)}`}><Headphones className="size-4" />Enter the crowd<ArrowRight className="size-4" /></Link> : state?.available ? <Link className="button-primary mt-5 w-full" href={state.signedIn ? "/roast-off/new#create-room" : "/login?next=%2Froast-off%2Fnew"}><LockKeyhole className="size-4" />{state.signedIn ? "Create a private room" : "Sign in to host"}<ArrowRight className="size-4" /></Link> : <Link className="button-primary mt-5 w-full" href="/play">Play Classic<ArrowRight className="size-4" /></Link>}
        {!mainActive && <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><Link className="button-ghost px-2 text-xs" href="/">All solo modes<ArrowRight className="size-3.5" /></Link><button className="button-ghost px-2 text-xs" onClick={() => void refresh()}><RefreshCw className="size-3.5" />Refresh status</button></div>}
      </div>
    </section>

    {error && <div role="alert" className="mt-5 rounded-xl border border-acid/40 bg-acid/5 p-4 text-sm text-acid">{error}</div>}

    <section className="mt-5 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-white/10 px-5 py-4 sm:px-6">
      <div className="flex max-w-2xl items-start gap-3"><Check className="mt-1 size-4 shrink-0 text-electric" /><p className="text-sm leading-6 text-white/65">Spectators need no microphone or camera. Performers sign in, check their mic privately, and choose to be roasted.</p></div>
      {mainActive && (state?.signedIn ? <button className="button-secondary" onClick={() => setCreateOpen((value) => !value)} aria-expanded={createOpen} aria-controls="create-room"><LockKeyhole className="size-4" />{createOpen ? "Close room setup" : "Host a private room"}</button> : <Link href="/login?next=%2Froast-off%2Fnew" className="button-secondary"><LockKeyhole className="size-4" />Sign in to host</Link>)}
    </section>

    {(createOpen || state?.canHostPublic) && <section className="roast-panel mt-5 scroll-mt-24 p-6 sm:p-7" id="create-room"><h2 className="text-xl font-bold">Create your room</h2><p className="mt-2 text-sm text-white/65">Invite your friends. You control the stage and queue.</p><div className="mt-5 max-w-xl"><label htmlFor="roast-room-name" className="mb-2 block text-sm font-bold">Room name</label><input id="roast-room-name" className="roast-input" maxLength={32} value={name} onChange={(event) => setName(event.target.value)} placeholder="The group chat roast" /><label className="roast-check mt-4"><input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} /><span>I am 18 or older and agree to run the room under the roast rules below. This acknowledgement does not verify my age.</span></label><div className="mt-5 flex flex-wrap gap-3">{state?.signedIn ? <button className="button-primary" disabled={!adult || busy || !state.available} onClick={() => void create("private")}><LockKeyhole className="size-4" />{busy ? "Opening stage…" : "Open private room"}</button> : <Link className="button-primary" href="/login?next=%2Froast-off%2Fnew"><LockKeyhole className="size-4" />Sign in to open your room</Link>}{state?.canHostPublic && <button className="button-secondary" disabled={!adult || busy || !state.available || mainActive} onClick={() => void create("public")}><ShieldCheck className="size-4" />Open the main stage</button>}</div>{state && !state.available && <p className="mt-3 text-sm text-acid">Live rooms are unavailable right now.</p>}</div></section>}

    <details className="mt-5 rounded-xl border border-white/10 p-5"><summary className="cursor-pointer text-sm font-bold">Battle format & roast rules</summary><div className="mt-4 max-w-3xl"><RoastFormat /><div className="mt-4 border-t border-white/10 pt-4"><RoastRules /></div><p className="mt-3 text-xs leading-6 text-white/55">Audience votes decide the result. Guest identity limits reduce casual repeat voting; they cannot prevent determined multi-account abuse.</p></div></details>
  </main>;
}
