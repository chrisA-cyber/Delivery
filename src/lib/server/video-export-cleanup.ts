import "server-only";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {checkedExport} from "@/lib/server/video-export-sources";

export async function cleanupVideoExports(limit=100):Promise<{expired:number;objects:number}> {
 const admin=createSupabaseAdminClient();
 const expired=await admin.rpc("expire_video_exports",{p_limit:limit});checkedExport(expired.error);
 const jobs=await admin.from("cleanup_video_export_objects").select("*").lte("delete_after",new Date().toISOString()).order("delete_after").limit(limit);checkedExport(jobs.error);
 let objects=0;
 for(const row of jobs.data ?? []){
  const path=String(row.storage_path);
  if(!/^exports\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.mp4$/.test(path))continue;
  const removal=await admin.storage.from("delivery-exports").remove([path]);
  if(removal.error)continue;
  objects++;
  // Tombstones survive in-flight uploads; repeat removals until every old lease is long dead.
  if(new Date(String(row.retain_until)).getTime()<=Date.now()){
   const done=await admin.from("cleanup_video_export_objects").delete().eq("storage_path",path).eq("delete_after",String(row.delete_after));checkedExport(done.error);
  }else{
   const done=await admin.from("cleanup_video_export_objects").update({last_deleted_at:new Date().toISOString(),attempts:Number(row.attempts)+1,delete_after:new Date(Date.now()+10*60_000).toISOString()}).eq("storage_path",path).eq("delete_after",String(row.delete_after));checkedExport(done.error);
  }
 }
 return {expired:Number(expired.data ?? 0),objects};
}

export async function cleanupExpiredClassicVideoAttempts(limit=100):Promise<{deleted:number}>{
 const admin=createSupabaseAdminClient();
 const rows=await admin.from("classic_video_attempts").select("*").lte("expires_at",new Date().toISOString()).is("recording_deleted_at",null).limit(limit);checkedExport(rows.error);
 let deleted=0;
 for(const row of rows.data??[]){
  const path=String(row.recording_path);
  if(!/^guests\/[a-f0-9]{64}\/classic\/[a-f0-9-]{36}\.(wav|mp3)$/.test(path)||path.split("/")[1]!==row.guest_owner_hash)continue;
  const mark=await admin.from("classic_video_attempts").update({deleted_at:new Date().toISOString()}).eq("id",String(row.id));checkedExport(mark.error);
  const removal=await admin.storage.from("delivery-audio").remove([path]);checkedExport(removal.error);
  const completed=await admin.from("classic_video_attempts").update({recording_deleted_at:new Date().toISOString()}).eq("id",String(row.id));checkedExport(completed.error);deleted++;
 }
 return {deleted};
}

export async function deleteOwnerVideoExports(userId:string):Promise<void>{
 const admin=createSupabaseAdminClient();let afterId:string|null=null;
 for(;;){
  let query=admin.from("video_exports").select("id,storage_path").eq("user_id",userId).order("id").limit(100);
  if(afterId)query=query.gt("id",afterId);
  const page=await query;checkedExport(page.error);if(!page.data?.length)break;
  const paths=page.data.flatMap(row=>row.storage_path?[String(row.storage_path)]:[]);
  if(paths.some(path=>!/^exports\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.mp4$/.test(path)))throw new Error("Invalid video cleanup path");
  if(paths.length){const removal=await admin.storage.from("delivery-exports").remove(paths);checkedExport(removal.error);}
  afterId=String(page.data.at(-1)!.id);
 }
}
