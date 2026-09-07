import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";
import { getSayViewer } from "@/lib/server/say-it-back";
import { publishSayImport } from "@/lib/server/say-imports";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(request: Request, context: { params: Promise<{ importId: string }> }) {
  const requestId = requestIdFrom(request);
  try { assertSameOrigin(request); assertJsonRequest(request); assertContentLength(request, 65536);
    return jsonOk({ clip: await publishSayImport((await context.params).importId, await request.json(), await getSayViewer(request)) }, requestId); }
  catch (error) { return jsonError(error, requestId); }
}
