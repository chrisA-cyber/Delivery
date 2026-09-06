import "server-only";

export interface AuthAvailability {
  enabledProviders: Array<"google" | "github">;
  emailReady: boolean;
  passwordSignIn: boolean;
}

/** Provider enablement alone does not establish that hosted email can deliver. */
export async function getAuthAvailability(): Promise<AuthAvailability> {
  const unavailable: AuthAvailability = { enabledProviders: [], emailReady: false, passwordSignIn: false };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return unavailable;
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return unavailable;
    const settings = await response.json() as { external?: Record<string, unknown> };
    const emailEnabled = settings.external?.email === true;
    return {
      enabledProviders: (["google", "github"] as const).filter((provider) => settings.external?.[provider] === true),
      emailReady: emailEnabled && process.env.DELIVERY_AUTH_EMAIL_READY === "true",
      passwordSignIn: emailEnabled,
    };
  } catch {
    return unavailable;
  }
}
