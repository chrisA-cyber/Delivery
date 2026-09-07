"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { BUILTIN_AVATARS, type ClipAvatar } from "@/lib/video-composition";

type AvatarState = { avatar: ClipAvatar; loading: boolean; saving: boolean; error: string };
type Entry = { state: AvatarState; listeners: Set<(state: AvatarState) => void>; pending?: Promise<void>; loaded?: boolean; revision: number };
const entries = new Map<string, Entry>();
function entryFor(key: string): Entry {
  const existing = entries.get(key);
  if (existing) return existing;
  const created: Entry = { state: { avatar: { kind: "builtin", id: BUILTIN_AVATARS[0].id }, loading: true, saving: false, error: "" }, listeners: new Set(), revision: 0 };
  entries.set(key, created);
  return created;
}
function publish(entry: Entry, patch: Partial<AvatarState>) {
  entry.state = { ...entry.state, ...patch };
  entry.listeners.forEach((listener) => listener(entry.state));
}
function readAvatar(body: { data?: { avatar?: ClipAvatar }; avatar?: ClipAvatar }) { return body.data?.avatar ?? body.avatar; }

/** One server-backed preference per identity. Choosing an editor override never changes it. */
export function usePreferredAvatar() {
  const { authenticated, profile, authReady } = useApp();
  const key = authenticated ? `account:${profile?.handle ?? "signed-in"}` : "guest";
  const entry = entryFor(key);
  const [state, setState] = useState(entry.state);
  useEffect(() => {
    setState(entry.state);
    entry.listeners.add(setState);
    if (authReady !== false && !entry.loaded && !entry.pending) {
      const revision = entry.revision;
      entry.pending = fetch("/api/avatars", { cache: "no-store" }).then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || "Your saved avatar could not load.");
        const avatar = readAvatar(body);
        if (revision === entry.revision && avatar) publish(entry, { avatar });
        entry.loaded = true;
      }).catch(() => {
        // A neutral built-in keeps recording available when preferences cannot load.
      }).finally(() => { entry.pending = undefined; publish(entry, { loading: false }); });
    }
    return () => { entry.listeners.delete(setState); };
  }, [entry, authReady]);

  const setAvatar = useCallback(async (avatar: ClipAvatar) => {
    if (entry.state.saving) return;
    const previous = entry.state.avatar;
    entry.revision += 1;
    publish(entry, { avatar, saving: true, error: "" });
    try {
      // Finish identity initialization before writing a guest preference.
      await entry.pending;
      const response = await fetch("/api/avatars", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatar }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Your avatar could not be saved. Try again.");
      publish(entry, { avatar: readAvatar(body) ?? avatar });
      entry.loaded = true;
    } catch (cause) {
      publish(entry, { avatar: previous, error: cause instanceof Error ? cause.message : "Your avatar could not be saved. Try again." });
    } finally { publish(entry, { saving: false }); }
  }, [entry]);
  return { ...state, setAvatar };
}
