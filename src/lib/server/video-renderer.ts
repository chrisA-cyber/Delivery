import "server-only";

import { spawn } from "node:child_process";
import { mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
// Sharp 0.35 ships declarations but omits them from its ESM export map.
// @ts-expect-error Upstream package export map; runtime import is supported.
import sharp from "sharp";
import { BRAND_MARK_PATH, brandGradientSvg } from "@/lib/brand";
import { VISUAL_THEME } from "@/lib/visual-theme";
import type { SwitchChallenge } from "@/lib/switch/types";
import type { SayClip } from "@/lib/say-it-back/types";

export const VIDEO_LAYOUT_VERSION = "delivery-vertical-v1" as const;
export const VIDEO_RENDER_LIMITS = Object.freeze({ durationSeconds: 22, outputBytes: 48 * 1024 * 1024, timeoutMs: 180_000, threads: 2 });
const W = 1080;
const H = 1920;
const FPS = 30;
const C = { ...VISUAL_THEME, accent: VISUAL_THEME.accent, panel: VISUAL_THEME.surface };

export interface VideoRenderCommon {
  layoutVersion: typeof VIDEO_LAYOUT_VERSION;
  /** Authorized local downloads only. FFmpeg never receives remote URLs. */
  recordingPath: string;
  outputPath: string;
  durationMs: number;
  recordingOffsetMs: number;
  /** Public immutable assignment URL; never an attempt/share/round token. */
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
async function run(binary: string, args: string[], signal?: AbortSignal, maxBytes = 2 * 1024 * 1024): Promise<Buffer> {
  if (signal?.aborted) throw new VideoRenderError("RENDER_INTERRUPTED", "Video creation was interrupted. Try again.");
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const chunks: Buffer[] = [];
    let count = 0;
    let settled = false;
    let stopped: VideoRenderError | null = null;
    const stop = (error: VideoRenderError) => { stopped = error; child.kill("SIGKILL"); };
    const aborted = () => stop(new VideoRenderError("RENDER_INTERRUPTED", "Video creation was interrupted. Try again."));
    const timeout = setTimeout(() => stop(new VideoRenderError("RENDER_TIMEOUT", "Video creation took too long. Try again.")), VIDEO_RENDER_LIMITS.timeoutMs);
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
function xml(value: string): string { return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function text(value: string, x: number, y: number, size: number, color = C.paper, weight = 700, anchor = "start"): string {
  return `<text x="${x}" y="${y}" font-family="DejaVu Sans, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${color}">${xml(value)}</text>`;
}
function textWidth(value: string, size: number): number {
  // Conservative font metrics keep all text inside its safe rectangle. Explicit
  // line breaks are preserved; no words or dialogue content are abbreviated.
  return [...value].reduce((width, char) => width + (/[ilI.,'!:;|]/.test(char) ? 0.34 : /[MW@%]/.test(char) ? 0.96 : char === " " ? 0.37 : /[A-Z]/.test(char) ? 0.76 : char.codePointAt(0)! > 0x2fff ? 1.1 : 0.65), 0) * size;
}
export function wrapVideoText(value: string, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split(/\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (textWidth(word, size) > width) {
        if (line) { lines.push(line); line = ""; }
        for (const char of [...word]) { if (line && textWidth(line + char, size) > width) { lines.push(line); line = ""; } line += char; }
      } else if (line && textWidth(`${line} ${word}`, size) > width) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
  }
  return lines;
}
function fitText(value: string, x: number, top: number, width: number, height: number, maxSize: number, minSize = 26, color = C.paper, centered = false): string {
  let size = maxSize;
  let lines = wrapVideoText(value, size, width);
  while (size > minSize && lines.length * size * 1.24 > height) { size -= 2; lines = wrapVideoText(value, size, width); }
  if (lines.length * size * 1.24 > height) throw new VideoRenderError("RENDER_TEXT_LIMIT", "The challenge text is too long for this video layout.");
  return lines.map((line, i) => text(line, centered ? x + width / 2 : x, top + size + i * size * 1.24, size, color, 700, centered ? "middle" : "start")).join("");
}
function rect(x: number, y: number, width: number, height: number, fill: string, radius = 0, stroke?: string): string { return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="2"` : ""}/>`; }
function svg(body: string, width = W, height = H): string { return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`; }
async function png(path: string, body: string, width = W, height = H): Promise<void> { await sharp(Buffer.from(svg(body, width, height)), { limitInputPixels: W * H * 2 }).png().toFile(path); }

function footer(input: VideoRenderInput): string {
  const url = new URL(input.invitationUrl);
  if (url.protocol !== "https:" || !/^\/a\/[A-Za-z0-9_-]{6,64}$/.test(url.pathname) || url.search || url.hash || url.username || url.password) throw new VideoRenderError("RENDER_INVITATION", "The playable invitation is unavailable. Try creating the video again.");
  let body = rect(86, 1532, 864, 2, C.border) + text("Your turn.", 86, 1618, 52) + text(url.host, 86, 1672, 27, C.muted, 500);
  body += fitText(url.pathname, 86, 1690, 864, 62, 37, 26, C.blue);
  if (input.mode === "say-it-back") {
    const source = input.say.clip.source;
    body += fitText(`${source.title} · ${source.creator} · ${source.license}\nShortened, dubbed adaptation. ${source.license === "CC BY 3.0" ? "creativecommons.org/licenses/by/3.0/" : ""}`, 86, 1790, 864, 90, 18, 16, C.muted);
  }
  return body;
}
async function identity(input: VideoRenderInput): Promise<string> {
  let body = "";
  if (input.displayName) {
    let avatar: Buffer | null = null;
    if (input.avatarPath) {
      try { avatar = await sharp(input.avatarPath, { limitInputPixels: 16 * 1024 * 1024 }).rotate().resize(70, 70, { fit: "cover" }).composite([{ input: Buffer.from(svg('<circle cx="35" cy="35" r="35" fill="white"/>', 70, 70)), blend: "dest-in" }]).png().toBuffer(); } catch { /* A profile image failure must not invalidate a saved take. */ }
    }
    body += avatar ? `<image href="data:image/png;base64,${avatar.toString("base64")}" x="86" y="1415" width="70" height="70"/>` : `<circle cx="121" cy="1450" r="35" fill="${C.accent}"/>${text([...input.displayName.trim()][0]?.toUpperCase() || "D", 121, 1463, 35, C.ink, 700, "middle")}`;
    body += fitText(input.displayName, 178, 1418, input.score ? 478 : 758, 70, 32, 24);
  } else body += text("One take. All you.", 86, 1468, 31, C.muted, 500);
  if (input.score && Number.isFinite(input.score.value) && input.score.value >= 0 && input.score.value <= 100) {
    body += text(`${Math.round(input.score.value)}`, 950, 1454, 43, C.accent, 700, "end");
    body += text(input.score.beta || input.mode === "switch" ? "BETA SCORE" : input.score.label.slice(0, 18).toUpperCase(), 950, 1488, 19, C.muted, 500, "end");
  }
  return body;
}
function waveformBody(peaks: number[], x: number, y: number, width: number, height: number): string {
  const max = Math.max(0.02, ...peaks);
  const step = width / peaks.length;
  return peaks.map((peak, i) => {
    // Visual scaling only. These peaks are decoded from this recording; the
    // performance stream never passes through gain/normalization filters.
    const barHeight = Math.max(3, Math.sqrt(peak / max) * height);
    return rect(x + i * step, y + (height - barHeight) / 2, Math.max(2, step - 3), barHeight, C.blue, 2);
  }).join("");
}
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
  if (input.layoutVersion !== VIDEO_LAYOUT_VERSION || !Number.isFinite(input.durationMs) || input.durationMs <= 0 || input.durationMs > VIDEO_RENDER_LIMITS.durationSeconds * 1000 || !Number.isFinite(input.recordingOffsetMs) || Math.abs(input.recordingOffsetMs) > 2000) throw new VideoRenderError("RENDER_INPUT", "This recording is outside the video export limits.");
  if (input.mode === "switch") {
    const challenge = input.switch;
    if (challenge.cues[0]?.start !== 0 || challenge.cues.at(-1)?.end !== challenge.duration || challenge.cues.length < 4 || challenge.cues.length > 6 || !Number.isFinite(challenge.duration) || challenge.duration > 22 || challenge.cues.some((cue, index) => !Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start || cue.end > challenge.duration || (index > 0 && cue.start !== challenge.cues[index - 1]!.end) || cue.text !== challenge.cues[0]!.text)) throw new VideoRenderError("RENDER_CUES", "This Switch cue sequence is unavailable for export.");
  }
  if (input.mode === "say-it-back" && (!input.say.clip.roles.some((role) => role.id === input.say.roleId) || input.say.clip.duration <= 0 || input.say.clip.duration > VIDEO_RENDER_LIMITS.durationSeconds)) throw new VideoRenderError("RENDER_SCENE", "This scene is unavailable for export.");
}

/**
 * Converts an authorized immutable saved take. Publication/leases/ownership live
 * in the job service. This function uses local files and atomically renames only
 * a probed, complete MP4. An abort never leaves a playable half-written result.
 */
export async function renderPerformanceVideo(input: VideoRenderInput, options: { signal?: AbortSignal } = {}): Promise<VideoRenderResult> {
  validateInput(input);
  const started = Date.now();
  const dir = await mkdtemp(join(dirname(input.outputPath), ".delivery-render-"));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIDEO_RENDER_LIMITS.timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const partial = join(dir, "finished.mp4");
  try {
    const recording = await probe(input.recordingPath, signal);
    const audio = recording.streams?.find((stream) => stream.codec_type === "audio");
    const recordingDuration = numeric(recording.format?.duration, numeric(audio?.duration));
    if (!audio || recordingDuration <= 0 || recordingDuration > VIDEO_RENDER_LIMITS.durationSeconds) throw new VideoRenderError("RENDER_AUDIO", "The saved recording has no supported audio or exceeds the video limit.");
    const duration = input.mode === "say-it-back" ? input.say.clip.duration : recordingDuration;
    const basePath = join(dir, "layout.png");
    let body = rect(0, 0, W, H, C.ink) + brandGradientSvg("delivery-video-spectrum") + `<path d="${BRAND_MARK_PATH}" transform="translate(76 114) scale(1.1)" fill="url(#delivery-video-spectrum)" fill-rule="evenodd"/>` + text("delivery", 155, 173, 49) + text("THE VOICE IS THE WHOLE POINT.", 86, 229, 19, C.muted, 500);
    body += await identity(input) + footer(input);
    const parts: { path: string; start?: number; end?: number; x: number; y: number }[] = [];
    let waveform: { x: number; y: number; width: number; height: number } | null = null;
    if (input.mode !== "say-it-back") {
      const pcm = await run(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-nostdin", "-threads", "1", "-protocol_whitelist", "file,pipe", "-i", input.recordingPath, "-vn", "-t", String(VIDEO_RENDER_LIMITS.durationSeconds), "-ac", "1", "-ar", "8000", "-f", "f32le", "pipe:1"], signal, 8000 * 4 * VIDEO_RENDER_LIMITS.durationSeconds + 1000);
      const peaks = measureVideoPeaks(pcm);
      if (input.mode === "classic") {
        body += text("CLASSIC", 86, 333, 28, C.accent) + fitText(input.classic.phrase, 86, 401, 864, 440, 78, 34);
        body += text("DELIVERED AS", 86, 926, 23, C.muted, 500) + fitText(input.classic.direction, 86, 958, 864, 153, 42, 26, C.accent);
        waveform = { x: 90, y: 1190, width: 856, height: 132 };
        body += waveformBody(peaks, waveform.x, waveform.y, waveform.width, waveform.height);
      } else {
        const challenge = input.switch;
        body += text(challenge.kind === "speed" ? "SWITCH / SPEED" : "SWITCH / EMOTION", 86, 333, 28, C.accent) + fitText(challenge.cues[0]!.text, 86, 387, 864, 219, 75, 44);
        for (const [index, cue] of challenge.cues.entries()) {
          const cuePath = join(dir, `cue-${index}.png`);
          const next = challenge.cues[index + 1];
          let card = rect(0, 0, 864, 495, C.panel, 30, C.border) + text(`SWITCH ${String(index + 1).padStart(2, "0")} / ${challenge.cues.length}`, 432, 56, 23, C.muted, 500, "middle");
          // librsvg renders color emoji as black silhouettes. Rasterize the exact
          // stored emoji through Pango's RGBA text path before composing the card.
          const emojiPng = await sharp({ text: { text: xml(cue.emoji), font: "Noto Color Emoji", fontfile: process.env.VIDEO_EMOJI_FONT_PATH || "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf", rgba: true, width: 160, height: 160 } }).resize(160, 160, { fit: "contain", background: "#00000000" }).png().toBuffer();
          card += `<image href="data:image/png;base64,${emojiPng.toString("base64")}" x="352" y="91" width="160" height="160"/>`;
          card += fitText(cue.directionLabel, 28, 260, 808, 94, challenge.kind === "speed" ? 53 : 61, 39, C.pink, true);
          card += text(next ? `NEXT: ${next.directionLabel}` : "THE FINAL SWITCH", 432, 391, 23, C.muted, 500, "middle");
          challenge.cues.forEach((_, dot) => { card += rect(46 + dot * (772 / challenge.cues.length), 438, 772 / challenge.cues.length - 10, 7, dot === index ? C.accent : dot < index ? C.blue : C.border, 3); });
          await png(cuePath, card, 864, 495);
          parts.push({ path: cuePath, x: 86, y: 654, start: cue.start, end: index === challenge.cues.length - 1 ? duration + 1 : cue.end });
        }
        waveform = { x: 90, y: 1243, width: 856, height: 88 };
        body += waveformBody(peaks, waveform.x, waveform.y, waveform.width, waveform.height);
      }
      body += text("YOUR ORIGINAL RECORDING", 86, 1384, 18, C.muted, 500);
    } else {
      const { clip, roleId } = input.say;
      const role = clip.roles.find((item) => item.id === roleId)!;
      body += text("SAY IT BACK", 86, 312, 28, C.accent) + fitText(clip.title, 86, 333, 864, 124, 43, 29) + text(`THE VOICE OF ${role.name.toUpperCase()}`, 86, 476, 23, C.blue, 500);
      body += rect(60, 524, 960, 704, C.ink, 20, C.border);
      // Phrase-level cues are the exact stored manifest intervals, including
      // retained speakers; no ASR request or fabricated word timing is involved.
      const boundaries = [...new Set([0, clip.duration, ...clip.cues.flatMap((cue) => [Math.max(0, cue.start - 0.12), Math.min(clip.duration, cue.end + 0.12)])])].sort((a, b) => a - b);
      for (let i = 0; i < boundaries.length - 1; i += 1) {
        const start = boundaries[i]!;
        const end = boundaries[i + 1]!;
        const cues = clip.cues.filter((cue) => (start + end) / 2 >= cue.start - 0.12 && (start + end) / 2 <= cue.end + 0.12);
        if (!cues.length) continue;
        const captionPath = join(dir, `caption-${i}.png`);
        const caption = cues.map((cue) => `${cue.roleId === roleId ? "YOU" : clip.roles.find((item) => item.id === cue.roleId)?.name.toUpperCase() ?? "SCENE"}: ${cue.text}`).join("\n");
        await png(captionPath, fitText(caption, 0, 0, 864, 143, 35, 22, cues.some((cue) => cue.roleId === roleId) ? C.paper : C.muted), 864, 146);
        parts.push({ path: captionPath, x: 86, y: 1250, start, end });
      }
    }
    await png(basePath, body);
    const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-filter_complex_threads", "1", "-threads", "2", "-loop", "1", "-framerate", String(FPS), "-i", basePath, "-threads", "2", "-protocol_whitelist", "file,pipe", "-i", input.recordingPath];
    const filters: string[] = ["[0:v]format=rgba[base]"];
    let inputIndex = 2;
    let videoLabel = "base";
    let audioLabel: string | null = null;
    let audioCopied = audio.codec_name === "aac" && input.mode !== "say-it-back";
    if (input.mode === "say-it-back") {
      const { clip, roleId, videoPath, backingPath } = input.say;
      const role = clip.roles.find((item) => item.id === roleId)!;
      args.push("-threads", "2", "-protocol_whitelist", "file,pipe", "-i", videoPath);
      const sceneIndex = inputIndex++;
      filters.push(`[${sceneIndex}:v]scale=960:704:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=${FPS},setpts=PTS-STARTPTS[scene]`, `[${videoLabel}][scene]overlay=x=(W-w)/2:y=524+(704-h)/2:eof_action=pass[scene_composed]`);
      videoLabel = "scene_composed";
      const offset = input.recordingOffsetMs / 1000;
      const voice = offset >= 0 ? `atrim=start=${offset},asetpts=PTS-STARTPTS` : `asetpts=PTS-STARTPTS,adelay=${Math.round(-offset * 1000)}:all=1`;
      // HTML media playback places a mono voice equally in both ears. Preserve
      // that amplitude and the scene's stereo backing; automatic down/upmixing
      // would otherwise attenuate the voice or collapse the backing to mono.
      const voiceLayout = audio.channels === 1 ? ",pan=stereo|c0=c0|c1=c0" : "";
      filters.push(`[1:a]${voice}${voiceLayout},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad,atrim=duration=${duration}[voice]`);
      if (backingPath) {
        args.push("-threads", "2", "-protocol_whitelist", "file,pipe", "-i", backingPath);
        const bedIndex = inputIndex++;
        // These are exactly DubPlayer's intentional backing gain and saved take.
        // Disable amix normalization: it otherwise halves the player's voice.
        filters.push(`[${bedIndex}:a]asetpts=PTS-STARTPTS,volume=0.65,apad,atrim=duration=${duration}[bed]`);
      } else {
        const muted = role.muteIntervals.map((part) => `between(t,${part.start},${part.end})`).join("+") || "0";
        filters.push(`[${sceneIndex}:a]asetpts=PTS-STARTPTS,volume='if(${muted},0,1)':eval=frame,apad,atrim=duration=${duration}[bed]`);
      }
      filters.push(`[voice][bed]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,atrim=duration=${duration}[audio]`);
      audioLabel = "audio";
      audioCopied = false;
    }
    for (const [index, part] of parts.entries()) {
      args.push("-threads", "1", "-i", part.path);
      const label = `layer_${index}`;
      const enable = part.start != null && part.end != null ? `:enable='gte(t,${part.start})*lt(t,${part.end})'` : "";
      filters.push(`[${videoLabel}][${inputIndex++}:v]overlay=x=${part.x}:y=${part.y}:eof_action=repeat${enable}[${label}]`);
      videoLabel = label;
    }
    if (waveform) {
      const cursor = join(dir, "cursor.png");
      await png(cursor, rect(0, 0, 3, waveform.height + 20, C.accent, 1), 3, waveform.height + 20);
      args.push("-threads", "1", "-i", cursor);
      filters.push(`[${videoLabel}][${inputIndex++}:v]overlay=x='${waveform.x}+min(t/${duration},1)*${waveform.width - 3}':y=${waveform.y - 10}:eof_action=repeat[cursor]`);
      videoLabel = "cursor";
    }
    filters.push(`[${videoLabel}]format=yuv420p[out]`);
    // A script file avoids command-line size limits for longer stored cue text.
    const filterPath = join(dir, "filters.txt");
    await writeFile(filterPath, filters.join(";\n"));
    args.push("-filter_complex_script", filterPath, "-map", "[out]", "-map", audioLabel ? `[${audioLabel}]` : "1:a:0", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-threads", String(VIDEO_RENDER_LIMITS.threads), "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", audioCopied ? "copy" : "aac");
    if (!audioCopied) args.push("-b:a", "192k");
    args.push("-t", String(duration), "-movflags", "+faststart", "-map_metadata", "-1", "-metadata", "title=Delivery performance", "-metadata", `comment=${input.invitationUrl}`, "-fs", String(VIDEO_RENDER_LIMITS.outputBytes), partial);
    await run(process.env.FFMPEG_PATH || "ffmpeg", args, signal);
    const [output, info] = await Promise.all([stat(partial), probe(partial, signal)]);
    const video = info.streams?.find((stream) => stream.codec_type === "video");
    const sound = info.streams?.find((stream) => stream.codec_type === "audio");
    const actualDuration = numeric(info.format?.duration);
    if (output.size >= VIDEO_RENDER_LIMITS.outputBytes || video?.codec_name !== "h264" || sound?.codec_name !== "aac" || video.width !== W || video.height !== H || Math.abs(actualDuration - duration) > 0.15) throw new VideoRenderError("RENDER_VALIDATION", "The finished video could not be verified. Try creating it again.");
    if (signal?.aborted) throw new VideoRenderError("RENDER_INTERRUPTED", "Video creation was interrupted. Try again.");
    await rename(partial, input.outputPath);
    return { path: input.outputPath, bytes: output.size, duration: actualDuration, width: W, height: H, videoCodec: "h264", audioCodec: "aac", renderMs: Date.now() - started, audioCopied };
  } finally { clearTimeout(timeout); await rm(dir, { recursive: true, force: true }); }
}
