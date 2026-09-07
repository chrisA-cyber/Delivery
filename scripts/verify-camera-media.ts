/** Render actual browser MediaRecorder files captured with simulated inputs.
 * CAMERA_SAMPLE_DIR=/tmp/delivery-camera-media node --conditions=react-server --import tsx scripts/verify-camera-media.ts
 * Inputs: classic/switch/say-camera.webm and their original -audio.wav files.
 * No device, speech service, score, or public sharing is used by this check.
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { renderPerformanceVideo, VIDEO_LAYOUT_VERSION, type VideoRenderInput } from '../src/lib/server/video-renderer';
import { defaultCameraSettings } from '../src/lib/video-composition';
import { sliceCamera, type CameraSegment } from '../src/lib/camera';
import { composeLineTakes, readPcmWav } from '../src/lib/say-it-back/audio-timeline';
import { SWITCH_CHALLENGES } from '../src/lib/switch/catalog';
import catalog from '../src/lib/say-it-back/catalog.json';
import type { SayClip } from '../src/lib/say-it-back/types';
async function main(){
const dir=resolve(process.env.CAMERA_SAMPLE_DIR || '/tmp/delivery-camera-media');
const file=(s:string)=>join(dir,s);
const ffmpeg=(args:string[])=>execFileSync('ffmpeg',['-v','error','-y',...args],{timeout:60000,stdio:'pipe'});
const clip=catalog.find(c=>c.id==='hgf-perfect-fiance') as unknown as SayClip;
const offsets={classic:.05588004535296932,switch:.03868004534998909,say:.0437800453514792};
const cam=(mode:keyof typeof offsets,duration:number):CameraSegment[]=>[{start:0,end:duration,sourceStart:offsets[mode],mirror:true,path:file(`${mode}-camera.webm`)}];
const baseBlob=new Blob([await readFile(file('say-audio.wav'))],{type:'audio/wav'});
const replacement=new Blob([await readFile(file('classic-audio.wav'))],{type:'audio/wav'});
const windows=clip.cues.map((cue,i,cues)=>({cue,start:i?(cues[i-1]!.end+cue.start)/2:0,end:i===cues.length-1?clip.duration:(cue.end+cues[i+1]!.start)/2}));
const originalLines=windows.map(w=>({blob:baseBlob,sceneStart:w.start,sceneEnd:w.end,recordingOffsetMs:w.start*1000}));
const before=await composeLineTakes(originalLines,clip.duration);
const retaken=await composeLineTakes(originalLines.map((line,i)=>i===1?{...line,blob:replacement,recordingOffsetMs:0}:line),clip.duration);
const a=readPcmWav(await before.blob.arrayBuffer())!,b=readPcmWav(await retaken.blob.arrayBuffer())!;
let outside=0,inside=0;for(let i=0;i<a.samples.length;i++)if(a.samples[i]!==b.samples[i]){if(i/a.sampleRate<windows[1]!.start||i/a.sampleRate>=windows[1]!.end)outside++;else inside++;}
assert.equal(outside,0);assert.ok(inside>0);
await writeFile(file('say-retake.wav'),Buffer.from(await retaken.blob.arrayBuffer()));
ffmpeg(['-i',file('classic-camera.webm'),'-c:v','libx264','-threads','2','-c:a','aac',file('classic-camera.mp4')]);
ffmpeg(['-display_rotation:v:0','90','-i',file('classic-camera.mp4'),'-c','copy',file('rotated-camera.mp4')]);
const sayCamera=windows.flatMap((w,i)=>i===1?[{start:w.start,end:w.end,sourceStart:offsets.classic,mirror:false,path:file('rotated-camera.mp4')}]:sliceCamera(cam('say',clip.duration),w.start,w.end));
const common={layoutVersion:VIDEO_LAYOUT_VERSION,recordingOffsetMs:0,invitationUrl:'',score:null};
const classic={...common,mode:'classic' as const,recordingPath:file('classic-audio.wav'),outputPath:file('classic.mp4'),durationMs:5000,classic:{phrase:'I would like to speak to the manager of this entire situation.',direction:'Like you just discovered a conspiracy'},camera:cam('classic',5),settings:{...defaultCameraSettings('classic'),trimStart:.4,trimEnd:4.6,cameraZoom:1.25,cameraCropX:.2}};
const inputs:VideoRenderInput[]=[classic,{...common,mode:'switch',switch:SWITCH_CHALLENGES.find(c=>c.id==='not-my-problem')!,durationMs:20000,recordingPath:file('switch-audio.wav'),outputPath:file('switch.mp4'),camera:cam('switch',20),settings:{...defaultCameraSettings('switch'),cameraZoom:1.05,cameraCropY:.51,cameraMirror:false,avatarSize:.58,trimStart:4.15,trimEnd:12.3}},{...common,mode:'say-it-back',durationMs:14700,recordingPath:file('say-retake.wav'),outputPath:file('say-it-back.mp4'),camera:sayCamera,say:{clip,roleId:'walter',videoPath:resolve('public',`.${clip.videoUrl}`),backingPath:resolve('public',`.${clip.roles[0]!.dubAudioUrl}`)},settings:{...defaultCameraSettings('say-it-back'),trimStart:2.4,trimEnd:12.8}},{...classic,outputPath:file('classic-avatar.mp4'),settings:{...classic.settings!,performer:'avatar'}}];
await writeFile(file('inputs.json'),JSON.stringify(inputs,null,2));
const results=[];for(const input of inputs){const result=await renderPerformanceVideo(input);ffmpeg(['-i',result.path,'-f','null','-']);results.push({mode:input.mode,performer:input.settings!.performer,...result});console.log(input.mode,input.settings!.performer,result.renderMs+'ms');}
await mkdir('docs/evidence/camera',{recursive:true});await writeFile('docs/evidence/camera/render-results.json',JSON.stringify({simulatedCapture:true,physicalDevice:false,retake:{outsideChangedSamples:outside,replacementChangedSamples:inside},results},null,2)+'\n');

}
void main().catch(error=>{console.error(error);process.exitCode=1;});
