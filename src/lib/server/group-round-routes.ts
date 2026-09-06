import "server-only";
import { z } from "zod";
import { AppError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { createGroupRound, getGroupRound, getGroupViewer, mutateGroupRound, submitGroupPerformance } from "@/lib/server/group-rounds";
import { enforceRateLimit, getClientKey } from "@/lib/server/rate-limit";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";

export const groupRatingSchema = z.enum(["everyone", "teen", "mature"]);
export const groupTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const displayName = z.string().trim().min(1).max(32).regex(/^[^\u0000-\u001f\u007f<>]+$/, "Choose a readable display name.");
export const createRoundSchema = z.object({
  requestId: z.string().uuid(), name: z.string().trim().min(1).max(60), displayName,
  mode: z.enum(["classic", "say-it-back"]), closesInHours: z.union([z.literal(1), z.literal(24), z.literal(72), z.literal(168)]).default(24),
  maxRating: groupRatingSchema.default("everyone"),
  clipId: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(), clipVersion: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(), roleId: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
  promptId: z.string().min(1).max(100).optional(), energyId: z.string().min(1).max(100).optional(),
}).strict();
const payloadSchema = z.object({ maxRating: groupRatingSchema.default("everyone"), displayName: displayName.optional(), memberId: z.string().uuid().optional(), takeId: z.string().uuid().optional(), sayAttemptId: z.string().uuid().optional(), consent: z.literal(true).optional() }).strict();
export const groupHeaders = (cookie?: string) => ({ "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", ...(cookie ? { "Set-Cookie": cookie } : {}) });

type GroupRouteAction = "create" | "read" | "join" | "submit" | "close" | "revoke" | "vote" | "claim" | "rematch";
export async function handleGroupRoute(request: Request, action: GroupRouteAction, rawToken?: string) {
  const requestId = requestIdFrom(request);
  let cookie: string | undefined;
  try {
    if (action !== "read") { assertSameOrigin(request); assertJsonRequest(request); assertContentLength(request, 16_384); }
    const token = rawToken ? groupTokenSchema.parse(rawToken) : undefined;
    const body = action === "read" ? null : await request.json();
    const creation = action === "create" || action === "rematch" ? createRoundSchema.parse(body) : null;
    const viewer = await getGroupViewer(request, creation?.requestId); cookie = viewer.setCookie;
    await enforceRateLimit(getClientKey(request, `group-${action}`), { limit: action === "create" || action === "rematch" ? 10 : action === "read" ? 600 : 60, windowMs: 10 * 60_000 });
    const origin = new URL(request.url).origin;
    let round;
    if (creation) round = await createGroupRound(creation, viewer, origin, action === "rematch" ? token : undefined);
    else if (action === "read") round = await getGroupRound(token!, viewer, origin, groupRatingSchema.parse(new URL(request.url).searchParams.get("maxRating") ?? "everyone"));
    else {
      const payload = payloadSchema.parse(body);
      if (action === "submit") {
        if (payload.consent !== true || (!payload.takeId && !payload.sayAttemptId)) throw new AppError("GROUP_CONSENT_REQUIRED", "Choose a performance and confirm sharing it with the group.", 422);
        round = await submitGroupPerformance(token!, viewer, origin, { ...payload, consent: true });
      } else {
        if (action === "join" && !payload.displayName) throw new AppError("ROUND_NAME_REQUIRED", "Choose a display name for this round.", 422);
        if (action === "vote" && !payload.memberId) throw new AppError("ROUND_VOTE_INVALID", "Choose another player's performance.", 422);
        round = await mutateGroupRound(token!, viewer, origin, action as "join" | "close" | "revoke" | "vote" | "claim", payload, payload.maxRating);
      }
    }
    return jsonOk({ round }, requestId, { status: action === "create" || action === "rematch" ? 201 : 200, headers: groupHeaders(cookie) });
  } catch (error) { return jsonError(error, requestId, groupHeaders(cookie)); }
}
