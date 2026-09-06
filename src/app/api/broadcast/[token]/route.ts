import { getBroadcast } from "@/lib/server/group-rounds";
import { groupHeaders, groupRatingSchema } from "@/lib/server/group-round-routes";
import { getServerEnv } from "@/lib/server/env";
import { jsonOk, jsonError, requestIdFrom } from "@/lib/server/api-error";
import { enforceRateLimit, getClientKey } from "@/lib/server/rate-limit";
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const id = requestIdFrom(request);
  try {
    await enforceRateLimit(getClientKey(request, "broadcast-read"), { limit: 600, windowMs: 600_000 });
    const rating = groupRatingSchema.parse(new URL(request.url).searchParams.get("maxRating") ?? "everyone");
    const round = await getBroadcast((await context.params).token, new URL(getServerEnv().NEXT_PUBLIC_APP_URL || request.url).origin, rating);
    return jsonOk({ round }, id, { headers: groupHeaders() });
  } catch (error) { return jsonError(error, id, groupHeaders()); }
}
