"use client";

import React, { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Require the SDK's recovery event from this code exchange, never a URL flag. */
async function recoverSession(code: string, flowId?: string): Promise<string> {
  const client = createClient();
  let recoveryUser: string | undefined;
  const { data: listener } = client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") recoveryUser = session?.user.id;
  });
  try {
    const { data, error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error || !data.session || !recoveryUser || recoveryUser !== data.user?.id) {
      throw new Error("This reset link expired, was already used, or opened in a different browser. Request a fresh link and open it in the browser where you requested it.");
    }
    return recoveryUser;
  } finally { listener.subscription.unsubscribe(); }
}

export function PasswordResetPanel({ next, emailReady }: { next: string; emailReady: boolean }) {
  const recovery = useRef<Promise<string> | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"checking" | "ready" | "saving" | "error" | "done">(emailReady ? "checking" : "error");
  const [message, setMessage] = useState(emailReady ? "Checking your reset link…" : "Password reset emails are temporarily unavailable. You can continue playing as a guest.");

  useEffect(() => {
    if (!emailReady) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setStatus("error"); setMessage("Open a fresh password reset link from your email in the browser where you requested it."); return;
    }
    let active = true;
    recovery.current ??= recoverSession(code, params.get("sb_flow_id") ?? undefined);
    void recovery.current.then((id) => {
      if (!active) return;
      setUserId(id); setStatus("ready"); setMessage("");
      window.history.replaceState(null, "", `/auth/reset?next=${encodeURIComponent(next)}`);
    }).catch((cause) => {
      if (!active) return;
      setStatus("error"); setMessage(cause instanceof Error ? cause.message : "This reset link could not be verified. Request a fresh one.");
    });
    return () => { active = false; };
  }, [emailReady, next]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!userId || status !== "ready") return;
    if (password !== confirm) { setMessage("Those passwords do not match."); return; }
    setStatus("saving"); setMessage("");
    try {
      const client = createClient();
      const { data, error: sessionError } = await client.auth.getUser();
      if (sessionError || data.user?.id !== userId) {
        setUserId(null);
        throw new Error("Your reset session ended. Request a fresh password reset link.");
      }
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setConfirm(""); setStatus("done");
      setMessage("Password updated. You’re signed in and can return to your scene.");
    } catch (cause) {
      setStatus("ready"); setMessage(cause instanceof Error ? cause.message : "Your password could not be updated. Try again.");
    }
  }

  return <div className="panel-solid w-full max-w-lg p-6 sm:p-9">
    <h1 className="display-type text-5xl leading-none">RESET YOUR PASSWORD.</h1>
    {message && <p role={status === "error" || status === "ready" ? "alert" : "status"} className="mt-5 text-sm leading-6 text-white/75">{message}</p>}
    {status === "checking" && <LoaderCircle className="mt-4 size-5 animate-spin" />}
    {userId && (status === "ready" || status === "saving") && <form onSubmit={save} className="mt-6 grid gap-3">
      <label htmlFor="new-password" className="mono-label text-white/70">New password</label>
      <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={status === "saving"} className="min-h-12 rounded-xl border border-white/15 bg-white/5 px-3" />
      <p className="text-xs text-white/55">Use at least 8 characters. Your account’s password security requirements still apply.</p>
      <label htmlFor="confirm-password" className="mono-label text-white/70">Confirm new password</label>
      <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(event) => setConfirm(event.target.value)} disabled={status === "saving"} className="min-h-12 rounded-xl border border-white/15 bg-white/5 px-3" />
      <button disabled={status === "saving"} className="button-primary mt-2">{status === "saving" ? "Updating…" : "Update password"}</button>
    </form>}
    {status === "done" ? <a href={next} className="button-primary mt-6 w-full">Continue playing</a> : <Link href={`/login?next=${encodeURIComponent(next)}`} className="button-secondary mt-6 w-full">Back to sign in</Link>}
  </div>;
}
