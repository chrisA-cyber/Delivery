import { jsonError, requestIdFrom } from "@/lib/server/api-error";
import { getSwitchViewer } from "@/lib/server/switch";
import { clipSourceSchema, clipEditorAudioResponse } from "@/lib/server/clip-editor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const input = clipSourceSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return await clipEditorAudioResponse(input.mode, input.attemptId, input.maxRating, await getSwitchViewer(request), request);
  } catch (error) { return jsonError(error, requestId); }
}
