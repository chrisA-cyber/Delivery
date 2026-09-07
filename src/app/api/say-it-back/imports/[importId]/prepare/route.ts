import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";
import { getSayViewer } from "@/lib/server/say-it-back";
import { prepareSayImport } from "@/lib/server/say-imports";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ importId: string }> }) {
  const requestId = requestIdFrom(request);
  try { assertSameOrigin(request); assertJsonRequest(request); assertContentLength(request, 4096);
    return jsonOk({ import: await prepareSayImport((await context.params).importId, await request.json(), await getSayViewer(request)) }, requestId, { status: 202 }); }
  catch (error) { return jsonError(error, requestId); }
}
