import { resolveCommunityCode } from "@/lib/server/group-rounds";
import { jsonOk, jsonError, requestIdFrom } from "@/lib/server/api-error";
import { enforceRateLimit, getClientKey } from "@/lib/server/rate-limit";
export async function GET(request: Request) {
  const id = requestIdFrom(request);
  try {
    await enforceRateLimit(getClientKey(request, "community-code"), { limit: 30, windowMs: 600_000 });
    const token = await resolveCommunityCode((new URL(request.url).searchParams.get("code") ?? "").replace(/[\s-]/g, "").toUpperCase());
    return jsonOk({ path: `/rounds/${token}` }, id, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error, id); }
}
