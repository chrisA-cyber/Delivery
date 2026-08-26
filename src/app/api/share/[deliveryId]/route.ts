import { z } from "zod";

import { AppError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { enforceRateLimit, getClientKey, rateLimitHeaders } from "@/lib/server/rate-limit";
import { getShareDelivery } from "@/lib/server/share";

const idSchema = z.string().uuid();

export async function GET(
  request: Request,
  context: { params: Promise<{ deliveryId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    const rateLimit = await enforceRateLimit(getClientKey(request, "share"), {
      limit: 180,
      windowMs: 60 * 1_000,
    });
    const { deliveryId } = await context.params;
    const id = idSchema.parse(deliveryId);
    const delivery = await getShareDelivery(id);
    if (!delivery) {
      throw new AppError(
        "DELIVERY_NOT_FOUND",
        "That take is private, expired, or lost to the timeline.",
        404,
      );
    }
    return jsonOk(delivery, requestId, {
      headers: {
        ...rateLimitHeaders(rateLimit),
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie, Authorization",
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
