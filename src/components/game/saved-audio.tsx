"use client";

import React, { useEffect, useRef, useState } from "react";

/** Signed links expire independently of a saved result. Recovery rechecks access. */
export function SavedAudio({ url, label, refreshPath, reloadOnRetry = false, autoPlay = false, className = "w-full" }: {
  url: string;
  label: string;
  refreshPath?: string;
  reloadOnRetry?: boolean;
  autoPlay?: boolean;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const retryingRef = useRef(false);
  const [source, setSource] = useState(url);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    // Restore the source when development StrictMode replays effect setup.
    if (audio) audio.setAttribute("src", url);
    return () => { if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); } };
  }, [url]);

  async function retry() {
    if (retryingRef.current) return;
    if (reloadOnRetry) { window.location.reload(); return; }
    if (!refreshPath) return;
    retryingRef.current = true;
    setRetrying(true);
    try {
      const response = await fetch(refreshPath, { cache: "no-store" });
      const body = await response.json() as { data?: { audioUrl?: string }; error?: { message?: string } };
      if (!response.ok || !body.data?.audioUrl) throw new Error(body.error?.message || "This recording is unavailable. Try again in a moment.");
      setSource(body.data.audioUrl);
      setError("");
      // A freshly checked link can be byte-identical within its signing window.
      if (body.data.audioUrl === source) audioRef.current?.load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Playback could not reconnect. Try again.");
    } finally { retryingRef.current = false; setRetrying(false); }
  }

  return <div className={className}>
    <audio ref={audioRef} controls autoPlay={autoPlay} preload="metadata" src={source} className="w-full" aria-label={label} onError={() => setError(refreshPath || reloadOnRetry ? "Playback could not load. The link may have expired or your connection may have dropped." : "This local recording is no longer available. Record a new take to hear it again.")} />
    {error && <div role="alert" className="mt-3 rounded-xl border border-white/15 p-3 text-sm leading-6 text-white/75"><p>{error}</p>{(refreshPath || reloadOnRetry) && <button type="button" className="button-secondary mt-3 min-h-11" disabled={retrying} onClick={() => void retry()}>{retrying ? "Refreshing playback…" : "Reload playback"}</button>}</div>}
  </div>;
}
