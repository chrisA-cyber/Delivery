"use client";

import { Check, Clapperboard, Download, Film, LoaderCircle, LockKeyhole, RefreshCw, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import Link from "next/link";

export type VideoExportMode = "classic" | "switch" | "say-it-back";
export interface ExportVideo {
  id: string;
  status: "queued" | "rendering" | "ready" | "failed" | "expired" | "cancelled";
  includeScore: boolean;
  includeName: boolean;
  errorMessage?: string | null;
  filename?: string;
  expiresAt?: string | null;
  createdAt?: string;
  assignmentUrl?: string | null;
}

class ExportRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function exportRequest<T>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 25_000);
  try {
    const response = await fetch(path, { cache: "no-store", ...init, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.data) throw new ExportRequestError(body?.error?.message ?? "Video creation is unavailable right now. Your recording is safe; try again.", response.status);
    return body.data as T;
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError" && !signal?.aborted) throw new Error("That request took too long. Check video status to recover your export.");
    throw cause;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
}

/** One owned saved take, one video layout. The server owns eligibility and idempotency. */
export function VideoExport({ mode, attemptId, prepareAttempt, hasScore = false, disabled = false, compact = false, reopenPath, initialOpen = false }: {
  mode: VideoExportMode;
  attemptId?: string | null;
  prepareAttempt?: () => Promise<string>;
  hasScore?: boolean;
  disabled?: boolean;
  compact?: boolean;
  reopenPath?: string;
  initialOpen?: boolean;
}) {
  const { contentRating } = useApp();
  const [opened, setOpened] = useState(initialOpen);
  const [sourceId, setSourceId] = useState(attemptId ?? null);
  const [includeScore, setIncludeScore] = useState(hasScore);
  const [includeName, setIncludeName] = useState(false);
  const [exports, setExports] = useState<ExportVideo[]>([]);
  const [eligible, setEligible] = useState(true);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [preparingShare, setPreparingShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [nativeSharing, setNativeSharing] = useState(false);
  const settingsTouched = useRef(false);
  const mounted = useRef(true);
  const creatingRef = useRef(false);
  const sourceRef = useRef(attemptId ?? null);

  useEffect(() => { mounted.current = true; setNativeSharing(typeof navigator.share === "function" && typeof navigator.canShare === "function"); return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const next = attemptId ?? null;
    // Saving a local take supplies its first ID while Create video is in flight.
    if (next && !sourceRef.current) { sourceRef.current = next; setSourceId(next); return; }
    if (next !== sourceRef.current) {
      sourceRef.current = next; setSourceId(next); setExports([]); setError(""); setNotice(""); setEligible(true); setReason("");
      settingsTouched.current = false; setIncludeScore(hasScore); setIncludeName(false);
    }
  }, [attemptId, hasScore]);

  const scoreChoice = hasScore && includeScore;
  const selected = exports.find((item) => item.includeScore === scoreChoice && item.includeName === includeName);
  const selectedId = selected?.id;
  const rendering = selected?.status === "queued" || selected?.status === "rendering";
  const ready = selected?.status === "ready";
  const videoPath = selected ? `/api/exports/${encodeURIComponent(selected.id)}/video` : "";
  const filename = selected?.filename ?? `delivery-${mode}-${selected?.id ?? "performance"}.mp4`;
  const savedPath = reopenPath ?? (sourceId ? mode === "classic" ? `/performances/classic/${encodeURIComponent(sourceId)}` : `/${mode === "switch" ? "switch" : "say-it-back"}?attempt=${encodeURIComponent(sourceId)}` : undefined);

  const acceptExport = useCallback((next: ExportVideo) => {
    setExports((current) => [next, ...current.filter((item) => item.id !== next.id)]);
  }, []);

  useEffect(() => {
    if (!opened || !sourceId) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    const query = new URLSearchParams({ mode, attemptId: sourceId, maxRating: contentRating });
    void exportRequest<{ exports: ExportVideo[]; eligible: boolean; reason?: string }>(`/api/exports?${query}`, undefined, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setExports((current) => [...(data.exports ?? []), ...current.filter((item) => !(data.exports ?? []).some((saved) => saved.id === item.id))]); setEligible(data.eligible !== false); setReason(data.reason ?? "");
        const previous = data.exports?.[0];
        if (previous && !settingsTouched.current) { setIncludeScore(hasScore && previous.includeScore); setIncludeName(previous.includeName); }
      }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Couldn’t recover your videos. Try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [opened, sourceId, mode, contentRating, refresh, hasScore]);

  useEffect(() => {
    if (!opened || !rendering || !selectedId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await exportRequest<{ export: ExportVideo }>(`/api/exports/${encodeURIComponent(selectedId)}?maxRating=${contentRating}`, undefined, controller.signal);
        if (controller.signal.aborted) return;
        acceptExport(data.export); setError("");
        if (data.export.status !== "queued" && data.export.status !== "rendering") return;
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof ExportRequestError && [401, 403, 404].includes(cause.status)) {
          setEligible(false); setReason(cause.message);
          setExports((current) => current.map((item) => item.id === selectedId ? { ...item, status: "cancelled" } : item));
          return;
        }
        setError(cause instanceof Error ? cause.message : "The connection dropped. Checking your video again shortly.");
      }
      timer = setTimeout(() => void poll(), document.visibilityState === "hidden" ? 12_000 : 4_000);
    };
    timer = setTimeout(() => void poll(), 3_000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [opened, rendering, selectedId, contentRating, acceptExport]); // Status updates keep one polling loop.

  useEffect(() => {
    setShareFile(null); setPreviewError(false);
    if (!opened || !ready || !nativeSharing) { setPreparingShare(false); return; }
    const controller = new AbortController();
    setPreparingShare(true);
    // Fetch before the tap so mobile share() retains its required user gesture.
    void fetch(videoPath, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("This video couldn’t be prepared for sharing. You can still download it.");
        const file = new File([await response.blob()], filename, { type: "video/mp4" });
        if (controller.signal.aborted) return;
        if (navigator.canShare({ files: [file] })) setShareFile(file);
        else setNotice("This browser cannot share video files directly. Download the video, then share it from your files or photos.");
      }).catch(() => { if (!controller.signal.aborted) setNotice("Use Download video if your device’s share menu is unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setPreparingShare(false); });
    return () => controller.abort();
  }, [opened, ready, videoPath, filename, nativeSharing]);

  async function create() {
    if (creatingRef.current || disabled) return;
    creatingRef.current = true; setCreating(true); setError(""); setNotice(""); settingsTouched.current = true;
    try {
      const id = sourceId ?? await prepareAttempt?.();
      if (!id) throw new Error("Save this performance before creating its video.");
      if (!mounted.current) return;
      sourceRef.current = id; setSourceId(id);
      const data = await exportRequest<{ export: ExportVideo }>("/api/exports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, attemptId: id, includeScore: scoreChoice, includeName, maxRating: contentRating }),
      });
      if (mounted.current) acceptExport(data.export);
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Your video could not be created. Your take is safe; try again."); }
    finally { creatingRef.current = false; if (mounted.current) setCreating(false); }
  }

  async function share() {
    if (!shareFile || sharing) return;
    setSharing(true); setError(""); setNotice("");
    try {
      await navigator.share({ title: selected?.assignmentUrl ? "Your turn on Delivery" : "My Delivery performance", files: [shareFile] });
      if (mounted.current) setNotice("Share menu closed. Your video is still available here.");
    } catch (cause) {
      if (mounted.current && !(cause instanceof Error && cause.name === "AbortError")) setNotice("The share menu could not open. Download the video, then share it from your device.");
    } finally { if (mounted.current) setSharing(false); }
  }

  return <section className={compact ? "mt-4" : "rounded-2xl border border-electric/25 bg-electric/[.045] p-5 sm:p-6"} aria-label="Performance video">
    {!opened ? <div className="flex flex-wrap items-center justify-between gap-4">
      {!compact && <div className="min-w-0"><p className="mono-label text-electric">Keep the performance</p><h2 className="mt-2 text-xl font-bold">Made for a second watch.</h2><p className="mt-2 max-w-md text-sm leading-6 text-white/60">Your voice in a finished vertical video, ready to download or share.</p></div>}
      <button type="button" className="button-secondary min-h-12" disabled={disabled} onClick={() => setOpened(true)}><Clapperboard className="size-4" />Create video</button>
    </div> : <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-bold"><Film className="size-5 text-electric" />Your performance video</h2><button className="button-ghost min-h-11 px-3 text-xs" type="button" onClick={() => setOpened(false)}>Close</button></div>
      {!eligible ? <p className="rounded-xl border border-white/15 p-4 text-sm leading-6 text-white/70">{reason || "This performance is not available for video export. Your replay is still available."}</p> : <>
        <fieldset disabled={creating || loading} className="flex flex-wrap gap-x-5 gap-y-2 border-y border-white/10 py-3"><legend className="sr-only">Include in your video</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm"><input type="checkbox" checked={scoreChoice} disabled={!hasScore} onChange={(event) => { settingsTouched.current = true; setIncludeScore(event.target.checked); }} className="size-4 accent-electric" /><span className={!hasScore ? "text-white/40" : "text-white/80"}>{mode === "switch" ? "Beta score" : "Score"}{!hasScore && <span className="text-xs"> · unscored take</span>}</span></label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-white/80"><input type="checkbox" checked={includeName} onChange={(event) => { settingsTouched.current = true; setIncludeName(event.target.checked); }} className="size-4 accent-electric" />Display name / avatar</label>
        </fieldset>
        {loading && <p role="status" className="flex items-center gap-2 text-sm text-white/60"><LoaderCircle className="size-4 animate-spin" />Checking your videos…</p>}
        {rendering && <div role="status" className="rounded-xl bg-electric/10 p-4"><p className="flex items-center gap-2 text-sm font-bold text-electric"><LoaderCircle className="size-4 animate-spin" />{selected.status === "queued" ? "Your video is queued." : "Creating your video…"}</p><p className="mt-2 text-xs leading-6 text-white/65">You can keep playing. Return to this saved performance to find your finished video.</p>{savedPath && <Link href={savedPath} className="mt-2 inline-flex min-h-11 items-center text-xs font-bold underline underline-offset-4">Reopen this performance</Link>}</div>}
        {ready && <>
          <div className="overflow-hidden rounded-xl border border-white/15 bg-black"><video key={`${selected.id}:${previewRevision}`} className="mx-auto max-h-[32rem] w-full object-contain" controls playsInline preload="metadata" src={`${videoPath}?v=${previewRevision}`} aria-label="Finished performance video" onError={() => setPreviewError(true)} /></div>
          {previewError && <p role="alert" className="text-sm leading-6 text-orange-200">The preview could not load. <button type="button" className="underline underline-offset-4" onClick={() => { setPreviewError(false); setPreviewRevision((current) => current + 1); setRefresh((current) => current + 1); }}>Reload video</button> or try the download below.</p>}
          <div className="flex flex-wrap items-center gap-3"><span className="flex items-center gap-1.5 text-xs text-electric"><Check className="size-4" />Ready · MP4</span><span className="text-xs text-white/50">{selected.includeScore ? mode === "switch" ? "Beta score included" : "Score included" : "No score"} · {selected.includeName ? "Name included when available" : "No name"}</span></div>
          <div className="flex flex-wrap gap-2"><a href={`${videoPath}?download=1`} download={filename} className="button-primary min-h-12"><Download className="size-4" />Download video</a>{nativeSharing && (shareFile || preparingShare) ? <button type="button" className="button-secondary min-h-12" disabled={!shareFile || sharing} onClick={() => void share()}>{preparingShare || sharing ? <LoaderCircle className="size-4 animate-spin" /> : <Share2 className="size-4" />}{preparingShare ? "Preparing sharing…" : "Share video"}</button> : <a className="button-secondary min-h-12" href={`${videoPath}?download=1`} download={filename} onClick={() => setNotice("Download the video, then share it from your files or photos. Direct video sharing is unavailable in this browser.")}><Share2 className="size-4" />Save to share</a>}</div>
        </>}
        {selected?.status === "failed" && <p role="alert" className="text-sm leading-6 text-orange-200">{selected.errorMessage || "Video creation didn’t finish. Retry to recover this export. Your original take and score are safe."}</p>}
        {(selected?.status === "expired" || selected?.status === "cancelled") && <p className="text-sm leading-6 text-white/65">This video is no longer available. You can recreate it while your saved performance is available.</p>}
        {!ready && !rendering && <button type="button" className="button-primary min-h-12" disabled={creating || loading || disabled} onClick={() => void create()}>{creating ? <LoaderCircle className="size-4 animate-spin" /> : selected ? <RefreshCw className="size-4" /> : <Clapperboard className="size-4" />}{creating ? "Preparing your video…" : selected ? "Retry video" : "Generate video"}</button>}
        <p className="flex items-start gap-2 text-xs leading-6 text-white/50"><LockKeyhole className="mt-1 size-3.5 shrink-0" /><span>Your video stays private here. {selected ? selected.assignmentUrl ? "Its invitation opens the same challenge, without your recording." : "This download has no public challenge link." : "Public challenge links are included when available."} Downloaded or externally shared copies cannot be recalled.</span></p>
      </>}
      {error && <div role="alert" className="rounded-xl border border-hot/25 bg-hot/5 p-4 text-sm leading-6 text-orange-200"><p>{error}</p><button type="button" className="button-ghost mt-2 min-h-11 px-0 text-xs" onClick={() => setRefresh((current) => current + 1)}><RefreshCw className="size-3.5" />Check video status</button></div>}
      {notice && <p role="status" className="text-xs leading-6 text-white/65">{notice}</p>}
    </div>}
  </section>;
}
