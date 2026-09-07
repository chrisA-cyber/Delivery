import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { assertSameOrigin } from "@/lib/server/request";
import { getSayViewer } from "@/lib/server/say-it-back";
import { claimSayImports, deleteSayImport, loadSayImport, presentSayImport } from "@/lib/server/say-imports";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ importId: string }> };
export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try { const viewer = await getSayViewer(request); await claimSayImports(request, viewer); return jsonOk({ import: await presentSayImport(await loadSayImport((await context.params).importId, viewer)) }, requestId, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return jsonError(error, requestId); }
}
export async function DELETE(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try { assertSameOrigin(request); await deleteSayImport((await context.params).importId, await getSayViewer(request)); return jsonOk({ deleted: true }, requestId); }
  catch (error) { return jsonError(error, requestId); }
}
