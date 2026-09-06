import { z } from "zod";
import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { createSwitchChallenge, getSwitchViewer } from "@/lib/server/switch";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";
import { getServerEnv } from "@/lib/server/env";
import { enforceRateLimit, getClientKey } from "@/lib/server/rate-limit";
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request); assertJsonRequest(request); assertContentLength(request, 4096);
    await enforceRateLimit(getClientKey(request, "switch-challenge"), { limit: 10, windowMs: 10 * 60_000 });
    const fields = z.object({ attemptId: z.string().uuid(), shareAudio: z.literal(true) }).parse(await request.json());
    const origin = getServerEnv().NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    return jsonOk({ challenge: await createSwitchChallenge(fields.attemptId, await getSwitchViewer(request), origin) }, requestId, { status: 201, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return jsonError(error, requestId); }
}
