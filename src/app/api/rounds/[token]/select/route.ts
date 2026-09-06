import { handleGroupRoute } from "@/lib/server/group-round-routes";
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  return handleGroupRoute(request, "select", (await context.params).token);
}
