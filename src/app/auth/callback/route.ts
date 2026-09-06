import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/server/env";
import { safeInternalAppPath } from "@/lib/server/redirects";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const env = getServerEnv();
  const configuredOrigin = env.NEXT_PUBLIC_APP_URL;
  if (env.NODE_ENV === "production" && !configuredOrigin) {
    return NextResponse.json(
      { error: "Authentication is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const origin = configuredOrigin ? new URL(configuredOrigin).origin : url.origin;
  const code = url.searchParams.get("code");
  const requested = url.searchParams.get("next") ?? "/profile";
  const next = safeInternalAppPath(requested, origin);
  function redirect(path: string) {
    const response = NextResponse.redirect(new URL(path, origin));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const failed = `/login?error=callback&next=${encodeURIComponent(next)}`;
  if (code) {
    try {
      const client = await createServerSupabaseClient();
      const flowId = url.searchParams.get("sb_flow_id");
      const { error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      if (error) throw error;
    }
    catch { return redirect(failed); }
  } else return redirect(failed);
  return redirect(next);
}
