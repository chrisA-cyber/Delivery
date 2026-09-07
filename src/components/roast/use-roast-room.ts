"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoastRoomSnapshot } from "@/lib/roast/types";
import { RoundApiError, roundApi, roundPost } from "@/components/rounds/round-api";

export interface RoastMediaCredentials { url: string; token: string; identity: string }
export function useRoastRoom(id: string, inviteToken?: string) {
  const [room, setRoom] = useState<RoastRoomSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [now, setNow] = useState(Date.now());
  const [credentials, setCredentials] = useState<RoastMediaCredentials | null>(null);
  const [mediaError, setMediaError] = useState("");
  const [mediaLoading, setMediaLoading] = useState(false);
  const roomRef = useRef<RoastRoomSnapshot | null>(null);
  const clockOffset = useRef(0);
  const mutation = useRef(false);
  const readPending = useRef(false);
  const readError = useRef("");
  const alive = useRef(true);
  const path = `/api/roast/${encodeURIComponent(id)}`;
  const apply = useCallback((next: RoastRoomSnapshot) => {
    if (!alive.current || next.id !== id || (roomRef.current && next.revision < roomRef.current.revision)) return;
    clockOffset.current = next.serverNow - Date.now();
    roomRef.current = next;
    setRoom(next);
    setNow(next.serverNow);
  }, [id]);

  const refresh = useCallback(async () => {
    if (readPending.current) return;
    readPending.current = true;
    try {
      const data = await roundApi<{ room: RoastRoomSnapshot }>(`${path}${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ""}`);
      apply(data.room);
      if (alive.current) setError((current) => current === readError.current ? "" : current);
      readError.current = "";
    } catch (cause) {
      readError.current = cause instanceof Error ? cause.message : "The stage could not reconnect. Please retry.";
      if (alive.current) setError(readError.current);
    } finally {
      readPending.current = false;
      if (alive.current) setLoading(false);
    }
  }, [path, inviteToken, apply]);

  const act = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    if (mutation.current) return null;
    mutation.current = true;
    setBusy(action); setError("");
    try {
      const data = await roundPost<{ room: RoastRoomSnapshot; inviteToken?: string }>(path, { action, requestId: crypto.randomUUID(), battleId: roomRef.current?.battleId ?? undefined, inviteToken, ...body });
      apply(data.room);
      return data;
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "That change did not finish. Please retry.");
      return null;
    } finally {
      mutation.current = false;
      if (alive.current) setBusy("");
    }
  }, [path, inviteToken, apply]);

  const connectMedia = useCallback(async () => {
    setMediaLoading(true); setMediaError("");
    try {
      const data = await roundPost<RoastMediaCredentials>(`${path}/media`, { inviteToken });
      if (alive.current) setCredentials(data);
    } catch (cause) {
      if (alive.current) setMediaError(cause instanceof Error ? cause.message : "Live audio is unavailable. Please reconnect.");
    } finally { if (alive.current) setMediaLoading(false); }
  }, [path, inviteToken]);

  useEffect(() => {
    alive.current = true;
    roomRef.current = null;
    setRoom(null); setLoading(true); setCredentials(null);
    void refresh();
    const poll = setInterval(() => { if (roomRef.current?.phase !== "closed") void refresh(); }, 2000);
    const clock = setInterval(() => setNow(Date.now() + clockOffset.current), 250);
    return () => { alive.current = false; clearInterval(poll); clearInterval(clock); };
  }, [refresh]);

  const joined = Boolean(room?.viewer.id && room.viewer.adultAcknowledged && !room.viewer.removed && room.phase !== "closed");
  useEffect(() => {
    if (!joined) { setCredentials(null); return; }
    void connectMedia();
  }, [joined, connectMedia]);

  useEffect(() => {
    if (!joined) return;
    let heartbeatPending = false;
    const heartbeat = setInterval(async () => {
      if (heartbeatPending || mutation.current) return;
      heartbeatPending = true;
      try { const data = await roundPost<{ room: RoastRoomSnapshot }>(path, { action: "heartbeat", requestId: crypto.randomUUID(), inviteToken }); apply(data.room); }
      catch (cause) { if (alive.current && cause instanceof RoundApiError && (cause.status === 403 || cause.status === 410)) { setCredentials(null); void refresh(); } }
      finally { heartbeatPending = false; }
    }, 5000);
    return () => clearInterval(heartbeat);
  }, [joined, path, inviteToken, apply, refresh]);

  return { room, loading, error, busy, now, joined, credentials, mediaError, mediaLoading, refresh, act, connectMedia, setError };
}
