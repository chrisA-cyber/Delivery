import { handleGroupRoute } from "@/lib/server/group-round-routes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  return handleGroupRoute(request, "read", (await context.params).token);
}
