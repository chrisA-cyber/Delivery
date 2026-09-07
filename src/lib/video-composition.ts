import { z } from "zod";
import { VISUAL_THEME as C } from "./visual-theme";
import { BRAND_MARK_PATH, brandGradientSvg } from "./brand";
import type { SwitchChallenge } from "./switch/types";
import type { SayClip } from "./say-it-back/types";
import emojiImages from "./video-emoji.json";

export const VIDEO_LAYOUT_VERSION = "delivery-vertical-v6-full-camera" as const;
export const COMPOSITION_WIDTH = 1080;
export const COMPOSITION_HEIGHT = 1920;
export const AUDIO_LEVEL_FPS = 15;
export const BUILTIN_AVATARS = [
  { id: "fox", name: "Fox", color: C.orange, imageUrl: "/avatars/fox.webp" },
  { id: "cloud", name: "Cloud", color: C.blue, imageUrl: "/avatars/cloud.webp" },
  { id: "star", name: "Star", color: C.accent, imageUrl: "/avatars/star.webp" },
  { id: "robot", name: "Robot", color: C.violet, imageUrl: "/avatars/robot.webp" },
  { id: "alien", name: "Alien", color: "#ace89b", imageUrl: "/avatars/alien.webp" },
  { id: "cat", name: "Cat", color: C.pink, imageUrl: "/avatars/cat.webp" },
] as const;
export const clipAvatarSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("builtin"), id: z.string().refine((id) => BUILTIN_AVATARS.some((item) => item.id === id), "Choose an available avatar") }).strict(),
  z.object({ kind: z.literal("upload"), dataUrl: z.string().max(700_000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/, "Choose a PNG, JPEG or WebP image") }).strict(),
]);
export type ClipAvatar = z.infer<typeof clipAvatarSchema>;
export const clipEditSettingsSchema = z.object({
  performer: z.enum(["avatar", "camera"]).default("avatar"), cameraZoom: z.number().finite().min(1).max(3).default(1), cameraCropX: z.number().finite().min(0).max(1).default(0.5), cameraCropY: z.number().finite().min(0).max(1).default(0.5), cameraMirror: z.boolean().optional(),
  version: z.literal(1), layoutRevision: z.literal(3).optional(), layout: z.enum(["spotlight", "duet"]), avatar: clipAvatarSchema,
  reducedMotion: z.boolean().default(false), avatarVisible: z.boolean(), avatarX: z.number().finite().min(0).max(1), avatarY: z.number().finite().min(0).max(1),
  avatarSize: z.number().finite().min(0.14).max(0.7), captions: z.boolean(), includeName: z.boolean(), includeScore: z.boolean(),
  trimStart: z.number().finite().min(0).max(45), trimEnd: z.number().finite().min(0).max(45).nullable(),
}).strict().refine((value) => value.trimEnd === null || value.trimEnd - value.trimStart >= 0.5, { message: "Keep at least half a second", path: ["trimEnd"] });
export type ClipEditSettings = z.infer<typeof clipEditSettingsSchema>;
export type CompositionMode = "classic" | "switch" | "say-it-back";
export function defaultClipEditSettings(mode: CompositionMode): ClipEditSettings {
  return { performer: "avatar", cameraZoom: 1, cameraCropX: 0.5, cameraCropY: 0.5, version: 1, layoutRevision: 3, layout: "spotlight", avatar: { kind: "builtin", id: "fox" }, reducedMotion: false, avatarVisible: true,
    avatarX: mode === "say-it-back" ? 0.79 : 0.5, avatarY: mode === "say-it-back" ? 0.60 : mode === "switch" ? 0.51 : 0.35,
    avatarSize: mode === "say-it-back" ? 0.23 : mode === "switch" ? 0.57 : 0.55,
    captions: true, includeName: true, includeScore: true, trimStart: 0, trimEnd: null };
}
export function layoutClipEditSettings(mode: CompositionMode, layout: ClipEditSettings["layout"]): Pick<ClipEditSettings, "layout" | "avatarX" | "avatarY" | "avatarSize"> {
  const initial = defaultClipEditSettings(mode);
  if (layout === "spotlight") return { layout, avatarX: initial.avatarX, avatarY: initial.avatarY, avatarSize: initial.avatarSize };
  return { layout, avatarX: mode === "say-it-back" ? 0.205 : mode === "switch" ? 0.5 : 0.275, avatarY: mode === "say-it-back" ? 0.665 : mode === "switch" ? 0.48 : 0.44, avatarSize: mode === "say-it-back" ? 0.25 : mode === "switch" ? 0.64 : 0.43 };
}
/** Only previous preset coordinates move; intentional custom placement survives. */
export function migrateClipEditSettings(mode: CompositionMode, settings: ClipEditSettings): ClipEditSettings {
  if (settings.layoutRevision === 3) return settings;
  const previous = settings.layout === "spotlight" ? { x: 0.5, y: 0.34, size: 0.49 } : { x: 0.275, y: 0.465, size: 0.43 };
  const matches = Math.abs(settings.avatarX - previous.x) < 0.000001 && Math.abs(settings.avatarY - previous.y) < 0.000001 && Math.abs(settings.avatarSize - previous.size) < 0.000001;
  return { ...settings, ...(mode === "switch" && matches ? layoutClipEditSettings(mode, settings.layout) : {}), layoutRevision: 3 };
}
export type CompositionScene = { duration: number; invitationUrl?: string; displayName?: string | null; score?: { value: number; label: string; beta?: boolean } | null } & (
  | { mode: "classic"; classic: { phrase: string; direction: string } }
  | { mode: "switch"; switch: SwitchChallenge }
  | { mode: "say-it-back"; say: { clip: SayClip; roleId: string } }
);
export interface CompositionFrame { x: number; y: number; width: number; height: number }
export function fullFrameCamera(settings?: Pick<ClipEditSettings, "performer" | "layout">): boolean { return settings?.performer === "camera" && settings.layout === "spotlight"; }
export function cameraFrame(settings: ClipEditSettings): CompositionFrame { return fullFrameCamera(settings) ? { x: 0, y: 0, width: COMPOSITION_WIDTH, height: COMPOSITION_HEIGHT } : avatarFrame(settings); }
export function sceneFrame(settings: ClipEditSettings): CompositionFrame { if (fullFrameCamera(settings)) return { x: 64, y: 250, width: 480, height: 360 }; if (settings.performer === "camera") return { x: 64, y: 330, width: 952, height: 930 }; return settings.layout === "duet" ? { x: 64, y: 360, width: 952, height: 760 } : { x: 64, y: 340, width: 952, height: 930 }; }
export function contentFrame(scene: CompositionScene, settings: ClipEditSettings): CompositionFrame {
  if (fullFrameCamera(settings)) return scene.mode === "switch" ? { x: 64, y: 184, width: 952, height: 256 } : { x: 86, y: 1220, width: 884, height: 260 };
  if (scene.mode === "say-it-back" && settings.performer === "camera") return { x: 86, y: 1280, width: 884, height: 174 };
  if (scene.mode === "say-it-back") return settings.layout === "duet" ? { x: 400, y: 1160, width: 590, height: 290 } : { x: 86, y: 1280, width: 884, height: 174 };
  return settings.layout === "duet" ? { x: 86, y: 210, width: 884, height: 330 } : { x: 86, y: 200, width: 884, height: 430 };
}
/** Waveforms use the selected source interval; the recording itself is untouched. */
export function waveformFrame(scene: CompositionScene, settings: ClipEditSettings): CompositionFrame {
  if (fullFrameCamera(settings)) return { x: 86, y: 1530, width: 884, height: 40 };
  if (scene.mode === "classic") return settings.layout === "duet" ? { x: 86, y: 1130, width: 422, height: 60 } : { x: 86, y: 978, width: 884, height: 44 };
  if (scene.mode === "switch") return { x: 86, y: 1295, width: 884, height: 54 };
  return { x: 86, y: 1465, width: 884, height: 48 };
}
export function avatarFrame(settings: ClipEditSettings): CompositionFrame {
  const size = Math.round(settings.avatarSize * COMPOSITION_WIDTH);
  // Keep the complete pulse ring on canvas even after dragging near an edge.
  return { x: Math.round(Math.max(0, Math.min(COMPOSITION_WIDTH - size, settings.avatarX * COMPOSITION_WIDTH - size / 2))), y: Math.round(Math.max(0, Math.min(COMPOSITION_HEIGHT - size, settings.avatarY * COMPOSITION_HEIGHT - size / 2))), width: size, height: size };
}
const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, Number.isFinite(value) ? value : 0));
/** Visual measurement only: never changes recorded or rendered audio gain. */
export function speechLevel(rms: number): number { return Math.round(clamp(Math.sqrt(Math.max(0, rms - 0.004)) * 2.8) * 7) / 7; }
export function measureAudioLevels(samples: Float32Array, sampleRate: number): number[] {
  if (!samples.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return [];
  const frames = Math.ceil(samples.length / sampleRate * AUDIO_LEVEL_FPS);
  return Array.from({ length: frames }, (_, frame) => {
    const start = Math.floor(frame * sampleRate / AUDIO_LEVEL_FPS), end = Math.min(samples.length, Math.floor((frame + 1) * sampleRate / AUDIO_LEVEL_FPS));
    let sum = 0;
    for (let i = start; i < end; i++) { const value = samples[i]!; if (Number.isFinite(value)) sum += value * value; }
    return speechLevel(Math.sqrt(sum / Math.max(1, end - start)));
  });
}
export function audioLevelAt(levels: readonly number[], time: number): number { return time < 0 ? 0 : levels[Math.floor(time * AUDIO_LEVEL_FPS)] ?? 0; }
export function xml(value: string): string { return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function text(value: string, x: number, y: number, size: number, color = C.paper, weight = 700, anchor = "start"): string {
  return `<text x="${x}" y="${y}" font-family="DejaVu Sans, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${color}">${xml(value)}</text>`;
}
function textWidth(value: string, size: number): number {
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
function fitText(value: string, x: number, top: number, width: number, height: number, maxSize: number, minSize = 22, color = C.paper, centered = false): string {
  let size = maxSize, lines = wrapVideoText(value, size, width);
  while (size > minSize && lines.length * size * 1.22 > height) { size -= 1; lines = wrapVideoText(value, size, width); }
  if (lines.length * size * 1.22 > height) throw new Error("The challenge text is too long for this layout.");
  return lines.map((line, i) => text(line, centered ? x + width / 2 : x, top + size + i * size * 1.22, size, color, 700, centered ? "middle" : "start")).join("");
}
function rect(x: number, y: number, width: number, height: number, fill: string, radius = 0, extra = ""): string { return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" ${extra}/>`; }
function svg(body: string, width = COMPOSITION_WIDTH, height = COMPOSITION_HEIGHT): string { return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`; }
export interface AvatarSpeechPose { x: number; y: number; rotation: number; scaleX: number; scaleY: number }
/** An eight-pose response to measured sound, with no timer or idle animation. */
export function avatarSpeechPose(avatar: ClipAvatar, level: number, reducedMotion = false): AvatarSpeechPose {
  const amount = Math.round(clamp(level) * 7) / 7;
  if (reducedMotion || amount === 0) return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  if (avatar.kind === "upload") return { x: 0, y: -4.5 * amount, rotation: -2.25 * amount, scaleX: 1 + 0.055 * amount, scaleY: 1 + 0.055 * amount };
  const direction = avatar.id === "fox" || avatar.id === "cat" ? -1 : 1;
  const soft = avatar.id === "cloud" || avatar.id === "robot";
  return { x: direction * 2.5 * amount, y: -(avatar.id === "star" ? 9 : 7.5) * amount, rotation: direction * (soft ? 3 : 4.5) * amount,
    scaleX: 1 + (soft ? 0.065 : -0.025) * amount, scaleY: 1 + (soft ? -0.02 : 0.10) * amount };
}
export function avatarSvg(avatar: ClipAvatar, options: { size?: number; level?: number; reducedMotion?: boolean; imageHref?: string } = {}): string {
  const level = clamp(options.level ?? 0), selected = BUILTIN_AVATARS.find((item) => avatar.kind === "builtin" && item.id === avatar.id) ?? BUILTIN_AVATARS[0];
  const source = options.imageHref ?? (avatar.kind === "upload" ? avatar.dataUrl : selected.imageUrl);
  const pose = avatarSpeechPose(avatar, level, options.reducedMotion);
  const background = avatar.kind === "upload" ? C.violet : selected.color;
  const assetId = avatar.kind === "upload" ? "uploaded" : selected.id;
  const body = `<defs><radialGradient id="avatar-wash-${assetId}"><stop stop-color="${background}" stop-opacity="0.25"/><stop offset="1" stop-color="${background}" stop-opacity="0.055"/></radialGradient><clipPath id="avatar-crop-${assetId}"><circle cx="128" cy="128" r="107"/></clipPath></defs>`
    + `<circle cx="128" cy="128" r="120" fill="${background}" fill-opacity="${(0.025 + level * 0.07).toFixed(3)}"/>`
    + `<circle cx="128" cy="128" r="116" fill="none" stroke="${background}" stroke-width="${(1.8 + level * 3.2).toFixed(2)}" stroke-opacity="${(0.25 + level * 0.7).toFixed(3)}"/>`
    + `<g data-avatar-body="true" data-speech-level="${level}" transform="translate(${(128 + pose.x).toFixed(4)} ${(128 + pose.y).toFixed(4)}) rotate(${pose.rotation.toFixed(4)}) scale(${pose.scaleX.toFixed(4)} ${pose.scaleY.toFixed(4)}) translate(-128 -128)"><circle cx="128" cy="128" r="107" fill="${C.surface}"/><circle cx="128" cy="128" r="107" fill="url(#avatar-wash-${assetId})"/><image href="${xml(source)}" x="21" y="21" width="214" height="214" preserveAspectRatio="${avatar.kind === "upload" ? "xMidYMid slice" : "xMidYMid meet"}"${avatar.kind === "upload" ? ` clip-path="url(#avatar-crop-${assetId})"` : ""}/></g>`
    + Array.from({ length: 5 }, (_, i) => { const h = 3 + level * [10, 19, 26, 19, 10][i]!; return rect(112 + i * 7, 242 - h / 2, 4, h, background, 2); }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size ?? 256}" height="${options.size ?? 256}" viewBox="0 0 256 256">${body}</svg>`;
}
export function compositionFooter(scene: CompositionScene): string {
  let body = rect(86, 1604, 884, 2, C.border);
  if (scene.invitationUrl) {
    const url = new URL(scene.invitationUrl);
    if (url.protocol !== "https:" || !/^\/a\/[A-Za-z0-9_-]{6,64}$/.test(url.pathname) || url.search || url.hash || url.username || url.password) throw new Error("Invalid playable invitation");
    body += text("Your turn.", 86, 1678, 40) + fitText(`${url.host}${url.pathname}`, 86, 1697, 884, 75, 24, 16, C.muted);
  } else body += text("Made on Delivery.", 86, 1678, 35, C.muted);
  if (scene.mode === "say-it-back") {
    const source = scene.say.clip.source;
    body += fitText(`${source.title} · ${source.creator} · ${source.license}\nShortened, dubbed adaptation. ${source.license === "CC BY 3.0" ? "creativecommons.org/licenses/by/3.0/" : ""}`, 86, 1785, 884, 88, 17, 14, C.muted);
  }
  return body;
}
function baseBody(scene: CompositionScene, settings: ClipEditSettings): string {
  if (fullFrameCamera(settings)) return cameraOverlayBody(scene, settings);
  let body = rect(0, 0, COMPOSITION_WIDTH, COMPOSITION_HEIGHT, C.ink)
    + `<defs><radialGradient id="stage-wash"><stop stop-color="${C.violet}" stop-opacity="0.10"/><stop offset="1" stop-color="${C.ink}" stop-opacity="0"/></radialGradient></defs><ellipse cx="540" cy="750" rx="700" ry="850" fill="url(#stage-wash)"/>`
    + brandGradientSvg("clip-brand") + `<path d="${BRAND_MARK_PATH}" transform="translate(75 94) scale(.78)" fill="url(#clip-brand)" fill-rule="evenodd"/>` + text("delivery", 137, 136, 34)
    + text(scene.mode === "classic" ? "CLASSIC" : scene.mode === "switch" ? "SWITCH" : "SAY IT BACK", 970, 133, 23, C.muted, 700, "end")
    + compositionFooter(scene);
  if (settings.includeName && scene.displayName) body += fitText(scene.displayName, 86, 1531, settings.includeScore && scene.score ? 650 : 884, 52, 28, 21);
  if (settings.includeScore && scene.score && Number.isFinite(scene.score.value)) {
    body += text(`${Math.round(scene.score.value)}`, 970, 1556, 40, C.accent, 700, "end") + text(scene.score.beta || scene.mode === "switch" ? "BETA SCORE" : scene.score.label.toUpperCase().slice(0, 22), 970, 1584, 15, C.muted, 500, "end");
  }
  if (scene.mode === "classic") {
    body += text("ONE LINE. YOUR DELIVERY.", 540, 260, 26, C.accent, 700, "middle");
    const duet = settings.layout === "duet", x = duet ? 564 : 86, width = duet ? 422 : 884;
    if (settings.captions) body += text("CHALLENGE LINE", x, duet ? 572 : 1040, 20, C.muted, 500) + fitText(scene.classic.phrase, x, duet ? 600 : 1070, width, duet ? 390 : 225, duet ? 52 : 65, 28);
    body += text("DELIVERED AS", x, duet ? 1110 : 1351, 19, C.muted, 500) + fitText(scene.classic.direction, x, duet ? 1138 : 1374, width, duet ? 250 : 139, duet ? 34 : 32, 19, C.accent);
  } else if (scene.mode === "switch") {
    if (settings.captions) body += text("CHALLENGE LINE", 86, 1370, 19, C.muted, 500) + fitText(scene.switch.cues[0]?.text ?? "", 86, 1391, 884, 121, 61, 27);
  } else {
    body += fitText(scene.say.clip.title, 86, 210, 884, 93, 40, 27);
    const f = sceneFrame(settings);
    body += rect(f.x, f.y, f.width, f.height, "#030303", 22, `stroke="${C.border}" stroke-width="2"`);
  }
  return body;
}
/** Transparent artwork sits above the camera; the middle stays clear for faces. */
function cameraOverlayBody(scene: CompositionScene, settings: ClipEditSettings): string {
  let body = `<defs><linearGradient id="camera-top" x2="0" y2="1"><stop stop-color="#000" stop-opacity=".78"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient><linearGradient id="camera-bottom" x2="0" y2="1"><stop stop-color="#000" stop-opacity="0"/><stop offset=".55" stop-color="#000" stop-opacity=".70"/><stop offset="1" stop-color="#000" stop-opacity=".9"/></linearGradient></defs>`
    + rect(0, 0, 1080, 650, "url(#camera-top)") + rect(0, 1040, 1080, 880, "url(#camera-bottom)")
    + brandGradientSvg("clip-brand") + `<path d="${BRAND_MARK_PATH}" transform="translate(75 94) scale(.78)" fill="url(#clip-brand)" fill-rule="evenodd"/>` + text("delivery", 137, 136, 34)
    + text(scene.mode === "classic" ? "CLASSIC" : scene.mode === "switch" ? "SWITCH" : "SAY IT BACK", 970, 133, 23, C.paper, 700, "end");
  if (scene.mode === "classic") {
    body += text("DELIVERED AS", 86, 220, 18, C.paper, 500) + fitText(scene.classic.direction, 86, 240, 884, 210, 43, 24, C.accent);
    if (settings.captions) body += text("CHALLENGE LINE", 86, 1208, 18, C.paper, 500) + fitText(scene.classic.phrase, 86, 1230, 884, 260, 66, 28);
  } else if (scene.mode === "switch") {
    if (settings.captions) body += text("CHALLENGE LINE", 86, 1230, 18, C.paper, 500) + fitText(scene.switch.cues[0]?.text ?? "", 86, 1250, 884, 240, 72, 28);
  } else {
    body += fitText(scene.say.clip.title, 86, 179, 884, 52, 29, 21);
    const f = sceneFrame(settings);
    body += rect(f.x - 3, f.y - 3, f.width + 6, f.height + 6, "#080808", 6, 'stroke="#ffffff" stroke-opacity=".45" stroke-width="2"');
  }
  if (settings.includeName && scene.displayName) body += fitText(scene.displayName, 86, 1610, settings.includeScore && scene.score ? 650 : 884, 62, 30, 21);
  if (settings.includeScore && scene.score && Number.isFinite(scene.score.value)) body += text(`${Math.round(scene.score.value)}`, 970, 1654, 40, C.accent, 700, "end") + text(scene.score.beta || scene.mode === "switch" ? "BETA SCORE" : scene.score.label.toUpperCase().slice(0, 22), 970, 1681, 15, C.paper, 500, "end");
  // Keep the established invitation validation and mandatory scene attribution.
  compositionFooter(scene);
  if (scene.invitationUrl) { const url = new URL(scene.invitationUrl); body += text("Your turn.", 86, 1753, 27) + fitText(`${url.host}${url.pathname}`, 86, 1770, 884, 40, 21, 16, C.paper); }
  else body += text("Made on Delivery.", 86, 1770, 24, C.paper);
  if (scene.mode === "say-it-back") { const source = scene.say.clip.source; body += fitText(`${source.title} · ${source.creator} · ${source.license}\nShortened, dubbed adaptation. ${source.license === "CC BY 3.0" ? "creativecommons.org/licenses/by/3.0/" : ""}`, 86, 1810, 884, 88, 17, 14, C.paper); }
  return body;
}
export function compositionBoundaries(scene: CompositionScene, settings: ClipEditSettings): number[] {
  if (scene.mode === "switch") return [...new Set([0, scene.duration, ...scene.switch.cues.flatMap((cue) => [cue.start, cue.end])])].sort((a, b) => a - b);
  if (scene.mode === "say-it-back" && settings.captions) return [...new Set([0, scene.duration, ...scene.say.clip.cues.flatMap((cue) => [cue.start, cue.end])])].sort((a, b) => a - b);
  return [0, scene.duration];
}
function contentBody(scene: CompositionScene, settings: ClipEditSettings, time: number): string {
  const f = contentFrame(scene, settings);
  if (scene.mode === "switch") {
    const index = scene.switch.cues.findIndex((cue) => time >= cue.start && time < cue.end);
    const cue = scene.switch.cues[index];
    if (!cue) return "";
    if (fullFrameCamera(settings)) {
      let body = rect(f.x, f.y, f.width, f.height, "#000", 28, 'fill-opacity=".32" stroke="#fff" stroke-opacity=".18" stroke-width="2"');
      if (scene.switch.kind === "speed") body += text(`${cue.speed ?? 1}×`, f.x + 142, f.y + 151, 102, C.accent, 700, "middle");
      else { const emoji = (emojiImages as Record<string, string>)[cue.emoji]; body += emoji ? `<image href="${emoji}" x="${f.x + 50}" y="${f.y + 42}" width="156" height="156"/>` : text(cue.emoji, f.x + 128, f.y + 162, 125, C.paper, 700, "middle"); }
      body += text(`${index + 1} / ${scene.switch.cues.length}`, f.x + f.width - 28, f.y + 40, 18, C.paper, 500, "end")
        + fitText(cue.directionLabel, f.x + 285, f.y + 58, 615, 96, 48, 28)
        + fitText(scene.switch.cues[index + 1] ? `Next: ${scene.switch.cues[index + 1]!.directionLabel}` : "Last switch", f.x + 285, f.y + 165, 615, 35, 22, 16, C.paper);
      const step = (f.width - 64) / scene.switch.cues.length;
      scene.switch.cues.forEach((_, i) => { body += rect(f.x + 32 + i * step, f.y + f.height - 24, step - 9, 6, i === index ? C.accent : i < index ? C.blue : "#ffffff55", 3); });
      return body;
    }
    const duet = settings.layout === "duet", cx = f.x + f.width / 2;
    const symbolX = duet ? f.x + 44 : cx - 92, symbolY = f.y + 38, symbolSize = duet ? 210 : 184;
    let body = rect(f.x, f.y, f.width, f.height, C.surface, 32, `stroke="${C.border}" stroke-width="2"`)
      + text(`${index + 1} / ${scene.switch.cues.length}`, f.x + f.width - 32, f.y + 40, 20, C.muted, 500, "end");
    if (scene.switch.kind === "speed") body += text(`${cue.speed ?? 1}×`, duet ? f.x + 153 : cx, f.y + (duet ? 191 : 196), duet ? 116 : 138, C.accent, 700, "middle");
    else { const emoji = (emojiImages as Record<string, string>)[cue.emoji]; body += emoji ? `<image href="${emoji}" x="${symbolX}" y="${symbolY}" width="${symbolSize}" height="${symbolSize}"/>` : text(cue.emoji, duet ? f.x + 153 : cx, f.y + 196, 135, C.accent, 700, "middle"); }
    const labelX = duet ? f.x + 300 : f.x + 26, labelWidth = duet ? f.width - 335 : f.width - 52;
    body += fitText(cue.directionLabel, labelX, f.y + (duet ? 92 : 242), labelWidth, duet ? 96 : 78, duet ? 48 : 53, 29, C.paper, !duet);
    const next = scene.switch.cues[index + 1];
    body += fitText(next ? `Next: ${next.directionLabel}` : "Last switch", labelX, f.y + (duet ? 204 : 338), labelWidth, 46, 21, 16, C.muted, !duet);
    const gap = 9, step = (f.width - 64) / scene.switch.cues.length;
    scene.switch.cues.forEach((_, i) => { body += rect(f.x + 32 + i * step, f.y + f.height - 27, step - gap, 7, i === index ? C.accent : i < index ? C.blue : C.border, 3); });
    return body;
  }
  if (scene.mode === "say-it-back" && settings.captions) {
    const cues = scene.say.clip.cues.filter((cue) => time >= cue.start && time < cue.end);
    if (!cues.length) return "";
    const caption = cues.map((cue) => `${scene.say.clip.roles.find((role) => role.id === cue.roleId)?.name ?? "Scene"}: ${cue.text}`).join("\n");
    return text("SCENE SCRIPT", f.x, f.y + 20, 18, C.muted, 500) + fitText(caption, f.x, f.y + 38, f.width, f.height - 46, fullFrameCamera(settings) ? 52 : settings.layout === "duet" ? 35 : 37, 21);
  }
  return "";
}
export const WAVEFORM_FPS = 15;
function waveformBody(scene: CompositionScene, settings: ClipEditSettings, levels: readonly number[], options: { time: number; audioOffset?: number }): string {
  const f = waveformFrame(scene, settings), count = 32, step = f.width / count;
  // A short, rolling window of the voice that is audible now, never the entire take.
  // Quantize relative to the trim so browser seeks and encoded frames agree.
  const elapsed = Math.max(0, options.time - settings.trimStart);
  const time = settings.trimStart + Math.floor((elapsed + 1e-7) * WAVEFORM_FPS) / WAVEFORM_FPS;
  const end = Math.min(scene.duration, settings.trimEnd ?? scene.duration);
  let body = "";
  for (let bar = 0; bar < count; bar++) {
    const sampleTime = time - (settings.reducedMotion ? 0 : (count - 1 - bar) / (count - 1) * 0.65);
    const position = (sampleTime + (options.audioOffset ?? 0)) * AUDIO_LEVEL_FPS;
    const index = Math.floor(position), fraction = position - index;
    const level = sampleTime < settings.trimStart || sampleTime >= end || position < 0 ? 0
      : clamp((levels[index] ?? 0) * (1 - fraction) + (levels[index + 1] ?? 0) * fraction);
    const height = Math.max(2, level * (f.height - 4));
    body += rect(f.x + bar * step, f.y + (f.height - height) / 2, Math.max(3, step - 6), height, level > 0 ? (bar > count - 5 ? C.accent : C.blue) : C.border, 3);
  }
  return body;
}
export function waveformSvg(scene: CompositionScene, settings: ClipEditSettings, levels: readonly number[], options: { time: number; audioOffset?: number }): string {
  return svg(waveformBody(scene, settings, levels, options));
}
export function compositionSvg(scene: CompositionScene, settings: ClipEditSettings, options: { time: number; level?: number; reducedMotion?: boolean; layer?: "all" | "background" | "base" | "content" | "waveform" | "avatar"; audioLevels?: readonly number[]; audioOffset?: number; avatarImageHref?: string } = { time: 0 }): string {
  const layer = options.layer ?? "all";
  if (layer === "background") return svg(rect(0, 0, COMPOSITION_WIDTH, COMPOSITION_HEIGHT, C.ink));
  let body = layer === "all" || layer === "base" ? baseBody(scene, settings) : "";
  if (layer === "all" || layer === "content") body += contentBody(scene, settings, options.time);
  if (layer === "all" || layer === "waveform") body += waveformBody(scene, { ...settings, reducedMotion: options.reducedMotion ?? settings.reducedMotion }, options.audioLevels ?? [], { time: options.time, audioOffset: options.audioOffset });
  if ((layer === "all" || layer === "avatar") && settings.avatarVisible && settings.performer !== "camera") {
    const f = avatarFrame(settings);
    body += `<g transform="translate(${f.x} ${f.y})">${avatarSvg(settings.avatar, { size: f.width, level: options.level, reducedMotion: options.reducedMotion ?? settings.reducedMotion, imageHref: options.avatarImageHref })}</g>`;
  }
  return svg(body);
}

/** Exact source crop used by both CSS preview and FFmpeg. */
export function cameraCrop(width: number, height: number, settings?: Pick<ClipEditSettings, "cameraZoom" | "cameraCropX" | "cameraCropY"> & Partial<Pick<ClipEditSettings, "performer" | "layout">>): CompositionFrame {
  const ratio = settings?.performer === "camera" && settings.layout === "spotlight" ? 9 / 16 : 1;
  const heightAtZoom = Math.min(height, width / ratio) / (settings?.cameraZoom ?? 1);
  const cropWidth = Math.max(1, Math.floor(heightAtZoom * ratio / 2) * 2), cropHeight = Math.max(1, Math.floor(heightAtZoom / 2) * 2);
  return { x: Math.floor((width - cropWidth) * (settings?.cameraCropX ?? 0.5) / 2) * 2, y: Math.floor((height - cropHeight) * (settings?.cameraCropY ?? 0.5) / 2) * 2, width: cropWidth, height: cropHeight };
}
export function cameraLayoutSettings(mode: CompositionMode, layout: ClipEditSettings["layout"]): Partial<ClipEditSettings> {
  if (mode === "say-it-back") return { layout, avatarX: layout === "spotlight" ? 0.24 : 0.77, avatarY: layout === "spotlight" ? 0.64 : 0.575, avatarSize: layout === "spotlight" ? 0.36 : 0.29 };
  return layoutClipEditSettings(mode, layout);
}
export function defaultCameraSettings(mode: CompositionMode): ClipEditSettings {
  return { ...defaultClipEditSettings(mode), ...cameraLayoutSettings(mode, "spotlight"), performer: "camera", captions: false };
}
