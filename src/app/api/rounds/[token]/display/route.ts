import { handleGroupRoute } from "@/lib/server/group-round-routes";
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  return handleGroupRoute(request, "display", (await context.params).token);
}
