"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { roundApi } from "./round-api";
export function JoinCode({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return <main className="mx-auto min-h-screen max-w-xl px-5 pb-24 pt-36"><p className="mono-label text-electric">The audience is part of the show</p><h1 className="display-type mt-4 text-6xl">You’re up.</h1><p className="my-6 leading-7 text-white/65">Enter the host’s code. Bring a performance, or just watch and vote. Camera optional. No account required.</p><form className="panel-solid space-y-5 p-6" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(""); try { const data = await roundApi<{ path: string }>(`/api/rounds/lookup?code=${encodeURIComponent(code)}`); router.push(data.path); } catch (cause) { setError(cause instanceof Error ? cause.message : "That code could not be found."); } finally { setBusy(false); } }}><label htmlFor="join-code" className="block text-sm font-bold">Join code</label><input id="join-code" autoComplete="off" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} required className="min-h-16 w-full rounded-xl border border-white/25 bg-transparent px-4 text-center font-mono text-3xl uppercase tracking-widest" placeholder="A1B2C3D4" /><button className="button-primary w-full" disabled={busy || code.replace(/[\s-]/g, "").length !== 8}>{busy ? "Finding your round…" : "Join the round"}</button>{error && <p role="alert" className="text-sm text-orange-200">{error}</p>}</form><Link className="mt-8 inline-block text-sm underline" href="/rounds?community=1">Host a community round</Link></main>;
}
