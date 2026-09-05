import { describe, expect, it } from "vitest";

import { GET as randomPromptRoute } from "@/app/api/prompts/random/route";
import { resetEnvCacheForTests } from "@/lib/server/env";
import { selectRuntimeContent } from "@/lib/server/random-content";

type Snapshot = Parameters<typeof selectRuntimeContent>[0];
type Query = Parameters<typeof selectRuntimeContent>[1];
type PackRow = Snapshot["packs"][number];
type EnergyRow = Snapshot["energies"][number];
type PromptRow = Extract<
  Snapshot["memberships"][number]["prompts"],
  { id: string }
>;

const now = new Date("2026-08-26T12:00:00.000Z");
const freePack: PackRow = {
  id: "pack-free-id",
  slug: "free-pack",
  name: "Free Pack",
  access: "free",
  state: "published",
  available_from: null,
  available_until: null,
};
const proPack: PackRow = {
  ...freePack,
  id: "pack-pro-id",
  slug: "pro-pack",
  name: "Pro Pack",
  access: "pro",
};
const energy: EnergyRow = {
  id: "energy-id",
  slug: "energy",
  instruction: "Say it with unmistakable confidence and excellent timing.",
  short_label: "Confident",
  intensity: 3,
  tags: ["confidence"],
  compatible_difficulties: null,
  state: "published",
};

function prompt(
  id: string,
  category: PromptRow["category"] = "gaming",
  difficulty: PromptRow["difficulty"] = 2,
): PromptRow {
  return {
    id: `${id}-uuid`,
    slug: id,
    body: `The runtime line called ${id} has arrived.`,
    category,
    difficulty,
    rating: "everyone",
    state: "published",
    tags: ["runtime"],
    scoring_focus: ["commitment", "comedy"],
    locale: "en",
    is_mimic: false,
    available_from: null,
    available_until: null,
  };
}

function membership(packId: string, value: ReturnType<typeof prompt>) {
  return { pack_id: packId, prompt_id: value.id, prompts: value };
}

function baseQuery(overrides: Partial<Query> = {}): Query {
  return { market: "global", includePro: false, ...overrides };
}

async function withUnconfiguredSupabase<T>(run: () => Promise<T>): Promise<T> {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  resetEnvCacheForTests();
  try {
    return await run();
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
    resetEnvCacheForTests();
  }
}

