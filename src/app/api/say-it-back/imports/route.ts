import { z } from "zod";
import { AppError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { assertContentLength, assertSameOrigin, assertJsonRequest } from "@/lib/server/request";
import { enforceRateLimit, getClientKey } from "@/lib/server/rate-limit";
import { getSayViewer } from "@/lib/server/say-it-back";
import { claimSayImports, createSayImport, listSayImports, SAY_IMPORT_MAX_BYTES } from "@/lib/server/say-imports";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function GET(request: Request) {
  const requestId = requestIdFrom(request); let cookie: string | undefined;
  try {
    const viewer = await getSayViewer(request); cookie = viewer.setCookie;
    await claimSayImports(request, viewer);
    return jsonOk({ imports: await listSayImports(viewer) }, requestId, { headers: { "Cache-Control": "private, no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) } });
  } catch (error) { return jsonError(error, requestId, cookie ? { "Set-Cookie": cookie } : undefined); }
}
export async function POST(request: Request) {
  const requestId = requestIdFrom(request); let cookie: string | undefined;
  try {
    assertSameOrigin(request);
    await enforceRateLimit(getClientKey(request, "say-import-source"), { limit: 20, windowMs: 3600_000 });
    let input: { url?: string; file?: File; requestId: string };
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      assertContentLength(request, SAY_IMPORT_MAX_BYTES + 65536);
      const form = await request.formData(); const file = form.get("file");
      if (!(file instanceof File)) throw new AppError("SCENE_FILE_REQUIRED", "Choose a video file.", 422);
      input = { file, requestId: z.string().uuid().parse(form.get("requestId")) };
    } else {
      assertJsonRequest(request); assertContentLength(request, 4096);
      input = z.object({ url: z.string().trim().min(1).max(2048), requestId: z.string().uuid() }).parse(await request.json());
    }
    const viewer = await getSayViewer(request, input.requestId); cookie = viewer.setCookie;
    await claimSayImports(request, viewer);
    return jsonOk({ import: await createSayImport(input, viewer) }, requestId, { status: 202, headers: { "Cache-Control": "private, no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) } });
  } catch (error) { return jsonError(error, requestId, cookie ? { "Set-Cookie": cookie } : undefined); }
}
