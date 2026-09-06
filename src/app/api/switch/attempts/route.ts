import { z } from "zod";
import { AppError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { assertContentLength, assertMultipartRequest, assertSameOrigin } from "@/lib/server/request";
import { enforceRateLimit, getClientKey } from "@/lib/server/rate-limit";
import { createSwitchAttempt, getSwitchHistory, getSwitchViewer } from "@/lib/server/switch";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fieldsSchema = z.object({
  challengeId: z.string().regex(/^[a-z0-9-]{1,80}$/), challengeVersion: z.string().regex(/^[a-z0-9.-]{1,80}$/),
  durationMs: z.coerce.number().int().min(250).max(30000), recordingOffsetMs: z.coerce.number().int().min(0).max(0).default(0),
  attemptId: z.string().uuid(), maxRating: z.enum(["everyone", "teen", "mature"]).default("everyone"),
  roundToken: z.string().regex(/^[A-Za-z0-9_-]{40,80}$/).optional(),
  challengeToken: z.string().regex(/^[A-Za-z0-9_-]{40,80}$/).optional(), shareAudio: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
});
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  let cookie: string | undefined;
  try {
    assertSameOrigin(request); assertMultipartRequest(request); assertContentLength(request, 15 * 1024 * 1024 + 65536);
    await enforceRateLimit(getClientKey(request, "switch-upload"), { limit: 15, windowMs: 10 * 60_000 });
    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size < 512) throw new AppError("AUDIO_REQUIRED", "Record one complete Switch take first.", 422);
    if (audio.size > 15 * 1024 * 1024) throw new AppError("AUDIO_TOO_LARGE", "Keep your recording under 15 MB.", 413);
    const values = Object.fromEntries([...form.entries()].filter(([key, value]) => key !== "audio" && typeof value === "string"));
    const fields = fieldsSchema.parse(values);
    const headerKey = request.headers.get("idempotency-key");
    if (headerKey && headerKey !== fields.attemptId) throw new AppError("IDEMPOTENCY_KEY_MISMATCH", "The retry key does not match this take.", 422);
    const viewer = await getSwitchViewer(request, fields.attemptId); cookie = viewer.setCookie;
    const result = await createSwitchAttempt({ ...fields, audio }, viewer);
    return jsonOk({ attempt: result.attempt }, requestId, { status: result.replayed ? 200 : 201, headers: { "Cache-Control": "private, no-store", "Idempotency-Replayed": String(result.replayed), ...(cookie ? { "Set-Cookie": cookie } : {}) } });
  } catch (error) { return jsonError(error, requestId, cookie ? { "Set-Cookie": cookie } : undefined); }
}
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const viewer = await getSwitchViewer(request);
    if (!viewer.user) throw new AppError("UNAUTHORIZED", "Sign in to see saved takes.", 401);
    const maxRating = z.enum(["everyone", "teen", "mature"]).parse(new URL(request.url).searchParams.get("maxRating") ?? "everyone");
    return jsonOk({ attempts: await getSwitchHistory(viewer.user.id, maxRating) }, requestId, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error, requestId); }
}
