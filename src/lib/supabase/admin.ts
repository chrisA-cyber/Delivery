import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { requireEnv } from "@/lib/server/env";
import type { Database } from "@/lib/supabase/database";

let adminClient: ReturnType<typeof createSupabaseClient<Database>> | undefined;

export function createAdminClient() {
  const env = requireEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  adminClient ??= createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  return adminClient;
}

export const createSupabaseAdminClient = createAdminClient;
