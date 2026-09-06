import { z } from "zod";
import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { getSayViewer, judgeSayAttempt } from "@/lib/server/say-it-back";
import { assertSameOrigin } from "@/lib/server/request";
import { enforceRateLimit, getClientKey } from "@/lib/server/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ attemptId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    await enforceRateLimit(getClientKey(request, "say-judge"), { limit: 15, windowMs: 10 * 60_000 });
    const { attemptId } = await context.params;
    const result = await judgeSayAttempt(z.string().uuid().parse(attemptId), await getSayViewer(request));
    return jsonOk({ attempt: result.attempt, usage: result.usage }, requestId, { headers: { "Cache-Control": "private, no-store", "Idempotency-Replayed": String(result.replayed) } });
  } catch (error) { return jsonError(error, requestId); }
}
