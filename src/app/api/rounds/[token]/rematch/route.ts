import { handleGroupRoute } from "@/lib/server/group-round-routes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  return handleGroupRoute(request, "rematch", (await context.params).token);
}
