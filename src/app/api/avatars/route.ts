import { z } from "zod";
import { jsonOk, jsonError, requestIdFrom, AppError } from "@/lib/server/api-error";
import { assertSameOrigin, assertJsonRequest, assertContentLength, assertMultipartRequest } from "@/lib/server/request";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSwitchViewer } from "@/lib/server/switch";
import { getPreferredAvatar, savePreferredAvatar, normalizeAvatarUpload, readBoundedClipBody, AVATAR_UPLOAD_BYTES, CLIP_REQUEST_BYTES } from "@/lib/server/clip-editor";
import { clipAvatarSchema } from "@/lib/video-composition";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = (setCookie?: string) => ({ "Cache-Control": "private, no-store", ...(setCookie ? { "Set-Cookie": setCookie } : {}) });
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try { const viewer = await getSwitchViewer(request); return jsonOk({ avatar: await getPreferredAvatar(viewer) }, requestId, { headers: headers(viewer.setCookie) }); }
  catch (error) { return jsonError(error, requestId); }
}
export async function PUT(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request); assertJsonRequest(request); assertContentLength(request, CLIP_REQUEST_BYTES);
    const body = (await readBoundedClipBody(request, CLIP_REQUEST_BYTES)).toString("utf8");
    const input = z.object({ avatar: clipAvatarSchema }).strict().parse(JSON.parse(body));
    const viewer = await getSwitchViewer(request);
    await enforceRateLimit(`avatar-save:${viewer.ownerKey}`, { limit: 60, windowMs: 60 * 60_000 });
    return jsonOk({ avatar: await savePreferredAvatar(input.avatar, viewer) }, requestId, { headers: headers(viewer.setCookie) });
  } catch (error) { return jsonError(error, requestId); }
}
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request); assertMultipartRequest(request); assertContentLength(request, AVATAR_UPLOAD_BYTES + 4096);
    const viewer = await getSwitchViewer(request);
    await enforceRateLimit(`avatar-upload:${viewer.ownerKey}`, { limit: 30, windowMs: 60 * 60_000 });
    const body = await readBoundedClipBody(request, AVATAR_UPLOAD_BYTES + 4096);
    const form = await new Response(new Uint8Array(body), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData(), image = form.get("image");
    if (!(image instanceof File) || image.size > AVATAR_UPLOAD_BYTES) throw new AppError("AVATAR_INVALID", "Choose an image under 5 MB.", 400);
    return jsonOk({ avatar: await normalizeAvatarUpload(Buffer.from(await image.arrayBuffer()), image.type) }, requestId, { headers: headers(viewer.setCookie) });
  } catch (error) { return jsonError(error, requestId); }
}
