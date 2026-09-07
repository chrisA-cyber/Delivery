import { jsonError, requestIdFrom } from "@/lib/server/api-error";
import { getSayImportMedia } from "@/lib/server/say-imports";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ importId: string; asset: string }> }) {
  try { const { importId, asset } = await context.params; return await getSayImportMedia(importId, asset, request); }
  catch (error) { return jsonError(error, requestIdFrom(request)); }
}
