// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createImportedBacking, inspectUploadedSource, prepareImportedMedia, resolveAndDownloadSource, validateSourceUrl } from "./say-import-media";

describe("public import URL boundary", () => {
  it.each([
    ["https://youtu.be/Abcdefg_123?si=tracking", "https://www.youtube.com/watch?v=Abcdefg_123"],
    ["https://m.youtube.com/watch?v=Abcdefg_123&t=10", "https://www.youtube.com/watch?v=Abcdefg_123"],
    ["https://www.youtube.com/shorts/Abcdefg_123?feature=share", "https://www.youtube.com/shorts/Abcdefg_123"],
    ["https://www.twitch.tv/creator/clip/FunnyClipSlug?tt_content=sharing", "https://clips.twitch.tv/FunnyClipSlug"],
    ["https://clips.twitch.tv/FunnyClipSlug/", "https://clips.twitch.tv/FunnyClipSlug"],
    ["https://instagram.com/reel/Abcdef_123/?igsh=tracking", "https://www.instagram.com/reel/Abcdef_123/"],
    ["https://m.tiktok.com/@creator.name/video/1234567890123456789?is_from_webapp=1", "https://www.tiktok.com/@creator.name/video/1234567890123456789"],
  ])("normalizes the individual post %s", (input, output) => { expect(validateSourceUrl(input)).toBe(output); });

  it.each([
    "https://127.0.0.1/watch?v=Abcdefg_123", "https://[::1]/watch?v=Abcdefg_123", "https://localhost/reel/abcdef",
    "file:///etc/passwd", "http://youtube.com/watch?v=Abcdefg_123", "https://youtube.com.evil.test/watch?v=Abcdefg_123",
    "https://evil.test@youtube.com/watch?v=Abcdefg_123", "https://youtube.com:8443/watch?v=Abcdefg_123",
    "https://youtube.com/watch?v=Abcdefg_123&list=PLanything", "https://youtube.com/playlist?list=PLanything",
    "https://youtube.com/watch?v=Abcdefg_123&v=Different12", "https://youtube.com/live/Abcdefg_123",
    "https://youtube.com/redirect?q=https://localhost", "https://www.twitch.tv/creator", "https://www.twitch.tv/videos/12345",
    "https://instagram.com/p/Abcdef_123/", "https://vm.tiktok.com/ABC123/", "https://www.tiktok.com/@creator/live",
    "https://www.youtube.com\\@localhost/watch?v=Abcdefg_123", "https://youtube.com./watch?v=Abcdefg_123",
  ])("rejects unsupported, ambiguous, or non-public targets %s", (input) => {
    expect(() => validateSourceUrl(input)).toThrow(expect.objectContaining({ code: "SAY_IMPORT_URL" }));
  });
});

const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
function mediaInfo(path: string) {
  return JSON.parse(execFileSync(ffprobe, ["-v", "error", "-show_format", "-show_streams", "-of", "json", path], { timeout: 10_000 }).toString());
}
function rms(path: string, start: number, duration: number) {
  const pcm = execFileSync(ffmpeg, ["-v", "error", "-nostdin", "-threads", "2", "-i", path, "-ss", String(start), "-t", String(duration), "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"], { timeout: 10_000 });
  let squares = 0;
  for (let i = 0; i + 4 <= pcm.length; i += 4) squares += pcm.readFloatLE(i) ** 2;
  return Math.sqrt(squares / (pcm.length / 4));
}

