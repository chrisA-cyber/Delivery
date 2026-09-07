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
  getPromptById,
  getEnergyModifierById,
  queryPrompts,
  isEnergyCompatible,
  isActivePrompt,
} from "../../data/content";
import {
  RECOGNIZABLE_PROMPTS,
  RECOGNIZABLE_SOURCES,
} from "../../data/recognizable-content";
import {
  PROMPTS as V2_PROMPTS,
  ENERGY_MODIFIERS as V2_ENERGY,
  getDailyPrompt as getV2DailyPrompt,
} from "../../data/classic-content-v2";
import {
  createPromptDeck,
  getSuggestedEnergy,
  validateContentCatalog,
} from "./catalog";
import { preflightSubmittedLine } from "./moderation";
import { getTrendingSelection, resolveActiveTrends } from "./trending";
import type { TrendingPromptInjection } from "./types";

describe("Delivery content catalog", () => {
  it("ships the complete launch baseline", () => {
    expect(CONTENT_COUNTS).toEqual({ prompts: 166, modifiers: 36, packs: 8 });
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
    expect(() => getRandomPrompt({ packId: "missing-pack" })).toThrow(
      RangeError,
    );
  });

  it("builds a no-repeat endless deck and preserves favorite order", () => {
    const deck = createPromptDeck({
      seed: "session-42",
      limit: 25,
      maxRating: "mature",
    });
    expect(deck).toHaveLength(25);
    expect(new Set(deck.map(({ id }) => id)).size).toBe(25);

    const ids = [PROMPTS[4]!.id, "stale-id", PROMPTS[1]!.id];
    expect(getFavoritePrompts(ids).map(({ id }) => id)).toEqual([
      ids[0],
      ids[2],
    ]);
  });

  it("keeps the database seed in exact slug and copy parity", () => {
    const fullSql = readFileSync(
      resolve(process.cwd(), "supabase/seed.sql"),
      "utf8",
    );
    const catalogBlocks = [3, 4].map((version) => fullSql.slice(
      fullSql.indexOf(`-- BEGIN CLASSIC V${version} CATALOG`),
      fullSql.indexOf(`-- END CLASSIC V${version} CATALOG`),
    ));
    const section = (start: string, end: string): string => {
      const sections = catalogBlocks.flatMap((sql) => {
        const startIndex = sql.indexOf(start);
        if (startIndex < 0) return [];
        const endIndex = sql.indexOf(end, startIndex + start.length);
        expect(endIndex, `missing seed section terminator: ${end}`).toBeGreaterThan(startIndex);
        return [sql.slice(startIndex, endIndex)];
      });
      expect(sections.length, `missing seed section: ${start}`).toBeGreaterThan(0);
      return sections.join("\n");
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
      "on conflict (slug) do nothing",
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
    expect([...seedPrompts.keys()].sort()).toEqual(
      PROMPTS.map(({ id }) => id).sort(),
    );
    expect(
      ENERGY_MODIFIERS.filter(
        ({ id, instruction }) => seedEnergy.get(id) !== instruction,
      ),
    ).toEqual([]);
    expect(
      PROMPTS.filter(({ id, line }) => seedPrompts.get(id) !== line),
    ).toEqual([]);
  });
});

describe("v2 audience and history contracts", () => {
  it("fails clean by default and requires explicit mature selection", () => {
    expect(queryPrompts()).toHaveLength(68);
    expect(queryPrompts({ maxRating: "teen" })).toHaveLength(103);
    expect(queryPrompts({ maxRating: "mature" })).toHaveLength(166);
    expect(PROMPTS.filter((p) => p.rating === "mature")).toHaveLength(63);
    for (let seed = 0; seed < 100; seed++)
      expect(getRandomPrompt({ seed }).rating).toBe("everyone");
  });
  it("preserves old IDs and exact copy but never puts them in new draws", () => {
    expect(getPromptById("timeline-needs-me")?.line).toBe(
      "The timeline has been quiet. Unfortunately, I have arrived.",
    );
    expect(getEnergyModifierById("lying-to-police")?.instruction).toBe(
      "Say it like you're calmly explaining something extremely suspicious to the police.",
    );
    expect(
      queryPrompts({ maxRating: "mature" }).every((p) => /^v[234]-/.test(p.id)),
    ).toBe(true);
    expect(
      getDailyPrompt(new Date("2026-08-25T12:00:00Z")).prompt.id.startsWith(
        "v2-",
      ),
    ).toBe(false);
  });
  it("keeps every Step 1 receipt exact and retires changed copy under fresh IDs", () => {
    for (const prompt of V2_PROMPTS)
      expect(getPromptById(prompt.id)).toEqual(prompt);
    for (const energy of V2_ENERGY)
      expect(getEnergyModifierById(energy.id)).toEqual(energy);
    const retiredPrompts = V2_PROMPTS.filter(({ id }) => !isActivePrompt(id));
    const retiredEnergy = V2_ENERGY.filter(
      ({ id }) => !ENERGY_MODIFIERS.some((energy) => energy.id === id),
    );
    expect(retiredPrompts).toHaveLength(27);
    expect(retiredEnergy).toHaveLength(12);
    expect(getPromptById("v2-god-favorites")?.line).toBe(
      "The universe put me in charge of my own life. Bold fucking choice.",
    );
    expect(getPromptById("v3-banned-list")?.line).toBe(
      "I told the bouncer I was on the list. It was the fucking banned list.",
    );
    expect(getDailyPrompt(new Date("2026-09-05T12:00:00Z"))).toEqual(
      getV2DailyPrompt(new Date("2026-09-05T12:00:00Z")),
    );
  });
  it("publishes only reviewed text references with source provenance, actual filtering, and fresh IDs", () => {
    expect(RECOGNIZABLE_PROMPTS).toHaveLength(14);
    expect(Object.keys(RECOGNIZABLE_SOURCES).sort()).toEqual(
      RECOGNIZABLE_PROMPTS.map(({ id }) => id).sort(),
    );
    for (const prompt of RECOGNIZABLE_PROMPTS) {
      const source = RECOGNIZABLE_SOURCES[prompt.id]!;
      expect(source.publicationDecision).toBe("publish-text-only");
      expect(source.sourceUrl).toMatch(/^https:\/\//);
      expect(source.wordingVerification.length).toBeGreaterThan(20);
      expect(source.recognitionEvidence.length).toBeGreaterThan(20);
      expect(source.publicationRationale.length).toBeGreaterThan(20);
      expect(source.limitations.length).toBeGreaterThan(20);
      expect(prompt.isMimic).toBe(false);
      expect(isActivePrompt(prompt.id)).toBe(true);
      expect(prompt.id).toMatch(/^v3-ref-/);
      expect(
        queryPrompts({ maxRating: "everyone" }).some(
          ({ id }) => id === prompt.id,
        ),
      ).toBe(prompt.rating === "everyone");
      expect(
        queryPrompts({ maxRating: "teen" }).some(({ id }) => id === prompt.id),
      ).toBe(prompt.rating !== "mature");
      expect(
        createPromptDeck({
          seed: "references",
          maxRating: "mature",
          tags: ["recognizable"],
        }).some(({ id }) => id === prompt.id),
      ).toBe(true);
    }
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/202609050017_classic_content_v3.sql",
      ),
      "utf8",
    );
    for (const source of Object.values(RECOGNIZABLE_SOURCES))
      expect(migration).toContain(JSON.stringify(source).replaceAll("'", "''"));
  });
  it("keeps short phrases out of both emotional and sequential multi-beat tasks", () => {
    const short = { line: "This is fine.", difficulty: "easy" as const };
    for (const energy of ENERGY_MODIFIERS.filter(
      (item) =>
        item.tags.includes("multi-beat") || item.tags.includes("contrast"),
    )) {
      expect(isEnergyCompatible(short, energy), energy.id).toBe(false);
    }
    for (const id of [
      "v2-polite-fury",
      "v2-sincere-confession",
      "v2-quiet-winner",
      "v3-manual-serious",
    ]) {
      expect(isEnergyCompatible(short, getEnergyModifierById(id)!)).toBe(true);
    }
  });
  it("gives every published line a playable direction, and rejects multibeat directions for tiny lines", () => {
    for (const prompt of PROMPTS)
      expect(
        ENERGY_MODIFIERS.some((energy) => isEnergyCompatible(prompt, energy)),
      ).toBe(true);
    const multibeat = ENERGY_MODIFIERS.find((energy) =>
      energy.tags.includes("contrast"),
    )!;
    expect(
      isEnergyCompatible({ line: "Oh no.", difficulty: "easy" }, multibeat),
    ).toBe(false);
    for (const prompt of PROMPTS)
      expect(prompt.line.length).toBeLessThanOrEqual(180);
  });
  it("ships identical additive data in the migration and seed without destructive retirement", () => {
    const seed = readFileSync(
      resolve(process.cwd(), "supabase/seed.sql"),
      "utf8",
    );
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/202609050017_classic_content_v3.sql",
      ),
      "utf8",
    );
    const block = (sql: string) =>
      sql.slice(
        sql.indexOf("-- BEGIN CLASSIC V3 CATALOG"),
        sql.indexOf("-- END CLASSIC V3 CATALOG"),
      );
    expect(block(seed)).toBe(block(migration));
    expect(migration).toContain("set draw_enabled = false");
    expect(migration).not.toMatch(
      /delete from public\.(prompts|energy_modifiers|daily_challenges)/i,
    );
    expect(migration).toContain("if found then return result; end if;");
    expect(migration).toContain("p.rating = 'everyone'::public.content_rating");
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

  it("requires mature opt-in for editorial injections and keeps empty-trend fallback clean", () => {
    const now = new Date("2026-08-25T12:00:00Z");
    const mature = {
      ...trend,
      prompt: { ...trend.prompt, rating: "mature" as const },
    };
    expect(resolveActiveTrends([mature], { now })).toEqual([]);
    expect(resolveActiveTrends([mature], { now, maxRating: "teen" })).toEqual(
      [],
    );
    expect(
      resolveActiveTrends([mature], { now, maxRating: "mature" }),
    ).toHaveLength(1);
    expect(getTrendingSelection([mature], { now }).prompt.rating).toBe(
      "everyone",
    );
  });

  it("only relaxes recent-direction exclusions inside the compatible pool", () => {
    const short = { ...PROMPTS[0]!, line: "Oh no." };
    const result = getSuggestedEnergy(
      short,
      "exhausted",
      ENERGY_MODIFIERS.map((energy) => energy.id),
    );
    expect(isEnergyCompatible(short, result)).toBe(true);
    expect(result.tags).not.toContain("contrast");
  });

  it("honors schedule, market, and energy allowlist", () => {
    const now = new Date("2026-08-25T12:00:00.000Z");
    expect(resolveActiveTrends([trend], { now, market: "us" })).toHaveLength(1);
    const selection = getTrendingSelection([trend], { now, seed: "test" });
    expect(selection.prompt.id).toBe("editorial-test-line");
    expect(selection.energy.id).toBe(trend.energyIds?.[0]);
    expect(
      resolveActiveTrends([trend], { now: new Date("2026-10-01") }),
    ).toEqual([]);
  });
});

describe("submission preflight", () => {
  it("normalizes safe lines and flags likely PII", () => {
    expect(preflightSubmittedLine("  My   original line. ")).toMatchObject({
      acceptedForReview: true,
      normalizedLine: "My original line.",
    });
    expect(
      preflightSubmittedLine("Email me at person@example.com").risks,
    ).toContain("possible-email");
  });
});
