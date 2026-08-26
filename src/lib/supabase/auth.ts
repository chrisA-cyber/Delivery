import "server-only";

import type { User } from "@supabase/supabase-js";

import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { isSupabaseConfigured } from "@/lib/server/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getOptionalUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") {
    throw new ExternalServiceError("Supabase", { cause: error });
  }
  return data.user ?? null;
}

export async function requireUser(): Promise<User> {
  if (!isSupabaseConfigured()) {
    throw new AppError(
      "AUTH_NOT_CONFIGURED",
      "Sign-in is not configured for this environment.",
      503,
    );
  }

  const user = await getOptionalUser();
  if (!user) {
    throw new AppError("UNAUTHORIZED", "Sign in to keep the show going.", 401);
  }
  return user;
}

export async function requireStaff(): Promise<{ user: User; role: "moderator" | "admin" }> {
  const user = await requireUser();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new ExternalServiceError("Supabase", { cause: error });
  const role = (data as { role?: unknown } | null)?.role;
  if (role !== "moderator" && role !== "admin") {
    throw new AppError("FORBIDDEN", "This room is for the trust crew.", 403);
  }
  return { user, role };
}
