import { z } from "zod";
import { AppError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { createClassicExportAttempt, getClassicExportHistory, getClassicExportViewer } from "@/lib/server/classic-export-attempts";
import { enforceRateLimit, getClientKey } from "@/lib/server/rate-limit";
import { assertContentLength, assertMultipartRequest, assertSameOrigin } from "@/lib/server/request";
import { DELIVERY_MODES } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fieldsSchema = z.object({
  attemptId: z.string().uuid(), durationMs: z.coerce.number().int().min(250).max(20_000),
  promptId: z.string().trim().min(1).max(120), promptText: z.string().trim().min(2).max(500),
  energy: z.string().trim().min(2).max(180), mode: z.enum(DELIVERY_MODES).default("classic"),
  category: z.string().trim().min(2).max(80).optional(), maxRating: z.enum(["everyone", "teen", "mature"]).default("everyone"),
  challengeId: z.string().uuid().optional(), challengeToken: z.string().regex(/^[A-Za-z0-9_-]{20,120}$/).optional(),
  dailyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), dailyMarket: z.string().regex(/^[a-z0-9-]{2,32}$/i).optional(),
  assignmentCode: z.string().regex(/^[a-f0-9]{12}$/).optional(), displayName: z.string().trim().min(1).max(40).optional(),
});
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  let cookie: string | undefined;
  try {
    assertSameOrigin(request); assertMultipartRequest(request); assertContentLength(request, 15 * 1024 * 1024 + 65536);
    await enforceRateLimit(getClientKey(request, "classic-video-upload"), { limit: 15, windowMs: 10 * 60_000 });
    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size < 512) throw new AppError("AUDIO_REQUIRED", "Record a take before creating its video.", 422);
    if (audio.size > 15 * 1024 * 1024) throw new AppError("AUDIO_TOO_LARGE", "Keep your recording under 15 MB.", 413);
    const values = Object.fromEntries([...form.entries()].filter(([key, value]) => key !== "audio" && typeof value === "string" && value.trim()));
    const fields = fieldsSchema.parse({ ...values, promptText: values.promptText ?? values.line });
    const headerKey = request.headers.get("idempotency-key");
    if (headerKey && headerKey !== fields.attemptId) throw new AppError("IDEMPOTENCY_KEY_MISMATCH", "The retry key does not match this take.", 422);
    const viewer = await getClassicExportViewer(request, fields.attemptId); cookie = viewer.setCookie;
    const result = await createClassicExportAttempt({ ...fields, audio }, viewer);
    return jsonOk({ attempt: result.attempt }, requestId, { status: result.replayed ? 200 : 201, headers: { "Cache-Control": "private, no-store", "Idempotency-Replayed": String(result.replayed), ...(cookie ? { "Set-Cookie": cookie } : {}) } });
  } catch (error) { return jsonError(error, requestId, { "Cache-Control": "private, no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) }); }
}
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const viewer = await getClassicExportViewer(request);
    const maxRating = z.enum(["everyone", "teen", "mature"]).parse(new URL(request.url).searchParams.get("maxRating") ?? "everyone");
    return jsonOk({ attempts: await getClassicExportHistory(viewer, maxRating) }, requestId, { headers: { "Cache-Control": "private, no-store", ...(viewer.setCookie ? { "Set-Cookie": viewer.setCookie } : {}) } });
  } catch (error) { return jsonError(error, requestId, { "Cache-Control": "private, no-store" }); }
}
