import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/challenges/route";
import { AppError } from "@/lib/server/api-error";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), requireUser: vi.fn(), preflight: vi.fn(), inserts: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/server/account-deletion", () => ({ assertAccountNotDeleting: vi.fn() }));
vi.mock("@/lib/server/entitlements", () => ({ preflightJudgingUsage: mocks.preflight }));
vi.mock("@/lib/supabase/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({ from: mocks.from }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/server/env", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/server/env")>(), isSupabaseConfigured: () => true, isSupabaseAdminConfigured: () => true, getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://delivery.test" }) }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: async () => ({}), rateLimitHeaders: () => ({}) }));
vi.mock("@/lib/server/moderation", () => ({ moderateLine: async () => ({ decision: "approved" }) }));

const pack = { access: "free" as const, state: "published", draw_enabled: true, available_from: null as string | null, available_until: null as string | null };
function promptRow() {
  return { id: "11111111-1111-4111-8111-111111111111", slug: "v2-creation-test", body: "I am my own emergency contact. We are both panicking.", category: "main-character", difficulty: 1, rating: "everyone" as "everyone" | "teen" | "mature", state: "published", draw_enabled: true, available_from: null as string | null, available_until: null as string | null, pack_prompts: [{ content_packs: { ...pack } }] };
}
function energyRow() {
  return { id: "22222222-2222-4222-8222-222222222222", slug: "v2-test-energy", instruction: "Keep a steady voice and pause before the final phrase.", state: "published", draw_enabled: true, tags: ["quiet"], compatible_difficulties: null as number[] | null };
}
let prompt = promptRow();
let energy = energyRow();

beforeEach(() => {
  vi.clearAllMocks(); mocks.inserts.length = 0; prompt = promptRow(); energy = energyRow();
  mocks.requireUser.mockResolvedValue({ id: "owner-id" });
  mocks.preflight.mockResolvedValue({ tier: "pro", used: 0, limit: 100, remaining: 100, resetAt: null, tracked: true });
  mocks.from.mockImplementation((table: string) => {
    const filters: Array<[string, unknown]> = [];
    const builder = {
      select: vi.fn(() => builder), limit: vi.fn(() => builder),
      eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return builder; }),
      maybeSingle: vi.fn(async () => {
        const row = table === "prompts" ? prompt : energy;
        const matches = filters.every(([key, value]) => (row as Record<string, unknown>)[key] === value);
        return { data: matches ? row : null, error: null };
      }),
      insert: vi.fn((value: Record<string, unknown>) => { mocks.inserts.push(value); return builder; }),
      single: vi.fn(async () => ({ data: { id: "challenge-id", code: mocks.inserts[0]?.code, expires_at: "2026-10-01T00:00:00Z" }, error: null })),
    };
    return builder;
  });
});

function create(maxRating?: "everyone" | "teen" | "mature") {
  return POST(new Request("https://delivery.test/api/challenges", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://delivery.test" },
    body: JSON.stringify({ promptId: prompt.slug, energyId: energy.slug, ...(maxRating ? { maxRating } : {}) }),
  }));
}

async function errorCode(response: Response) { return (await response.json()).error.code; }

describe("challenge creation uses canonical content gates", () => {
  it("creates a clean invite by default with private token digest and canonical UUIDs", async () => {
    const response = await create(); expect(response.status).toBe(201);
    const body = await response.json();
    const rawToken = body.data.inviteUrl.split(".").at(-1);
    expect(mocks.inserts).toHaveLength(1);
    expect(mocks.inserts[0]).toMatchObject({ prompt_id: prompt.id, energy_modifier_id: energy.id, created_by: "owner-id", visibility: "link", max_entries: 2, token_digest: `\\x${createHash("sha256").update(rawToken).digest("hex")}` });
    expect(JSON.stringify(mocks.inserts[0])).not.toContain(rawToken);
  });
  it("rejects mature content without explicit mature opt-in before creating a token", async () => {
    prompt.rating = "mature";
    for (const rating of [undefined, "everyone", "teen"] as const) {
      const response = await create(rating); expect(response.status).toBe(403); expect(await errorCode(response)).toBe("CONTENT_OPT_IN_REQUIRED");
    }
    expect(mocks.inserts).toHaveLength(0);
    expect((await create("mature")).status).toBe(201);
  });
  it("rejects retired lines and retired directions for new invites", async () => {
    prompt.draw_enabled = false;
    expect(await errorCode(await create())).toBe("CHALLENGE_CONTENT_NOT_FOUND");
    prompt.draw_enabled = true; energy.draw_enabled = false;
    expect(await errorCode(await create())).toBe("CHALLENGE_CONTENT_NOT_FOUND");
    expect(mocks.inserts).toHaveLength(0);
  });
  it("rejects a retired or expired pack even when the prompt is still published", async () => {
    prompt.pack_prompts[0]!.content_packs.draw_enabled = false;
    expect(await errorCode(await create())).toBe("PROMPT_NOT_FOUND");
    prompt.pack_prompts[0]!.content_packs.draw_enabled = true;
    prompt.pack_prompts[0]!.content_packs.available_until = "2000-01-01T00:00:00Z";
    expect(await errorCode(await create())).toBe("PROMPT_NOT_FOUND");
    expect(mocks.inserts).toHaveLength(0);
  });
  it("rejects unavailable canonical dates and incompatible directions", async () => {
    prompt.available_from = "2099-01-01T00:00:00Z";
    expect(await errorCode(await create())).toBe("PROMPT_NOT_FOUND");
    prompt.available_from = null; energy.compatible_difficulties = [4];
    expect(await errorCode(await create())).toBe("ENERGY_INCOMPATIBLE");
    energy.compatible_difficulties = null; energy.tags = ["contrast"]; prompt.body = "Oh no.";
    expect(await errorCode(await create())).toBe("ENERGY_INCOMPATIBLE");
    expect(mocks.inserts).toHaveLength(0);
  });
  it("retains the Pro and authentication boundaries regardless of audience choice", async () => {
    mocks.preflight.mockResolvedValueOnce({ tier: "free" });
    expect(await errorCode(await create("mature"))).toBe("PRO_REQUIRED");
    mocks.requireUser.mockRejectedValueOnce(new AppError("AUTH_REQUIRED", "Sign in.", 401));
    expect((await create("mature")).status).toBe(401);
    expect(mocks.inserts).toHaveLength(0);
  });
});
