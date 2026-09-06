"use client";

import { ArrowRight, Github, LoaderCircle, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function signInMessage(cause: unknown, emailReady: boolean): string {
  const code = cause && typeof cause === "object" && "code" in cause ? cause.code : undefined;
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    return "Email sign-in has reached its sending limit. Wait before requesting another link. Your scene is still waiting; you can keep playing as a guest.";
  }
  if (code === "invalid_credentials") return `That email and password did not match. Check them.${emailReady ? " You can also reset your password below." : " Password recovery is temporarily unavailable."}`;
  if (code === "email_not_confirmed") return `Confirm your email before signing in. Open the confirmation message in your inbox.${emailReady ? "" : " New confirmation emails are temporarily unavailable."}`;
  return cause instanceof Error ? cause.message : "Sign-in could not start. Please try again.";
}

export function AuthPanel({ enabledProviders = [], emailReady = false, passwordSignIn = false }: {
  enabledProviders?: Array<"google" | "github">;
  emailReady?: boolean;
  passwordSignIn?: boolean;
}) {
  const search = useSearchParams();
  const requestedNext = search.get("next") ?? "/profile";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\") ? requestedNext : "/profile";
  const callbackError = search.get("error") === "callback";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordMode, setPasswordMode] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(callbackError ? "error" : "idle");
  const [message, setMessage] = useState(callbackError ? "That sign-in link expired, was already used, or opened in a different browser. Try an available sign-in method below. Your scene or challenge is still waiting." : "");
  const loading = status === "loading";
  const newAccountsAvailable = emailReady || enabledProviders.length > 0;

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (loading || (passwordMode ? !passwordSignIn : !emailReady)) return;
    setStatus("loading"); setMessage("");
    try {
      const client = createClient();
      if (passwordMode) {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(next);
      } else {
        const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
        if (error) throw error;
        setStatus("sent");
        setMessage("Check your inbox and spam folder. Open the newest link in this same browser to finish signing in. No password needed.");
      }
    } catch (cause) { setStatus("error"); setMessage(signInMessage(cause, emailReady)); }
  }

  async function recoverPassword() {
    if (loading || !emailReady || !email) return;
    setStatus("loading"); setMessage("");
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset?next=${encodeURIComponent(next)}` });
      if (error) throw error;
      setStatus("sent");
      setMessage("If that address has a password account, a reset link is on its way. Open the newest message in this same browser. Your scene or challenge will be waiting afterward.");
    } catch (cause) { setStatus("error"); setMessage(signInMessage(cause, emailReady)); }
  }

  async function social(provider: "google" | "github") {
    if (loading || !enabledProviders.includes(provider)) return;
    setStatus("loading"); setMessage("");
    try {
      const { error } = await createClient().auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
      if (error) throw error;
    } catch (cause) { setStatus("error"); setMessage(signInMessage(cause, emailReady)); }
  }

  return <div className="panel-solid w-full max-w-lg p-6 sm:p-9">
    <div className="grid size-12 place-items-center rounded-2xl bg-acid text-black"><Sparkles className="size-5" /></div>
    <h1 className="display-type mt-7 text-[clamp(2.5rem,7vw,3.6rem)] leading-none">SAVE THE TAPE.</h1>
    <p className="mt-4 text-sm leading-6 text-white/65">Keep your takes, claim a friend’s challenge, and build a profile. New recordings still start private.</p>
    {!newAccountsAvailable && <p role="status" className="mt-6 rounded-xl border border-orange-400/20 bg-orange-400/10 p-3 text-sm leading-6 text-orange-200">New accounts are temporarily unavailable. You can still play as a guest. Saving to an account and creating challenges will be available once sign-up is ready.</p>}
    {enabledProviders.length > 0 && <>
      <div className="mt-7 grid gap-2">{enabledProviders.map((provider) => <button key={provider} onClick={() => void social(provider)} disabled={loading} className="button-secondary w-full">
        {provider === "google" ? <span className="text-base font-black">G</span> : <Github className="size-4" />} Continue with {provider === "google" ? "Google" : "GitHub"}
      </button>)}</div>
      {emailReady && <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-white/10" /><span className="mono-label text-white/55">or email</span><div className="h-px flex-1 bg-white/10" /></div>}
    </>}
    {(emailReady || (passwordMode && passwordSignIn)) && <form className={enabledProviders.length && emailReady ? undefined : "mt-7"} onSubmit={signIn}>
      <label className="mono-label text-white/60" htmlFor="email">Email address</label>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 focus-within:border-acid/40"><Mail className="size-4 text-white/55" /><input id="email" type="email" autoComplete="email" inputMode="email" required disabled={loading} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@thegroupchat.com" className="min-h-12 w-full bg-transparent text-sm font-bold outline-none placeholder:text-white/55" /></div>
      {passwordMode && <div className="mt-4"><label className="mono-label text-white/60" htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required disabled={loading} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold outline-none focus:border-acid/40" /><p className="mt-2 text-xs leading-5 text-white/55">For an account that already has a password.</p></div>}
      <button disabled={loading} className="button-primary mt-3 w-full">{loading ? <LoaderCircle className="size-4 animate-spin" /> : null} {passwordMode ? "Sign in" : status === "sent" ? "Send a fresh link" : "Continue with email"} <ArrowRight className="size-4" /></button>
      {!passwordMode && <p className="mt-2 text-xs leading-5 text-white/55">We’ll email a sign-in link. Your first sign-in creates your free account.</p>}
      {passwordMode && (emailReady ? <button type="button" disabled={loading || !email} onClick={() => void recoverPassword()} className="button-ghost mt-1 w-full text-xs">Forgot password? Send a reset link</button> : <p className="mt-3 text-xs leading-5 text-orange-200">Password reset emails are temporarily unavailable. If you cannot sign in, keep playing as a guest and return when recovery is ready.</p>)}
    </form>}
    {message && <p role={status === "error" ? "alert" : "status"} className={`mt-4 rounded-xl border p-3 text-xs font-bold leading-5 ${status === "sent" ? "border-acid/20 bg-acid/10 text-acid" : "border-orange-400/20 bg-orange-400/10 text-orange-200"}`}>{message}</p>}
    {passwordSignIn && <button type="button" disabled={loading} onClick={() => { setPasswordMode(!passwordMode); setStatus("idle"); setMessage(""); setPassword(""); }} className="button-ghost mt-3 w-full text-xs">{passwordMode ? emailReady ? "Use an email link instead" : "Back to sign-in options" : "Already have a password? Sign in"}</button>}
    <Link href={next.startsWith("/say-it-back") || next.startsWith("/play") || next.startsWith("/challenge/") ? next : "/play"} className="button-ghost mt-1 w-full">Keep playing as guest</Link>
    <p className="mt-5 text-center text-[10px] leading-4 text-white/55">By continuing, you agree to the <Link className="font-bold text-white/80 underline hover:text-white" href="/terms">terms</Link> and <Link className="font-bold text-white/80 underline hover:text-white" href="/privacy">privacy policy</Link>.</p>
  </div>;
}
