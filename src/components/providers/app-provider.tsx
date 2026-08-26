"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { DeliveryHistoryItem, DeliveryProfile, EarnedBadge } from "@/types/game";

interface AppState {
  profile: DeliveryProfile;
  stats: Record<string, number> | null;
  history: DeliveryHistoryItem[];
  badges: EarnedBadge[];
  favorites: string[];
  muted: boolean;
  reducedMotion: boolean;
  publicDefault: boolean;
  notifications: boolean;
}

interface AppContextValue extends AppState {
  hydrated: boolean;
  authReady: boolean;
  authenticated: boolean;
  accountEmail: string | null;
  tier: "guest" | "free" | "pro";
  refreshAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  saveDelivery: (delivery: DeliveryHistoryItem) => void;
  toggleFavorite: (promptId: string) => void;
  updatePreferences: (preferences: Partial<Pick<AppState, "muted" | "reducedMotion" | "publicDefault" | "notifications">>) => void;
  clearLocalData: () => void;
}

const GUEST_STORAGE_KEY = "delivery.game.state.v2.guest";
const ACCOUNT_STORAGE_PREFIX = "delivery.game.state.v2.user.";

const defaultState: AppState = {
  profile: {
    handle: "guest",
    displayName: "Guest Performer",
    avatar: "G",
    level: 1,
    xp: 0,
    streak: 0,
    followers: 0,
    following: 0,
  },
  stats: null,
  history: [],
  badges: [],
  favorites: [],
  muted: false,
  reducedMotion: false,
  publicDefault: false,
  notifications: false,
};

const AppContext = createContext<AppContextValue | null>(null);

function readStoredState(key: string): AppState {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultState;
    const parsed = JSON.parse(stored) as Partial<AppState>;
    return { ...defaultState, ...parsed, profile: { ...defaultState.profile, ...parsed.profile } };
  } catch {
    localStorage.removeItem(key);
    return defaultState;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [tier, setTier] = useState<"guest" | "free" | "pro">("guest");
  const [storageScope, setStorageScope] = useState(GUEST_STORAGE_KEY);

  useEffect(() => {
    setState(readStoredState(GUEST_STORAGE_KEY));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageScope, JSON.stringify(state));
  }, [hydrated, state, storageScope]);

  const refreshAccount = useCallback(async () => {
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      if (!response.ok) throw new Error("Account sync failed");
      const account = await response.json() as {
        authenticated?: boolean;
        user?: { id?: string; email?: string | null };
        profile?: DeliveryProfile;
        stats?: Record<string, number> | null;
        subscription?: { tier?: "free" | "pro" };
        history?: DeliveryHistoryItem[];
        badges?: EarnedBadge[];
      };
      setAuthenticated(Boolean(account.authenticated));
      setAccountEmail(account.user?.email ?? null);
      setTier(account.authenticated ? account.subscription?.tier ?? "free" : "guest");
      if (account.authenticated && account.profile && account.user?.id) {
        const accountScope = `${ACCOUNT_STORAGE_PREFIX}${account.user.id}`;
        const cached = readStoredState(accountScope);
        setStorageScope(accountScope);
        setState({ ...cached, profile: account.profile, stats: account.stats ?? null, history: account.history ?? [], badges: account.badges ?? [] });
      } else {
        setStorageScope(GUEST_STORAGE_KEY);
        setState(readStoredState(GUEST_STORAGE_KEY));
      }
    } catch {
      setAuthenticated(false);
      setAccountEmail(null);
      setTier("guest");
      setStorageScope(GUEST_STORAGE_KEY);
      setState(readStoredState(GUEST_STORAGE_KEY));
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshAccount();
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const client = createClient();
    const { data } = client.auth.onAuthStateChange(() => { void refreshAccount(); });
    return () => data.subscription.unsubscribe();
  }, [refreshAccount]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(state.reducedMotion);
    document.documentElement.dataset.muted = String(state.muted);
  }, [state.muted, state.reducedMotion]);

  const saveDelivery = useCallback((delivery: DeliveryHistoryItem) => {
    setState((current) => {
      const xp = current.profile.xp + (delivery.xp ?? 35);
      return {
        ...current,
        history: [delivery, ...current.history].slice(0, 60),
        profile: {
          ...current.profile,
          xp,
          level: Math.max(1, Math.floor(xp / 450) + 1),
        },
      };
    });
  }, []);

  const toggleFavorite = useCallback((promptId: string) => {
    setState((current) => ({
      ...current,
      favorites: current.favorites.includes(promptId)
        ? current.favorites.filter((id) => id !== promptId)
        : [...current.favorites, promptId],
    }));
  }, []);

  const updatePreferences = useCallback(
    (preferences: Partial<Pick<AppState, "muted" | "reducedMotion" | "publicDefault" | "notifications">>) => {
      setState((current) => ({ ...current, ...preferences }));
    },
    [],
  );

  const clearLocalData = useCallback(() => {
    setState((current) => authenticated ? { ...defaultState, profile: current.profile } : defaultState);
    localStorage.removeItem(storageScope);
  }, [authenticated, storageScope]);

  const signOut = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      await createClient().auth.signOut();
    }
    setAuthenticated(false);
    setAccountEmail(null);
    setTier("guest");
    setStorageScope(GUEST_STORAGE_KEY);
    setState(readStoredState(GUEST_STORAGE_KEY));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      hydrated,
      authReady,
      authenticated,
      accountEmail,
      tier,
      refreshAccount,
      signOut,
      saveDelivery,
      toggleFavorite,
      updatePreferences,
      clearLocalData,
    }),
    [accountEmail, authReady, authenticated, clearLocalData, hydrated, refreshAccount, saveDelivery, signOut, state, tier, toggleFavorite, updatePreferences],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
