import {z} from "zod";
import {jsonOk,jsonError,requestIdFrom} from "@/lib/server/api-error";
import {getSwitchViewer} from "@/lib/server/switch";
import {getVideoExportRow,presentVideoExport} from "@/lib/server/video-exports";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{exportId:string}>}){const requestId=requestIdFrom(request);try{
const id=z.string().uuid().parse((await context.params).exportId);const viewer=await getSwitchViewer(request);
return jsonOk({export:presentVideoExport(await getVideoExportRow(id,viewer))},requestId,{headers:{"Cache-Control":"private, no-store"}});
}catch(error){return jsonError(error,requestId);}}
