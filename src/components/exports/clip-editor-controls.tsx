"use client";

import { useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { Check, Captions, LayoutTemplate, Scissors, UserRound } from "lucide-react";
import { AvatarPicker } from "@/components/avatars/avatar-picker";
import { usePreferredAvatar } from "@/hooks/use-preferred-avatar";
import { cameraLayoutSettings, fullFrameCamera, layoutClipEditSettings, type ClipEditSettings } from "@/lib/video-composition";
import type { VideoExportMode } from "./video-export";
import { clipTime } from "./clip-preview";

const tabs = [{ id: "layout", label: "Layout", icon: LayoutTemplate }, { id: "avatar", label: "Avatar", icon: UserRound }, { id: "text", label: "Text", icon: Captions }, { id: "trim", label: "Trim", icon: Scissors }] as const;
export function ClipEditorControls({ mode, settings, onChange, duration, hasScore, hasCamera = false, disabled }: {
  mode: VideoExportMode;
  settings: ClipEditSettings;
  onChange: (patch: Partial<ClipEditSettings>) => void;
  duration: number;
  hasScore: boolean;
  hasCamera?: boolean;
  disabled?: boolean;
}) {
  const { reducedMotion } = useApp();
  const prefersReduced = reducedMotion || (typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("layout");
  const preference = usePreferredAvatar();
  const sameAvatar = JSON.stringify(preference.avatar) === JSON.stringify(settings.avatar);
  const end = Math.min(settings.trimEnd ?? duration, duration);
  return <div className="flex h-full min-h-0 flex-col">
    <div className="grid shrink-0 grid-cols-4 gap-1 border-b border-white/10 bg-surface p-2" role="tablist" aria-label="Clip adjustments">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" tabIndex={tab === id ? 0 : -1} onKeyDown={(event) => { const index = tabs.findIndex((item) => item.id === tab); const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1; if (next >= 0) { event.preventDefault(); const target = tabs[next]!.id; setTab(target); document.getElementById(`clip-tab-${target}`)?.focus(); } }} aria-selected={tab === id} aria-controls={`clip-panel-${id}`} id={`clip-tab-${id}`} onClick={() => setTab(id)} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-bold ${tab === id ? "bg-electric text-ink" : "text-white/60 hover:bg-white/5"}`}><Icon className="size-3.5" />{id === "avatar" && hasCamera ? "Performer" : label}</button>)}
    </div>
    <div role="tabpanel" aria-labelledby={`clip-tab-${tab}`} id={`clip-panel-${tab}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
      <fieldset disabled={disabled} className="space-y-4">
        <legend className="sr-only">{tabs.find((item) => item.id === tab)?.label} settings</legend>
        {tab === "layout" && <>
          {hasCamera && <div className="flex gap-2" role="group" aria-label="Clip performer">{(["avatar", "camera"] as const).map(performer => <button type="button" key={performer} aria-pressed={settings.performer === performer} className={settings.performer === performer ? "button-primary min-h-10 text-xs" : "button-secondary min-h-10 text-xs"} onClick={() => onChange({ performer, ...(performer === "camera" && settings.performer !== "camera" ? { captions: false } : {}), ...(performer === "camera" ? cameraLayoutSettings(mode, settings.layout) : layoutClipEditSettings(mode, settings.layout)) })}>{performer === "camera" ? "Camera" : "Avatar"}</button>)}</div>}
          <div className="grid grid-cols-2 gap-3">
            {(["spotlight", "duet"] as const).map((layout) => <button type="button" key={layout} aria-pressed={settings.layout === layout} onClick={() => onChange(settings.performer === "camera" ? cameraLayoutSettings(mode, layout) : layoutClipEditSettings(mode, layout))} className={`rounded-xl border p-3 text-left transition-colors ${settings.layout === layout ? "border-electric bg-electric/10" : "border-white/15 bg-black/20 hover:border-white/35"}`}>
              <div className={`relative mx-auto h-24 w-14 overflow-hidden rounded-md border border-white/20 bg-ink ${mode === "say-it-back" ? "" : "pt-5"}`} aria-hidden="true">
                {settings.performer === "camera" && layout === "spotlight" ? <><div className="absolute inset-0 bg-gradient-to-b from-electric/50 via-white/15 to-black/80" /><div className="absolute inset-x-1 top-3 h-4 rounded bg-black/60" />{mode === "say-it-back" && <div className="absolute left-1 top-9 h-4 w-6 border border-white/50 bg-white/25" />}<div className="absolute bottom-5 left-2 right-2 h-1 rounded bg-white/80" /></> : mode === "say-it-back" ? <><div className={`absolute inset-x-1 bg-white/25 ${layout === "spotlight" ? "top-4 h-14" : "top-3 h-10"}`} /><div className={`absolute size-4 rounded-full bg-electric ${layout === "spotlight" ? "bottom-5 right-1" : "bottom-5 left-5"}`} /></> : <><div className={`mx-auto rounded-full bg-electric ${layout === "spotlight" ? "size-7" : "mt-5 size-5"}`} /><div className={`absolute inset-x-2 h-1 rounded bg-white/50 ${layout === "spotlight" ? "bottom-6" : "top-5"}`} /></>}
                <div className="absolute bottom-2 left-2 right-2 h-0.5 rounded bg-white/20" />
              </div>
              <span className="mt-2 flex items-center justify-between text-sm font-bold">{settings.performer === "camera" ? layout === "spotlight" ? "Full frame" : mode === "say-it-back" ? "Scene focus" : "Framed" : layout === "spotlight" ? mode === "say-it-back" ? "Scene" : "Spotlight" : mode === "say-it-back" ? "Companion" : "Split"}{settings.layout === layout && <Check className="size-3.5 text-electric" />}</span>
            </button>)}
          </div>
          <p className="text-xs leading-5 text-white/55">{fullFrameCamera(settings) ? "Drag the video to frame your face. Adjust zoom in Performer." : mode === "say-it-back" ? "Your scene keeps its original framing. Drag your performer in the preview to place it." : "Drag your performer in the preview. Keep key content clear of the edges."}</p>
        </>}
        {tab === "avatar" && <>
          {settings.performer === "camera" && <>
            <label className="block text-xs font-bold">Camera zoom<input type="range" min={1} max={3} step={0.01} value={settings.cameraZoom} onChange={e => onChange({ cameraZoom: Number(e.target.value) })} className="mt-2 h-8 w-full accent-electric" /></label>
            <div className="grid grid-cols-2 gap-3">{(["cameraCropX", "cameraCropY"] as const).map((field, i) => <label key={field} className="text-xs">{i ? "Crop vertical" : "Crop horizontal"}<input type="range" min={0} max={1} step={0.01} value={settings[field]} onChange={e => onChange({ [field]: Number(e.target.value) })} className="mt-1 h-8 w-full accent-electric" /></label>)}</div>
            <label className="block text-xs">Orientation<select aria-label="Camera orientation" value={settings.cameraMirror === undefined ? "recorded" : settings.cameraMirror ? "mirror" : "natural"} onChange={e => onChange({ cameraMirror: e.target.value === "recorded" ? undefined : e.target.value === "mirror" })} className="mt-2 min-h-10 w-full rounded-lg bg-surface px-2"><option value="recorded">As recorded</option><option value="natural">Natural</option><option value="mirror">Mirrored</option></select></label>
          </>}
          <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={settings.avatarVisible} onChange={(event) => onChange({ avatarVisible: event.target.checked })} className="size-4 accent-electric" />{settings.performer === "camera" ? "Show camera" : "Show avatar"}</label>
          {settings.performer !== "camera" && <>
          <label className="flex min-h-10 items-center gap-2 text-xs text-white/65"><input type="checkbox" checked={settings.reducedMotion} disabled={prefersReduced} onChange={(event) => onChange({ reducedMotion: event.target.checked })} className="size-4 accent-electric" />Reduced motion in clip</label>
          <AvatarPicker compact value={settings.avatar} onChange={(avatar) => onChange({ avatar, avatarVisible: true })} disabled={disabled} />
          <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" className="button-ghost min-h-10 px-0 text-xs" disabled={sameAvatar || preference.saving || disabled} onClick={() => void preference.setAvatar(settings.avatar)}>{sameAvatar ? <><Check className="size-3.5" />Your default avatar</> : preference.saving ? "Saving avatar…" : "Use for future clips"}</button></div>
          {preference.error && <p role="alert" className="text-xs text-orange-200">{preference.error}</p>}
          </>}
          {!fullFrameCamera(settings) && <>
          <label className="block text-xs font-bold">Size <span className="float-right font-normal tabular-nums text-white/55">{Math.round(settings.avatarSize * 100)}%</span><input type="range" min={0.14} max={0.7} step={0.01} value={settings.avatarSize} onChange={(event) => onChange({ avatarSize: Number(event.target.value) })} className="mt-2 h-8 w-full accent-electric" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-white/65">Horizontal<input type="range" min={settings.avatarSize / 2} max={1 - settings.avatarSize / 2} step={0.01} value={settings.avatarX} onChange={(event) => onChange({ avatarX: Number(event.target.value) })} className="mt-1 h-8 w-full accent-electric" /></label>
            <label className="block text-xs text-white/65">Vertical<input type="range" min={settings.avatarSize * 1080 / 1920 / 2} max={1 - settings.avatarSize * 1080 / 1920 / 2} step={0.01} value={settings.avatarY} onChange={(event) => onChange({ avatarY: Number(event.target.value) })} className="mt-1 h-8 w-full accent-electric" /></label>
          </div>
          </>}
        </>}
        {tab === "text" && <>
          {[{ field: "captions" as const, label: mode === "say-it-back" ? "Scripted dialogue" : "Challenge text", note: mode === "say-it-back" ? "Original scene lines, at their saved times." : "The line you were asked to perform." }, { field: "includeName" as const, label: "Display name", note: "Your name, when available." }, { field: "includeScore" as const, label: mode === "switch" ? "Beta score" : "Score", note: hasScore ? "The original full-performance score." : "This take is unscored." }].map(({ field, label, note }) => <label key={field} className="flex min-h-12 cursor-pointer items-start gap-3"><input type="checkbox" checked={settings[field]} disabled={field === "includeScore" && !hasScore} onChange={(event) => onChange({ [field]: event.target.checked })} className="mt-1 size-4 accent-electric" /><span className="text-sm font-bold">{label}<span className="mt-0.5 block text-xs font-normal leading-5 text-white/55">{note}</span></span></label>)}
          <p className="border-t border-white/10 pt-3 text-xs leading-5 text-white/50">Scripted text is not a transcript of your recording.</p>
        </>}
        {tab === "trim" && <>
          <div className="flex items-baseline justify-between"><h3 className="text-sm font-bold">Keep the best part</h3><span className="text-xs tabular-nums text-electric">{clipTime(end - settings.trimStart)}</span></div>
          <label className="block text-xs font-bold">Start <input aria-label="Trim start seconds" type="number" min={0} max={Math.max(0, end - 0.5)} step={0.1} value={Number(settings.trimStart.toFixed(2))} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) onChange({ trimStart: Math.max(0, Math.min(end - 0.5, value)) }); }} className="float-right -mt-2 min-h-9 w-20 rounded-lg border border-white/20 bg-black/25 px-2 text-right text-sm tabular-nums" /><input aria-label="Trim start" type="range" min={0} max={Math.max(0, end - 0.5)} step={0.05} value={settings.trimStart} onChange={(event) => onChange({ trimStart: Number(event.target.value) })} className="mt-3 h-8 w-full accent-electric" /></label>
          <label className="block text-xs font-bold">End <input aria-label="Trim end seconds" type="number" min={settings.trimStart + 0.5} max={duration} step={0.1} value={Number(end.toFixed(2))} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) onChange({ trimEnd: Math.min(duration, Math.max(settings.trimStart + 0.5, value)) }); }} className="float-right -mt-2 min-h-9 w-20 rounded-lg border border-white/20 bg-black/25 px-2 text-right text-sm tabular-nums" /><input aria-label="Trim end" type="range" min={settings.trimStart + 0.5} max={duration} step={0.05} value={end} onChange={(event) => onChange({ trimEnd: Number(event.target.value) })} className="mt-3 h-8 w-full accent-electric" /></label>
          <p className="text-xs leading-5 text-white/55">Picture, voice, dialogue and cues stay together. Your original take and score stay saved.</p>
          <button type="button" className="button-ghost min-h-10 px-0 text-xs" onClick={() => onChange({ trimStart: 0, trimEnd: null })}>Use full recording</button>
        </>}
      </fieldset>
    </div>
  </div>;
}
