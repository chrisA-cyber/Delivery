import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "@/app/api/deliveries/[deliveryId]/visibility/route";
import { assertPublicContentAllowed } from "@/lib/server/content-publication";
import { getShareDelivery } from "@/lib/server/share";

const mocks = vi.hoisted(() => ({ from: vi.fn(), moderate: vi.fn(), setVisibility: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/server/account-deletion", () => ({ assertAccountNotDeleting: vi.fn() }));
vi.mock("@/lib/supabase/auth", () => ({ requireUser: async () => ({ id: "owner-id" }) }));
vi.mock("@/lib/server/moderation", () => ({ moderateLine: mocks.moderate }));
vi.mock("@/lib/server/deliveries", () => ({ setDeliveryVisibility: mocks.setVisibility }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: async () => ({}), rateLimitHeaders: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({ from: mocks.from }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: mocks.from, storage: { from: () => ({ createSignedUrl: mocks.sign }) } }) }));
vi.mock("@/lib/server/env", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/server/env")>(), isSupabaseConfigured: () => true, isSupabaseAdminConfigured: () => true }));

const deliveryId = "33333333-3333-4333-8333-333333333333";
function deliveryRow() {
  return { id: deliveryId, user_id: "owner-id", state: "judged", transcript: "My private take.", moderation_labels: ["publish-approved"], prompts: { body: "My private line.", rating: "mature" as string | undefined }, created_at: "2026-09-05T12:00:00Z", recording_path: "owner-id/audio.wav", energy_modifiers: { instruction: "Whisper." }, profiles: null, delivery_scores: { headline: "COMMITTED TO THE BIT", verdict: "The whisper worked.", evidence: {}, overall: 80, commitment: 80, comedy: 80, accuracy: 80, chaos: 80 } };
}
let row = deliveryRow();
beforeEach(() => {
  vi.clearAllMocks(); row = deliveryRow();
  mocks.moderate.mockResolvedValue({ decision: "approved", categories: [] });
  mocks.setVisibility.mockImplementation(async (_id, _user, visibility) => ({ visibility, publishedAt: null }));
  mocks.from.mockImplementation(() => {
    const builder = {
      select: vi.fn(() => builder), eq: vi.fn(() => builder), update: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: row, error: null })),
      then: (resolve: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    return builder;
  });
});
function publish(visibility = "public") {
  return PATCH(new Request("https://delivery.test/api/deliveries/id/visibility", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ visibility }) }), { params: Promise.resolve({ deliveryId }) });
}

describe("Mature publication launch boundary", () => {
  it("blocks Mature before moderation or visibility writes even when already approved", async () => {
    const response = await publish(); expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("MATURE_PUBLICATION_UNAVAILABLE");
    expect(mocks.moderate).not.toHaveBeenCalled(); expect(mocks.setVisibility).not.toHaveBeenCalled();
  });
  it("retains sticky Mature hold after a rating downgrade, and fails closed for unknown ratings", () => {
    expect(() => assertPublicContentAllowed("teen", ["mature-content"])).toThrowError(expect.objectContaining({ code: "MATURE_PUBLICATION_UNAVAILABLE" }));
    expect(() => assertPublicContentAllowed(undefined)).toThrowError(expect.objectContaining({ code: "CONTENT_RATING_UNAVAILABLE" }));
  });
  it("always permits the owned unpublish path and rejects unlisted API publication", async () => {
    expect((await publish("private")).status).toBe(200);
    expect(mocks.setVisibility).toHaveBeenCalledWith(deliveryId, "owner-id", "private");
    expect((await publish("unlisted")).status).toBe(422);
  });
  it("preserves existing non-Mature moderation approval and publication", async () => {
    row.prompts.rating = "teen";
    expect((await publish()).status).toBe(200);
    expect(mocks.moderate).toHaveBeenCalledTimes(1); expect(mocks.setVisibility).toHaveBeenCalledWith(deliveryId, "owner-id", "public");
  });
  it("denies stale Mature public reads before minting audio URLs", async () => {
    expect(await getShareDelivery(deliveryId)).toBeNull(); expect(mocks.sign).not.toHaveBeenCalled();
    row.prompts.rating = "everyone"; row.moderation_labels.push("mature-content");
    expect(await getShareDelivery(deliveryId)).toBeNull(); expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("still returns non-Mature historical public results through the authorized read", async () => {
    row.prompts.rating = "everyone";
    expect(await getShareDelivery(deliveryId, { includeAssets: false })).toMatchObject({ id: deliveryId, promptText: row.prompts.body, score: 80 });
  });
});
