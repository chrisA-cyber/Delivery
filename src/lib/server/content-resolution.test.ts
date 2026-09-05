import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDailyPrompt,
  getPromptById,
  getEnergyModifierById,
  PROMPTS,
  ENERGY_MODIFIERS,
} from "@/data/content";
import {
  challengeHasActiveProfileContainment,
  assertContentRating,
  resolveCanonicalDeliveryContent,
  resolvePromptPackEntitlement,
} from "@/lib/server/content";
import { resetEnvCacheForTests } from "@/lib/server/env";

const guestUsage = {
  tier: "guest" as const,
  used: 0,
  limit: 5,
  remaining: 5,
  resetAt: null,
  tracked: true,
};

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function dailyInput(date = todayUtc(), market = "global") {
  const daily = getDailyPrompt(new Date(`${date}T12:00:00.000Z`));
  return {
    promptId: daily.prompt.id,
    promptText: daily.prompt.line,
    energy: daily.energy.instruction,
    category: daily.prompt.category,
    mode: "daily" as const,
    dailyDate: date,
    dailyMarket: market,
    user: null,
    usage: guestUsage,
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  resetEnvCacheForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});

describe("canonical Daily resolution", () => {
  it("accepts today's global Daily pairing", async () => {
    await expect(
      resolveCanonicalDeliveryContent(dailyInput()),
    ).resolves.toMatchObject({
      dailyDate: todayUtc(),
      dailyMarket: "global",
      requiresPro: false,
    });
  });

  it("rejects a seeded future date before content lookup", async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1_000)
      .toISOString()
      .slice(0, 10);
    await expect(
      resolveCanonicalDeliveryContent(dailyInput(future)),
    ).rejects.toMatchObject({
      code: "DAILY_CHALLENGE_EXPIRED",
      status: 409,
    });
  });

  it("rejects unsurfaced markets before content lookup", async () => {
    await expect(
      resolveCanonicalDeliveryContent(dailyInput(todayUtc(), "future-market")),
    ).rejects.toMatchObject({
      code: "DAILY_MARKET_UNAVAILABLE",
      status: 409,
    });
  });
});

describe("canonical pack availability", () => {
  it("rejects orphaned or fully inactive prompts instead of treating them as free", () => {
    expect(() => resolvePromptPackEntitlement([], "classic")).toThrowError(
      expect.objectContaining({ code: "PROMPT_NOT_FOUND", status: 404 }),
    );
    expect(() =>
      resolvePromptPackEntitlement(
        [
          {
            access: "pro",
            state: "published",
            available_from: null,
            available_until: "2000-01-01T00:00:00.000Z",
          },
        ],
        "classic",
      ),
    ).toThrowError(expect.objectContaining({ code: "PROMPT_NOT_FOUND" }));
  });

  it("derives paywall access from every active canonical membership", () => {
    const activePro = {
      access: "pro" as const,
      state: "published",
      available_from: null,
      available_until: null,
    };
    expect(resolvePromptPackEntitlement([activePro], "classic")).toEqual({
      requiresPro: true,
    });
    expect(
      resolvePromptPackEntitlement(
        [activePro, { ...activePro, access: "free" as const }],
        "classic",
      ),
    ).toEqual({ requiresPro: false });
  });

  it("keeps a canonical current Daily slot promotional", () => {
    expect(resolvePromptPackEntitlement([], "daily")).toEqual({
      requiresPro: false,
    });
  });
});

