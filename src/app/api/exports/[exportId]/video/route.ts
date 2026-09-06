import {z} from "zod";
import {jsonError,requestIdFrom} from "@/lib/server/api-error";
import {getSwitchViewer} from "@/lib/server/switch";
import {videoExportResponse} from "@/lib/server/video-exports";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{exportId:string}>}){try{
const id=z.string().uuid().parse((await context.params).exportId);return await videoExportResponse(id,await getSwitchViewer(request),request);
}catch(error){return jsonError(error,requestIdFrom(request));}}
