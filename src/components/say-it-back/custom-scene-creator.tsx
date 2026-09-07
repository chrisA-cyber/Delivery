"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clapperboard, Clock3, FileVideo, Link2, LoaderCircle, Play, Plus, RotateCcw, Scissors, Search, Trash2, Upload, X } from "lucide-react";
import { ContentControl, CONTENT_LABELS } from "@/components/content/content-control";
import { isRatingAllowed } from "@/data/content";
import type { ContentRating } from "@/lib/content/types";
import type { SayImport, SayImportCue } from "@/lib/say-it-back/import-types";
import type { SayClip } from "@/lib/say-it-back/types";
import { matchesSceneSearch } from "@/lib/say-it-back/library";
import { cn } from "@/lib/utils";

const PENDING = new Set<SayImport["status"]>(["queued", "fetching", "processing", "publishing"]);
const STATUS_LABELS: Record<SayImport["status"], string> = {
  queued: "Waiting to open your video…", fetching: "Opening your video…", "source-ready": "Choose your excerpt",
  processing: "Finding the dialogue and timing…", ready: "Your lines are ready", publishing: "Finishing your scene…",
  published: "Ready to play", failed: "Needs another try",
};
const FIELD = "w-full rounded-lg border border-white/20 bg-ink px-3 py-2.5 text-sm text-paper placeholder:text-white/40 focus:border-hot";

async function importApi<T>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  if (signal?.aborted) cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(), 95_000);
  try {
    const response = await fetch(`/api/say-it-back/imports${path}`, { cache: "no-store", ...init, signal: controller.signal });
    const body = await response.json().catch(() => null) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
    if (!response.ok || !body?.ok || !body.data) throw new Error(body?.error?.message ?? "That request did not finish. Please try again.");
    return body.data;
  } catch (cause) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error("That request took too long. Your edits are still here; please try again.");
    throw cause;
  } finally { clearTimeout(timeout); signal?.removeEventListener("abort", cancel); }
}

