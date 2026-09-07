"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, AudioLines, Check, Flame, Headphones, LockKeyhole, Mic, Radio, RefreshCw, ShieldCheck, Users } from "lucide-react";
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
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><p className="mono-label flex items-center gap-2 text-acid"><Flame className="size-4" />Delivery after hours</p><span className="roast-tag bg-white/5 text-white/65">Live · 18+</span></div>
    <section className="roast-hero grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14" aria-labelledby="roast-title">
      <div>
        <h1 id="roast-title" className="display-type text-[76px] sm:text-[108px]">Roast <span className="text-acid">Off.</span></h1>
        <p className="display-type mt-5 max-w-lg text-4xl sm:text-5xl">Take the mic.<br />Take the heat.</p>
        <p className="mt-5 max-w-md text-base leading-7 text-white/70">Two people going at it. A crowd with opinions. And you, deciding whether to hang back or step up.</p>
        <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-xs text-white/70"><span className="flex items-center gap-2"><Headphones className="size-4 text-electric" />Watch without devices</span><span className="flex items-center gap-2"><AudioLines className="size-4 text-acid" />Real live voices</span><span className="flex items-center gap-2"><Users className="size-4 text-hot" />The crowd decides</span></div>
      </div>
      <div className="flex flex-col justify-center">
        <div className="rounded-2xl border border-white/15 bg-ink/75 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3"><p className="mono-label text-white/65">The main stage</p><span className={`roast-tag ${mainActive ? "bg-electric/10 text-electric" : "bg-white/5 text-white/55"}`}><span className="roast-live-dot" />{!state ? "Checking" : mainActive ? "Open" : "Offline"}</span></div>
          <div className="my-7 flex items-center justify-center gap-5" aria-hidden="true"><div className="grid size-20 place-items-center rounded-2xl border border-acid/30 bg-acid/5 text-acid"><Mic className="size-8" /></div><span className="display-type text-3xl text-white/30">VS</span><div className="grid size-20 place-items-center rounded-2xl border border-hot/30 bg-hot/5 text-hot"><Mic className="size-8" /></div></div>
          <h2 className="text-xl font-bold">{mainActive ? state?.main?.name : "The mic is cooling down."}</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">{!state ? "Checking whether the stage is open…" : !state.available ? state.reason || "Live rooms are not connected yet. Check back once the stage is ready." : mainActive ? state.main?.performers?.length ? `${state.main.performers.map((performer) => performer.name).join(" vs ")}. Come hear it for yourself.` : "The host is here. Come hang out or put your name in the queue." : "An authorized moderator needs to open the public stage. There’s no unattended show running."}</p>
          {mainActive && state?.main ? <Link className="button-primary mt-5 w-full" href={`/roast-off/${encodeURIComponent(state.main.id)}`}><Headphones className="size-4" />Enter the crowd<ArrowRight className="size-4" /></Link> : <button className="button-secondary mt-5 w-full" onClick={() => void refresh()}><RefreshCw className="size-4" />Check stage status</button>}
        </div>
        <p className="mt-3 text-center text-xs leading-6 text-white/45">Spectate as a guest. Sign in to perform or host.</p>
      </div>
    </section>

    {error && <div role="alert" className="mt-5 rounded-xl border border-acid/40 bg-acid/5 p-4 text-sm text-acid">{error}</div>}

    <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <div className="roast-panel p-6 sm:p-7"><div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-acid/10 text-acid"><Radio className="size-5" /></span><h2 className="text-lg font-bold">A battle. Then the next challenger.</h2></div><RoastFormat /><div className="mt-5 flex gap-3 border-t border-white/10 pt-5"><Check className="mt-1 size-4 shrink-0 text-electric" /><p className="text-sm leading-6 text-white/60">Voice only is welcome. Cameras are optional. Joining the queue includes a private microphone check and your explicit consent to be roasted.</p></div></div>
      <div className="roast-panel p-6 sm:p-7"><div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-hot/10 text-hot"><LockKeyhole className="size-5" /></span><h2 className="text-lg font-bold">Bring your own crowd.</h2></div><p className="text-sm leading-7 text-white/65">Open a private room, send one invitation, and run the stage for your friends. You control the queue, the room, and the invitation.</p>{state?.signedIn ? <button className="button-secondary mt-5" onClick={() => setCreateOpen((value) => !value)} aria-expanded={createOpen}>{createOpen ? "Close room setup" : "Create a private room"}<ArrowRight className="size-4" /></button> : <Link href="/login?next=%2Froast-off" className="button-secondary mt-5">Sign in to host<ArrowRight className="size-4" /></Link>}</div>
    </section>

    {(createOpen || state?.canHostPublic) && <section className="roast-panel mt-5 p-6 sm:p-7" id="create-room"><h2 className="text-xl font-bold">Your stage. Your people.</h2><div className="mt-5 max-w-xl"><label htmlFor="roast-room-name" className="mb-2 block text-sm font-bold">Room name</label><input id="roast-room-name" className="roast-input" maxLength={32} value={name} onChange={(event) => setName(event.target.value)} placeholder="The group chat roast" /><label className="roast-check mt-4"><input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} /><span>I am 18 or older and agree to run the room under the roast rules below. This acknowledgement does not verify my age.</span></label><div className="mt-5 flex flex-wrap gap-3"><button className="button-primary" disabled={!adult || busy || !state?.available} onClick={() => void create("private")}><LockKeyhole className="size-4" />{busy ? "Opening stage…" : "Open private room"}</button>{state?.canHostPublic && <button className="button-secondary" disabled={!adult || busy || !state.available || mainActive} onClick={() => void create("public")}><ShieldCheck className="size-4" />Open the main stage</button>}</div>{state && !state.available && <p className="mt-3 text-sm text-acid">Room creation will be available when live media is connected.</p>}</div></section>}

    <details className="mt-7 rounded-xl border border-white/10 p-5"><summary className="cursor-pointer text-sm font-bold">The roast rules <span className="ml-2 font-normal text-white/50">Sharp jokes. Clear boundaries.</span></summary><div className="mt-4 max-w-3xl"><RoastRules /><p className="mt-3 text-xs leading-6 text-white/45">Audience votes decide the result. Guest identity limits reduce casual repeat voting; they cannot prevent determined multi-account abuse.</p></div></details>
  </main>;
}
