/** Focused, resumable release checks. Uses disposable offline speech, never judging/AI.
 * CLIP_VERIFY_ORIGIN=https://... node scripts/verify-clip-editor.mjs --revision SHA
 * --cleanup removes only this run's three disposable original takes.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const origin = process.env.CLIP_VERIFY_ORIGIN || 'https://delivery-production-0577.up.railway.app';
const dir = process.env.CLIP_VERIFY_DIR || '/tmp/delivery-clip-editor-live';
const fixtureDir = process.env.VIDEO_SAMPLE_DIR || '/tmp/delivery-video-samples';
const args = process.argv.slice(2);
const revision = args[args.indexOf('--revision') + 1];
assert.match(revision || '', /^[a-f0-9]{7,40}$/);
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const checkpoint = path.join(dir, 'checkpoint.json');
const state = fs.existsSync(checkpoint) ? JSON.parse(fs.readFileSync(checkpoint, 'utf8')) : { origin, revision, createdAt: new Date().toISOString(), saved: {}, checks: [], samples: [], calls: 0 };
assert.equal(state.origin, origin);
assert.equal(state.revision, revision, "Use a fresh CLIP_VERIFY_DIR for a different deployed revision");
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
  const cmd = ['-sS', '--max-time', '50', '-b', jar, '-c', jar, '-H', `Origin: ${origin}`, '-o', output, '-w', '%{http_code}', '-X', options.method || (options.body || options.form ? 'POST' : 'GET')];
  if (options.body) cmd.push('-H', 'Content-Type: application/json', '--data-binary', JSON.stringify(options.body));
  if (options.form) for (const [key, value] of Object.entries(options.form)) cmd.push('--form-string', `${key}=${value}`);
  if (options.audio) cmd.push('-F', `audio=@${options.audio};type=audio/wav;filename=sample.wav`);
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
  if (args.includes('--cleanup')) { cleanup(); } else {
  const prompt = call('classic:assignment', '/api/prompts/random?maxRating=everyone&seed=clip-editor-release');
  const catalog = call('switch:catalog', '/api/switch/catalog?maxRating=everyone');
  const challenge = catalog.challenges.find(c => c.id === 'not-my-problem');
  const clip = JSON.parse(fs.readFileSync('src/lib/say-it-back/catalog.json', 'utf8')).find(c => c.id === 'hgf-perfect-fiance');
  const classicAudio = path.join(dir, 'classic.wav');
  if (!fs.existsSync(classicAudio)) {
    const txt = path.join(dir, 'classic.txt'); fs.writeFileSync(txt, prompt.prompt.line);
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `flite=textfile=${txt}:voice=slt`, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', classicAudio]);
  }
  const preferred = { kind: 'builtin', id: 'fox' };
  call('avatar:save', '/api/avatars', { method: 'PUT', body: { avatar: preferred } });
  check('Guest preferred avatar recovers', JSON.stringify(call('avatar:recover', '/api/avatars').avatar) === JSON.stringify(preferred));
  const imagePath = path.join(dir, 'crop-sample.png');
  if (!fs.existsSync(imagePath)) execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=0xffdc66:s=512x512', '-vf', 'drawbox=x=256:y=0:w=256:h=512:c=0x5d7cff:t=fill', '-frames:v', '1', '-threads', '1', '-y', imagePath]);
  const uploadedAvatar = call('avatar:upload', '/api/avatars', { method: 'POST', image: imagePath }).avatar;
  check('Upload returns a bounded normalized raster', uploadedAvatar.kind === 'upload' && uploadedAvatar.dataUrl.startsWith('data:image/webp;base64,') && uploadedAvatar.dataUrl.length < 250000);
  const samples = [
    { mode: 'classic', file: classicAudio, form: { promptId: prompt.prompt.id, promptText: prompt.prompt.line, energy: prompt.energy.instruction, category: prompt.prompt.category, mode: 'classic', displayName: 'Sample performer' }, start: .25 },
    { mode: 'switch', file: path.join(fixtureDir, 'emotion.wav'), form: { challengeId: challenge.id, challengeVersion: challenge.version, recordingOffsetMs: '0', shareAudio: 'false' }, start: 4.15, end: 12.3 },
    { mode: 'say-it-back', file: path.join(fixtureDir, 'say-retake.wav'), form: { clipId: clip.id, clipVersion: clip.version, roleId: 'walter', recordingOffsetMs: '0', shareAudio: 'false' }, start: 3.2, end: 11.9 },
  ];
  for (const sample of samples) {
    const { mode } = sample;
    const duration = Number(probe(sample.file).format.duration);
    const attempt = call(mode + ':upload', `/api/${mode}/attempts`, { form: { ...sample.form, attemptId: randomUUID(), durationMs: String(Math.round(duration * 1000)), maxRating: 'everyone' }, audio: sample.file }).attempt;
    const query = `mode=${mode}&attemptId=${attempt.id}&maxRating=everyone`;
    const editor = call(mode + ':editor', `/api/exports/editor?${query}`);
    check(mode + ': preferred avatar initializes editor', editor.settings.avatar.id === preferred.id);
    call(mode + ':outsider-editor', `/api/exports/editor?${query}`, { outsider: true, expect: [404] });
    const settings = { ...editor.settings, layout: mode === 'say-it-back' ? 'duet' : 'spotlight', ...(mode === 'classic' ? {avatar:uploadedAvatar} : mode === 'say-it-back' ? {avatarX: .205, avatarY: .665, avatarSize: .25} : {}), avatarVisible: true, captions: true, includeName: false, includeScore: false, trimStart: sample.start, trimEnd: sample.end || Math.max(sample.start + .5, duration - .15) };
    const body = { mode, attemptId: attempt.id, maxRating: 'everyone', settings };
    call(mode + ':save-edits', '/api/exports/editor', { method: 'PUT', body });
    const reopened = call(mode + ':reopen', `/api/exports/editor?${query}`);
    assert.deepEqual(reopened.settings, settings); check(mode + ': saved edit recovery', true);
    call(mode + ':outsider-save', '/api/exports/editor', { method: 'PUT', body, outsider: true, expect: [404] });
    call(mode + ':invalid-trim', '/api/exports/editor', { method: 'PUT', body: { ...body, settings: { ...settings, trimEnd: duration + 4 } }, expect: [400, 422] });
    const request = { ...body, includeName: false, includeScore: false };
    const job = call(mode + ':export', '/api/exports', { body: request }).export;
    const same = call(mode + ':reuse', '/api/exports', { body: request }).export;
    check(mode + ': matching source and settings reuse export', same.id === job.id);
    const final = await ready(mode, job);
    const file = path.join(dir, `${mode}.mp4`);
    call(mode + ':download', `/api/exports/${final.id}/video?download=1`, { file });
    const info = probe(file), video = info.streams.find(s => s.codec_type === 'video'), audio = info.streams.find(s => s.codec_type === 'audio');
    const expected = settings.trimEnd - settings.trimStart;
    check(mode + ': trimmed 1080x1920 H264/AAC', video.width === 1080 && video.height === 1920 && video.codec_name === 'h264' && audio.codec_name === 'aac' && Math.abs(Number(info.format.duration) - expected) < .15);
    execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], { timeout: 60000, stdio: 'pipe' });
    const original = call(mode + ':unchanged-take', `/api/${mode}/attempts/${attempt.id}?maxRating=everyone`).attempt;
    check(mode + ': original duration and unscored take preserved', original.durationMs === attempt.durationMs && original.score === null);
    if (!state.samples.some(s => s.mode === mode)) state.samples.push({ mode, duration: Number(info.format.duration), trimStart: settings.trimStart, trimEnd: settings.trimEnd, width: video.width, height: video.height, file, exportId: final.id, assignmentUrl: final.assignmentUrl });
    if (mode === 'classic') {
      const changed = call('classic:changed-version', '/api/exports', { body: { ...request, settings: { ...settings, captions: false } } }).export;
      check('Classic: changed settings create distinct version', changed.id !== final.id);
      await ready('classic:changed-version', changed);
    }
    persist();
  }
  state.passedAt = new Date().toISOString(); persist();
  }
} finally {
  const out = 'docs/evidence/clip-editor/live-checks.json'; fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ origin, revision, passed: !!state.passedAt, checks: state.checks, samples: state.samples, paidCalls: 0, physicalPhoneChecked: false, cleanedAt: state.cleanedAt || null }, null, 2) + '\n');
}