function json(body: unknown): Pick<RequestInit, "headers" | "body"> {
  return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function seconds(value: number) { return `${Math.max(0, value).toFixed(1)}s`; }

export function CustomSceneCreator({ initialImport, initialRating, authenticated = false, onCreated, onClose }: {
  initialImport?: SayImport; initialRating: ContentRating; authenticated?: boolean; onCreated: (clip: SayClip) => void; onClose: () => void;
}) {
  const [sceneImport, setSceneImport] = useState<SayImport | null>(initialImport ?? null);
  const [sourceMode, setSourceMode] = useState<"link" | "upload">("link");
  const [url, setUrl] = useState(initialImport?.sourceUrl ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState((initialImport?.title ?? "").slice(0, 100));
  const [rating, setRating] = useState<ContentRating>(initialRating);
  const [start, setStart] = useState(initialImport?.start ?? 0);
  const [end, setEnd] = useState(Math.min(initialImport?.end || 45, (initialImport?.start ?? 0) + 45, initialImport?.sourceDuration ?? 45));
  const [cues, setCues] = useState<SayImportCue[]>(initialImport?.cues ?? []);
  const [busy, setBusy] = useState<"import" | "prepare" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [pollPaused, setPollPaused] = useState(false);
  const [changingExcerpt, setChangingExcerpt] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const previewEnd = useRef<number | null>(null);
  const requestId = useRef(initialImport?.requestId ?? "");
  const requestInFlight = useRef(false);
  const mounted = useRef(true);
  const draftLoaded = useRef(initialImport?.status === "ready" ? initialImport.id : null);
  const delivered = useRef(false);
  const pending = Boolean(sceneImport && PENDING.has(sceneImport.status));
  const locked = Boolean(busy) || pending;
  const hasSource = Boolean(sceneImport?.sourceVideoUrl && sceneImport.sourceDuration);
  const editingLines = !changingExcerpt && (sceneImport?.status === "ready" || (sceneImport?.status === "failed" && cues.length > 0));
  const duration = Math.max(0, end - start);
  const selectedCount = cues.filter((cue) => cue.selected).length;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const acceptImport = useCallback((next: SayImport) => {
    setSceneImport(next);
    if (next.status === "source-ready") {
      setTitle((current) => current || next.title.slice(0, 100));
      setStart(next.start || 0);
      setEnd(Math.min(next.end > next.start ? next.end : next.start + 45, next.start + 45, next.sourceDuration ?? 45));
    }
    if (next.status === "ready" && draftLoaded.current !== next.id) {
      draftLoaded.current = next.id;
      setCues(next.cues);
      setTitle((current) => current || next.title.slice(0, 100));
      setStart(next.start); setEnd(next.end);
    }
  }, []);

  useEffect(() => {
    if (!sceneImport || !PENDING.has(sceneImport.status) || pollPaused) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void importApi<{ import: SayImport }>(`/${encodeURIComponent(sceneImport.id)}`, undefined, controller.signal)
        .then((data) => { if (!controller.signal.aborted) acceptImport(data.import); })
        .catch((cause) => {
          if (controller.signal.aborted) return;
          setPollPaused(true); setError(cause instanceof Error ? cause.message : "Could not check progress. Your scene is still saved.");
        });
    }, 2000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [sceneImport, pollPaused, acceptImport]);

  useEffect(() => {
    if (sceneImport?.status === "published" && sceneImport.clip && !delivered.current) {
      delivered.current = true; onCreated(sceneImport.clip);
    }
  }, [sceneImport, onCreated]);

  async function importSource() {
    if (requestInFlight.current) return;
    setError("");
    if (sourceMode === "link" && !url.trim()) { setError("Paste a clip or Short link first."); return; }
    if (sourceMode === "upload" && !file) { setError("Choose a video first."); return; }
    if (file && sourceMode === "upload" && file.size > 80 * 1024 * 1024) { setError("Choose a video smaller than 80 MB."); return; }
    requestInFlight.current = true; setBusy("import");
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      let init: RequestInit;
      if (sourceMode === "upload" && file) {
        const form = new FormData(); form.set("file", file); form.set("requestId", requestId.current);
        init = { method: "POST", body: form };
      } else init = { method: "POST", ...json({ url: url.trim(), requestId: requestId.current }) };
      const data = await importApi<{ import: SayImport }>("", init);
      if (!mounted.current) return;
      draftLoaded.current = null; setCues([]); setPollPaused(false); acceptImport(data.import);
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not open that video."); }
    finally { requestInFlight.current = false; if (mounted.current) setBusy(null); }
  }

  async function prepare() {
    if (!sceneImport || requestInFlight.current) return;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || duration < 1 || duration > 45 || end > (sceneImport.sourceDuration ?? 0) + 0.01) {
      setError("Choose an excerpt between 1 and 45 seconds within your video."); return;
    }
    requestInFlight.current = true; setBusy("prepare"); setError(""); video.current?.pause();
    try {
      const data = await importApi<{ import: SayImport }>(`/${encodeURIComponent(sceneImport.id)}/prepare`, { method: "POST", ...json({ start, end }) });
      if (!mounted.current) return;
      draftLoaded.current = null; setPollPaused(false); setChangingExcerpt(false); acceptImport(data.import);
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not prepare this excerpt. Your selection is still here."); }
    finally { requestInFlight.current = false; if (mounted.current) setBusy(null); }
  }

  async function publish() {
    if (!sceneImport || requestInFlight.current) return;
    if (title.trim().length < 2) { setError("Give your scene a title of at least 2 characters."); return; }
    if (!selectedCount) { setError("Select at least one line to perform."); return; }
    const sorted = [...cues].sort((a, b) => a.start - b.start);
    if (sorted.some((cue) => !cue.text.trim() || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start || cue.end > duration + 0.01)) {
      setError("Each line needs text and a start and end inside your excerpt."); return;
    }
    if (sorted.some((cue, index) => index > 0 && cue.start < sorted[index - 1]!.end - 0.05)) {
      setError("Lines cannot overlap. Adjust their start and end times."); return;
    }
    requestInFlight.current = true; setBusy("publish"); setError(""); video.current?.pause();
    try {
      const data = await importApi<{ clip: SayClip }>(`/${encodeURIComponent(sceneImport.id)}/publish`, { method: "POST", ...json({ title: title.trim(), rating, cues: sorted }) });
      if (!mounted.current) return;
      delivered.current = true; onCreated(data.clip);
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not finish your scene. Your edits are still here."); }
    finally { requestInFlight.current = false; if (mounted.current) setBusy(null); }
  }

  async function preview(from: number, to: number) {
    if (!video.current) return;
    setError(""); previewEnd.current = to;
    video.current.currentTime = from;
    try { await video.current.play(); } catch { setError("The preview is still loading. Try playing it again."); }
  }

  function updateCue(id: string, updates: Partial<SayImportCue>) {
    setCues((current) => current.map((cue) => cue.id === id ? { ...cue, ...updates } : cue));
  }

  const step = editingLines || sceneImport?.status === "publishing" ? 2 : hasSource || sceneImport?.status === "processing" ? 1 : 0;
  return <section className="mx-auto max-w-5xl" aria-label="Make your own scene">
    <button type="button" className="button-ghost -ml-3 mb-5 px-3" onClick={onClose} disabled={Boolean(busy)}><ArrowLeft className="size-4" />All scenes</button>
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div><p className="mono-label mb-3 text-hot">Say It Back</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Make your own scene</h1><p className="mt-3 text-sm text-white/65">Bring a clip. Pick your lines. Make it yours.</p></div>
      <ol className="flex gap-4 text-xs text-white/50" aria-label="Scene creation steps">{["Video", "Excerpt", "Lines"].map((label, index) => <li key={label} className={cn("flex items-center gap-2", step === index && "text-paper")} aria-current={step === index ? "step" : undefined}><span className={cn("grid size-7 place-items-center rounded-full border border-white/20", index <= step && "border-hot/50 bg-hot/15 text-hot")}>{index < step ? <Check className="size-3.5" /> : index + 1}</span>{label}</li>)}</ol>
    </div>

    {error && <div className="game-error mb-5" role="alert">{error}{pollPaused && <button type="button" className="ml-3 underline" onClick={() => { setError(""); setPollPaused(false); }}>Check again</button>}</div>}
    {sceneImport?.error && <p className="mb-5 rounded-xl border border-hot/30 bg-hot/10 p-4 text-sm leading-6" role={sceneImport.status === "failed" ? "alert" : "status"}>{sceneImport.error}{sceneImport.status === "ready" && " You can write or correct the lines below."}</p>}
    {(pending || busy) && <div className="mb-6 flex items-center gap-3 rounded-xl border border-electric/30 bg-electric/10 p-4" role="status" aria-live="polite"><LoaderCircle className="size-5 shrink-0 animate-spin text-electric" /><div><p className="text-sm font-bold">{busy === "import" ? sourceMode === "upload" ? "Uploading your video…" : "Opening your link…" : busy === "publish" ? "Finishing your scene…" : busy === "prepare" ? "Preparing your excerpt…" : STATUS_LABELS[sceneImport!.status]}</p>{!busy && <p className="mt-1 text-xs text-white/65">You can leave this screen and return through My scenes.</p>}</div></div>}

    {!hasSource && !pending && <div className="panel p-5 sm:p-7">
      <div className="segmented-control mb-5 inline-flex" role="group" aria-label="Video source"><button type="button" aria-pressed={sourceMode === "link"} onClick={() => { setSourceMode("link"); setError(""); requestId.current = ""; }} disabled={locked}><Link2 className="mr-2 inline size-4" />Paste a link</button><button type="button" aria-pressed={sourceMode === "upload"} onClick={() => { setSourceMode("upload"); setError(""); requestId.current = ""; }} disabled={locked}><Upload className="mr-2 inline size-4" />Upload video</button></div>
      <form onSubmit={(event) => { event.preventDefault(); void importSource(); }}>
        {sourceMode === "link" ? <label className="block text-sm font-bold">Twitch clip, YouTube Short, Instagram Reel, or TikTok<input className={`${FIELD} mt-2`} type="url" value={url} onChange={(event) => { setUrl(event.target.value); requestId.current = ""; }} placeholder="Paste the video link" disabled={locked} required /><span className="mt-2 block text-xs font-normal leading-5 text-white/55">Use a public video up to 3 minutes. You’ll choose up to 45 seconds.</span></label> : <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-white/25 bg-ink/40 p-8 text-center"><FileVideo className="size-8 text-electric" /><span className="text-sm font-bold">{file?.name ?? "Choose a video"}</span><span className="text-xs text-white/55">Up to 80 MB and 3 minutes. Choose your excerpt next.</span><input className="mt-1 block max-w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-paper file:px-4 file:py-2 file:font-bold file:text-ink" type="file" accept="video/*,.mp4,.mov,.webm,.m4v" onChange={(event) => { setFile(event.target.files?.[0] ?? null); requestId.current = ""; }} disabled={locked} required /></label>}
        <button type="submit" className="button-primary mt-5" disabled={locked}><Clapperboard className="size-4" />Open video<ArrowRight className="size-4" /></button>
      </form>
      <p className="mt-5 text-xs leading-5 text-white/50">Use footage you own or have permission to remix. If a link cannot be opened, upload the video instead.</p>
      {!authenticated && <p className="mt-3 text-xs leading-5 text-white/60">Guest imports and scenes expire after 24 hours. Sign in before then to keep your created scenes.</p>}
    </div>}

    {hasSource && <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-black"><video ref={video} src={sceneImport!.sourceVideoUrl!} className="aspect-video max-h-[420px] w-full object-contain" controls playsInline preload="metadata" onTimeUpdate={(event) => { if (previewEnd.current != null && event.currentTarget.currentTime >= previewEnd.current) { event.currentTarget.pause(); previewEnd.current = null; } }} onError={() => setError("This browser cannot preview the source video. You can still select your excerpt below, or try an MP4 upload.")} /></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60"><span className="flex items-center gap-1.5"><Clock3 className="size-3.5" />{seconds(start)} – {seconds(end)}</span><button type="button" className="button-ghost px-3 py-2 text-xs" onClick={() => void preview(start, end)} disabled={locked}><Play className="size-3.5" />Play excerpt</button></div>
        {editingLines && <p className="mt-2 text-xs leading-5 text-white/50">Line times start at the beginning of your excerpt.</p>}
      </div>

      <div className="panel p-5 sm:p-6">
        {!editingLines ? <>
          <h2 className="text-xl font-bold">Pick the moment</h2><p className="mt-2 text-sm leading-6 text-white/65">Keep a full exchange or just your favorite line. Up to 45 seconds.</p>
          <div className="mt-5 grid grid-cols-2 gap-4"><label className="text-xs font-bold text-white/70">Start (seconds)<input className={`${FIELD} mt-2`} type="number" min="0" max={sceneImport!.sourceDuration ?? undefined} step="0.1" value={start} disabled={locked} onChange={(event) => { const next = Number(event.target.value); setStart(next); setEnd(Math.min(next + Math.min(duration || 45, 45), sceneImport!.sourceDuration ?? next + 45)); }} /></label><label className="text-xs font-bold text-white/70">End (seconds)<input className={`${FIELD} mt-2`} type="number" min={start + 0.1} max={Math.min(start + 45, sceneImport!.sourceDuration ?? start + 45)} step="0.1" value={end} disabled={locked} onChange={(event) => setEnd(Number(event.target.value))} /></label></div>
          <label className="mt-5 block text-xs font-bold text-white/70">Move excerpt<input className="mt-3 w-full" type="range" min="0" max={Math.max(0, (sceneImport!.sourceDuration ?? 0) - Math.min(duration, 45))} step="0.1" value={start} disabled={locked} onChange={(event) => { const next = Number(event.target.value); setStart(next); setEnd(Math.min(sceneImport!.sourceDuration ?? next + duration, next + duration)); }} /></label>
          <p className={cn("mt-4 text-sm", duration > 45 || duration < 1 ? "text-hot" : "text-white/65")}>{seconds(duration)} selected</p>
          <button type="button" className="button-primary mt-5 w-full" disabled={locked || duration < 1 || duration > 45} onClick={() => void prepare()}><Scissors className="size-4" />Prepare lines<ArrowRight className="size-4" /></button>
          {changingExcerpt && <button type="button" className="button-ghost mt-3 w-full" disabled={locked} onClick={() => { setStart(sceneImport!.start); setEnd(sceneImport!.end); setChangingExcerpt(false); }}>Keep current lines</button>}
        </> : <>
          <button type="button" className="button-ghost -ml-3 mb-4 px-3 text-xs" disabled={locked} onClick={() => { video.current?.pause(); setChangingExcerpt(true); }}><Scissors className="size-3.5" />Change excerpt</button>
          <label className="block text-sm font-bold">Scene title<input className={`${FIELD} mt-2`} value={title} maxLength={100} disabled={locked} onChange={(event) => setTitle(event.target.value)} placeholder="Name this moment" /></label>
          <div className="mt-5"><ContentControl compact value={rating} onChange={setRating} disabled={locked} /></div>
          <div className="mb-4 mt-6 flex items-end justify-between gap-3"><div><h2 className="text-lg font-bold">Which lines are yours?</h2><p className="mt-1 text-xs leading-5 text-white/60">Check the lines to perform. Correct any missed words.</p></div><span className="shrink-0 text-xs text-hot">{selectedCount} selected</span></div>
          <div className="space-y-3">{cues.map((cue, index) => <div className={cn("rounded-xl border p-3", cue.selected ? "border-hot/35 bg-hot/5" : "border-white/15")} key={cue.id}>
            <div className="mb-2 flex items-center justify-between gap-2"><label className="flex cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={cue.selected} disabled={locked} onChange={(event) => updateCue(cue.id, { selected: event.target.checked })} className="size-4" />Perform line {index + 1}</label><div className="flex gap-1"><button type="button" aria-label={`Listen to line ${index + 1}`} className="icon-button size-9" disabled={locked} onClick={() => void preview(start + cue.start, start + cue.end)}><Play className="size-3.5" /></button><button type="button" aria-label={`Remove line ${index + 1}`} className="icon-button size-9" disabled={locked} onClick={() => setCues((current) => current.filter((item) => item.id !== cue.id))}><Trash2 className="size-3.5" /></button></div></div>
            <textarea className={`${FIELD} min-h-20 resize-y`} aria-label={`Line ${index + 1} dialogue`} value={cue.text} disabled={locked} maxLength={500} onChange={(event) => updateCue(cue.id, { text: event.target.value })} />
            <div className="mt-2 grid grid-cols-2 gap-3"><label className="text-[10px] font-bold text-white/55">Start (seconds)<input className={`${FIELD} mt-1 py-2`} aria-label={`Line ${index + 1} start`} type="number" min="0" max={duration} step="0.1" value={cue.start} disabled={locked} onChange={(event) => updateCue(cue.id, { start: Number(event.target.value) })} /></label><label className="text-[10px] font-bold text-white/55">End (seconds)<input className={`${FIELD} mt-1 py-2`} aria-label={`Line ${index + 1} end`} type="number" min="0" max={duration} step="0.1" value={cue.end} disabled={locked} onChange={(event) => updateCue(cue.id, { end: Number(event.target.value) })} /></label></div>
          </div>)}</div>
          {!cues.length && <p className="rounded-xl border border-white/15 p-4 text-sm leading-6 text-white/65">No lines found. Add the dialogue and its start and end times.</p>}
          <button type="button" className="button-ghost mt-3" disabled={locked || cues.length >= 40} onClick={() => { const from = Math.min(Math.max(0, ...cues.map((cue) => cue.end)), Math.max(0, duration - 1)); setCues((current) => [...current, { id: crypto.randomUUID(), text: "", start: from, end: Math.min(duration, from + 3), selected: true }]); }}><Plus className="size-4" />Add a line</button>
          <button type="button" className="button-primary mt-5 w-full" disabled={locked || !selectedCount || title.trim().length < 2} onClick={() => void publish()}><Clapperboard className="size-4" />Create scene & record<ArrowRight className="size-4" /></button>
          <p className="mt-3 text-xs leading-5 text-white/50">{authenticated ? "Your scene stays in My scenes. You choose when to share a performance." : "Guest imports and scenes expire after 24 hours. Sign in before then to keep your created scenes."}</p>
        </>}
      </div>
    </div>}
  </section>;
}

export type MySceneFilters = { search: string; status: "all" | "published" | "progress" | "attention" };

export function CustomSceneLibrary({ rating, authenticated, filters, onFiltersChange, onCreate, onResume, onPlay }: {
  rating: ContentRating; authenticated: boolean; onCreate: () => void; onResume: (item: SayImport) => void; onPlay: (clip: SayClip) => void;
  filters: MySceneFilters; onFiltersChange: (value: MySceneFilters) => void;
}) {
  const [imports, setImports] = useState<SayImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const mounted = useRef(true);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await importApi<{ imports: SayImport[] }>(""); if (mounted.current) setImports(data.imports); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Your scenes could not load."); }
    finally { if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load]);

  async function remove(id: string) {
    setDeleting(id); setError("");
    try { await importApi<Record<string, unknown>>(`/${encodeURIComponent(id)}`, { method: "DELETE" }); if (mounted.current) { setImports((items) => items.filter((item) => item.id !== id)); setConfirmDelete(null); } }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "That scene could not be removed."); }
    finally { if (mounted.current) setDeleting(null); }
  }

  const allowed = imports.filter((item) => !item.clip || isRatingAllowed(item.clip.rating, rating));
  const activeFilters = Boolean(filters.search.trim() || filters.status !== "all");
  const visible = allowed.filter((item) => {
    if (filters.status === "published" && item.status !== "published") return false;
    if (filters.status === "attention" && item.status !== "failed") return false;
    if (filters.status === "progress" && (item.status === "published" || item.status === "failed")) return false;
    return matchesSceneSearch(filters.search, item.title, item.sourceUrl ?? "", ...item.cues.map((cue) => cue.text),
      item.clip?.title ?? "", item.clip?.description ?? "", item.clip?.source.creator ?? "", ...(item.clip?.cues.map((cue) => cue.text) ?? []));
  });
  return <section aria-label="My scenes">
    <div className="mb-3 flex gap-2 sm:gap-3">
      <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-white/45" /><input type="search" aria-label="Search my scenes" placeholder="Search your scenes or dialogue" value={filters.search} onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })} className={`${FIELD} min-h-11 pl-10 pr-10`} />{filters.search && <button type="button" aria-label="Clear my scene search" onClick={() => onFiltersChange({ ...filters, search: "" })} className="absolute right-0 top-0 grid size-11 place-items-center text-white/60"><X className="size-4" /></button>}</div>
      <select aria-label="My scene status" value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value as MySceneFilters["status"] })} className="min-h-11 w-36 min-w-0 rounded-lg border border-white/20 bg-surface px-3 text-xs font-bold text-paper sm:w-44"><option value="all">Any status</option><option value="published">Ready to play</option><option value="progress">In progress</option><option value="attention">Needs attention</option></select>
    </div>
    <div className="mb-4 flex min-h-8 items-center justify-between gap-3">{activeFilters && <button type="button" className="button-ghost min-h-11 px-2 text-xs" onClick={() => onFiltersChange({ search: "", status: "all" })}><X className="size-3.5" />Clear filters</button>}<p role="status" aria-live="polite" className="ml-auto text-xs text-white/50">{loading ? "Loading scenes…" : `${visible.length} ${visible.length === 1 ? "scene" : "scenes"}`}</p></div>
    <p className="mb-5 text-xs leading-5 text-white/60">{authenticated ? "Your created scenes stay here. Unfinished imports expire after 7 days." : "Your imports and scenes on this browser expire after 24 hours. Sign in before then to keep your created scenes."}</p>
    {error && <div className="game-error mb-5" role="alert">{error}<button type="button" onClick={() => void load()} className="ml-3 underline">Try again</button></div>}
    {loading && !imports.length ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-white/60"><LoaderCircle className="size-4 animate-spin" />Opening your scenes…</div> : error && !imports.length ? null : !visible.length ? <div className="panel flex flex-col items-center p-8 text-center"><Clapperboard className="mb-4 size-8 text-hot" /><h3 className="text-xl font-bold">{allowed.length && activeFilters ? "No scenes match your filters" : imports.length ? "No scenes match this content setting" : "Your next scene can be anything"}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-white/60">{allowed.length && activeFilters ? "Try a different search or status to find your scene." : imports.length ? "Change your content setting to see more." : "Bring a clip or upload a video, then choose the lines you want to perform."}</p>{allowed.length && activeFilters ? <button type="button" className="button-secondary mt-5" onClick={() => onFiltersChange({ search: "", status: "all" })}>Show all my scenes</button> : <button type="button" className="button-primary mt-5" onClick={onCreate}><Plus className="size-4" />Make your own</button>}</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((item) => <article className="overflow-hidden rounded-2xl border border-white/15 bg-surface" key={item.id}>
      {item.clip && <div className="aspect-video bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.clip.posterUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
      </div>}
      <div className="p-5"><p className="mono-label mb-2 flex items-center gap-2 text-hot">{PENDING.has(item.status) && <LoaderCircle className="size-3 animate-spin" />}{STATUS_LABELS[item.status]}</p><h3 className="break-words text-lg font-bold">{item.clip?.title || item.title || "Untitled scene"}</h3>{item.clip && <p className="mt-2 text-xs text-white/55">{seconds(item.clip.duration)} · {CONTENT_LABELS[item.clip.rating]}</p>}
        {confirmDelete === item.id ? <div className="mt-4 rounded-lg border border-hot/30 p-3"><p className="text-xs leading-5">Remove this import and scene from My scenes?</p><div className="mt-3 flex gap-3"><button type="button" className="button-secondary px-3 py-2 text-xs" onClick={() => void remove(item.id)} disabled={Boolean(deleting)}>{deleting === item.id ? "Removing…" : "Remove"}</button><button type="button" className="button-ghost px-3 py-2 text-xs" onClick={() => setConfirmDelete(null)} disabled={Boolean(deleting)}>Keep it</button></div></div> : <div className="mt-4 flex items-center gap-2"><button type="button" className="button-secondary flex-1" onClick={() => item.status === "published" && item.clip ? onPlay(item.clip) : onResume(item)}>{item.status === "published" ? <Play className="size-4" /> : <RotateCcw className="size-4" />}{item.status === "published" ? "Record scene" : PENDING.has(item.status) ? "View progress" : "Continue"}</button><button type="button" className="icon-button size-11" aria-label={`Remove ${item.title || "untitled scene"}`} onClick={() => setConfirmDelete(item.id)}><Trash2 className="size-4" /></button></div>}
      </div>
    </article>)}</div>}
  </section>;
}
