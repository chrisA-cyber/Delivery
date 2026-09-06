import { z } from "zod";
import { AppError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { groupHeaders, groupRatingSchema, groupTokenSchema } from "@/lib/server/group-round-routes";
import { createClassicRoundTake, getGroupViewer } from "@/lib/server/group-rounds";
import { enforceRateLimit, getClientKey } from "@/lib/server/rate-limit";
import { assertContentLength, assertMultipartRequest, assertSameOrigin } from "@/lib/server/request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fields = z.object({ attemptId: z.string().regex(/^[A-Za-z0-9:_.-]{8,128}$/), durationMs: z.coerce.number().int().min(250).max(20000), maxRating: groupRatingSchema.default("everyone") });
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const requestId = requestIdFrom(request); let cookie: string | undefined;
  try {
    assertSameOrigin(request); assertMultipartRequest(request); assertContentLength(request, 15 * 1024 * 1024 + 65536);
    await enforceRateLimit(getClientKey(request, "group-upload"), { limit: 20, windowMs: 10 * 60_000 });
    const token = groupTokenSchema.parse((await context.params).token);
    const form = await request.formData(); const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size < 512) throw new AppError("AUDIO_REQUIRED", "Record your performance first.", 422);
    if (audio.size > 15 * 1024 * 1024) throw new AppError("AUDIO_TOO_LARGE", "Keep the recording under 15 MB.", 413);
    const input = fields.parse({ attemptId: form.get("attemptId"), durationMs: form.get("durationMs"), maxRating: form.get("maxRating") ?? "everyone" });
    const viewer = await getGroupViewer(request, input.attemptId); cookie = viewer.setCookie;
    const take = await createClassicRoundTake({ ...input, token, audio }, viewer);
    return jsonOk({ take }, requestId, { status: take.replayed ? 200 : 201, headers: groupHeaders(cookie) });
  } catch (error) { return jsonError(error, requestId, groupHeaders(cookie)); }
}
