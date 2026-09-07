import type { SayClip } from "./types";

export type SayImportStatus = "queued" | "fetching" | "source-ready" | "processing" | "ready" | "publishing" | "published" | "failed";

/** Cue times are relative to the prepared excerpt, not the original source. */
export interface SayImportCue {
  id: string;
  text: string;
  start: number;
  end: number;
  selected: boolean;
}

export interface SayImport {
  id: string;
  requestId?: string;
  status: SayImportStatus;
  title: string;
  sourceUrl: string | null;
  sourceDuration: number | null;
  sourceVideoUrl: string | null;
  start: number;
  end: number;
  error: string | null;
  cues: SayImportCue[];
  clip?: SayClip;
  createdAt: string;
}
