import { jsonOk, jsonError, requestIdFrom } from "@/lib/server/api-error";
import { assertSameOrigin, assertJsonRequest, assertContentLength } from "@/lib/server/request";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSwitchViewer } from "@/lib/server/switch";
import { getClipEditor, saveClipSettings, clipSourceSchema, readBoundedClipBody, CLIP_REQUEST_BYTES } from "@/lib/server/clip-editor";
import { resolveExportSource } from "@/lib/server/video-export-sources";
import { clipEditSettingsSchema } from "@/lib/video-composition";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = (setCookie?: string) => ({ "Cache-Control": "private, no-store", ...(setCookie ? { "Set-Cookie": setCookie } : {}) });
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const input = clipSourceSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const viewer = await getSwitchViewer(request);
    return jsonOk(await getClipEditor(input.mode, input.attemptId, input.maxRating, viewer), requestId, { headers: headers(viewer.setCookie) });
  } catch (error) { return jsonError(error, requestId); }
}
export async function PUT(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request); assertJsonRequest(request); assertContentLength(request, CLIP_REQUEST_BYTES);
    const body = (await readBoundedClipBody(request, CLIP_REQUEST_BYTES)).toString("utf8");
    const input = clipSourceSchema.extend({ settings: clipEditSettingsSchema }).strict().parse(JSON.parse(body));
    const viewer = await getSwitchViewer(request);
    await enforceRateLimit(`clip-edit:${viewer.ownerKey}`, { limit: 90, windowMs: 60 * 60_000 });
    const source = await resolveExportSource(input.mode, input.attemptId, viewer, input.maxRating);
    return jsonOk({ settings: await saveClipSettings(source, input.settings) }, requestId, { headers: headers(viewer.setCookie) });
  } catch (error) { return jsonError(error, requestId); }
}
