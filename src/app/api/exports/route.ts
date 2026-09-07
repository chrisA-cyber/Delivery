import { z } from "zod";
import { jsonOk,jsonError,requestIdFrom } from "@/lib/server/api-error";
import { assertSameOrigin,assertJsonRequest,assertContentLength } from "@/lib/server/request";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSwitchViewer } from "@/lib/server/switch";
import { listVideoExports,requestVideoExport } from "@/lib/server/video-exports";
import { clipEditSettingsSchema } from "@/lib/video-composition";
import { CLIP_REQUEST_BYTES,readBoundedClipBody } from "@/lib/server/clip-editor";
export const runtime="nodejs"; export const dynamic="force-dynamic";
const source=z.object({mode:z.enum(["classic","switch","say-it-back"]),attemptId:z.string().uuid(),maxRating:z.enum(["everyone","teen","mature"]).default("everyone")});
const options=source.extend({includeName:z.boolean().default(true),includeScore:z.boolean().default(true),settings:clipEditSettingsSchema.optional()}).strict();
export async function POST(request:Request){const requestId=requestIdFrom(request);try{
  assertSameOrigin(request);assertJsonRequest(request);assertContentLength(request,CLIP_REQUEST_BYTES);
  const body=(await readBoundedClipBody(request,CLIP_REQUEST_BYTES)).toString("utf8");
  const input=options.parse(JSON.parse(body));const viewer=await getSwitchViewer(request);
  await enforceRateLimit(`video-export:${viewer.ownerKey}`,{limit:20,windowMs:60*60_000});
  return jsonOk(await requestVideoExport(input,viewer),requestId,{status:202,headers:{"Cache-Control":"private, no-store",...(viewer.setCookie?{"Set-Cookie":viewer.setCookie}:{})}});
}catch(error){return jsonError(error,requestId);}}
export async function GET(request:Request){const requestId=requestIdFrom(request);try{
  const input=source.parse(Object.fromEntries(new URL(request.url).searchParams));const viewer=await getSwitchViewer(request);
  return jsonOk(await listVideoExports(input.mode,input.attemptId,viewer,input.maxRating),requestId,{headers:{"Cache-Control":"private, no-store"}});
}catch(error){return jsonError(error,requestId);}}
