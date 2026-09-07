import { z } from "zod";
import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { getSayClips, getSayViewer } from "@/lib/server/say-it-back";
import { claimSayImports } from "@/lib/server/say-imports";
import { SAY_SCORING_VERSION } from "@/lib/say-it-back/types";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const maxRating = z.enum(["everyone", "teen", "mature"]).parse(new URL(request.url).searchParams.get("maxRating") ?? "everyone");
    const viewer = await getSayViewer(request); await claimSayImports(request, viewer);
    return jsonOk({ clips: await getSayClips(maxRating, viewer), scoringVersion: SAY_SCORING_VERSION }, requestId, { headers: { "Cache-Control": "private, no-store", ...(viewer.setCookie ? { "Set-Cookie": viewer.setCookie } : {}) } });
  } catch (error) { return jsonError(error, requestId); }
}
