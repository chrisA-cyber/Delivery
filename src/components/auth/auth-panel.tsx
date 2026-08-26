"use client";

import { ArrowRight, Github, LoaderCircle, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthPanel() {
  const search = useSearchParams();
  const requestedNext = search.get("next") ?? "/profile";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\") ? requestedNext : "/profile";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault(); setStatus("loading"); setMessage("");
    try {
      const client = createClient();
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
      if (error) throw error;
      setStatus("sent"); setMessage("Check your inbox. The link expires soon, unlike this bit.");
    } catch (cause) { setStatus("error"); setMessage(cause instanceof Error ? cause.message : "Sign-in could not start."); }
  }

  async function social(provider: "google" | "github") {
    setStatus("loading"); setMessage("");
    try { const client = createClient(); const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } }); if (error) throw error; }
    catch (cause) { setStatus("error"); setMessage(cause instanceof Error ? cause.message : "Sign-in could not start."); }
  }

  return <div className="panel-solid w-full max-w-md p-6 sm:p-8"><div className="grid size-12 place-items-center rounded-2xl bg-acid text-black"><Sparkles className="size-5" /></div><h1 className="display-type mt-7 text-5xl">SAVE THE TAPE.</h1><p className="mt-4 text-sm leading-6 text-white/50">Sign in to keep your history, claim challenges, climb leaderboards, and receive an irresponsible number of badges.</p><div className="mt-7 grid gap-2"><button onClick={() => social("google")} className="button-secondary w-full"><span className="text-base font-black">G</span> Continue with Google</button><button onClick={() => social("github")} className="button-secondary w-full"><Github className="size-4" /> Continue with GitHub</button></div><div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-white/10" /><span className="mono-label text-white/25">or email</span><div className="h-px flex-1 bg-white/10" /></div><form onSubmit={sendMagicLink}><label className="mono-label text-white/60" htmlFor="email">Email address</label><div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 focus-within:border-acid/40"><Mail className="size-4 text-white/55" /><input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@thegroupchat.com" className="min-h-12 w-full bg-transparent text-sm font-bold outline-none placeholder:text-white/55" /></div><button disabled={status === "loading"} className="button-primary mt-3 w-full">{status === "loading" ? <LoaderCircle className="size-4 animate-spin" /> : null} Email me a magic link <ArrowRight className="size-4" /></button></form>{message && <p role="status" className={`mt-4 rounded-xl border p-3 text-xs font-bold leading-5 ${status === "sent" ? "border-acid/20 bg-acid/10 text-acid" : "border-orange-400/20 bg-orange-400/10 text-orange-200"}`}>{message}</p>}<Link href={next === "/pricing" ? "/pricing" : "/play"} className="button-ghost mt-4 w-full">Keep playing as guest</Link><p className="mt-5 text-center text-[10px] leading-4 text-white/55">By continuing, you agree to the <Link className="font-bold text-white/80 underline hover:text-white" href="/terms">terms</Link> and <Link className="font-bold text-white/80 underline hover:text-white" href="/privacy">privacy policy</Link>.</p></div>;
}
