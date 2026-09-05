import { z } from "zod";

import { AppError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { getRandomRuntimeContent } from "@/lib/server/random-content";
import { enforceRateLimit, getClientKey, rateLimitHeaders } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  pack: z.string().trim().min(1).max(80).optional(),
  category: z
    .enum([
      "main-character",
      "group-chat",
      "gaming",
      "anime-energy",
      "cinema-coded",
      "workplace",
      "romance",
      "villain-era",
      "brainrot",
      "customer-service",
      "streamer-mode",
      "wildcard",
    ])
    .optional(),
  difficulty: z.enum(["easy", "medium", "hard", "impossible"]).optional(),
  exclude: z.string().max(4_000).optional(),
  excludeEnergy: z.string().max(2_000).optional(),
  maxRating: z.enum(["everyone", "teen", "mature"]).default("everyone"),
  seed: z.string().max(120).optional(),
  market: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,32}$/).default("global"),
  includePro: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const rateLimit = await enforceRateLimit(getClientKey(request, "prompts"), {
      limit: 120,
      windowMs: 60 * 1_000,
    });
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    const content = await getRandomRuntimeContent({
      pack: query.pack,
      category: query.category,
      difficulty: query.difficulty,
      excludeIds: query.exclude?.split(",").map((id) => id.trim()).filter(Boolean),
      excludeEnergyIds: query.excludeEnergy?.split(",").map((id) => id.trim()).filter(Boolean),
      maxRating: query.maxRating,
      seed: query.seed,
      market: query.market,
      includePro: query.includePro,
    });

    return jsonOk(
      content,
      requestId,
      { headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RangeError) {
      return jsonError(
        new AppError("NO_PROMPTS", "No lines match those filters. Try a wider vibe.", 404),
        requestId,
        { "Cache-Control": "no-store" },
      );
    }
    return jsonError(error, requestId, { "Cache-Control": "no-store" });
  }
}
