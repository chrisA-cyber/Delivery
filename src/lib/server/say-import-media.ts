import "server-only";

import { spawn } from "node:child_process";
import { lstat, mkdir, readdir, rm } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { AppError } from "@/lib/server/api-error";

export const SAY_IMPORT_MEDIA_LIMITS = Object.freeze({
  sourceSeconds: 180,
  sourceBytes: 80 * 1024 * 1024,
  excerptSeconds: 45,
  downloadTimeoutMs: 120_000,
  renderTimeoutMs: 120_000,
  threads: 2,
});

export interface ImportInterval { start: number; end: number }
export interface DownloadedImportSource { path: string; title: string; creator: string; sourceUrl: string; duration: number }
export interface PreparedImportMedia { videoPath: string; posterPath: string; referencePath: string; duration: number }

function invalidUrl(): never {
  throw new AppError("SAY_IMPORT_URL", "Use a public YouTube video or Short, Twitch clip, Instagram Reel, or full TikTok video link.");
}

/** Only individual public posts; tracking parameters never reach the downloader. */
export function validateSourceUrl(input: string): string {
  if (typeof input !== "string" || input.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(input.trim())) invalidUrl();
  let url: URL;
  try { url = new URL(input.trim()); } catch { return invalidUrl(); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hostname.endsWith(".")) invalidUrl();
  if (["list", "playlist", "index"].some((key) => url.searchParams.has(key))) invalidUrl();
  const host = url.hostname;
  const path = url.pathname;
  const youtubeId = /^[A-Za-z0-9_-]{11}$/;
  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    if (path === "/watch" && url.searchParams.getAll("v").length === 1 && youtubeId.test(url.searchParams.get("v")!)) {
      return `https://www.youtube.com/watch?v=${url.searchParams.get("v")}`;
    }
    const match = /^\/shorts\/([A-Za-z0-9_-]{11})\/?$/.exec(path);
    if (match) return `https://www.youtube.com/shorts/${match[1]}`;
    invalidUrl();
  }
  if (host === "youtu.be") {
    const match = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(path);
    if (match) return `https://www.youtube.com/watch?v=${match[1]}`;
    invalidUrl();
  }
  if (host === "clips.twitch.tv") {
    if (/^\/[A-Za-z0-9_-]{4,200}\/?$/.test(path)) return `https://clips.twitch.tv/${path.split("/")[1]}`;
    invalidUrl();
  }
  if (["twitch.tv", "www.twitch.tv", "m.twitch.tv"].includes(host)) {
    const match = /^\/[A-Za-z0-9_]{1,25}\/clip\/([A-Za-z0-9_-]{4,200})\/?$/.exec(path);
    if (match) return `https://clips.twitch.tv/${match[1]}`;
    invalidUrl();
  }
  if (["instagram.com", "www.instagram.com"].includes(host)) {
    const match = /^\/reel\/([A-Za-z0-9_-]{5,64})\/?$/.exec(path);
    if (match) return `https://www.instagram.com/reel/${match[1]}/`;
    invalidUrl();
  }
  if (["tiktok.com", "www.tiktok.com", "m.tiktok.com"].includes(host)) {
    const match = /^\/@([A-Za-z0-9._]{1,32})\/video\/(\d{10,25})\/?$/.exec(path);
    if (match) return `https://www.tiktok.com/@${match[1]}/video/${match[2]}`;
    invalidUrl();
  }
  // Short-link redirectors, embeds, arbitrary hosts/IPs and live pages fail closed.
  return invalidUrl();
}

interface ProcessOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxOutputBytes?: number;
  downloadDirectory?: string;
}

function interrupted(): AppError { return new AppError("SAY_IMPORT_INTERRUPTED", "Scene import was interrupted. Try again.", 409); }
function sourceLimit(): AppError { return new AppError("SAY_IMPORT_SOURCE_LIMIT", "Choose a video up to 3 minutes and 80 MB.", 422); }

