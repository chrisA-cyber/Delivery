"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { AvatarPicker } from "./avatar-picker";
import { SpeechAvatar } from "./speech-avatar";
import { usePreferredAvatar } from "@/hooks/use-preferred-avatar";

/** A compact preference control used on recording stages as well as Settings. */
export function PerformerAvatar({ level = 0, size = 104, editable = true, className = "" }: { level?: number; size?: number; editable?: boolean; className?: string }) {
  const { avatar, setAvatar, loading, saving, error } = usePreferredAvatar();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open || !dialog.current) return;
    const current = dialog.current;
    const returnFocus = trigger.current;
    current.showModal?.();
    return () => { current.close?.(); returnFocus?.focus({ preventScroll: true }); };
  }, [open]);
  return <div className={`relative shrink-0 ${className}`}>
    {editable ? <button ref={trigger} type="button" disabled={loading} className="relative rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-acid" aria-label="Change your performance avatar" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}><SpeechAvatar avatar={avatar} level={level} size={size} /><span className="absolute -bottom-1 right-0 grid size-7 place-items-center rounded-full border border-white/20 bg-surface text-paper"><ImagePlus className="size-3.5" /></span></button> : <SpeechAvatar avatar={avatar} level={level} size={size} />}
    {open && editable && <dialog ref={dialog} aria-labelledby={titleId} onCancel={() => setOpen(false)} className="fixed inset-0 m-auto max-h-[90svh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl border border-white/25 bg-surface p-5 text-paper shadow-2xl backdrop:bg-black/65"><div className="mb-4 flex items-center justify-between"><h2 id={titleId} className="text-xl font-bold">Your avatar</h2><button type="button" className="icon-button size-9" onClick={() => setOpen(false)} aria-label="Close avatar selection"><X className="size-4" /></button></div><AvatarPicker compact value={avatar} disabled={saving} onChange={setAvatar} />{saving && <p className="mt-2 text-xs text-white/60" role="status">Saving avatar…</p>}{error && <p className="mt-2 text-xs text-hot" role="alert">{error}</p>}<button type="button" className="button-secondary mt-4 w-full" onClick={() => setOpen(false)}>Done</button></dialog>}
  </div>;
}
