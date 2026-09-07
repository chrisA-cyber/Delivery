import { handleRoastRoom } from "@/lib/server/roast-routes";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = {params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){return handleRoastRoom(request,(await params).id);}
export async function POST(request:Request,{params}:Context){return handleRoastRoom(request,(await params).id);}
