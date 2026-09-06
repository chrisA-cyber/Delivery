import { z } from "zod";
import { jsonError, requestIdFrom } from "@/lib/server/api-error";
import { getClassicExportAudioResponse, getClassicExportViewer } from "@/lib/server/classic-export-attempts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ attemptId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const { attemptId } = await context.params;
    return await getClassicExportAudioResponse(z.string().uuid().parse(attemptId), await getClassicExportViewer(request), request);
  } catch (error) { return jsonError(error, requestId, { "Cache-Control": "private, no-store" }); }
}
