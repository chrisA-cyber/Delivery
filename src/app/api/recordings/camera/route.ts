import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { assertContentLength, assertMultipartRequest, assertSameOrigin } from "@/lib/server/request";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSwitchViewer } from "@/lib/server/switch";
import { clipSourceSchema, readBoundedClipBody } from "@/lib/server/clip-editor";
import { resolveExportSource } from "@/lib/server/video-export-sources";
import { uploadCamera } from "@/lib/server/camera-media";
import { CAMERA_MAX_BYTES } from "@/lib/camera";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request); assertMultipartRequest(request); assertContentLength(request, CAMERA_MAX_BYTES + 65536);
    const viewer = await getSwitchViewer(request);
    await enforceRateLimit(`camera-upload:${viewer.ownerKey}`, { limit: 30, windowMs: 600000 });
    const bytes = await readBoundedClipBody(request, CAMERA_MAX_BYTES + 65536);
    const form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    const input = clipSourceSchema.parse(Object.fromEntries(["mode", "attemptId", "maxRating"].map(k => [k, form.get(k)])));
    const source = await resolveExportSource(input.mode, input.attemptId, viewer, input.maxRating, { mediaOnly: true });
    await uploadCamera(source, form);
    return jsonOk({ saved: true }, requestId, { headers: { "Cache-Control": "private, no-store", ...(viewer.setCookie ? { "Set-Cookie": viewer.setCookie } : {}) } });
  } catch (error) { return jsonError(error, requestId); }
}
