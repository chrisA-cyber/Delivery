import { broadcastViewer, resolveBroadcast, groupAudioResponse } from "@/lib/server/group-rounds";
import { groupHeaders, groupRatingSchema } from "@/lib/server/group-round-routes";
import { jsonError, requestIdFrom } from "@/lib/server/api-error";
import { enforceRateLimit, getClientKey } from "@/lib/server/rate-limit";
export async function GET(request: Request, context: { params: Promise<{ token: string; memberId: string }> }) {
  try {
    await enforceRateLimit(getClientKey(request, "broadcast-audio"), { limit: 120, windowMs: 600_000 });
    const { token, memberId } = await context.params;
    return await groupAudioResponse(await resolveBroadcast(token), broadcastViewer(), request, { memberId }, groupRatingSchema.parse(new URL(request.url).searchParams.get("maxRating") ?? "everyone"));
  } catch (error) { return jsonError(error, requestIdFrom(request), groupHeaders()); }
}
