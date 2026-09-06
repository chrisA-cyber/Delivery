import { z } from "zod";
import { jsonError, requestIdFrom } from "@/lib/server/api-error";
import { groupHeaders, groupRatingSchema, groupTokenSchema } from "@/lib/server/group-round-routes";
import { getGroupViewer, groupAudioResponse } from "@/lib/server/group-rounds";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ token: string; memberId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const params = await context.params;
    const token = groupTokenSchema.parse(params.token); const id = z.string().uuid().parse(params.memberId);
    const maxRating = groupRatingSchema.parse(new URL(request.url).searchParams.get("maxRating") ?? "everyone");
    return await groupAudioResponse(token, await getGroupViewer(request), request, { memberId: id }, maxRating);
  } catch (error) { return jsonError(error, requestId, groupHeaders()); }
}