async function directoryBytes(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true });
  let bytes = 0;
  for (const entry of entries) {
    if (!entry.isFile()) throw sourceLimit();
    try { bytes += (await lstat(join(directory, entry.name))).size; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  return bytes;
}

/** No shell, credentials, config/plugins, unbounded logs, or abandoned process. */
async function run(binary: string, args: string[], options: ProcessOptions = {}): Promise<Buffer> {
  if (options.signal?.aborted) throw interrupted();
  return new Promise((resolveResult, reject) => {
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"], shell: false, windowsHide: true, detached: process.platform !== "win32",
      // The importer has no reason to expose application secrets to a subprocess.
      env: { PATH: process.env.PATH, LANG: "C.UTF-8", NODE_ENV: process.env.NODE_ENV ?? "production", ...(process.platform === "win32" ? { SystemRoot: process.env.SystemRoot } : {}) },
    });
    let failure: AppError | undefined;
    let settled = false;
    let outputBytes = 0;
    let checkingSize = false;
    const chunks: Buffer[] = [];
    const stop = (error: AppError) => {
      failure ??= error;
      // yt-dlp may briefly spawn its bundled JavaScript extractor. Stop the
      // whole process group so cancellation cannot leave that child running.
      if (process.platform !== "win32" && child.pid) {
        try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
      } else child.kill("SIGKILL");
    };
    const abort = () => stop(interrupted());
    const timeout = setTimeout(() => stop(new AppError("SAY_IMPORT_TIMEOUT", "That video took too long to process. Try a shorter clip or upload the file.", 422)), options.timeoutMs ?? SAY_IMPORT_MEDIA_LIMITS.renderTimeoutMs);
    const sizeCheck = options.downloadDirectory ? setInterval(() => {
      if (checkingSize || settled) return;
      checkingSize = true;
      void directoryBytes(options.downloadDirectory!).then((bytes) => {
        if (!settled && bytes > SAY_IMPORT_MEDIA_LIMITS.sourceBytes) stop(sourceLimit());
      }).catch(() => { if (!settled) stop(sourceLimit()); }).finally(() => { checkingSize = false; });
    }, 100) : undefined;
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > (options.maxOutputBytes ?? 2 * 1024 * 1024)) stop(new AppError("SAY_IMPORT_MEDIA", "That video could not be read. Try another clip.", 422));
      else chunks.push(chunk);
    });
    // Provider/decoder output can contain signed URLs or untrusted metadata.
    child.stderr.on("data", () => undefined);
    const finish = (error?: AppError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (sizeCheck) clearInterval(sizeCheck);
      options.signal?.removeEventListener("abort", abort);
      if (error) reject(error); else resolveResult(Buffer.concat(chunks));
    };
    child.once("error", () => finish(new AppError("SAY_IMPORT_UNAVAILABLE", "Scene import is temporarily unavailable.", 503)));
    child.once("close", (code) => finish(failure ?? (code === 0 ? undefined : new AppError("SAY_IMPORT_MEDIA", "That public video could not be read. It may require sign-in or be unavailable. Try another link or upload the file.", 422))));
  });
}

const INPUT_ARGS = ["-protocol_whitelist", "file,pipe", "-format_whitelist", "mov,matroska,webm,avi,ogg"];
interface Probe {
  format?: { duration?: string };
  streams?: { codec_type?: string; codec_name?: string; duration?: string; width?: number; height?: number; channels?: number; sample_rate?: string; r_frame_rate?: string; disposition?: { attached_pic?: number } }[];
}
const VIDEO_CODECS = new Set(["h264", "hevc", "vp8", "vp9", "av1", "mpeg4", "mjpeg", "prores"]);
const AUDIO_CODECS = new Set(["aac", "mp3", "opus", "vorbis", "pcm_s16le", "pcm_s24le", "pcm_s32le", "pcm_f32le", "pcm_s16be", "alac", "flac", "ac3", "eac3"]);

async function probe(path: string, signal?: AbortSignal): Promise<Probe> {
  if (!isAbsolute(path)) throw new AppError("SAY_IMPORT_MEDIA", "The source video is unavailable.", 422);
  const output = await run(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-threads", "2", ...INPUT_ARGS, "-show_format", "-show_streams", "-of", "json", path], { signal, timeoutMs: 15_000 });
  try { return JSON.parse(output.toString("utf8")) as Probe; }
  catch { throw new AppError("SAY_IMPORT_MEDIA", "That video could not be read. Try another clip.", 422); }
}

async function inspect(path: string, signal?: AbortSignal): Promise<{ duration: number; probe: Probe }> {
  const file = await lstat(path);
  if (!file.isFile() || file.size <= 0 || file.size > SAY_IMPORT_MEDIA_LIMITS.sourceBytes) throw sourceLimit();
  const media = await probe(path, signal);
  const duration = Number(media.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > SAY_IMPORT_MEDIA_LIMITS.sourceSeconds) throw sourceLimit();
  const video = media.streams?.find((stream) => stream.codec_type === "video" && !stream.disposition?.attached_pic);
  const audio = media.streams?.find((stream) => stream.codec_type === "audio");
  if (!video || !audio || !VIDEO_CODECS.has(video.codec_name ?? "") || !AUDIO_CODECS.has(audio.codec_name ?? "") ||
    !Number.isFinite(video.width) || !Number.isFinite(video.height) || video.width! < 2 || video.height! < 2 || video.width! > 8192 || video.height! > 8192 || video.width! * video.height! > 4096 * 2160 ||
    !Number.isFinite(audio.channels) || audio.channels! < 1 || audio.channels! > 8 || !Number.isFinite(Number(audio.sample_rate)) || Number(audio.sample_rate) < 8000 || Number(audio.sample_rate) > 192000) {
    throw new AppError("SAY_IMPORT_MEDIA", "Choose a playable MP4, MOV, or WebM video with spoken audio.", 422);
  }
  if (media.streams?.some((stream) => Number(stream.duration) > SAY_IMPORT_MEDIA_LIMITS.sourceSeconds)) throw sourceLimit();
  return { duration, probe: media };
}

export async function inspectUploadedSource(path: string, signal?: AbortSignal): Promise<{ duration: number }> {
  return { duration: (await inspect(path, signal)).duration };
}

function metadataText(value: unknown, fallback: string, maxLength: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength) || fallback : fallback;
}