describe("real imported media pipeline", () => {
  let directory: string;
  let source: string;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "delivery-say-import-test-"));
    source = join(directory, "original.mp4");
    execFileSync(ffmpeg, ["-v", "error", "-nostdin", "-y", "-threads", "2", "-filter_threads", "2", "-f", "lavfi", "-i", "testsrc2=size=1280x960:rate=60", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "3", "-c:v", "libx264", "-preset", "ultrafast", "-threads", "2", "-c:a", "aac", "-pix_fmt", "yuv420p", source], { timeout: 20_000 });
  }, 25_000);
  afterAll(async () => { vi.unstubAllEnvs(); if (directory) await rm(directory, { recursive: true, force: true }); });

  it("trims, normalizes actual video/audio, and keeps sound only outside selected dialogue", async () => {
    expect((await inspectUploadedSource(source)).duration).toBeCloseTo(3, 1);
    const prepared = await prepareImportedMedia(source, join(directory, "prepared"), { start: 0.5, end: 2.5 });
    expect(prepared.duration).toBeCloseTo(2, 1);
    const info = mediaInfo(prepared.videoPath);
    expect(info.streams.find((stream: { codec_type: string }) => stream.codec_type === "video")).toMatchObject({ codec_name: "h264", width: 960, height: 720, pix_fmt: "yuv420p", r_frame_rate: "30/1" });
    expect(info.streams.find((stream: { codec_type: string }) => stream.codec_type === "audio")).toMatchObject({ codec_name: "aac" });
    expect(mediaInfo(prepared.referencePath).streams[0]).toMatchObject({ codec_name: "pcm_s16le", channels: 1, sample_rate: "16000" });
    expect((await readFile(prepared.posterPath)).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));

    const backing = await createImportedBacking(prepared.videoPath, join(directory, "backing.m4a"), [{ start: 0.7, end: 1.3 }]);
    const backingInfo = mediaInfo(backing);
    expect(backingInfo.streams).toHaveLength(1);
    expect(backingInfo.streams[0]).toMatchObject({ codec_type: "audio", codec_name: "aac" });
    expect(rms(backing, 0.85, 0.3)).toBeLessThan(0.001);
    expect(rms(backing, 0.15, 0.3)).toBeGreaterThan(0.04);
    expect(rms(backing, 1.55, 0.3)).toBeGreaterThan(0.04);
    expect(rms(backing, 0.15, 0.3) / rms(prepared.videoPath, 0.15, 0.3)).toBeCloseTo(1, 1);
  }, 25_000);

  it("rejects oversized excerpts, invalid cue times, missing audio, fake videos, and cancelled work", async () => {
    await expect(prepareImportedMedia(source, directory, { start: 0, end: 46 })).rejects.toMatchObject({ code: "SAY_IMPORT_TRIM" });
    await expect(prepareImportedMedia(source, directory, { start: 1, end: 4 })).rejects.toMatchObject({ code: "SAY_IMPORT_TRIM" });
    await expect(createImportedBacking(source, join(directory, "bad.m4a"), [{ start: NaN, end: 1 }])).rejects.toMatchObject({ code: "SAY_IMPORT_CUES" });
    const fake = join(directory, "fake.mp4");
    await writeFile(fake, "#EXTM3U\nhttp://127.0.0.1/internal.ts");
    await expect(inspectUploadedSource(fake)).rejects.toMatchObject({ code: "SAY_IMPORT_MEDIA" });
    const silentVideo = join(directory, "no-audio.mp4");
    execFileSync(ffmpeg, ["-v", "error", "-i", source, "-map", "0:v:0", "-c", "copy", silentVideo], { timeout: 10_000 });
    await expect(inspectUploadedSource(silentVideo)).rejects.toMatchObject({ code: "SAY_IMPORT_MEDIA" });
    const controller = new AbortController(); controller.abort();
    await expect(inspectUploadedSource(source, controller.signal)).rejects.toMatchObject({ code: "SAY_IMPORT_INTERRUPTED" });
  }, 20_000);

  it("rejects live metadata before downloading, with sanitized downloader errors and no config/auth", async () => {
    const mockDownloader = join(directory, "downloader.cjs");
    await writeFile(mockDownloader, `#!${process.execPath}\nconst args = process.argv.slice(2);\nif (!['--ignore-config','--no-plugin-dirs','--no-cookies','--no-cookies-from-browser','--no-remote-components'].every(flag => args.includes(flag))) process.exit(3);\nif (!args.includes('--dump-single-json')) process.exit(4);\nprocess.stdout.write(JSON.stringify({duration: 3, is_live: true, title:'private title'}));\n`, { mode: 0o700 });
    vi.stubEnv("YT_DLP_PATH", mockDownloader);
    const downloadDir = join(directory, "mock-download");
    await mkdir(downloadDir);
    await expect(resolveAndDownloadSource("https://youtu.be/Abcdefg_123", downloadDir)).rejects.toMatchObject({ code: "SAY_IMPORT_PUBLIC_ONLY" });
    vi.unstubAllEnvs();
  });

  it("uses measured downloaded duration and cancels a running retrieval with cleanup", async () => {
    const mockDownloader = join(directory, "success-downloader.cjs");
    await writeFile(mockDownloader, `#!${process.execPath}\nconst fs = require('node:fs'); const args = process.argv.slice(2);\nif (args.includes('--dump-single-json')) process.stdout.write(JSON.stringify({duration: 2, title:'Scene title', uploader:'Creator'}));\nelse fs.copyFileSync(${JSON.stringify(source)}, args[args.indexOf('--output') + 1]);\n`, { mode: 0o700 });
    vi.stubEnv("YT_DLP_PATH", mockDownloader);
    const downloaded = await resolveAndDownloadSource("https://youtu.be/Abcdefg_123?si=drop", join(directory, "success"));
    expect(downloaded).toMatchObject({ duration: 3, title: "Scene title", creator: "Creator", sourceUrl: "https://www.youtube.com/watch?v=Abcdefg_123" });
    expect(downloaded.path.endsWith("/download/source.mp4")).toBe(true);

    await writeFile(mockDownloader, `#!${process.execPath}\nsetInterval(() => {}, 1000);\n`, { mode: 0o700 });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 100);
    try {
      await expect(resolveAndDownloadSource("https://youtu.be/Abcdefg_123", join(directory, "cancelled"), controller.signal)).rejects.toMatchObject({ code: "SAY_IMPORT_INTERRUPTED" });
    } finally { clearTimeout(timeout); vi.unstubAllEnvs(); }
    await expect(readFile(join(directory, "cancelled", "download", "source.mp4"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
