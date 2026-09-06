import manifest from "./catalog.json";
import { z } from "zod";
import { sayClipSchema } from "./schema";
import type { SayClip } from "./types";

/** Curated, versioned references. Validate edits with scripts/import-say-clips.mjs. */
export const SAY_CLIPS: SayClip[] = z.array(sayClipSchema).parse(manifest);