describe("canonical challenge admission", () => {
  it("requires an account before any signed challenge can reach judging", async () => {
    const daily = getDailyPrompt(new Date(`${todayUtc()}T12:00:00.000Z`));
    await expect(
      resolveCanonicalDeliveryContent({
        promptId: daily.prompt.id,
        promptText: daily.prompt.line,
        energy: daily.energy.instruction,
        mode: "challenge",
        challengeId: "51515151-5151-4515-8515-515151515151",
        challengeToken: "valid-looking-token-that-must-not-bypass-auth",
        user: null,
        usage: guestUsage,
      }),
    ).rejects.toMatchObject({
      code: "CHALLENGE_AUTH_REQUIRED",
      status: 401,
    });
  });

  it("fails closed for active creator, recipient, or entrant profile containment", () => {
    const now = Date.parse("2026-08-26T12:00:00.000Z");
    const active = (userId: string, kind = "profile-limit") => ({
      user_id: userId,
      kind,
      starts_at: "2026-08-26T11:00:00.000Z",
      ends_at: null,
    });
    for (const containedId of ["creator", "recipient", "entrant"]) {
      expect(
        challengeHasActiveProfileContainment(
          [active(containedId)],
          ["creator", "recipient", "entrant"],
          now,
        ),
      ).toBe(true);
    }
    expect(
      challengeHasActiveProfileContainment(
        [
          {
            ...active("creator", "profile-remove"),
            ends_at: "2026-08-26T11:30:00.000Z",
          },
        ],
        ["creator", "recipient", "entrant"],
        now,
      ),
    ).toBe(false);
  });
});

describe("canonical content intensity enforcement", () => {
  it("requires explicit opt-in for mature canonical content, irrespective of supplied copy", async () => {
    const prompt = PROMPTS.find(
      (p) => p.rating === "mature" && p.packIds.includes("internet-originals"),
    )!;
    const input = {
      promptId: prompt.id,
      promptText: prompt.line,
      energy: ENERGY_MODIFIERS[0]!.instruction,
      mode: "classic" as const,
      user: null,
      usage: guestUsage,
    };
    await expect(resolveCanonicalDeliveryContent(input)).rejects.toMatchObject({
      code: "CONTENT_OPT_IN_REQUIRED",
      status: 403,
    });
    await expect(
      resolveCanonicalDeliveryContent({ ...input, maxRating: "teen" }),
    ).rejects.toMatchObject({ code: "CONTENT_OPT_IN_REQUIRED" });
    await expect(
      resolveCanonicalDeliveryContent({ ...input, maxRating: "mature" }),
    ).resolves.toMatchObject({ promptText: prompt.line });
  });
  it("never interprets teen as permission for mature content", () => {
    expect(() => assertContentRating("mature", "teen")).toThrowError(
      expect.objectContaining({ code: "CONTENT_OPT_IN_REQUIRED" }),
    );
    expect(() => assertContentRating("everyone", "mature")).not.toThrow();
  });
  it("retains retired lookup but rejects it for a new Classic submission", async () => {
    await expect(
      resolveCanonicalDeliveryContent({
        promptId: "timeline-needs-me",
        promptText:
          "The timeline has been quiet. Unfortunately, I have arrived.",
        energy:
          "Say it like you're calmly explaining something extremely suspicious to the police.",
        mode: "classic",
        user: null,
        usage: guestUsage,
      }),
    ).rejects.toMatchObject({ code: "PROMPT_RETIRED" });
  });
});

describe("Step 1B historical identity admission", () => {
  it("rejects a retired v2 line even when its unchanged text and mature consent match", async () => {
    const prompt = getPromptById("v2-god-favorites")!;
    const energy = getEnergyModifierById("v2-sincere-confession")!;
    await expect(
      resolveCanonicalDeliveryContent({
        promptId: prompt.id,
        promptText: prompt.line,
        energy: energy.instruction,
        mode: "classic",
        maxRating: "mature",
        user: null,
        usage: guestUsage,
      }),
    ).rejects.toMatchObject({ code: "PROMPT_RETIRED" });
  });
  it("recognizes a retired direction by exact historical text before denying new Classic use", async () => {
    const prompt = getPromptById("v2-favorite-child")!;
    const energy = getEnergyModifierById("v2-delayed-laugh")!;
    await expect(
      resolveCanonicalDeliveryContent({
        promptId: prompt.id,
        promptText: prompt.line,
        energy: energy.instruction,
        mode: "classic",
        user: null,
        usage: guestUsage,
      }),
    ).rejects.toMatchObject({ code: "PROMPT_RETIRED" });
  });
  it("resolves the frozen Step 1 Daily from its exact direction instruction", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00.000Z"));
    try {
      await expect(
        resolveCanonicalDeliveryContent(dailyInput("2026-09-05")),
      ).resolves.toMatchObject({ dailyDate: "2026-09-05" });
    } finally {
      vi.useRealTimers();
    }
  });
});
