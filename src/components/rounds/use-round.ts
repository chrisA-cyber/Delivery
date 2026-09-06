"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import type { GroupRound } from "@/lib/groups/types";
import { RoundApiError, roundApi, roundPost } from "./round-api";

export function useRound(token: string, poll = true) {
  const { contentRating, hydrated, authenticated, authReady } = useApp();
  const [round, setRound] = useState<GroupRound | null>(null);
  const [error, setError] = useState<RoundApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const sequence = useRef(0);
  const mutation = useRef(false);
  const readsInFlight = useRef(0);
  const claimAttempted = useRef("");
  const path = `/api/rounds/${encodeURIComponent(token)}`;
  const roundState = round?.state;
  const hasRound = Boolean(round);
  const communityPhase = round?.community?.phase;
  const refresh = useCallback(async (quiet = false) => {
    if (quiet && (readsInFlight.current > 0 || mutation.current)) return;
    readsInFlight.current += 1;
    const run = ++sequence.current;
    if (!quiet) setLoading(true);
    try {
      const data = await roundApi<{ round: GroupRound }>(`${path}?maxRating=${contentRating}`);
      if (run === sequence.current) { setRound(data.round); setError(null); }
    } catch (cause) {
      if (run === sequence.current) setError(cause instanceof RoundApiError ? cause : new RoundApiError("Your round could not reconnect. Please retry.", 0));
    } finally { readsInFlight.current -= 1; if (run === sequence.current) setLoading(false); }
  }, [path, contentRating]);

  useEffect(() => {
    if (!hydrated || !authReady) return;
    setRound(null);
    void refresh();
    return () => { sequence.current += 1; };
  }, [hydrated, authReady, authenticated, refresh]);
  useEffect(() => {
    if (!poll || !hasRound || roundState === "expired") return;
    const timer = setInterval(() => { if (document.visibilityState === "visible" && !mutation.current) void refresh(true); }, communityPhase && ["showcase", "voting"].includes(communityPhase) ? 4000 : 15000);
    return () => clearInterval(timer);
  }, [roundState, communityPhase, hasRound, poll, refresh]);

  async function act(action: string, body: Record<string, unknown> = {}) {
    if (mutation.current) return null;
    mutation.current = true; setBusy(action); setError(null);
    // A read started before the mutation must never overwrite its result.
    const run = ++sequence.current;
    try {
      const data = await roundPost<{ round: GroupRound }>(`${path}/${action}`, { ...body, maxRating: contentRating });
      if (run !== sequence.current) return null;
      setRound(data.round);
      return data.round;
    } catch (cause) {
      if (run === sequence.current) setError(cause instanceof RoundApiError ? cause : new RoundApiError("That change did not finish. Please retry.", 0));
      return null;
    } finally { mutation.current = false; setBusy(""); }
  }

  // Authenticated API verifies the original signed device cookie.
  useEffect(() => {
    if (!authenticated || !round?.canClaim || mutation.current) return;
    const key = `${token}:${round.viewerMemberId}`;
    if (claimAttempted.current === key) return;
    claimAttempted.current = key;
    void act("claim");
  });

  // Route transitions can reuse this hook before its loading effect runs.
  // Never render one group's private data under another invitation token.
  const switchingRounds = Boolean(round && round.token !== token);
  return { round: switchingRounds ? null : round, error, loading: loading || switchingRounds, busy, refresh, act };
}
