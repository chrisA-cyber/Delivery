import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import {
  assertProductionConfiguration,
  getServerEnv,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertProductionConfiguration();
    const env = getServerEnv();
    return jsonOk(
      {
        status: "ok" as const,
        environment: env.NODE_ENV,
        commit: /^[a-f0-9]{40}$/i.test(process.env.RAILWAY_GIT_COMMIT_SHA ?? "")
          ? process.env.RAILWAY_GIT_COMMIT_SHA
          : null,
        services: {
          supabase: isSupabaseConfigured(),
          supabaseAdmin: isSupabaseAdminConfigured(),
          openai: Boolean(env.OPENAI_API_KEY) && env.DELIVERY_AI_MODE === "live",
          stripe: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
        },
      },
      requestId,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
