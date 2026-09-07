import { describe, expect, it } from "vitest";
// @ts-expect-error Sharp's export map omits its bundled declarations.
import sharp from "sharp";
import { defaultClipEditSettings } from "@/lib/video-composition";
import { normalizeAvatarUpload, validateClipAvatar, validateClipSettings, readBoundedClipBody } from "@/lib/server/clip-editor";
import type { ExportSource } from "@/lib/server/video-export-sources";

describe("bounded custom avatars and non-destructive clip edits", () => {
  it("normalizes large camera images, strips metadata and keeps normalized bytes stable", async () => {
    const image = await sharp({ create: { width: 1200, height: 800, channels: 4, background: { r: 255, g: 70, b: 120, alpha: 0.5 } } }).png().toBuffer();
    const avatar = await normalizeAvatarUpload(image, "image/png");
    expect(avatar.kind).toBe("upload");
    if (avatar.kind !== "upload") throw new Error("Expected upload");
    const metadata = await sharp(Buffer.from(avatar.dataUrl.split(",")[1]!, "base64")).metadata();
    expect(metadata.width).toBe(512); expect(metadata.height).toBe(341);
    expect(metadata.hasAlpha).toBe(true); expect(metadata.exif).toBeUndefined();
    expect(await validateClipAvatar(avatar)).toEqual(avatar);
  });
  it("rejects SVG, forged MIME, corrupt raster and oversized saved image dimensions", async () => {
    await expect(normalizeAvatarUpload(Buffer.from("<svg/>"), "image/svg+xml")).rejects.toMatchObject({ status: 400 });
    const image = await sharp({ create: { width: 600, height: 600, channels: 3, background: "red" } }).png().toBuffer();
    await expect(normalizeAvatarUpload(image, "image/jpeg")).rejects.toMatchObject({ status: 400 });
    await expect(validateClipAvatar({ kind: "upload", dataUrl: `data:image/png;base64,${image.toString("base64")}` })).rejects.toMatchObject({ status: 400 });
    await expect(validateClipAvatar({ kind: "upload", dataUrl: "data:image/png;base64,Y29ycnVwdA==" })).rejects.toMatchObject({ status: 400 });
  });
  it("caps streamed bodies even without Content-Length", async () => {
    const request = new Request("https://delivery.test/api/avatars", { method: "POST", body: "too many bytes" });
    await expect(readBoundedClipBody(request, 5)).rejects.toMatchObject({ status: 413 });
  });
  it("validates trim against the immutable source and keeps its timing and scoring unchanged", async () => {
    const source = { input: { durationMs: 5000, recordingOffsetMs: 120, assignment: { mode: "classic" }, score: { value: 82, label: "Delivery score" } } } as ExportSource;
    const before = structuredClone(source);
    const settings = { ...defaultClipEditSettings("classic"), trimStart: 1.2, trimEnd: 4.5 };
    expect(await validateClipSettings(settings, source)).toEqual(settings);
    expect(source).toEqual(before);
    await expect(validateClipSettings({ ...settings, trimEnd: 7 }, source)).rejects.toMatchObject({ code: "CLIP_TRIM_INVALID" });
    await expect(validateClipSettings({ ...settings, trimStart: 4.8, trimEnd: null }, source)).rejects.toMatchObject({ code: "CLIP_TRIM_INVALID" });
  });
  it("moves legacy Switch preset positions while preserving custom placement and the take", async () => {
    const source = { input: { durationMs: 20000, recordingOffsetMs: 0, assignment: { mode: "switch" } } } as ExportSource;
    const before = structuredClone(source);
    const legacy = { ...defaultClipEditSettings("switch"), avatarX: 0.5, avatarY: 0.34, avatarSize: 0.49, trimStart: 1, trimEnd: 12 };
    delete legacy.layoutRevision;
    const migrated = await validateClipSettings(legacy, source);
    expect(migrated).toMatchObject({ ...defaultClipEditSettings("switch"), trimStart: 1, trimEnd: 12 });
    expect(source).toEqual(before);
    const custom = { ...legacy, avatarX: 0.7, avatarY: 0.72, avatarSize: 0.3 };
    expect(await validateClipSettings(custom, source)).toMatchObject({ avatarX: 0.7, avatarY: 0.72, avatarSize: 0.3, layoutRevision: 3 });
  });
});