export async function resolveAndDownloadSource(input: string, dir: string, signal?: AbortSignal): Promise<DownloadedImportSource> {
  const sourceUrl = validateSourceUrl(input);
  const directory = resolve(dir, "download");
  await mkdir(directory, { recursive: true });
  if ((await readdir(directory)).length) throw new AppError("SAY_IMPORT_MEDIA", "The scene import workspace is already in use.", 409);
  const path = join(directory, "source.mp4");
  const deadline = Date.now() + SAY_IMPORT_MEDIA_LIMITS.downloadTimeoutMs;
  const timeoutMs = () => Math.max(1, deadline - Date.now());
  const binary = process.env.YT_DLP_PATH || "yt-dlp";
  const common = [
    "--ignore-config", "--no-plugin-dirs", "--no-update", "--no-cache-dir", "--no-playlist",
    "--no-cookies", "--no-cookies-from-browser", "--no-remote-components", "--xff", "never", "--proxy", "",
    "--no-js-runtimes", "--js-runtimes", `node:${process.execPath}`,
    "--use-extractors", "^youtube$,^twitch:clips$,^instagram$,^tiktok$", "--socket-timeout", "15", "--retries", "1", "--extractor-retries", "1",
    "--no-warnings", "--no-progress", "--abort-on-error", "--fixup", "never",
    // A single progressive HTTPS file prevents downloader/merger grandchildren,
    // unsafe transport protocols, and separate-stream size-limit multiplication.
    "--format", "b[protocol=https][height<=720][vcodec^=avc1][acodec^=mp4a]/b[protocol=https][height<=720]",
    "--match-filters", "duration <= 180 & !is_live & !was_live",
    "--max-filesize", String(SAY_IMPORT_MEDIA_LIMITS.sourceBytes),
  ];
  try {
    const raw = await run(binary, [...common, "--dump-single-json", "--skip-download", "--", sourceUrl], { signal, timeoutMs: timeoutMs(), maxOutputBytes: 8 * 1024 * 1024 });
    let metadata: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw.toString("utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid metadata");
      metadata = parsed as Record<string, unknown>;
    }
    catch { throw new AppError("SAY_IMPORT_MEDIA", "That video could not be read. Try another link or upload the file.", 422); }
    const advertisedDuration = Number(metadata.duration);
    if (metadata._type && metadata._type !== "video" || metadata.entries || metadata.is_live || metadata.was_live || metadata.has_drm ||
      ["is_live", "is_upcoming", "post_live", "was_live"].includes(String(metadata.live_status)) ||
      ["private", "premium_only", "subscriber_only", "needs_auth"].includes(String(metadata.availability))) {
      throw new AppError("SAY_IMPORT_PUBLIC_ONLY", "Choose a public, recorded video that plays without signing in.", 422);
    }
    if (!Number.isFinite(advertisedDuration) || advertisedDuration <= 0 || advertisedDuration > SAY_IMPORT_MEDIA_LIMITS.sourceSeconds || Number(metadata.filesize) > SAY_IMPORT_MEDIA_LIMITS.sourceBytes) throw sourceLimit();
    await run(binary, [...common, "--no-simulate", "--no-mtime", "--no-continue", "--output", path, "--", sourceUrl], { signal, timeoutMs: timeoutMs(), downloadDirectory: directory });
    const { duration } = await inspectUploadedSource(path, signal);
    return { path, title: metadataText(metadata.title, "Imported scene", 100), creator: metadataText(metadata.uploader ?? metadata.channel ?? metadata.creator, "Original creator", 100), sourceUrl, duration };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

function ffmpeg(args: string[], signal?: AbortSignal): Promise<Buffer> {
  return run(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-nostdin", "-y", "-threads", "2", "-filter_threads", "2", ...args], { signal });
}

export async function prepareImportedMedia(sourcePath: string, dir: string, interval: ImportInterval, signal?: AbortSignal): Promise<PreparedImportMedia> {
  const requestedDuration = interval.end - interval.start;
  if (!Number.isFinite(interval.start) || !Number.isFinite(interval.end) || interval.start < 0 || requestedDuration <= 0 || requestedDuration > SAY_IMPORT_MEDIA_LIMITS.excerptSeconds) {
    throw new AppError("SAY_IMPORT_TRIM", "Choose an excerpt between 0 and 45 seconds long.", 422);
  }
  const source = await inspect(sourcePath, signal);
  if (interval.end > source.duration + 0.05) throw new AppError("SAY_IMPORT_TRIM", "The excerpt extends past the end of this video.", 422);
  const directory = resolve(dir);
  await mkdir(directory, { recursive: true });
  const videoPath = join(directory, "scene.mp4");
  const posterPath = join(directory, "poster.jpg");
  const referencePath = join(directory, "reference.wav");
  if ([videoPath, posterPath, referencePath].includes(resolve(sourcePath))) throw new AppError("SAY_IMPORT_MEDIA", "The source and excerpt must use different files.", 422);
  try {
    await ffmpeg([...INPUT_ARGS, "-ss", String(interval.start), "-i", sourcePath, "-t", String(requestedDuration), "-map", "0:V:0", "-map", "0:a:0", "-map_metadata", "-1", "-map_chapters", "-1",
      "-vf", "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=30",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-threads", "2", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", "-fs", String(SAY_IMPORT_MEDIA_LIMITS.sourceBytes), videoPath], signal);
    const rendered = await inspect(videoPath, signal);
    const video = rendered.probe.streams?.find((stream) => stream.codec_type === "video");
    const audio = rendered.probe.streams?.find((stream) => stream.codec_type === "audio");
    if (rendered.duration > 45.05 || Math.abs(rendered.duration - requestedDuration) > 0.25 || video?.codec_name !== "h264" || audio?.codec_name !== "aac" || video.width! > 1280 || video.height! > 720) {
      throw new AppError("SAY_IMPORT_MEDIA", "That excerpt could not be prepared completely. Try another selection.", 422);
    }
    await ffmpeg([...INPUT_ARGS, "-i", videoPath, "-map", "0:a:0", "-vn", "-t", String(requestedDuration), "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-map_metadata", "-1", referencePath], signal);
    await ffmpeg([...INPUT_ARGS, "-i", videoPath, "-map", "0:v:0", "-frames:v", "1", "-q:v", "3", "-update", "1", posterPath], signal);
    if ((await lstat(referencePath)).size <= 44 || (await lstat(posterPath)).size <= 0) throw new AppError("SAY_IMPORT_MEDIA", "That excerpt has no usable audio or picture.", 422);
    return { videoPath, posterPath, referencePath, duration: Math.min(requestedDuration, rendered.duration) };
  } catch (error) {
    await Promise.all([videoPath, posterPath, referencePath].map((path) => rm(path, { force: true })));
    throw error;
  }
}

/** This mutes all sound during selected dialogue, retaining the original mix elsewhere. */
export async function createImportedBacking(videoPath: string, outputPath: string, intervals: ImportInterval[], signal?: AbortSignal): Promise<string> {
  if (!isAbsolute(outputPath) || resolve(videoPath) === resolve(outputPath) || intervals.length > 100 || intervals.some(({ start, end }) => !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > 45)) {
    throw new AppError("SAY_IMPORT_CUES", "The selected dialogue timing is invalid.", 422);
  }
  const { duration } = await inspectUploadedSource(videoPath, signal);
  if (duration > 45.05 || intervals.some(({ end }) => end > duration + 0.05)) throw new AppError("SAY_IMPORT_CUES", "The selected dialogue extends past this excerpt.", 422);
  const expression = intervals.map(({ start, end }) => `between(t,${start.toFixed(6)},${end.toFixed(6)})`).join("+");
  try {
    await ffmpeg([...INPUT_ARGS, "-i", videoPath, "-map", "0:a:0", "-vn", "-t", String(Math.min(duration, 45)),
      ...(expression ? ["-af", `volume=0:enable='${expression}'`] : []),
      "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2", "-map_metadata", "-1", "-map_chapters", "-1", "-movflags", "+faststart", "-f", "ipod", outputPath], signal);
    if ((await lstat(outputPath)).size <= 0) throw new AppError("SAY_IMPORT_MEDIA", "The scene backing could not be prepared.", 422);
    return outputPath;
  } catch (error) { await rm(outputPath, { force: true }); throw error; }
}
