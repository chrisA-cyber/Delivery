/** One bounded media worker beside Next in the existing Railway service. No AI providers. */
import {mkdtemp,readFile,writeFile,rm,stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {createHash} from "node:crypto";
import {createSupabaseAdminClient} from "../src/lib/supabase/admin";
import {renderPerformanceVideo,type VideoRenderInput} from "../src/lib/server/video-renderer";
import {assertExportAccount,assertSceneExportEligible,checkedExport,type ExportInput} from "../src/lib/server/video-export-sources";
import {cleanupVideoExports,cleanupExpiredClassicVideoAttempts} from "../src/lib/server/video-export-cleanup";

type Row=Record<string,unknown>;
const admin=createSupabaseAdminClient();
let stopping=false;
let current:AbortController|null=null;
process.on("SIGTERM",()=>{stopping=true;current?.abort();});
process.on("SIGINT",()=>{stopping=true;current?.abort();});

async function download(bucket:string,key:string,file:string,max:number,signal:AbortSignal){
 const signed=await admin.storage.from(bucket).createSignedUrl(key,60);checkedExport(signed.error);
 if(!signed.data?.signedUrl)throw new Error("MEDIA_UNAVAILABLE");
 const response=await fetch(signed.data.signedUrl,{signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
 if(!response.ok||Number(response.headers.get("content-length"))>max||!response.body)throw new Error("MEDIA_UNAVAILABLE");
 const reader=response.body.getReader();const parts:Uint8Array[]=[];let size=0;
 for(;;){const result=await reader.read();if(result.done)break;size+=result.value.length;if(size>max){await reader.cancel();throw new Error("MEDIA_LIMIT");}parts.push(result.value);}
 const bytes=Buffer.concat(parts);await writeFile(file,bytes);return bytes;
}
async function asset(url:string,integrity:Record<string,string>|undefined){
 if(!/^\/media\/say-it-back\/[a-z0-9-]+\/v[0-9]+-[a-f0-9]{12}\/[a-zA-Z0-9._-]+$/.test(url))throw new Error("SCENE_ASSET_UNAVAILABLE");
 const file=path.join(process.cwd(),"public",url);const info=await stat(file);if(info.size>100*1024*1024)throw new Error("MEDIA_LIMIT");
 const expected=integrity?.[url] ?? integrity?.[url.split("/").pop()!];
 if(expected){const hash=createHash("sha256").update(await readFile(file)).digest("hex");if(hash!==expected)throw new Error("SCENE_ASSET_CHANGED");}
 return file;
}
async function run(job:Row){
 const controller=new AbortController();current=controller;
 const token=String(job.lease_token),id=String(job.id);let scratch:string|undefined;let uploaded=false;
 const timeout=setTimeout(()=>controller.abort(),300_000);
 const heartbeat=setInterval(()=>{void admin.rpc("renew_video_export_lease",{p_export_id:id,p_lease_token:token,p_lease_seconds:180}).then(({data,error})=>{if(error||data!==true)controller.abort();});},30_000);
 const started=performance.now();
 try{
  const input=job.input as unknown as ExportInput;
  await assertExportAccount(job.user_id?String(job.user_id):null);assertSceneExportEligible(input.assignment);
  scratch=await mkdtemp(path.join(tmpdir(),"delivery-video-"));
  const recording=path.join(scratch,"recording");
  const bytes=await download("delivery-audio",input.recordingPath,recording,15*1024*1024,controller.signal);
  if(input.audioHash&&createHash("sha256").update(bytes).digest("hex")!==input.audioHash)throw new Error("SOURCE_CHANGED");
  let avatar:string|undefined;
  if(input.avatarPath){try{avatar=path.join(scratch,"avatar");await download("avatars",input.avatarPath,avatar,5*1024*1024,controller.signal);}catch{avatar=undefined;}}
  const assignment=input.assignment;
  let say;
  if(assignment.mode==="say-it-back"){
   const available=await admin.from("say_clip_versions").select("enabled").eq("id",`${assignment.clip.id}:${assignment.clip.version}`).maybeSingle();checkedExport(available.error);if(!available.data?.enabled)throw new Error("SCENE_UNAVAILABLE");
   const role=assignment.clip.roles.find(r=>r.id===assignment.roleId);if(!role)throw new Error("ROLE_UNAVAILABLE");
   say={clip:assignment.clip,roleId:assignment.roleId,videoPath:await asset(assignment.clip.videoUrl,assignment.clip.assetIntegrity),backingPath:role.dubAudioUrl?await asset(role.dubAudioUrl,assignment.clip.assetIntegrity):null};
  }
  const rendered=await renderPerformanceVideo({layoutVersion:"delivery-vertical-v1",mode:assignment.mode,recordingPath:recording,outputPath:path.join(scratch,"finished.mp4"),durationMs:input.durationMs,recordingOffsetMs:input.recordingOffsetMs,invitationUrl:input.invitationUrl,displayName:input.displayName,avatarPath:avatar,score:input.score,...(assignment.mode==="classic"?{classic:{phrase:assignment.promptText,direction:assignment.energy}}:{}),...(assignment.mode==="switch"?{switch:assignment.challenge}:{}),...(say?{say}:{})} as VideoRenderInput,{signal:controller.signal});
  if(controller.signal.aborted)throw new Error("LEASE_LOST");
  const owned=await admin.rpc("renew_video_export_lease",{p_export_id:id,p_lease_token:token,p_lease_seconds:180});checkedExport(owned.error);if(!owned.data)throw new Error("LEASE_LOST");
  const output=await readFile(rendered.path);if(output.length>60*1024*1024)throw new Error("OUTPUT_LIMIT");
  const upload=await admin.storage.from("delivery-exports").upload(String(job.storage_path),output,{contentType:"video/mp4",cacheControl:"0",upsert:false});checkedExport(upload.error);uploaded=true;
  const publish=await admin.rpc("publish_video_export",{p_export_id:id,p_lease_token:token,p_bytes:output.length,p_duration_ms:Math.round(rendered.duration*1000)});checkedExport(publish.error);
  if(publish.data!==true)throw new Error("SOURCE_UNAVAILABLE");
  console.log(JSON.stringify({event:"video_export_ready",id,mode:assignment.mode,renderMs:rendered.renderMs,totalMs:Math.round(performance.now()-started),bytes:output.length,workerRssMiB:Math.round(process.memoryUsage().rss/1048576)}));
 }catch(error){
  if(uploaded)await admin.storage.from("delivery-exports").remove([String(job.storage_path)]);
  const code=controller.signal.aborted?"RENDER_INTERRUPTED":"RENDER_FAILED";
  await admin.rpc("fail_video_export",{p_export_id:id,p_lease_token:token,p_failure_code:code});
  console.error(JSON.stringify({event:"video_export_failed",id,code,errorName:error instanceof Error?error.name:"unknown",totalMs:Math.round(performance.now()-started)}));
 }finally{clearTimeout(timeout);clearInterval(heartbeat);current=null;if(scratch)await rm(scratch,{recursive:true,force:true});}
}
async function main(){
let cleanupAt=0;
console.log("Delivery video worker ready (one render, two FFmpeg threads, no AI calls).");
while(!stopping){
 try{
  if(Date.now()>cleanupAt){await cleanupVideoExports(30);await cleanupExpiredClassicVideoAttempts(30);cleanupAt=Date.now()+60_000;}
  const claim=await admin.rpc("claim_video_export",{p_lease_seconds:180});checkedExport(claim.error);
  if(claim.data){await run(claim.data as Row);continue;}
 }catch(error){console.error(JSON.stringify({event:"video_worker_retry",errorName:error instanceof Error?error.name:"unknown"}));}
 await new Promise(resolve=>setTimeout(resolve,5000));
}

}
void main().catch(()=>{console.error("Video worker could not start.");process.exitCode=1;});
