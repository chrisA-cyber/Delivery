/** Free disposable transport/render fixtures. Uses local libflite, never AI APIs.
 * Any pace simulation below prepares the source fixture only. The renderer must
 * preserve that saved source unchanged, just as it preserves a player's take.
 * Run: node --conditions=react-server --import tsx scripts/render-video-samples.ts
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { renderPerformanceVideo, VIDEO_LAYOUT_VERSION, type VideoRenderInput } from "../src/lib/server/video-renderer";
import { defaultClipEditSettings, layoutClipEditSettings } from "../src/lib/video-composition";
import { SWITCH_CHALLENGES } from "../src/lib/switch/catalog";
import { composeLineTakes, readPcmWav, type LineCapture } from "../src/lib/say-it-back/audio-timeline";
import catalog from "../src/lib/say-it-back/catalog.json";
import type { SayClip } from "../src/lib/say-it-back/types";

const outputDir = resolve(process.env.VIDEO_SAMPLE_DIR || "/tmp/delivery-video-samples");
const media = (url: string) => resolve("public", `.${url}`);
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function ffmpeg(args: string[]) { execFileSync(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-nostdin", "-y", ...args], { timeout: 60_000, stdio: "pipe" }); }
function duration(path: string) { return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", path]).toString().trim()); }
async function speak(name: string, text: string, voice = "slt") {
  const path = join(outputDir, `${name}.wav`);
  const textPath = join(outputDir, `${name}.txt`);
  await writeFile(textPath, text);
  ffmpeg(["-f", "lavfi", "-i", `flite=textfile=${textPath}:voice=${voice}`, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", path]);
  return path;
}
function paceFilter(pace: number) {
  const filters: string[] = [];
  while (pace > 2) { filters.push("atempo=2"); pace /= 2; }
  while (pace < 0.5) { filters.push("atempo=0.5"); pace *= 2; }
  filters.push(`atempo=${pace}`);
  return filters.join(",") + ",asetpts=N/SR/TB";
}
async function main() {
  await mkdir(outputDir, { recursive: true });
  const phrase = "I would like to speak to the manager of this entire situation.";
  const classic = await speak("classic", phrase);
  const repeated = await speak("repeated-phrase", "Not my problem.");
  const emotionChallenge = SWITCH_CHALLENGES.find((item) => item.id === "not-my-problem")!;
  const speedChallenge = SWITCH_CHALLENGES.find((item) => item.id === "speed-not-my-problem")!;
  for (const challenge of [emotionChallenge, speedChallenge]) {
    const segments: string[] = [];
    for (const [index, cue] of challenge.cues.entries()) {
      const path = join(outputDir, `${challenge.kind}-${index}.wav`);
      const filters = `${paceFilter(cue.speed ?? 1)},adelay=180:all=1,apad,atrim=end_sample=${Math.round((cue.end - cue.start) * 48000)},asetpts=N/SR/TB`;
      ffmpeg(["-i", repeated, "-af", filters, "-c:a", "pcm_s16le", path]);
      segments.push(path);
    }
    const concat = join(outputDir, `${challenge.kind}-concat.txt`);
    await writeFile(concat, segments.map((path) => `file '${path}'`).join("\n"));
    ffmpeg(["-f", "concat", "-safe", "0", "-i", concat, "-c:a", "copy", join(outputDir, `${challenge.kind}.wav`)]);
  }
  for (const kind of ["emotion", "speed"]) if (Math.abs(duration(join(outputDir, `${kind}.wav`)) - 20) > 0.001) throw new Error("Switch source fixture duration must be exactly20s");
  const clip = catalog.find((item) => item.id === "hgf-perfect-fiance") as unknown as SayClip;
  const lines: LineCapture[] = [];
  const cues = clip.cues.filter((cue) => cue.roleId === "walter");
  for (const [index, cue] of cues.entries()) {
    const raw = await speak(`say-line-${index + 1}`, cue.text, "rms");
    const start = index === 0 ? 0 : (cues[index - 1]!.end + cue.start) / 2;
    const end = index === cues.length - 1 ? clip.duration : (cue.end + cues[index + 1]!.start) / 2;
    const path = join(outputDir, `say-captured-${index + 1}.wav`);
    const pace = duration(raw) / (cue.end - cue.start);
    ffmpeg(["-i", raw, "-af", `${paceFilter(pace)},adelay=${Math.round((cue.start - start) * 1000)}:all=1,apad,atrim=end_sample=${Math.round((end - start) * 48000)},asetpts=N/SR/TB`, "-c:a", "pcm_s16le", path]);
    lines.push({ blob: new Blob([await readFile(path)], { type: "audio/wav" }), sceneStart: start, sceneEnd: end, recordingOffsetMs: 0 });
  }
  const original = await composeLineTakes(lines, clip.duration);
  const baseline = Buffer.from(await original.blob.arrayBuffer());
  const retakeIndex = 2;
  const redo = await speak("say-retake-line-3", cues[retakeIndex]!.text, "slt");
  const retained = lines[retakeIndex]!;
  const retakePath = join(outputDir, "say-captured-retake.wav");
  ffmpeg(["-i", redo, "-af", `${paceFilter(duration(redo) / (cues[retakeIndex]!.end - cues[retakeIndex]!.start))},adelay=${Math.round((cues[retakeIndex]!.start - retained.sceneStart) * 1000)}:all=1,apad,atrim=end_sample=${Math.round((retained.sceneEnd - retained.sceneStart) * 48000)},asetpts=N/SR/TB`, "-c:a", "pcm_s16le", retakePath]);
  lines[retakeIndex] = { ...retained, blob: new Blob([await readFile(retakePath)], { type: "audio/wav" }) };
  const assembled = await composeLineTakes(lines, clip.duration);
  const saved = Buffer.from(await assembled.blob.arrayBuffer());
  await writeFile(join(outputDir, "say-retake.wav"), saved);
  const before = readPcmWav(baseline.buffer.slice(baseline.byteOffset, baseline.byteOffset + baseline.byteLength))!;
  const after = readPcmWav(saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength))!;
  let outsideChanges = 0;
  let retakeChanges = 0;
  for (let index = 0; index < before.samples.length; index += 1) {
    if (before.samples[index] === after.samples[index]) continue;
    if (index / before.sampleRate < retained.sceneStart || index / before.sampleRate >= retained.sceneEnd) outsideChanges += 1; else retakeChanges += 1;
  }
  if (outsideChanges || !retakeChanges) throw new Error("Partial retake fixture did not preserve neighboring lines.");
  const common = { layoutVersion: VIDEO_LAYOUT_VERSION, invitationUrl: "https://deliverygame.netlify.app/a/Sample12345", displayName: "Sample performer", recordingOffsetMs: 0, score: null };
  const inputs: VideoRenderInput[] = [
    { ...common, mode: "classic", recordingPath: classic, outputPath: join(outputDir, "classic.mp4"), durationMs: Math.round(duration(classic) * 1000), settings: { ...defaultClipEditSettings("classic"), trimStart: 0.25, trimEnd: duration(classic) - 0.15 }, classic: { phrase, direction: "An exhausted customer service agent" } },
    { ...common, mode: "switch", recordingPath: join(outputDir, "emotion.wav"), outputPath: join(outputDir, "emotion.mp4"), durationMs: 20_000, settings: { ...defaultClipEditSettings("switch"), avatar: { kind: "builtin", id: "alien" }, trimStart: 3.5, trimEnd: 11.5 }, switch: emotionChallenge },
    { ...common, mode: "switch", recordingPath: join(outputDir, "speed.wav"), outputPath: join(outputDir, "speed.mp4"), durationMs: 20_000, settings: { ...defaultClipEditSettings("switch"), ...layoutClipEditSettings("switch", "duet"), avatar: { kind: "builtin", id: "robot" }, trimStart: 3.5, trimEnd: 10.5 }, switch: speedChallenge },
    { ...common, mode: "say-it-back", recordingPath: join(outputDir, "say-retake.wav"), outputPath: join(outputDir, "say-retake.mp4"), durationMs: 14_700, settings: { ...defaultClipEditSettings("say-it-back"), ...layoutClipEditSettings("say-it-back", "duet"), avatar: { kind: "builtin", id: "cloud" }, trimStart: 1.6, trimEnd: 12.6 }, say: { clip, roleId: "walter", videoPath: media(clip.videoUrl), backingPath: media(clip.roles[0]!.dubAudioUrl!) } },
  ];
  const metadata = { generatedBy: "Free local FFmpeg libflite stock synthesis; no human or AI judging", syntheticPreparation: "Stock speech paced into exact fixture cue windows before saving; renderer preserves the resulting original recording", invitations: "Local samples use an illustrative invitation. Live verifier replaces with actual public assignments.", partialRetake: { replacedCueId: cues[retakeIndex]!.id, start: retained.sceneStart, end: retained.sceneEnd, outsideChanges, retakeChanges, baselineSha256: hash(baseline), assembledSha256: hash(saved) }, fixtures: inputs.map((input) => ({ ...input, durationMs: Math.round(duration(input.recordingPath) * 1000) })) };
  await writeFile(join(outputDir, "fixtures.json"), JSON.stringify(metadata, null, 2));
  if (process.argv.includes("--fixtures-only")) { console.log(JSON.stringify({ fixtureMetadata: join(outputDir, "fixtures.json") })); return; }
  const results = [];
  for (const input of inputs) { const result = await renderPerformanceVideo(input); results.push({ mode: input.mode, ...result }); console.log(JSON.stringify(result)); }
  await writeFile(join(outputDir, "local-render-results.json"), JSON.stringify(results, null, 2));
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : "Sample creation failed"); process.exitCode = 1; });
