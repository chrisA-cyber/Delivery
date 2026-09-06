import { z } from "zod";
import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { switchChallengesForRating } from "@/lib/switch/catalog";
import { SWITCH_SCORING_VERSION, SWITCH_RUBRIC_VERSION } from "@/lib/switch/types";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const maxRating = z.enum(["everyone", "teen", "mature"]).parse(new URL(request.url).searchParams.get("maxRating") ?? "everyone");
    return jsonOk({ challenges: switchChallengesForRating(maxRating), scoringVersion: SWITCH_SCORING_VERSION, rubricVersion: SWITCH_RUBRIC_VERSION, beta: true, ranked: false }, requestId, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error, requestId); }
}
