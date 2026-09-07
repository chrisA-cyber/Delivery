"use client";

import { Check, Clapperboard, Download, Film, LoaderCircle, RefreshCw, RotateCcw, Save, Share2, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/components/providers/app-provider";
import { defaultCameraSettings, defaultClipEditSettings, type ClipAvatar, type ClipEditSettings } from "@/lib/video-composition";
import { ClipEditorControls } from "./clip-editor-controls";
import { ClipPreview, type ClipEditorSource } from "./clip-preview";
import Link from "next/link";

export type VideoExportMode = "classic" | "switch" | "say-it-back";
export interface ExportVideo {
  id: string;
  status: "queued" | "rendering" | "ready" | "failed" | "expired" | "cancelled";
  includeScore: boolean;
  includeName: boolean;
  settings?: ClipEditSettings | null;
  displayName?: string | null;
  score?: ClipEditorSource["scene"]["score"];
  errorMessage?: string | null;
  filename?: string;
  expiresAt?: string | null;
  createdAt?: string;
  assignmentUrl?: string | null;
}
interface EditorData { source: ClipEditorSource; settings: ClipEditSettings; preferredAvatar: ClipAvatar }
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
/** Key order from JSON/database serialization must not create a different edit. */
export function clipSettingsKey(settings: ClipEditSettings): string {
  return JSON.stringify(Object.fromEntries(Object.entries(settings).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => [key, key === "avatar" ? Object.fromEntries(Object.entries(value as ClipAvatar).sort(([left], [right]) => left.localeCompare(right))) : value])));
}

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
  const { contentRating, reducedMotion: appReducedMotion } = useApp();
  const [opened, setOpened] = useState(initialOpen);
  const [sourceId, setSourceId] = useState(attemptId ?? null);
  const [editor, setEditor] = useState<EditorData | null>(null);
  const [settings, setSettings] = useState<ClipEditSettings>({ ...defaultClipEditSettings(mode), includeScore: hasScore });
  const [savedKey, setSavedKey] = useState("");
  const [exports, setExports] = useState<ExportVideo[]>([]);
  const [eligible, setEligible] = useState(true);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [preparingShare, setPreparingShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [nativeSharing, setNativeSharing] = useState(false);
  const [finishedPreview, setFinishedPreview] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const settingsTouched = useRef(false);
  const mounted = useRef(true);
  const creatingRef = useRef(false);
  const savingRef = useRef(false);
  const preparingRef = useRef<Promise<string> | null>(null);
  const sourceRef = useRef(attemptId ?? null);
  const dialog = useRef<HTMLDivElement>(null);
  const headingId = useId();

  useEffect(() => { mounted.current = true; setPortalReady(true); setNativeSharing(typeof navigator.share === "function" && typeof navigator.canShare === "function"); return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const next = attemptId ?? null;
    if (next && !sourceRef.current) { sourceRef.current = next; setSourceId(next); return; }
    if (next !== sourceRef.current) {
      sourceRef.current = next; setSourceId(next); setExports([]); setEditor(null); setError(""); setNotice(""); setEligible(true); setReason(""); setSavedKey(""); setFinishedPreview(false);
      settingsTouched.current = false; setSettings({ ...defaultClipEditSettings(mode), includeScore: hasScore });
    }
  }, [attemptId, hasScore, mode]);

  // Opening an unsaved performance saves its source once, without judging it.
  useEffect(() => {
    if (!opened || sourceId || !prepareAttempt || disabled) return;
    let active = true;
    setPreparing(true); setError("");
    if (!preparingRef.current) preparingRef.current = prepareAttempt();
    void preparingRef.current.then((id) => {
      if (!id) throw new Error("Your performance could not be saved. Reopen the editor to retry.");
      if (mounted.current) { sourceRef.current = id; setSourceId(id); }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Your take could not be saved. Reopen the editor to retry."); })
      .finally(() => { preparingRef.current = null; if (mounted.current) setPreparing(false); });
    return () => { active = false; };
  }, [opened, sourceId, prepareAttempt, disabled, refresh]);

  useEffect(() => {
    if (!opened || !portalReady) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("[data-editor-close]")?.focus());
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpened(false); }
      if (event.key !== "Tab") return;
      const nodes = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex="0"]') ?? [])].filter((node) => node.getClientRects().length > 0);
      if (!nodes.length) { event.preventDefault(); return; }
      const first = nodes[0]!, last = nodes[nodes.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", keyboard); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [opened, portalReady]);

  const currentKey = clipSettingsKey(settings);
  const selected = exports.find((item) => item.settings && clipSettingsKey(item.settings) === currentKey
    && (!settings.includeName || (item.displayName ?? null) === (editor?.source.scene.displayName ?? null))
    && (!settings.includeScore || (item.score?.value === editor?.source.scene.score?.value && item.score?.label === editor?.source.scene.score?.label && Boolean(item.score?.beta) === Boolean(editor?.source.scene.score?.beta))));
  const selectedId = selected?.id;
  const rendering = selected?.status === "queued" || selected?.status === "rendering";
  const ready = selected?.status === "ready";
  const videoPath = selected ? `/api/exports/${encodeURIComponent(selected.id)}/video` : "";
  const filename = selected?.filename ?? `delivery-${mode}-${selected?.id ?? "performance"}.mp4`;
  const savedPath = reopenPath ?? (sourceId ? mode === "classic" ? `/performances/classic/${encodeURIComponent(sourceId)}` : `/${mode === "switch" ? "switch" : "say-it-back"}?attempt=${encodeURIComponent(sourceId)}` : undefined);
  const busy = loading || preparing || creating || saving;
  const acceptExport = useCallback((next: ExportVideo) => { setExports((current) => [next, ...current.filter((item) => item.id !== next.id)]); }, []);
  const changeSettings = useCallback((patch: Partial<ClipEditSettings>) => { settingsTouched.current = true; setFinishedPreview(false); setNotice(""); const reduced = appReducedMotion || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches); setSettings((current) => ({ ...current, ...patch, ...(reduced ? { reducedMotion: true } : {}) })); }, [appReducedMotion]);

  useEffect(() => {
    if (!opened || !sourceId) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    const query = new URLSearchParams({ mode, attemptId: sourceId, maxRating: contentRating });
    void Promise.allSettled([
      exportRequest<{ exports: ExportVideo[]; eligible: boolean; reason?: string }>(`/api/exports?${query}`, undefined, controller.signal),
      exportRequest<EditorData>(`/api/exports/editor?${query}`, undefined, controller.signal),
    ]).then(([list, edit]) => {
      if (controller.signal.aborted) return;
      if (list.status === "fulfilled") {
        setExports((current) => [...list.value.exports, ...current.filter((item) => !list.value.exports.some((saved) => saved.id === item.id))]);
        setEligible(list.value.eligible !== false); setReason(list.value.reason ?? "");
      }
      if (edit.status === "fulfilled") {
        setEditor(edit.value);
        if (!settingsTouched.current) {
          const restored = { ...edit.value.settings, includeScore: Boolean(edit.value.source.scene.score) && edit.value.settings.includeScore, reducedMotion: edit.value.settings.reducedMotion || appReducedMotion || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) };
          setSettings(restored); setSavedKey(clipSettingsKey(edit.value.settings));
        }
      } else if (list.status !== "fulfilled" || list.value.eligible !== false) {
        setError(edit.reason instanceof Error ? edit.reason.message : "Your clip editor could not load. Try again.");
      }
      if (list.status === "rejected") setError(list.reason instanceof Error ? list.reason.message : "Couldn’t recover your videos. Try again.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [opened, sourceId, mode, contentRating, refresh, appReducedMotion]);

  useEffect(() => {
    if (!opened || !rendering || !selectedId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await exportRequest<{ export: ExportVideo }>(`/api/exports/${encodeURIComponent(selectedId)}?maxRating=${contentRating}`, undefined, controller.signal);
        if (controller.signal.aborted) return;
        acceptExport(data.export); setError("");
        if (data.export.status === "ready") setFinishedPreview(true);
        if (data.export.status !== "queued" && data.export.status !== "rendering") return;
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof ExportRequestError && [401, 403, 404].includes(cause.status)) { setEligible(false); setReason(cause.message); return; }
        setError(cause instanceof Error ? cause.message : "The connection dropped. Checking your video again shortly.");
      }
      timer = setTimeout(() => void poll(), document.visibilityState === "hidden" ? 12_000 : 4_000);
    };
    timer = setTimeout(() => void poll(), 3_000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [opened, rendering, selectedId, contentRating, acceptExport]);

  useEffect(() => {
    setShareFile(null); setPreviewError(false);
    if (!opened || !ready || !nativeSharing) { setPreparingShare(false); return; }
    const controller = new AbortController(); setPreparingShare(true);
    void fetch(videoPath, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Sharing is unavailable. You can still download this video.");
      const file = new File([await response.blob()], filename, { type: "video/mp4" });
      if (!controller.signal.aborted && navigator.canShare({ files: [file] })) setShareFile(file);
    }).catch(() => { if (!controller.signal.aborted) setNotice("Download the video if your device’s share menu is unavailable."); }).finally(() => { if (!controller.signal.aborted) setPreparingShare(false); });
    return () => controller.abort();
  }, [opened, ready, videoPath, filename, nativeSharing]);

  async function persist(): Promise<ClipEditSettings> {
    if (!sourceId || !editor) throw new Error("Wait for your recording to finish loading.");
    const data = await exportRequest<{ settings: ClipEditSettings }>("/api/exports/editor", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, attemptId: sourceId, settings, maxRating: contentRating }) });
    if (mounted.current) { setSettings(data.settings); setSavedKey(clipSettingsKey(data.settings)); }
    return data.settings;
  }
  async function save() {
    if (savingRef.current || creatingRef.current) return;
    savingRef.current = true; setSaving(true); setError("");
    try { await persist(); if (mounted.current) setNotice("Edits saved. Reopen this performance to keep editing."); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Your edits could not be saved. Try again."); }
    finally { savingRef.current = false; if (mounted.current) setSaving(false); }
  }
  async function create() {
    if (creatingRef.current || savingRef.current || disabled || !editor) return;
    creatingRef.current = true; setCreating(true); setError(""); setNotice(""); settingsTouched.current = true;
    try {
      const saved = await persist();
      const data = await exportRequest<{ export: ExportVideo }>("/api/exports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, attemptId: sourceId, includeScore: saved.includeScore, includeName: saved.includeName, settings: saved, maxRating: contentRating }) });
      if (mounted.current) { acceptExport(data.export); if (data.export.status === "ready") setFinishedPreview(true); }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Your video could not be created. Your take is safe; try again."); }
    finally { creatingRef.current = false; if (mounted.current) setCreating(false); }
  }
  async function share() {
    if (!shareFile || sharing) return;
    setSharing(true); setError(""); setNotice("");
    try { await navigator.share({ title: selected?.assignmentUrl ? "Your turn on Delivery" : "My Delivery performance", files: [shareFile] }); if (mounted.current) setNotice("Share menu closed. Your video is still available here."); }
    catch (cause) { if (mounted.current && !(cause instanceof Error && cause.name === "AbortError")) setNotice("The share menu could not open. Download the video, then share it from your device."); }
    finally { if (mounted.current) setSharing(false); }
  }

  return <section className={compact ? "mt-4" : "rounded-2xl border border-electric/25 bg-electric/[.045] p-5"} aria-label="Performance video">
    <div className="flex flex-wrap items-center justify-between gap-3">
      {!compact && <div><h2 className="text-lg font-bold">Make it a clip</h2><p className="mt-1 text-sm text-white/55">Your avatar. Your performance.</p></div>}
      <button type="button" className="button-secondary min-h-12" disabled={disabled} onClick={() => setOpened(true)}><Clapperboard className="size-4" />{exports.length ? "Edit clip" : "Create video"}</button>
    </div>
    {opened && portalReady && createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-0 backdrop-blur-sm sm:p-4" onPointerDown={(event) => { if (event.target === event.currentTarget) setOpened(false); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={headingId} className="flex h-[100dvh] max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden border border-white/15 bg-surface shadow-2xl sm:h-[min(90dvh,850px)] sm:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2 sm:px-5">
          <h2 id={headingId} className="flex items-center gap-2 text-base font-bold"><Film className="size-4 text-electric" />Edit your clip</h2>
          <div className="flex items-center gap-1"><button type="button" disabled={!editor || busy} className="button-ghost min-h-10 px-2 text-xs" onClick={() => { const defaults = editor?.source.camera?.length ? defaultCameraSettings(mode) : defaultClipEditSettings(mode); changeSettings({ ...defaults, avatar: editor?.preferredAvatar ?? defaults.avatar, includeScore: Boolean(editor?.source.scene.score) }); }}><RotateCcw className="size-3.5" />Reset</button><button data-editor-close type="button" className="icon-button border-transparent" aria-label="Close clip editor" onClick={() => setOpened(false)}><X className="size-4" /></button></div>
        </header>
        {!eligible ? <div className="flex flex-1 items-center p-6"><p className="text-sm leading-6 text-white/70">{reason || "This performance is unavailable for video export."}</p></div> : editor ? <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] sm:grid-rows-1">
          <div className="flex min-h-0 flex-col border-b border-white/10 bg-ink/65 p-3 sm:border-b-0 sm:border-r sm:p-5">
            {ready && <div className="mb-2 flex shrink-0 items-center justify-center gap-1"><button type="button" aria-pressed={!finishedPreview} className={`min-h-8 rounded-lg px-3 text-xs font-bold ${!finishedPreview ? "bg-white/10 text-white" : "text-white/50"}`} onClick={() => setFinishedPreview(false)}>Edit preview</button><button type="button" aria-pressed={finishedPreview} className={`min-h-8 rounded-lg px-3 text-xs font-bold ${finishedPreview ? "bg-electric/15 text-electric" : "text-white/50"}`} onClick={() => setFinishedPreview(true)}>Finished MP4</button></div>}
            {ready && finishedPreview ? <div className="flex min-h-0 flex-1 flex-col items-center gap-2"><video key={`${selected.id}:${previewRevision}`} className="min-h-0 w-full flex-1 object-contain" controls playsInline preload="metadata" src={`${videoPath}?v=${previewRevision}`} aria-label="Finished performance video" onError={() => setPreviewError(true)} />{previewError && <p role="alert" className="text-xs text-orange-200">Preview could not load. <button type="button" className="underline" onClick={() => { setPreviewError(false); setPreviewRevision((current) => current + 1); }}>Reload video</button> or download below.</p>}</div> : <ClipPreview source={editor.source} settings={settings} onChange={changeSettings} disabled={busy} />}
          </div>
          <ClipEditorControls hasCamera={Boolean(editor.source.camera?.length)} mode={mode} settings={settings} onChange={changeSettings} duration={editor.source.duration} hasScore={Boolean(editor.source.scene.score)} disabled={busy} />
        </div> : <div className="flex flex-1 items-center justify-center p-6"><p role="status" className="flex items-center gap-2 text-sm text-white/65">{loading || preparing ? <><LoaderCircle className="size-4 animate-spin" />{preparing ? "Saving your performance…" : "Loading your clip…"}</> : "Open a saved performance to edit its clip."}</p></div>}
        <footer className="max-h-[35dvh] shrink-0 overflow-y-auto border-t border-white/10 bg-surface px-4 py-3 sm:px-5">
          {rendering && <div role="status" className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-electric"><p className="flex items-center gap-2"><LoaderCircle className="size-3.5 animate-spin" />{selected.status === "queued" ? "Your video is queued." : "Creating your video…"}</p>{savedPath && <Link href={savedPath} className="inline-flex min-h-8 items-center text-white/65 underline underline-offset-4">Reopen this performance</Link>}</div>}
          {selected?.status === "failed" && <p role="alert" className="mb-2 text-xs leading-5 text-orange-200">{selected.errorMessage || "Video creation was interrupted. Retry with your saved take."}</p>}
          {(selected?.status === "expired" || selected?.status === "cancelled") && <p className="mb-2 text-xs text-white/65">This video expired. Recreate it from your saved performance.</p>}
          {error && <div role="alert" className="mb-2 flex flex-wrap items-center justify-between gap-x-3 text-xs leading-5 text-orange-200"><p>{error}</p><button type="button" className="inline-flex min-h-9 items-center gap-1 underline" onClick={() => setRefresh((current) => current + 1)}><RefreshCw className="size-3" />Check video status</button></div>}
          {notice && <p role="status" className="mb-2 text-xs leading-5 text-white/65">{notice}</p>}
          {eligible && <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" disabled={busy || !editor || savedKey === currentKey} className="button-secondary min-h-11 px-3 text-xs sm:px-4" onClick={() => void save()}>{saving ? <LoaderCircle className="size-3.5 animate-spin" /> : savedKey === currentKey ? <Check className="size-3.5" /> : <Save className="size-3.5" />}{saving ? "Saving…" : savedKey === currentKey ? "Edits saved" : "Save edits"}</button>
            <div className="flex flex-wrap gap-2">{ready ? <><a href={`${videoPath}?download=1`} download={filename} className="button-primary min-h-11 px-3 text-xs sm:px-4"><Download className="size-4" />Download video</a>{nativeSharing && (shareFile || preparingShare) ? <button type="button" className="button-secondary min-h-11 px-3 text-xs" disabled={!shareFile || sharing} onClick={() => void share()}>{preparingShare || sharing ? <LoaderCircle className="size-4 animate-spin" /> : <Share2 className="size-4" />}{preparingShare ? "Preparing…" : "Share video"}</button> : <a className="button-secondary min-h-11 px-3 text-xs" href={`${videoPath}?download=1`} download={filename} onClick={() => setNotice("Download the video, then share it from your files or photos.")}><Share2 className="size-4" /><span className="sr-only sm:not-sr-only">Save to share</span></a>}</> : <button type="button" className="button-primary min-h-11 px-4 text-xs" disabled={busy || disabled || !editor || rendering} onClick={() => void create()}>{creating || rendering ? <LoaderCircle className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}{creating ? "Preparing…" : rendering ? "Rendering…" : selected ? "Retry video" : "Generate video"}</button>}</div>
          </div>}
          {exports.some((item) => item.status === "ready" && item.id !== selectedId) && <details className="mt-2 text-xs text-white/60"><summary className="cursor-pointer py-1">Earlier clips</summary><div className="flex flex-wrap gap-x-4">{exports.filter((item) => item.status === "ready" && item.id !== selectedId).map((item, index) => <a key={item.id} className="inline-flex min-h-9 items-center gap-1 underline" href={`/api/exports/${encodeURIComponent(item.id)}/video?download=1`} download={item.filename}><Download className="size-3" />Clip {index + 1}{item.settings ? "" : " · original layout"}</a>)}</div></details>}
          {ready && <p className="mt-2 text-[10px] leading-4 text-white/45">Private MP4 · {selected.assignmentUrl ? "Its invitation opens the same challenge, without your recording." : "This download has no public challenge link."}</p>}
        </footer>
      </div>
    </div>, document.body)}
  </section>;
}
