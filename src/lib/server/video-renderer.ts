import "server-only";

import { spawn } from "node:child_process";
import { link, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
// Sharp 0.35 ships declarations but omits them from its ESM export map.
// @ts-expect-error Upstream package export map; runtime import is supported.
import sharp from "sharp";
import { BUILTIN_AVATARS, audioLevelAt, avatarFrame, avatarSvg, clipEditSettingsSchema, compositionBoundaries, compositionFooter, compositionSvg, contentFrame, defaultClipEditSettings, measureAudioLevels, sceneFrame, type ClipEditSettings, type CompositionScene } from "@/lib/video-composition";
export { wrapVideoText } from "@/lib/video-composition";
import { MAX_SAY_RECORDING_MS } from "@/lib/audio-capture";
import type { SwitchChallenge } from "@/lib/switch/types";
import type { SayClip } from "@/lib/say-it-back/types";

export const VIDEO_LAYOUT_VERSION = "delivery-vertical-v2" as const;
export const VIDEO_RENDER_LIMITS = Object.freeze({ durationSeconds: 22, outputBytes: 48 * 1024 * 1024, timeoutMs: 180_000, threads: 2 });
const SAY_VIDEO_RENDER_LIMITS = Object.freeze({ ...VIDEO_RENDER_LIMITS, durationSeconds: MAX_SAY_RECORDING_MS / 1000, timeoutMs: 360_000 });
const W = 1080;
const H = 1920;
const FPS = 30;

export interface VideoRenderCommon {
  layoutVersion: typeof VIDEO_LAYOUT_VERSION;
  settings?: ClipEditSettings;
  /** Authorized local downloads only. FFmpeg never receives remote URLs. */
  recordingPath: string;
  outputPath: string;
  durationMs: number;
  recordingOffsetMs: number;
  /** Public immutable assignment URL, or empty for a private export. Never an attempt/share/round token. */
  invitationUrl: string;
  displayName?: string | null;
  avatarPath?: string | null;
  score?: { value: number; label: string; beta?: boolean } | null;
}
export type VideoRenderInput = VideoRenderCommon & (
  | { mode: "classic"; classic: { phrase: string; direction: string } }
  | { mode: "switch"; switch: SwitchChallenge }
  | { mode: "say-it-back"; say: { clip: SayClip; roleId: string; videoPath: string; backingPath?: string | null } }
);
export interface VideoRenderResult {
  path: string; bytes: number; duration: number; width: 1080; height: 1920;
  videoCodec: "h264"; audioCodec: "aac"; renderMs: number; audioCopied: boolean;
}
export class VideoRenderError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "VideoRenderError"; }
}
interface MediaProbe { format?: { duration?: string }; streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; sample_rate?: string; channels?: number; duration?: string }[] }

