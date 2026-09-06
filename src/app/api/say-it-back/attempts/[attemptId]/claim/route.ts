import { z } from "zod";
import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { claimSayAttempt, getSayViewer } from "@/lib/server/say-it-back";
import { assertSameOrigin } from "@/lib/server/request";
import { enforceRateLimit, getClientKey } from "@/lib/server/rate-limit";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ attemptId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    await enforceRateLimit(getClientKey(request, "say-claim"), { limit: 10, windowMs: 10 * 60_000 });
    const { attemptId } = await context.params;
    return jsonOk({ attempt: await claimSayAttempt(z.string().uuid().parse(attemptId), request, await getSayViewer(request)) }, requestId, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error, requestId); }
}
