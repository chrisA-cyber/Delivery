import { z } from "zod";
import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { getSayClips } from "@/lib/server/say-it-back";
import { SAY_SCORING_VERSION } from "@/lib/say-it-back/types";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const maxRating = z.enum(["everyone", "teen", "mature"]).parse(new URL(request.url).searchParams.get("maxRating") ?? "everyone");
    return jsonOk({ clips: await getSayClips(maxRating), scoringVersion: SAY_SCORING_VERSION }, requestId, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error, requestId); }
}
