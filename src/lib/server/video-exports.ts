import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ContentRating } from "@/lib/content/types";
import type { SwitchViewer } from "@/lib/server/switch";
import { AppError } from "@/lib/server/api-error";
import { resolveExportSource, checkedExport, exportUnavailable, type ExportMode, type ExportInput } from "@/lib/server/video-export-sources";
import { VIDEO_LAYOUT_VERSION, defaultClipEditSettings, type ClipEditSettings } from "@/lib/video-composition";
import { validateClipSettings } from "@/lib/server/clip-editor";
export { VIDEO_LAYOUT_VERSION } from "@/lib/video-composition";
export const VIDEO_EXPORT_BUCKET = "delivery-exports";
type Row = Record<string, unknown>;
export function presentVideoExport(row: Row) {
  const expired = new Date(String(row.expires_at)).getTime() <= Date.now();
  const status = expired ? "expired" : String(row.state);
  const snapshot = row.input as Partial<ExportInput> | undefined;
  return {id:String(row.id),status,layoutVersion:String(row.layout_version ?? ""),includeScore:row.include_score === true,includeName:row.include_name === true,settings:snapshot?.settings ?? null,displayName:snapshot?.displayName ?? null,score:snapshot?.score ?? null,
    assignmentUrl:(row.input as {invitationUrl?:string})?.invitationUrl ?? null,createdAt:row.created_at,expiresAt:row.expires_at,filename:`delivery-${row.mode}-${String(row.id).slice(0,8)}.mp4`,
    videoUrl:status === "ready" ? `/api/exports/${row.id}/video` : null,
    errorMessage:status === "failed" ? "We couldn’t finish this video. Your original take and score are safe. Try again." : status === "cancelled" ? "This video is no longer available. Create a new video from an available take." : status === "expired" ? "This download expired. Create it again from your saved take." : null};
}
export async function requestVideoExport(input:{mode:ExportMode;attemptId:string;includeName:boolean;includeScore:boolean;maxRating:ContentRating;settings?:ClipEditSettings},viewer:SwitchViewer) {
  const selected = input.settings ?? {...defaultClipEditSettings(input.mode),includeName:input.includeName,includeScore:input.includeScore};
  const source = await resolveExportSource(input.mode,input.attemptId,viewer,input.maxRating,{includeName:selected.includeName,includeScore:selected.includeScore,invitation:true});
  const settings = await validateClipSettings(selected,source);
  source.input.settings = settings;
  const hash = createHash("sha256").update(JSON.stringify({layout:VIDEO_LAYOUT_VERSION,input:source.input,includeScore:settings.includeScore,includeName:settings.includeName})).digest("hex");
  const result = await createSupabaseAdminClient().rpc("request_video_export",{p_source_kind:source.kind,p_attempt_id:input.attemptId,p_owner_key:source.ownerKey,p_user_id:source.userId,p_mode:input.mode,p_input:source.input,p_input_hash:hash,p_layout_version:VIDEO_LAYOUT_VERSION,p_include_score:settings.includeScore,p_include_name:settings.includeName});
  if(result.error){
    const code=String(result.error.message ?? "");
    if(code.includes("EXPORT_QUEUE_FULL"))throw new AppError("EXPORT_QUEUE_FULL","You already have three videos waiting. Let one finish before creating another.",429);
    if(code.includes("EXPORT_SOURCE_UNAVAILABLE"))throw exportUnavailable();
    if(code.includes("EXPORT_INPUT_CONFLICT"))throw new AppError("EXPORT_INPUT_CONFLICT","This take changed. Reopen it before creating a video.",409);
    checkedExport(result.error);
  }
  const row = result.data as Row | null; if (!row) throw exportUnavailable();
  return {export:presentVideoExport(row),replayed:String(row.state) !== "queued" || Number(row.attempts)>0};
}
export async function listVideoExports(mode:ExportMode,attemptId:string,viewer:SwitchViewer,maxRating:ContentRating) {
  try { await resolveExportSource(mode,attemptId,viewer,maxRating); }
  catch(error) { if(error instanceof AppError && ["SCENE_EXPORT_UNAVAILABLE","MATURE_PUBLICATION_UNAVAILABLE","CONTENT_OPT_IN_REQUIRED"].includes(error.code)) return {exports:[],eligible:false,reason:error.message}; throw error; }
  const result = await createSupabaseAdminClient().from("video_exports").select("*").eq("mode",mode).eq("attempt_id",attemptId).eq("owner_key",viewer.ownerKey).order("created_at",{ascending:false}).limit(16); checkedExport(result.error);
  return {exports:(result.data ?? []).map(presentVideoExport),eligible:true};
}
export async function getVideoExportRow(id:string,viewer:SwitchViewer):Promise<Row> {
  const result = await createSupabaseAdminClient().from("video_exports").select("*").eq("id",id).eq("owner_key",viewer.ownerKey).maybeSingle(); checkedExport(result.error);
  const row=result.data; if(!row)throw exportUnavailable();
  // Ownership and moderation are rechecked for every status and every byte-range request.
  await resolveExportSource(row.mode as ExportMode,String(row.attempt_id),viewer,"mature");
  return row;
}
export async function videoExportResponse(id:string,viewer:SwitchViewer,request:Request):Promise<Response> {
  const row=await getVideoExportRow(id,viewer);
  if(row.state!=="ready" || new Date(String(row.expires_at)).getTime()<=Date.now())throw new AppError("EXPORT_NOT_READY","This video is still rendering or its download has expired.",409);
  const storagePath=String(row.storage_path);
  if(!new RegExp(`^exports/${row.id}/[a-f0-9-]{36}\\.mp4$`).test(storagePath))throw exportUnavailable();
  const signed=await createSupabaseAdminClient().storage.from(VIDEO_EXPORT_BUCKET).createSignedUrl(storagePath,60);checkedExport(signed.error);if(!signed.data?.signedUrl)throw exportUnavailable();
  const range=request.headers.get("range");if(range&&!/^bytes=\d*-\d*$/.test(range))throw new AppError("INVALID_RANGE","Choose a valid playback position.",416);
  const upstream=await fetch(signed.data.signedUrl,{cache:"no-store",headers:range?{Range:range}:undefined,signal:AbortSignal.timeout(30000)});
  if(upstream.status===404){
    await createSupabaseAdminClient().from("video_exports").update({state:"failed",failure_code:"OUTPUT_MISSING"}).eq("id",id).eq("state","ready");
    throw new AppError("EXPORT_FILE_MISSING","This video file expired. Create it again from your saved take.",409);
  }
  if(!upstream.ok && upstream.status!==206)throw exportUnavailable();
  const download=new URL(request.url).searchParams.get("download")==="1";
  const headers=new Headers({"Content-Type":"video/mp4","Cache-Control":"private, no-store","Accept-Ranges":"bytes","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Content-Disposition":`${download?"attachment":"inline"}; filename="${presentVideoExport(row).filename}"`});
  for(const key of ["content-length","content-range"]){const val=upstream.headers.get(key);if(val)headers.set(key,val);}
  return new Response(upstream.body,{status:upstream.status,headers});
}
