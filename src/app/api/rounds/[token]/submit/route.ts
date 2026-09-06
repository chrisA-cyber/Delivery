import { handleGroupRoute } from "@/lib/server/group-round-routes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  return handleGroupRoute(request, "submit", (await context.params).token);
}
