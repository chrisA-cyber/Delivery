import { z } from "zod";
import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { getSwitchChallenge, getSwitchViewer } from "@/lib/server/switch";
import { getServerEnv } from "@/lib/server/env";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const { token } = await context.params;
    const maxRating = z.enum(["everyone", "teen", "mature"]).parse(new URL(request.url).searchParams.get("maxRating") ?? "everyone");
    const origin = getServerEnv().NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    return jsonOk({ challenge: await getSwitchChallenge(token, await getSwitchViewer(request), origin, maxRating) }, requestId, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return jsonError(error, requestId); }
}
