import { z } from "zod";
import { jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { deleteClassicExportAttempt, getClassicExportAttempt, getClassicExportViewer } from "@/lib/server/classic-export-attempts";
import { assertSameOrigin } from "@/lib/server/request";
import { assertContentRating } from "@/lib/server/content";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ attemptId: string }> };
export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const { attemptId } = await context.params;
    const attempt = await getClassicExportAttempt(z.string().uuid().parse(attemptId), await getClassicExportViewer(request));
    const maxRating = z.enum(["everyone", "teen", "mature"]).parse(new URL(request.url).searchParams.get("maxRating") ?? "everyone");
    assertContentRating(attempt.assignment.rating, maxRating);
    return jsonOk({ attempt }, requestId, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return jsonError(error, requestId, { "Cache-Control": "private, no-store" }); }
}
export async function DELETE(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const { attemptId } = await context.params;
    await deleteClassicExportAttempt(z.string().uuid().parse(attemptId), await getClassicExportViewer(request));
    return jsonOk({ deleted: true }, requestId, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error, requestId, { "Cache-Control": "private, no-store" }); }
}
