import "server-only";

/** Supabase's public Auth settings keep the sign-in screen in step with configuration. */
export async function getEnabledSocialProviders(): Promise<Array<"google" | "github">> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    const settings = await response.json() as { external?: Record<string, unknown> };
    return (["google", "github"] as const).filter((provider) => settings.external?.[provider] === true);
  } catch {
    return [];
  }
}