describe("runtime prompt selection", () => {
  it("rejects sequential multi-beat directions for a short sourced phrase on the database path", () => {
    const short = {
      ...prompt("v3-ref-this-is-fine"),
      body: "This is fine.",
      tags: ["recognizable"],
    };
    const multiBeat = {
      ...energy,
      id: "multi-beat",
      slug: "multi-beat",
      tags: ["multi-beat"],
    };
    const snapshot = {
      packs: [freePack],
      memberships: [membership(freePack.id, short)],
      energies: [multiBeat],
      trends: [],
    };
    expect(() =>
      selectRuntimeContent(snapshot, baseQuery(), { now, random: () => 0 }),
    ).toThrowError(expect.objectContaining({ code: "NO_PROMPTS" }));
    const selected = selectRuntimeContent(
      { ...snapshot, energies: [multiBeat, energy] },
      baseQuery(),
      { now, random: () => 0 },
    );
    expect(selected.prompt.line).toBe("This is fine.");
    expect(selected.energy.id).toBe(energy.slug);
  });

  it("keeps Pro-only memberships out of the default pool", () => {
    const free = prompt("free-line");
    const pro = prompt("pro-line");
    const snapshot = {
      packs: [freePack, proPack],
      memberships: [membership(freePack.id, free), membership(proPack.id, pro)],
      energies: [energy],
      trends: [],
    };

    expect(
      selectRuntimeContent(snapshot, baseQuery(), { now, random: () => 0.999 })
        .prompt.id,
    ).toBe("free-line");
    expect(
      selectRuntimeContent(
        snapshot,
        baseQuery({ includePro: true, pack: "pro-pack" }),
        {
          now,
          random: () => 0,
        },
      ).prompt.id,
    ).toBe("pro-line");
  });

  it("honors pack, category, difficulty, and slug/UUID exclusions", () => {
    const first = prompt("first", "gaming", 1);
    const target = prompt("target", "group-chat", 3);
    const snapshot = {
      packs: [freePack],
      memberships: [
        membership(freePack.id, first),
        membership(freePack.id, target),
      ],
      energies: [energy],
      trends: [],
    };

    const selected = selectRuntimeContent(
      snapshot,
      baseQuery({
        pack: freePack.id,
        category: "group-chat",
        difficulty: "hard",
      }),
      { now, random: () => 0 },
    );
    expect(selected.prompt.id).toBe("target");
    expect(() =>
      selectRuntimeContent(
        snapshot,
        baseQuery({ excludeIds: [target.id, first.slug] }),
        {
          now,
          random: () => 0,
        },
      ),
    ).toThrowError(
      expect.objectContaining({ code: "NO_PROMPTS", status: 404 }),
    );
  });

  it("applies active market trend priority/weight and its compatible energy", () => {
    const regular = prompt("regular");
    const trending = prompt("trending");
    const trendEnergy: EnergyRow = {
      ...energy,
      id: "trend-energy-id",
      slug: "trend-energy",
      short_label: "Trend",
    };
    const snapshot = {
      packs: [freePack],
      memberships: [
        membership(freePack.id, regular),
        membership(freePack.id, trending),
      ],
      energies: [energy, trendEnergy],
      trends: [
        {
          campaign_id: "campaign-id",
          prompt_id: trending.id,
          energy_modifier_id: trendEnergy.id,
          weight: 100,
          trend_campaigns: {
            id: "campaign-id",
            slug: "big-moment",
            label: "Big moment",
            markets: ["us"],
            priority: 100,
            starts_at: "2026-08-26T00:00:00.000Z",
            ends_at: "2026-08-27T00:00:00.000Z",
            state: "published",
          },
        },
      ],
    } as Snapshot;

    const selected = selectRuntimeContent(
      snapshot,
      baseQuery({ market: "us" }),
      {
        now,
        random: () => 0.5,
      },
    );
    expect(selected).toMatchObject({
      source: "trend",
      prompt: { id: "trending" },
      energy: { id: "trend-energy" },
      trend: {
        id: "big-moment",
        label: "Big moment",
        priority: 100,
        market: "us",
      },
    });
  });

  it("ignores out-of-market campaigns and rejects incompatible energy", () => {
    const trending = prompt("regional", "gaming", 2);
    const hardOnlyEnergy: EnergyRow = {
      ...energy,
      id: "hard-energy-id",
      slug: "hard-energy",
      compatible_difficulties: [4],
    };
    const snapshot = {
      packs: [freePack],
      memberships: [membership(freePack.id, trending)],
      energies: [energy, hardOnlyEnergy],
      trends: [
        {
          campaign_id: "campaign-id",
          prompt_id: trending.id,
          energy_modifier_id: hardOnlyEnergy.id,
          weight: 100,
          trend_campaigns: {
            id: "campaign-id",
            slug: "uk-only",
            label: "UK only",
            markets: ["uk"],
            priority: 100,
            starts_at: "2026-08-26T00:00:00.000Z",
            ends_at: "2026-08-27T00:00:00.000Z",
            state: "published",
          },
        },
      ],
    } as Snapshot;

    const outsideMarket = selectRuntimeContent(
      snapshot,
      baseQuery({ market: "us" }),
      {
        now,
        random: () => 0,
      },
    );
    expect(outsideMarket.source).toBe("database");
    expect(outsideMarket.energy.id).toBe("energy");

    const inMarket = selectRuntimeContent(
      snapshot,
      baseQuery({ market: "uk" }),
      {
        now,
        random: () => 0,
      },
    );
    expect(inMarket.source).toBe("trend");
    expect(inMarket.energy.id).toBe("energy");
  });
});

