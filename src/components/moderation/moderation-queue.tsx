"use client";

import { AlertTriangle, ArrowUpRight, Check, Clock3, EyeOff, LoaderCircle, RefreshCw, ShieldCheck, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiResponse } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import type { ModerationDecision, ModerationQueueItem, ReportState } from "@/types/moderation";

const states: Array<{ value: ReportState; label: string }> = [
  { value: "open", label: "Needs review" },
  { value: "triaged", label: "Triaged" },
  { value: "actioned", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" },
];

const reasonLabels: Record<string, string> = {
  harassment: "Harassment",
  hate: "Hateful conduct",
  sexual: "Sexual content",
  violence: "Violence or threat",
  self_harm: "Self-harm concern",
  spam: "Spam",
  privacy: "Privacy or impersonation",
  copyright: "Copyright",
  other: "Other",
};

const urgentReasons = new Set(["violence", "self_harm", "privacy", "hate"]);

const targetActionLabels = {
  delivery: { limit: "Limit visibility", remove: "Remove take" },
  profile: { limit: "Make private", remove: "Clear profile" },
  prompt: { limit: "Quarantine prompt", remove: "Archive prompt" },
  submission: { limit: "Return to review", remove: "Reject submission" },
  roast: { limit: "Mark reviewed", remove: "" },
} as const;

export function ModerationQueue() {
  const [state, setState] = useState<ReportState>("open");
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewing, setReviewing] = useState<{ item: ModerationQueueItem; decision: ModerationDecision } | null>(null);
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [saving, setSaving] = useState(false);
  const reviewDialogRef = useRef<HTMLElement>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const savingRef = useRef(saving);
  savingRef.current = saving;

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/moderation/reports?state=${state}`, { cache: "no-store", signal });
      const body = await response.json() as ApiResponse<{ items: ModerationQueueItem[]; capped: boolean }>;
      if (!response.ok || !body.ok) throw new Error(body.ok ? "Queue unavailable." : body.error.message);
      setItems(body.data.items);
      if (body.data.capped) setNotice("Showing the first 100 reports. Clear urgent items before paging deeper.");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Queue unavailable.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [state]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!reviewing) return;
    const trigger = reviewTriggerRef.current;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !savingRef.current) setReviewing(null);
      if (event.key !== "Tab") return;
      const focusable = Array.from(reviewDialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled]), a[href]") ?? []);
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    const frame = requestAnimationFrame(() => reviewDialogRef.current?.querySelector<HTMLElement>("[data-review-focus]")?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [reviewing]);

  function beginReview(item: ModerationQueueItem, decision: ModerationDecision, trigger: HTMLButtonElement) {
    reviewTriggerRef.current = trigger;
    setReviewing({ item, decision });
    setReason(decision === "allow" ? "Reviewed against the community guidelines; no action required." : item.target.kind === "roast" ? "Live room report reviewed. Any removal or ban is handled in the room by its host." : "Reviewed against the community guidelines.");
    setInternalNote("");
    setError("");
  }

  async function resolveReport() {
    if (!reviewing || reason.trim().length < 3) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/moderation/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: reviewing.item.id, decision: reviewing.decision, reason: reason.trim(), ...(internalNote.trim() ? { internalNote: internalNote.trim() } : {}) }),
      });
      const body = await response.json() as ApiResponse<unknown>;
      if (!response.ok || !body.ok) throw new Error(body.ok ? "Decision could not be saved." : body.error.message);
      setItems((current) => current.filter((item) => item.id !== reviewing.item.id));
      setNotice(reviewing.decision === "allow" ? "Report dismissed with an audit record." : reviewing.item.target.kind === "roast" ? "Report marked reviewed with an audit record. The room host handles removal and bans." : reviewing.decision === "remove" ? "Content removed and decision recorded." : "Visibility limited and decision recorded.");
      setReviewing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Decision could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
    <aside className="panel h-fit p-3 lg:sticky lg:top-24"><p className="mono-label px-3 pb-3 pt-2 text-white/30">Queue state</p>{states.map((option) => <button key={option.value} onClick={() => { setState(option.value); setNotice(""); setReviewing(null); }} className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-black transition ${state === option.value ? "bg-acid text-black" : "text-white/50 hover:bg-white/[0.06] hover:text-white"}`}><span>{option.label}</span>{state === option.value && <span className="font-mono text-xs">{items.length}</span>}</button>)}<div className="mt-3 border-t border-white/10 px-3 pt-4"><Link href="/guidelines" className="text-xs font-black text-acid hover:underline">Policy reference <ArrowUpRight className="inline size-3" /></Link><p className="mt-2 text-[11px] leading-5 text-white/30">Do not place sensitive report details in external chat or tickets.</p></div></aside>
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="mono-label text-hot">{states.find((option) => option.value === state)?.label}</p><p className="mt-1 text-sm text-white/40">Oldest urgent reports appear first.</p></div><button onClick={() => void load()} disabled={loading} className="button-secondary min-h-10 px-4"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button></div>
      {notice && <p role="status" className="mb-4 rounded-xl border border-acid/20 bg-acid/[0.06] p-3 text-sm font-bold text-acid">{notice}</p>}
      {error && <div role="alert" className="mb-4 rounded-xl border border-hot/25 bg-hot/[0.07] p-4"><p className="text-sm font-black text-hot">{error}</p>{error.toLowerCase().includes("sign in") && <Link href="/login?next=/moderation" className="button-secondary mt-3">Sign in</Link>}</div>}
      {loading ? <div className="panel grid min-h-80 place-content-center text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-acid" /><p className="mono-label mt-4 text-white/35">Opening the queue</p></div> : !items.length ? <div className="panel grid min-h-80 place-content-center text-center"><ShieldCheck className="mx-auto size-8 text-acid" /><p className="mt-5 text-2xl font-black">Queue clear.</p><p className="mt-2 text-sm text-white/40">A rare and beautiful internet moment.</p></div> : <div className="space-y-4">{items.map((item) => {
        const urgent = urgentReasons.has(item.reason);
        return <article key={item.id} className={`panel-solid overflow-hidden border ${urgent ? "border-hot/30" : "border-white/10"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><div className="flex flex-wrap items-center gap-2">{urgent && <span className="mono-label inline-flex items-center gap-1 rounded-full bg-hot px-2.5 py-1 text-black"><AlertTriangle className="size-3" /> Priority</span>}<span className="mono-label rounded-full bg-white/[0.07] px-2.5 py-1 text-white/55">{reasonLabels[item.reason]}</span><span className="mono-label text-white/25">{item.target.kind}</span></div><span className="flex items-center gap-1.5 text-xs font-bold text-white/30"><Clock3 className="size-3.5" /> {formatDateTime(item.createdAt)}</span></div>
          <div className="grid gap-5 p-5 md:grid-cols-[1fr_220px]"><div><p className="mono-label text-electric">Reported target</p><h2 className="mt-2 text-xl font-black leading-7">{item.target.title}</h2>{item.target.context && <p className="mt-3 max-w-2xl rounded-xl bg-black/25 p-3 text-sm leading-6 text-white/50">{item.target.context}</p>}{item.target.owner && <p className="mt-3 flex items-center gap-2 text-xs font-bold text-white/35"><UserRound className="size-3.5" /> {item.target.owner.displayName} · @{item.target.owner.handle}</p>}{item.target.state && <p className="mono-label mt-3 text-white/25">Current: {item.target.state}</p>}{item.target.moderationLabels?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{item.target.moderationLabels.map((label) => <span key={label} className="rounded-full bg-white/[0.05] px-2 py-1 font-mono text-[9px] text-white/35">{label}</span>)}</div> : null}</div><aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><p className="mono-label text-white/30">Reporter note</p><p className="mt-3 text-sm font-bold leading-6 text-white/60">{item.details ?? "No additional detail."}</p><p className="mt-3 text-xs text-white/25">{item.reporter ? `@${item.reporter.handle}` : "Anonymous report"}</p>{item.target.href && <Link href={item.target.href} target="_blank" rel="noreferrer" className="button-ghost mt-3 min-h-9 px-0">Inspect target <ArrowUpRight className="size-3.5" /></Link>}</aside></div>
           {(state === "open" || state === "triaged") && <div className="grid gap-2 border-t border-white/10 bg-black/15 p-4 sm:grid-cols-3"><button onClick={(event) => beginReview(item, "allow", event.currentTarget)} className="button-secondary"><Check className="size-4" /> Dismiss</button>{!(item.target.kind === "roast" && state === "triaged") && <button onClick={(event) => beginReview(item, "limit", event.currentTarget)} className="button-secondary"><EyeOff className="size-4" /> {targetActionLabels[item.target.kind].limit}</button>}{item.target.kind !== "roast" && <button onClick={(event) => beginReview(item, "remove", event.currentTarget)} className="button-danger"><Trash2 className="size-4" /> {targetActionLabels[item.target.kind].remove}</button>}</div>}
        </article>;
      })}</div>}
    </div>
    {reviewing && <div className="fixed inset-0 z-[110] grid place-items-end bg-black/80 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target && !saving) setReviewing(null); }}><section ref={reviewDialogRef} role="dialog" aria-modal="true" aria-labelledby="review-title" aria-describedby="review-target" className="w-full max-w-xl rounded-t-[28px] border border-white/10 bg-[#141416] p-6 sm:rounded-[28px]"><p className="mono-label text-hot">Audited action</p><h2 id="review-title" className="mt-2 text-2xl font-black">{reviewing.decision === "allow" ? "Dismiss this report?" : reviewing.decision === "remove" ? "Remove and record?" : "Limit and contain?"}</h2><p id="review-target" className="mt-2 text-sm leading-6 text-white/60">Target: {reviewing.item.target.title}</p><label className="mt-5 block"><span className="mono-label text-white/60">Policy reason</span><textarea data-review-focus value={reason} onChange={(event) => setReason(event.target.value.slice(0, 500))} rows={3} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-white outline-none focus:border-acid/50" /></label><label className="mt-4 block"><span className="mono-label text-white/60">Internal note · optional</span><textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value.slice(0, 2000))} rows={3} placeholder="Do not copy this into public replies." className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-white outline-none placeholder:text-white/55 focus:border-acid/50" /></label><div className="mt-5 grid gap-2 sm:grid-cols-2"><button onClick={() => setReviewing(null)} disabled={saving} className="button-secondary">Cancel</button><button onClick={() => void resolveReport()} disabled={saving || reason.trim().length < 3} className={reviewing.decision === "allow" ? "button-primary" : "button-danger"}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : reviewing.decision === "allow" ? <Check className="size-4" /> : <AlertTriangle className="size-4" />} Confirm action</button></div></section></div>}
  </div>;
}