/** Bounded child process output and wall time; no shell interpolation. */
async function run(binary: string, args: string[], signal?: AbortSignal, maxBytes = 2 * 1024 * 1024, timeoutMs: number = VIDEO_RENDER_LIMITS.timeoutMs): Promise<Buffer> {
  if (signal?.aborted) throw new VideoRenderError("RENDER_INTERRUPTED", "Video creation was interrupted. Try again.");
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const chunks: Buffer[] = [];
    let count = 0;
    let settled = false;
    let stopped: VideoRenderError | null = null;
    const stop = (error: VideoRenderError) => { stopped = error; child.kill("SIGKILL"); };
    const aborted = () => stop(new VideoRenderError("RENDER_INTERRUPTED", "Video creation was interrupted. Try again."));
    const timeout = setTimeout(() => stop(new VideoRenderError("RENDER_TIMEOUT", "Video creation took too long. Try again.")), timeoutMs);
    signal?.addEventListener("abort", aborted, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      count += chunk.length;
      if (count > maxBytes) stop(new VideoRenderError("RENDER_LIMIT", "This recording exceeds the video export limit."));
      else chunks.push(chunk);
    });
    // Drain stderr without retaining filenames, signed URLs, or arbitrary decoder output.
    child.stderr.on("data", () => undefined);
    const done = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", aborted);
      if (error) reject(error); else resolve(Buffer.concat(chunks));
    };
    child.on("error", () => done(new VideoRenderError("RENDER_UNAVAILABLE", "Video creation is temporarily unavailable. Try again shortly.")));
    child.on("close", (code) => done(stopped ?? (code === 0 ? undefined : new VideoRenderError("RENDER_MEDIA_ERROR", "The recording could not be converted to a video. The original take is unchanged."))));
  });
}
async function probe(path: string, signal?: AbortSignal): Promise<MediaProbe> {
  return JSON.parse((await run(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_format", "-show_streams", "-of", "json", path], signal)).toString("utf8")) as MediaProbe;
}
function numeric(value: unknown, fallback = 0): number { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
export function measureVideoPeaks(pcm: Buffer, bars = 108): number[] {
  const count = Math.floor(pcm.length / 4);
  const width = Math.max(1, Math.ceil(count / bars));
  return Array.from({ length: bars }, (_, bar) => {
    let peak = 0;
    for (let i = bar * width; i < Math.min(count, (bar + 1) * width); i += 1) { const value = pcm.readFloatLE(i * 4); if (Number.isFinite(value)) peak = Math.max(peak, Math.min(1, Math.abs(value))); }
    return peak;
  });
}

function validateInput(input: VideoRenderInput) {
  const limits = input.mode === "say-it-back" ? SAY_VIDEO_RENDER_LIMITS : VIDEO_RENDER_LIMITS;
  if (input.layoutVersion !== VIDEO_LAYOUT_VERSION || !Number.isFinite(input.durationMs) || input.durationMs <= 0 || input.durationMs > limits.durationSeconds * 1000 || !Number.isFinite(input.recordingOffsetMs) || Math.abs(input.recordingOffsetMs) > 2000) throw new VideoRenderError("RENDER_INPUT", "This recording is outside the video export limits.");
  if (input.mode === "switch") {
    const challenge = input.switch;
    if (challenge.cues[0]?.start !== 0 || challenge.cues.at(-1)?.end !== challenge.duration || challenge.cues.length < 4 || challenge.cues.length > 6 || !Number.isFinite(challenge.duration) || challenge.duration > 22 || challenge.cues.some((cue, index) => !Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start || cue.end > challenge.duration || (index > 0 && cue.start !== challenge.cues[index - 1]!.end) || cue.text !== challenge.cues[0]!.text)) throw new VideoRenderError("RENDER_CUES", "This Switch cue sequence is unavailable for export.");
  }
  if (input.mode === "say-it-back" && (!input.say.clip.roles.some((role) => role.id === input.say.roleId) || !Number.isFinite(input.say.clip.duration) || input.say.clip.duration <= 0 || input.say.clip.duration > limits.durationSeconds)) throw new VideoRenderError("RENDER_SCENE", "This scene is unavailable for export.");
}

function compositionScene(input: VideoRenderInput, duration: number): CompositionScene {
  const common = { duration, invitationUrl: input.invitationUrl, displayName: input.displayName, score: input.score };
  if (input.mode === "classic") return { ...common, mode: "classic", classic: input.classic };
  if (input.mode === "switch") return { ...common, mode: "switch", switch: input.switch };
  return { ...common, mode: "say-it-back", say: { clip: input.say.clip, roleId: input.say.roleId } };
}
export function renderVideoFooter(input: VideoRenderInput): string {
  try { return compositionFooter(compositionScene(input, input.durationMs / 1000)); }
  catch { throw new VideoRenderError("RENDER_INVITATION", "The playable invitation is unavailable. Try creating the video again."); }
}
async function raster(path: string, source: string): Promise<void> { await sharp(Buffer.from(source), { limitInputPixels: W * H * 2 }).png().toFile(path); }
function cropSvg(source: string, frame: { x: number; y: number; width: number; height: number }): string {
  return source.replace(`width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"`, `width="${frame.width}" height="${frame.height}" viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}"`);
}
/**
 * One shared SVG supplies editor and render geometry. Rasterize the base and cue
 * changes once; eight small avatar sprites carry measured 15 Hz speech levels.
 * No full-canvas per-frame rasterization or additional renderer service.
 */
export async function renderPerformanceVideo(input: VideoRenderInput, options: { signal?: AbortSignal } = {}): Promise<VideoRenderResult> {
  validateInput(input);
  const parsed = clipEditSettingsSchema.safeParse(input.settings ?? defaultClipEditSettings(input.mode));
  if (!parsed.success) throw new VideoRenderError("RENDER_SETTINGS", "The clip settings are unavailable. Reset the editor and try again.");
  const settings = parsed.data;
  // Keep malformed/private invitation links out of every composition layer.
  renderVideoFooter(input);
  const limits = input.mode === "say-it-back" ? SAY_VIDEO_RENDER_LIMITS : VIDEO_RENDER_LIMITS;
  const started = Date.now(), dir = await mkdtemp(join(dirname(input.outputPath), ".delivery-render-"));
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), limits.timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const partial = join(dir, "finished.mp4");
  try {
    const recording = await probe(input.recordingPath, signal);
    const audio = recording.streams?.find((stream) => stream.codec_type === "audio");
    const recordingDuration = numeric(recording.format?.duration, numeric(audio?.duration));
    if (!audio || recordingDuration <= 0 || recordingDuration > limits.durationSeconds + 0.05) throw new VideoRenderError("RENDER_AUDIO", "The saved recording has no supported audio or exceeds the video limit.");
    const sourceDuration = input.mode === "say-it-back" ? input.say.clip.duration : recordingDuration;
    const trimStart = settings.trimStart, trimEnd = settings.trimEnd ?? sourceDuration;
    if (trimStart >= sourceDuration || trimEnd > sourceDuration + 0.05 || trimEnd - trimStart < 0.5) throw new VideoRenderError("RENDER_TRIM", "Keep at least half a second within the original take.");
    const duration = Math.min(sourceDuration, trimEnd) - trimStart;
    const scene = compositionScene(input, sourceDuration), basePath = join(dir, "layout.png");
    await raster(basePath, compositionSvg(scene, settings, { time: trimStart, layer: "base" }));
    const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-filter_complex_threads", "1", "-threads", "2", "-loop", "1", "-framerate", String(FPS), "-i", basePath, "-threads", "2", "-protocol_whitelist", "file,pipe", "-i", input.recordingPath];
    const filters: string[] = ["[0:v]format=rgba[base]"];
    let inputIndex = 2, videoLabel = "base", audioLabel: string | null = null;
    let audioCopied = audio.codec_name === "aac" && input.mode !== "say-it-back" && trimStart === 0 && (settings.trimEnd === null || Math.abs(trimEnd - sourceDuration) < 0.001);
    if (input.mode === "say-it-back") {
      const { clip, roleId, videoPath, backingPath } = input.say;
      const role = clip.roles.find((item) => item.id === roleId)!;
      args.push("-threads", "2", "-protocol_whitelist", "file,pipe", "-i", videoPath);
      const sceneIndex = inputIndex++, f = sceneFrame(settings);
      filters.push(`[${sceneIndex}:v]trim=start=${trimStart}:end=${trimEnd},setpts=PTS-STARTPTS,scale=${f.width}:${f.height}:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=${FPS}[scene]`, `[${videoLabel}][scene]overlay=x=${f.x}+(${f.width}-w)/2:y=${f.y}+(${f.height}-h)/2:eof_action=pass[scene_composed]`);
      videoLabel = "scene_composed";
      const offset = input.recordingOffsetMs / 1000;
      const voice = offset >= 0 ? `atrim=start=${offset},asetpts=PTS-STARTPTS` : `asetpts=PTS-STARTPTS,adelay=${Math.round(-offset * 1000)}:all=1`;
      const voiceLayout = audio.channels === 1 ? ",pan=stereo|c0=c0|c1=c0" : "";
      filters.push(`[1:a]${voice}${voiceLayout},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad,atrim=duration=${sourceDuration}[voice]`);
      if (backingPath) {
        args.push("-threads", "2", "-protocol_whitelist", "file,pipe", "-i", backingPath);
        const bedIndex = inputIndex++;
        filters.push(`[${bedIndex}:a]asetpts=PTS-STARTPTS,volume=0.65,apad,atrim=duration=${sourceDuration}[bed]`);
      } else {
        const muted = role.muteIntervals.map((part) => `between(t,${part.start},${part.end})`).join("+") || "0";
        filters.push(`[${sceneIndex}:a]asetpts=PTS-STARTPTS,volume='if(${muted},0,1)':eval=frame,apad,atrim=duration=${sourceDuration}[bed]`);
      }
      // Preserve the existing stereo dub, then cut all sources on the same clock.
      filters.push(`[voice][bed]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,atrim=start=${trimStart}:end=${trimEnd},asetpts=PTS-STARTPTS[audio]`);
      audioLabel = "audio"; audioCopied = false;
    } else if (!audioCopied) {
      filters.push(`[1:a]atrim=start=${trimStart}:end=${trimEnd},asetpts=PTS-STARTPTS[audio]`);
      audioLabel = "audio";
    }
    const boundaries = compositionBoundaries(scene, settings);
    const frame = contentFrame(scene, settings);
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = Math.max(trimStart, boundaries[i]!), end = Math.min(trimEnd, boundaries[i + 1]!);
      if (start >= end || scene.mode === "classic" || (scene.mode === "say-it-back" && !settings.captions)) continue;
      const path = join(dir, `content-${i}.png`);
      await raster(path, cropSvg(compositionSvg(scene, settings, { time: (start + end) / 2, layer: "content" }), frame));
      args.push("-threads", "1", "-i", path);
      const label = `content_${i}`;
      filters.push(`[${videoLabel}][${inputIndex++}:v]overlay=x=${frame.x}:y=${frame.y}:eof_action=repeat:enable='gte(t,${start - trimStart})*lt(t,${end - trimStart})'[${label}]`);
      videoLabel = label;
    }
    if (settings.avatarVisible) {
      let imageHref: string;
      if (settings.avatar.kind === "upload") {
        const png = await sharp(Buffer.from(settings.avatar.dataUrl.split(",")[1]!, "base64"), { limitInputPixels: 1024 * 1024 }).png().toBuffer();
        imageHref = `data:image/png;base64,${png.toString("base64")}`;
      }
      else {
        const builtin = BUILTIN_AVATARS.find((item) => item.id === (settings.avatar.kind === "builtin" ? settings.avatar.id : ""))!;
        const bytes = await sharp(await readFile(join(process.cwd(), "public", builtin.imageUrl))).png().toBuffer();
        imageHref = `data:image/png;base64,${bytes.toString("base64")}`;
      }
      const f = avatarFrame(settings);
      for (let level = 0; level < 8; level++) await raster(join(dir, `avatar-level-${level}.png`), avatarSvg(settings.avatar, { size: f.width, level: level / 7, imageHref, reducedMotion: settings.reducedMotion }));
      const pcm = await run(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-nostdin", "-threads", "1", "-protocol_whitelist", "file,pipe", "-i", input.recordingPath, "-vn", "-t", String(limits.durationSeconds), "-ac", "1", "-ar", "8000", "-f", "f32le", "pipe:1"], signal, 8000 * 4 * limits.durationSeconds + 1000);
      const samples = new Float32Array(Math.floor(pcm.length / 4));
      for (let i = 0; i < samples.length; i++) samples[i] = pcm.readFloatLE(i * 4);
      const levels = measureAudioLevels(samples, 8000);
      const offset = input.mode === "say-it-back" ? input.recordingOffsetMs / 1000 : 0;
      // Hardlinks repeat only eight tiny PNG assets, avoiding per-frame encoding.
      for (let i = 0; i <= Math.ceil(duration * FPS); i++) {
        const level = Math.round(audioLevelAt(levels, trimStart + i / FPS + offset) * 7);
        await link(join(dir, `avatar-level-${level}.png`), join(dir, `avatar-${String(i).padStart(5, "0")}.png`));
      }
      args.push("-threads", "1", "-framerate", String(FPS), "-i", join(dir, "avatar-%05d.png"));
      filters.push(`[${videoLabel}][${inputIndex++}:v]overlay=x=${f.x}:y=${f.y}:eof_action=repeat[avatar]`);
      videoLabel = "avatar";
    }
    filters.push(`[${videoLabel}]format=yuv420p[out]`);
    const filterPath = join(dir, "filters.txt");
    await writeFile(filterPath, filters.join(";\n"));
    args.push("-filter_complex_script", filterPath, "-map", "[out]", "-map", audioLabel ? `[${audioLabel}]` : "1:a:0", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-threads", String(VIDEO_RENDER_LIMITS.threads), "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", audioCopied ? "copy" : "aac");
    if (!audioCopied) args.push("-b:a", "192k");
    args.push("-t", String(duration), "-movflags", "+faststart", "-map_metadata", "-1", "-metadata", "title=Delivery performance", "-metadata", `comment=${input.invitationUrl}`, "-fs", String(VIDEO_RENDER_LIMITS.outputBytes), partial);
    await run(process.env.FFMPEG_PATH || "ffmpeg", args, signal, 2 * 1024 * 1024, limits.timeoutMs);
    const [output, info] = await Promise.all([stat(partial), probe(partial, signal)]);
    const video = info.streams?.find((stream) => stream.codec_type === "video"), sound = info.streams?.find((stream) => stream.codec_type === "audio");
    const actualDuration = numeric(info.format?.duration);
    if (output.size >= VIDEO_RENDER_LIMITS.outputBytes || video?.codec_name !== "h264" || sound?.codec_name !== "aac" || video.width !== W || video.height !== H || Math.abs(actualDuration - duration) > 0.15) throw new VideoRenderError("RENDER_VALIDATION", "The finished video could not be verified. Try creating it again.");
    if (signal?.aborted) throw new VideoRenderError("RENDER_INTERRUPTED", "Video creation was interrupted. Try again.");
    await rename(partial, input.outputPath);
    return { path: input.outputPath, bytes: output.size, duration: actualDuration, width: W, height: H, videoCodec: "h264", audioCodec: "aac", renderMs: Date.now() - started, audioCopied };
  } finally { clearTimeout(timeout); await rm(dir, { recursive: true, force: true }); }
}
