import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CONTENT_COUNTS,
  ENERGY_MODIFIERS,
  PACKS,
  PROMPTS,
  getDailyPrompt,
  getFavoritePrompts,
  getRandomPrompt,
} from "../../data/content";
import { createPromptDeck, validateContentCatalog } from "./catalog";
import { preflightSubmittedLine } from "./moderation";
import { getTrendingSelection, resolveActiveTrends } from "./trending";
import type { TrendingPromptInjection } from "./types";

describe("Delivery content catalog", () => {
  it("ships the complete launch baseline", () => {
    expect(CONTENT_COUNTS).toEqual({ prompts: 120, modifiers: 48, packs: 12 });
    expect(new Set(PROMPTS.map(({ id }) => id)).size).toBe(PROMPTS.length);
    expect(new Set(ENERGY_MODIFIERS.map(({ id }) => id)).size).toBe(
      ENERGY_MODIFIERS.length,
    );
    expect(new Set(PACKS.map(({ id }) => id)).size).toBe(PACKS.length);
    expect(validateContentCatalog()).toEqual([]);
  });

  it("returns stable UTC daily pairings", () => {
    const morning = getDailyPrompt(new Date("2026-08-25T00:01:00.000Z"));
    const evening = getDailyPrompt(new Date("2026-08-25T23:59:59.999Z"));
    expect(morning).toEqual(evening);
    expect(morning.dateKey).toBe("2026-08-25");
    expect(morning.shareSlug).toContain(morning.prompt.id);
  });

  it("keeps the bundled Daily fallback inside Free or rotating packs", () => {
    for (let day = 0; day < 366; day += 1) {
      const date = new Date(Date.UTC(2028, 0, 1 + day));
      const { prompt } = getDailyPrompt(date);
      expect(
        prompt.packIds.some((packId) => {
          const pack = PACKS.find(({ id }) => id === packId);
          return pack?.access === "free" || pack?.access === "rotating";
        }),
      ).toBe(true);
    }
  });

  it("filters seeded random selection and throws for an empty pool", () => {
    const first = getRandomPrompt({ packId: "gaming-comms", seed: "same" });
    const second = getRandomPrompt({ packId: "gaming-comms", seed: "same" });
    expect(first).toEqual(second);
    expect(first.packIds).toContain("gaming-comms");
    expect(() => getRandomPrompt({ packId: "missing-pack" })).toThrow(RangeError);
  });

  it("builds a no-repeat endless deck and preserves favorite order", () => {
    const deck = createPromptDeck({ seed: "session-42", limit: 25 });
    expect(deck).toHaveLength(25);
    expect(new Set(deck.map(({ id }) => id)).size).toBe(25);

    const ids = [PROMPTS[4]!.id, "stale-id", PROMPTS[1]!.id];
    expect(getFavoritePrompts(ids).map(({ id }) => id)).toEqual([ids[0], ids[2]]);
  });

  it("keeps the database seed in exact slug and copy parity", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/seed.sql"), "utf8");
    const section = (start: string, end: string): string => {
      const startIndex = sql.indexOf(start);
      const endIndex = sql.indexOf(end, startIndex + start.length);
      expect(startIndex, `missing seed section: ${start}`).toBeGreaterThanOrEqual(0);
      expect(endIndex, `missing seed section terminator: ${end}`).toBeGreaterThan(
        startIndex,
      );
      return sql.slice(startIndex, endIndex);
    };
    const unescapeSql = (value: string): string => value.replaceAll("''", "'");

    const packSection = section(
      "insert into public.content_packs",
      "on conflict (slug) do update set",
    );
    const seedPackIds = [...packSection.matchAll(/^\s*\('([^']+)'/gm)].map(
      ([, id]) => id!,
    );

    const energySection = section(
      "insert into public.energy_modifiers",
      "on conflict (slug) do update set",
    );
    const seedEnergy = new Map(
      [...energySection.matchAll(/^\s*\('([^']+)',\s*'((?:''|[^'])*)'/gm)].map(
        ([, id, instruction]) => [id!, unescapeSql(instruction!)] as const,
      ),
    );

    const promptSection = section("with prompt_seed", "), upserted as (");
    const seedPrompts = new Map(
      [
        ...promptSection.matchAll(
          /^\s*\('(?:''|[^'])+'\s*,.*?\s*'([a-z0-9-]+)'\s*,\s*'((?:''|[^'])*)'\s*,\s*array\[/gm,
        ),
      ].map(([, id, line]) => [id!, unescapeSql(line!)] as const),
    );

    expect(seedPackIds.sort()).toEqual(PACKS.map(({ id }) => id).sort());
    expect([...seedEnergy.keys()].sort()).toEqual(
      ENERGY_MODIFIERS.map(({ id }) => id).sort(),
    );
    expect([...seedPrompts.keys()].sort()).toEqual(PROMPTS.map(({ id }) => id).sort());
    expect(
      ENERGY_MODIFIERS.filter(
        ({ id, instruction }) => seedEnergy.get(id) !== instruction,
      ),
    ).toEqual([]);
    expect(PROMPTS.filter(({ id, line }) => seedPrompts.get(id) !== line)).toEqual([]);
  });
});

describe("trending injection", () => {
  const trend: TrendingPromptInjection = {
    id: "editorial-test",
    prompt: {
      ...PROMPTS[0]!,
      id: "editorial-test-line",
      line: "The moment is temporary. The delivery is permanent.",
    },
    energyIds: [ENERGY_MODIFIERS[0]!.id],
    startsAt: "2026-08-01T00:00:00.000Z",
    endsAt: "2026-09-01T00:00:00.000Z",
    markets: ["global"],
    priority: 100,
    label: "Now serving",
  };

  it("honors schedule, market, and energy allowlist", () => {
    const now = new Date("2026-08-25T12:00:00.000Z");
    expect(resolveActiveTrends([trend], { now, market: "us" })).toHaveLength(1);
    const selection = getTrendingSelection([trend], { now, seed: "test" });
    expect(selection.prompt.id).toBe("editorial-test-line");
    expect(selection.energy.id).toBe(trend.energyIds?.[0]);
    expect(resolveActiveTrends([trend], { now: new Date("2026-10-01") })).toEqual([]);
  });
});

describe("submission preflight", () => {
  it("normalizes safe lines and flags likely PII", () => {
    expect(preflightSubmittedLine("  My   original line. ")).toMatchObject({
      acceptedForReview: true,
      normalizedLine: "My original line.",
    });
    expect(preflightSubmittedLine("Email me at person@example.com").risks).toContain(
      "possible-email",
    );
  });
});