describe("random prompt route contract", () => {
  it("keeps the success envelope and response uncacheable in bootstrap mode", async () => {
    const response = await withUnconfiguredSupabase(() =>
      randomPromptRoute(
        new Request(
          "https://delivery.test/api/prompts/random?pack=gaming-comms&category=gaming&difficulty=medium&maxRating=teen&seed=contract",
        ),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      ok: true,
      data: {
        prompt: {
          id: expect.any(String),
          line: expect.any(String),
          category: "gaming",
          packIds: ["gaming-comms"],
          difficulty: "medium",
        },
        energy: {
          id: expect.any(String),
          instruction: expect.any(String),
        },
        source: "curated",
      },
      requestId: expect.any(String),
    });
  });

  it("does not honor a Pro-pool request without a verified subscription", async () => {
    const response = await withUnconfiguredSupabase(() =>
      randomPromptRoute(
        new Request(
          "https://delivery.test/api/prompts/random?pack=impossible-energy&includePro=true",
        ),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      ok: false,
      error: { code: "PRO_REQUIRED", details: { upgradeCode: "DELIVERY_PRO" } },
    });
  });

  it("rejects an explicitly selected Pro-only pack from the free pool", async () => {
    const response = await withUnconfiguredSupabase(() =>
      randomPromptRoute(
        new Request(
          "https://delivery.test/api/prompts/random?pack=impossible-energy",
        ),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      ok: false,
      error: { code: "PRO_REQUIRED", details: { upgradeCode: "DELIVERY_PRO" } },
    });
  });
});

describe("runtime audience, retirement and repeat controls", () => {
  const snapshot = () => ({
    packs: [freePack],
    memberships: [
      membership(freePack.id, prompt("clean")),
      membership(freePack.id, {
        ...prompt("adult"),
        rating: "mature" as const,
      }),
      membership(freePack.id, { ...prompt("retired"), draw_enabled: false }),
    ],
    energies: [
      energy,
      {
        ...energy,
        id: "other-energy",
        slug: "other",
        instruction: "Keep a level voice and pause before the final detail.",
      },
    ],
    trends: [],
  });
  it("applies mature opt-in in the database selector, not only in the client", () => {
    expect(
      selectRuntimeContent(snapshot(), baseQuery(), {
        now,
        random: () => 0.999,
      }).prompt.id,
    ).toBe("clean");
    expect(
      selectRuntimeContent(snapshot(), baseQuery({ maxRating: "teen" }), {
        now,
        random: () => 0.999,
      }).prompt.id,
    ).toBe("clean");
    expect(
      selectRuntimeContent(snapshot(), baseQuery({ maxRating: "mature" }), {
        now,
        random: () => 0.999,
      }).prompt.id,
    ).toBe("adult");
  });
  it("excludes recent line and direction identities without admitting a retired line", () => {
    const result = selectRuntimeContent(
      snapshot(),
      baseQuery({
        maxRating: "mature",
        excludeIds: ["clean"],
        excludeEnergyIds: ["other"],
      }),
      { now, random: () => 0.999 },
    );
    expect(result.prompt.id).toBe("adult");
    expect(result.energy.id).toBe("energy");
  });
  it("never relaxes audience filters when all safe lines are excluded", () => {
    expect(() =>
      selectRuntimeContent(snapshot(), baseQuery({ excludeIds: ["clean"] }), {
        now,
      }),
    ).toThrowError(expect.objectContaining({ code: "NO_PROMPTS" }));
  });
  it("enforces the same audience contract in the HTTP fallback", async () => {
    await withUnconfiguredSupabase(async () => {
      const clean = await randomPromptRoute(
        new Request("http://localhost/api/prompts/random?seed=audience-check"),
      );
      expect((await clean.json()).data.prompt.rating).toBe("everyone");
      const invalid = await randomPromptRoute(
        new Request("http://localhost/api/prompts/random?maxRating=adult"),
      );
      expect(invalid.status).toBe(422);
      const adult = await randomPromptRoute(
        new Request(
          "http://localhost/api/prompts/random?maxRating=mature&seed=audience-check",
        ),
      );
      expect(adult.status).toBe(200);
    });
  });
});
