import { handleRoastRoom } from "@/lib/server/roast-routes";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return handleRoastRoom(request,(await params).id,true);}
