"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/database";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  // The server handles ordinary callbacks; the reset form explicitly consumes
  // recovery codes. An eager global client must not consume either code first.
  browserClient ??= createBrowserClient<Database>(url, anonKey, { auth: { detectSessionInUrl: false } });
  return browserClient;
}

export const createBrowserSupabaseClient = createClient;
