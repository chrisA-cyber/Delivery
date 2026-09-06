import { z } from "zod";
import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { deleteSwitchAttempt, getSwitchAttempt, getSwitchViewer } from "@/lib/server/switch";
import { assertSameOrigin } from "@/lib/server/request";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ attemptId: string }> };
export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const { attemptId } = await context.params;
    const viewer = await getSwitchViewer(request);
    const token = new URL(request.url).searchParams.get("challengeToken") ?? undefined;
    return jsonOk({ attempt: await getSwitchAttempt(z.string().uuid().parse(attemptId), viewer, token) }, requestId, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return jsonError(error, requestId); }
}
export async function DELETE(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const { attemptId } = await context.params;
    await deleteSwitchAttempt(z.string().uuid().parse(attemptId), await getSwitchViewer(request));
    return jsonOk({ deleted: true }, requestId, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error, requestId); }
}
