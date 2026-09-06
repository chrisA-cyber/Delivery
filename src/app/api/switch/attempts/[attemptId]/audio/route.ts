import { z } from "zod";
import { jsonError, requestIdFrom } from "@/lib/server/api-error";
import { getSwitchAudioResponse, getSwitchViewer } from "@/lib/server/switch";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ attemptId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const { attemptId } = await context.params;
    const token = new URL(request.url).searchParams.get("challengeToken") ?? undefined;
    return await getSwitchAudioResponse(z.string().uuid().parse(attemptId), await getSwitchViewer(request), request, token);
  } catch (error) { return jsonError(error, requestId, { "Cache-Control": "private, no-store" }); }
}
