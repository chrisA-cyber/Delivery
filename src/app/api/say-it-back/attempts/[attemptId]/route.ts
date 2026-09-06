import { z } from "zod";
import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { deleteSayAttempt, getSayAttempt, getSayViewer } from "@/lib/server/say-it-back";
import { assertSameOrigin } from "@/lib/server/request";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ attemptId: string }> };
export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const { attemptId } = await context.params;
    const viewer = await getSayViewer(request);
    const token = new URL(request.url).searchParams.get("challengeToken") ?? undefined;
    return jsonOk({ attempt: await getSayAttempt(z.string().uuid().parse(attemptId), viewer, token) }, requestId, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return jsonError(error, requestId); }
}
export async function DELETE(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const { attemptId } = await context.params;
    await deleteSayAttempt(z.string().uuid().parse(attemptId), await getSayViewer(request));
    return jsonOk({ deleted: true }, requestId, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error, requestId); }
}
