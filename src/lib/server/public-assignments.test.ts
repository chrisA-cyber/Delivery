import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SWITCH_CHALLENGES } from "@/lib/switch/catalog";
import { SAY_CLIPS } from "@/lib/say-it-back/catalog";
import { SAY_SCORING_VERSION } from "@/lib/say-it-back/types";
import type { GroupAssignment } from "@/lib/groups/types";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({ rows: [] as Row[], disabledClip: false, tables: [] as string[] }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: (table: string) => {
  state.tables.push(table);
  const filters: [string, unknown][] = [];
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    upsert: async (row: Row) => { if (!state.rows.some((item) => item.fingerprint === row.fingerprint)) state.rows.push(row); return { error: null }; },
    maybeSingle: async () => ({ data: table === "say_clip_versions" ? { enabled: !state.disabledClip, manifest: SAY_CLIPS[0] } : state.rows.find((row) => filters.every(([key, value]) => row[key] === value)) ?? null, error: null }),
  };
  return query;
} }) }));

import { canonicalAssignmentJson, ensurePublicAssignment, getPublicAssignment, parsePublicAssignment } from "./public-assignments";

function assignment(): Extract<GroupAssignment, { mode: "switch" }> {
  const challenge = structuredClone(SWITCH_CHALLENGES[0]!);
  return { mode: "switch", challenge, rating: challenge.rating, scoringVersion: challenge.scoringVersion, rubricVersion: challenge.rubricVersion };
}
beforeEach(() => { state.rows = []; state.disabledClip = false; state.tables = []; });

describe("public assignment invitations", () => {
  it("reuses one immutable link across players and key ordering without reading player media", async () => {
    const original = assignment();
    const first = await ensurePublicAssignment(original, "https://deliverygame.netlify.app");
    const reordered = Object.fromEntries(Object.entries(original).reverse()) as GroupAssignment;
    expect(await ensurePublicAssignment(reordered, "https://deliverygame.netlify.app")).toEqual(first);
    expect(first.url).toMatch(/^https:\/\/deliverygame.netlify.app\/a\/[a-f0-9]{12}$/);
    expect(state.rows).toHaveLength(1);
    expect(await getPublicAssignment(first.code, "mature")).toEqual(original);
    expect(new Set(state.tables)).toEqual(new Set(["public_assignment_links"]));
    expect(Object.keys(state.rows[0]!)).toEqual(["code", "fingerprint", "mode", "assignment"]);
  });

  it("preserves a historical cue sequence and rules instead of resolving today's challenge", async () => {
    const original = assignment();
    original.challenge.version = "historical-v1";
    original.challenge.scoringVersion = original.scoringVersion = "historical-beta";
    original.challenge.rubricVersion = original.rubricVersion = "historical-rules";
    original.challenge.cues.forEach((cue) => { cue.text = "The exact same old phrase."; });
    const { code } = await ensurePublicAssignment(original, "https://example.com");
    expect(await getPublicAssignment(code, "mature")).toEqual(original);
  });

  it("rejects private-token and recording fields instead of storing them in a public invitation", () => {
    expect(() => parsePublicAssignment({ ...assignment(), roundToken: "private-round-token" })).toThrow();
    const say = { mode: "say-it-back", clip: structuredClone(SAY_CLIPS[0]!), roleId: SAY_CLIPS[0]!.roles[0]!.id, rating: SAY_CLIPS[0]!.rating, scoringVersion: SAY_SCORING_VERSION };
    say.clip.videoUrl = "https://example.com/storage/v1/object/sign/delivery-audio/private.mp4?token=secret";
    expect(() => parsePublicAssignment(say)).toThrow();
  });

  it("honors content opt-in, disabled invitations, and immutable fingerprint checks", async () => {
    const original = assignment();
    original.rating = original.challenge.rating = "mature";
    const { code } = await ensurePublicAssignment(original, "https://example.com");
    await expect(getPublicAssignment(code, "everyone")).rejects.toMatchObject({ status: 403 });
    state.rows[0]!.disabled_at = "2026-09-06T00:00:00Z";
    await expect(getPublicAssignment(code, "mature")).rejects.toMatchObject({ status: 404 });
    state.rows[0]!.disabled_at = null;
    state.rows[0]!.fingerprint = createHash("sha256").update(canonicalAssignmentJson({ ...original, scoringVersion: "changed" })).digest("hex");
    await expect(getPublicAssignment(code, "mature")).rejects.toMatchObject({ status: 404 });
  });

  it("stops an existing scene invitation when the source version is disabled", async () => {
    const clip = SAY_CLIPS[0]!;
    const { code } = await ensurePublicAssignment({ mode: "say-it-back", clip, roleId: clip.roles[0]!.id, rating: clip.rating, scoringVersion: SAY_SCORING_VERSION }, "https://example.com");
    expect((await getPublicAssignment(code, "mature")).mode).toBe("say-it-back");
    state.disabledClip = true;
    await expect(getPublicAssignment(code, "mature")).rejects.toMatchObject({ status: 404 });
  });
});
