import { handleGroupRoute } from "@/lib/server/group-round-routes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) { return handleGroupRoute(request, "create"); }
