import { z } from "zod";
import { jsonError, requestIdFrom } from "@/lib/server/api-error";
import { getSayAudioResponse, getSayViewer } from "@/lib/server/say-it-back";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ attemptId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const { attemptId } = await context.params;
    const token = new URL(request.url).searchParams.get("challengeToken") ?? undefined;
    return await getSayAudioResponse(z.string().uuid().parse(attemptId), await getSayViewer(request), request, token);
  } catch (error) { return jsonError(error, requestId, { "Cache-Control": "private, no-store" }); }
}
