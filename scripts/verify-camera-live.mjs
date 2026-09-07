/** Focused live camera release verification; disposable simulated recordings, no judge or public shares.
 * CAMERA_VERIFY_ORIGIN=https://... node scripts/verify-camera-live.mjs --revision SHA
 * Resume with the same revision; --cleanup deletes only this check's original takes.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const origin = process.env.CAMERA_VERIFY_ORIGIN || 'https://delivery-production-0577.up.railway.app';
const dir = process.env.CAMERA_VERIFY_DIR || '/tmp/delivery-camera-live';
const fixtureDir = process.env.CAMERA_SAMPLE_DIR || '/tmp/delivery-camera-media';
const args = process.argv.slice(2);
const revision = args[args.indexOf('--revision') + 1];
assert.match(revision || '', /^[a-f0-9]{7,40}$/);
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const checkpoint = path.join(dir, 'checkpoint.json');
const state = fs.existsSync(checkpoint) ? JSON.parse(fs.readFileSync(checkpoint, 'utf8')) : { origin, revision, createdAt: new Date().toISOString(), saved: {}, checks: [], samples: [], calls: 0 };
assert.equal(state.origin, origin);
assert.equal(state.revision, revision, "Use a fresh CAMERA_VERIFY_DIR for a different deployed revision");
const persist = () => fs.writeFileSync(checkpoint, JSON.stringify(state), { mode: 0o600 });
const check = (label, value) => { assert.ok(value, label); if (!state.checks.includes(label)) state.checks.push(label); persist(); };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const probe = (file) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], { encoding: 'utf8' }));
function call(key, route, options = {}) {
  if (!options.fresh && state.saved[key]) return state.saved[key];
  assert.ok(route.startsWith('/') && !/judge|transcri|moderation|speech/.test(route));
  assert.ok(state.calls++ < 120, 'Focused request limit');
  const actor = options.outsider ? 'outsider' : 'performer';
  const jar = path.join(dir, actor + '.cookies');
  if (!fs.existsSync(jar)) fs.writeFileSync(jar, '', { mode: 0o600 });
  const output = options.file || path.join(dir, 'response.json');
  const cmd = ['-sS', '--max-time', '120', '-b', jar, '-c', jar, '-H', `Origin: ${origin}`, '-o', output, '-w', '%{http_code}', '-X', options.method || (options.body || options.form ? 'POST' : 'GET')];
  if (options.body) cmd.push('-H', 'Content-Type: application/json', '--data-binary', JSON.stringify(options.body));
  if (options.form) for (const [key, value] of Object.entries(options.form)) cmd.push('--form-string', `${key}=${value}`);
  if (options.audio) cmd.push('-F', `audio=@${options.audio};type=audio/wav;filename=sample.wav`);
  if (options.files) for (const [key,file] of Object.entries(options.files)) cmd.push('-F', `${key}=@${file};type=video/${file.endsWith('mp4')?'mp4':'webm'}`);
  if (options.image) cmd.push('-F', `image=@${options.image};type=image/png;filename=sample.png`);
  cmd.push(origin + route);
  const status = Number(execFileSync('curl', cmd, { encoding: 'utf8' }));
  const body = options.file ? null : JSON.parse(fs.readFileSync(output, 'utf8'));
  console.log(`${state.calls}. ${key}: ${status}`);
  assert.ok((options.expect || [200, 201, 202]).includes(status), `${key}: ${status} ${body?.error?.code || ''}`);
  const result = options.file ? { file: output, hash: sha(fs.readFileSync(output)) } : body.data ?? body;
  if (!options.fresh) state.saved[key] = result;
  persist(); return result;
}
async function ready(key, job) {
  if (state.saved[key + ':ready']) return state.saved[key + ':ready'];
  const start = Date.now(); let current = job;
  while (current.status !== 'ready' && Date.now() - start < 360000) {
    assert.ok(['queued', 'rendering'].includes(current.status), `${key}: render ${current.status}`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    current = call(key + ':progress', `/api/exports/${job.id}`, { fresh: true }).export;
  }
  check(key + ': ready', current.status === 'ready');
  state.saved[key + ':ready'] = current; persist(); return current;
}
function cleanup() {
  for (const mode of ['classic', 'switch', 'say-it-back']) {
    const take = state.saved[mode + ':upload']?.attempt;
    if (take) call(mode + ':cleanup', `/api/${mode}/attempts/${take.id}`, { method: 'DELETE' });
  }
  state.cleanedAt = new Date().toISOString(); persist();
}

try {
 if(args.includes('--cleanup')) cleanup(); else {
 const inputs=JSON.parse(fs.readFileSync(path.join(fixtureDir,'inputs.json'),'utf8'));
 const prompt=call('classic:assignment','/api/prompts/random?maxRating=everyone&seed=camera-release');
 const catalog=call('switch:catalog','/api/switch/catalog?maxRating=everyone');
 for(const input of inputs.filter(i=>i.settings.performer==='camera')) {
  const mode=input.mode;
  const form=mode==='classic'?{promptId:prompt.prompt.id,promptText:prompt.prompt.line,energy:prompt.energy.instruction,category:prompt.prompt.category,mode:'classic',displayName:'Camera check'}:mode==='switch'?{challengeId:input.switch.id,challengeVersion:catalog.challenges.find(c=>c.id===input.switch.id).version,recordingOffsetMs:'0',shareAudio:'false'}:{clipId:input.say.clip.id,clipVersion:input.say.clip.version,roleId:'walter',recordingOffsetMs:'0',shareAudio:'false'};
  const attempt=call(mode+':upload',`/api/${mode}/attempts`,{form:{...form,attemptId:randomUUID(),durationMs:String(input.durationMs),maxRating:'everyone'},audio:input.recordingPath}).attempt;
  const files={};const paths=[];
  const segments=input.camera.map(s=>{const file=mode==='classic'?path.join(fixtureDir,'classic-camera.mp4'):s.path;let index=paths.indexOf(file);if(index<0){index=paths.length;paths.push(file);files['file'+index]=file;}return {start:s.start,end:s.end,sourceStart:s.sourceStart,mirror:s.mirror,file:index};});
  const cameraForm={mode,attemptId:attempt.id,maxRating:'everyone',manifest:JSON.stringify({version:1,segments})};
  call(mode+':camera','/api/recordings/camera',{form:cameraForm,files});
  call(mode+':retry-camera','/api/recordings/camera',{form:cameraForm,files});check(mode+': idempotent camera upload',true);
  call(mode+':outsider-camera','/api/recordings/camera',{form:cameraForm,files,outsider:true,expect:[404]});
  const query=`mode=${mode}&attemptId=${attempt.id}&maxRating=everyone`;
  const editor=call(mode+':editor',`/api/exports/editor?${query}`);
  check(mode+': camera default and assembled segments',editor.settings.performer==='camera'&&editor.source.camera.length===segments.length);
  const original=call(mode+':original',editor.source.recordingUrl,{file:path.join(dir,mode+'-original.wav')});check(mode+': original WAV unchanged',original.hash===sha(fs.readFileSync(input.recordingPath)));
  const cameraUrl=editor.source.camera[0].url;
  call(mode+':outsider-replay',cameraUrl,{outsider:true,expect:[404]});
  const raw=call(mode+':camera-replay',cameraUrl,{file:path.join(dir,mode+'-camera-original')});check(mode+': authorized camera bytes unchanged',raw.hash===sha(fs.readFileSync(paths[0])));
  const settings={...input.settings,includeName:false,includeScore:false};
  const body={mode,attemptId:attempt.id,maxRating:'everyone',settings};
  call(mode+':save','/api/exports/editor',{method:'PUT',body});
  assert.deepEqual(call(mode+':reopen',`/api/exports/editor?${query}`).settings,settings);check(mode+': framing trim and orientation reopen',true);
  const job=call(mode+':export','/api/exports',{body}).export;await ready(mode,job);
  const file=path.join(dir,mode+'.mp4');call(mode+':download',`/api/exports/${job.id}/video?download=1`,{file});
  const info=probe(file),v=info.streams.find(s=>s.codec_type==='video'),a=info.streams.find(s=>s.codec_type==='audio');
  check(mode+': downloadable 1080x1920 H264/AAC with exact trim',v.width===1080&&v.height===1920&&v.codec_name==='h264'&&a.codec_name==='aac'&&Math.abs(Number(info.format.duration)-(settings.trimEnd-settings.trimStart))<.15);
  execFileSync('ffmpeg',['-v','error','-i',file,'-f','null','-'],{timeout:60000,stdio:'pipe'});check(mode+': full decoded playback',true);
  const unchanged=call(mode+':unchanged',`/api/${mode}/attempts/${attempt.id}?maxRating=everyone`).attempt;check(mode+': scoring input untouched',unchanged.score===null&&unchanged.durationMs===attempt.durationMs);
  if(mode==='classic') {const avatar=call(mode+':avatar-export','/api/exports',{body:{...body,settings:{...settings,performer:'avatar'}}}).export;await ready(mode+':avatar',avatar);check('Camera take can export its avatar',avatar.id!==job.id);}
  if(!state.samples.some(s=>s.mode===mode))state.samples.push({mode,exportId:job.id,duration:Number(info.format.duration),width:v.width,height:v.height,cameraParts:segments.length});persist();
 }
 state.passedAt=new Date().toISOString();persist();
 }
} finally {
 fs.mkdirSync('docs/evidence/camera',{recursive:true});fs.writeFileSync('docs/evidence/camera/live-checks.json',JSON.stringify({origin,revision,passed:!!state.passedAt,checks:state.checks,samples:state.samples,paidCalls:0,simulatedCapture:true,physicalPhoneChecked:false,nativeSharingChecked:false,cleanedAt:state.cleanedAt||null},null,2)+'\n');
}
