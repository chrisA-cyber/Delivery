"use client";

import { Flag, LoaderCircle, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import type { ApiResponse } from "@/lib/types";

const reasons = [
  ["harassment", "Harassment or bullying"],
  ["hate", "Hate or hateful conduct"],
  ["sexual", "Sexual content"],
  ["violence", "Violence or threats"],
  ["self_harm", "Self-harm concern"],
  ["privacy", "Privacy or impersonation"],
  ["copyright", "Copyright issue"],
  ["spam", "Spam or manipulation"],
  ["other", "Something else"],
] as const;

type ReportTarget =
  | { deliveryId: string; profileId?: never }
  | { profileId: string; deliveryId?: never };

type ReportActionProps = ReportTarget & {
  label?: string;
  className?: string;
  context?: string;
  challengeInvite?: string;
};

export function ReportAction({ label = "Report", className = "button-ghost", context, ...target }: ReportActionProps) {
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof reasons)[number][0]>("harassment");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const statusRef = useRef(status);
  const [error, setError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  statusRef.current = status;

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && statusRef.current !== "sending") setOpen(false);
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]") ?? []);
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("[data-report-focus]")?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  async function submit() {
    const requestKey = idempotencyKey || crypto.randomUUID();
    if (!idempotencyKey) setIdempotencyKey(requestKey);
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestKey,
        },
        body: JSON.stringify({
          ...target,
          reason,
          ...(details.trim() ? { details: details.trim() } : {}),
        }),
      });
      const body = await response.json() as ApiResponse<{ id: string }>;
      if (!response.ok || !body.ok) throw new Error(body.ok ? "Report could not be sent." : body.error.message);
      setStatus("sent");
    } catch (cause) {
      setStatus("idle");
      setError(cause instanceof Error ? cause.message : "Report could not be sent.");
    }
  }

  function close() {
    if (status === "sending") return;
    setOpen(false);
    if (status === "sent") {
      setReason("harassment");
      setDetails("");
      setIdempotencyKey("");
      setStatus("idle");
    }
    setError("");
  }

  return <>
    <button ref={triggerRef} type="button" onClick={() => { if (status === "sent") { setStatus("idle"); setDetails(""); } setError(""); setIdempotencyKey(crypto.randomUUID()); setOpen(true); }} className={className}><Flag className="size-4" /> {label}</button>
    {open && <div className="fixed inset-0 z-[100] grid place-items-end bg-black/75 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-lg rounded-t-[28px] border border-white/10 bg-[#131315] p-5 shadow-2xl sm:rounded-[28px] sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="mono-label text-hot">Safety signal</p><h2 id={titleId} className="mt-2 text-2xl font-black tracking-[-0.04em]">Send this to the crew</h2>{context && <p className="mt-2 text-sm font-bold text-white/40">{context}</p>}</div><button type="button" onClick={close} disabled={status === "sending"} aria-label="Close report form" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-40"><X className="size-4" /></button></div>
        {status === "sent" ? <div className="mt-7 rounded-2xl border border-acid/20 bg-acid/[0.07] p-5"><ShieldAlert className="size-6 text-acid" /><p className="mt-4 text-lg font-black">Report received.</p><p className="mt-2 text-sm leading-6 text-white/50">The item is queued for review. Blocking is available on profiles if you also want distance right now.</p><button type="button" autoFocus onClick={close} className="button-primary mt-5 w-full">Done</button></div> : <div className="mt-7 space-y-5">
          <label className="block"><span className="mono-label text-white/45">What happened?</span><select data-report-focus value={reason} onChange={(event) => setReason(event.target.value as typeof reason)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none focus:border-acid/50">{reasons.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
          <label className="block"><span className="mono-label text-white/45">Details <span className="text-white/25">· optional</span></span><textarea value={details} onChange={(event) => setDetails(event.target.value.slice(0, 1000))} rows={4} placeholder="Tell reviewers what to look for. Do not include private information." className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-acid/50" /><span className="mt-1 block text-right font-mono text-[10px] text-white/25">{details.length}/1000</span></label>
          {error && <p role="alert" className="rounded-xl border border-hot/20 bg-hot/[0.07] p-3 text-sm font-bold text-hot">{error}</p>}
          <p className="text-xs leading-5 text-white/55">Reports are rate-limited and reviewed under our <Link href="/guidelines" className="font-black text-acid hover:underline">community rules</Link>. If someone is in immediate danger, contact local emergency services.</p>
          <button type="button" onClick={() => void submit()} disabled={status === "sending"} className="button-primary w-full">{status === "sending" ? <><LoaderCircle className="size-4 animate-spin" /> Sending safely</> : <><Flag className="size-4" /> Submit report</>}</button>
        </div>}
      </section>
    </div>}
  </>;
}
