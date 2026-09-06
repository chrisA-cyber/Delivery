import { z } from "zod";
import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { claimClassicExportAttempt, getClassicExportViewer } from "@/lib/server/classic-export-attempts";
import { enforceRateLimit, getClientKey } from "@/lib/server/rate-limit";
import { assertSameOrigin } from "@/lib/server/request";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ attemptId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    await enforceRateLimit(getClientKey(request, "classic-video-claim"), { limit: 10, windowMs: 10 * 60_000 });
    const { attemptId } = await context.params;
    return jsonOk({ attempt: await claimClassicExportAttempt(z.string().uuid().parse(attemptId), request, await getClassicExportViewer(request)) }, requestId, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error, requestId, { "Cache-Control": "private, no-store" }); }
}
