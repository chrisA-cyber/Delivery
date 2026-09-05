// @vitest-environment node
import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ configured: true, rows: {} as Record<string, unknown>, errors: {} as Record<string, unknown> }));
vi.mock("@/lib/server/env", async (original) => ({
  ...await original<typeof import("@/lib/server/env")>(),
  isSupabaseConfigured: () => fixture.configured,
  isSupabaseAdminConfigured: () => fixture.configured,
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  from: (table: string) => {
    const result = Promise.resolve({ data: fixture.rows[table] ?? null, error: fixture.errors[table] ?? null });
    const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), or: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(), then: result.then.bind(result) };
    for (const name of ["select", "eq", "in", "or", "limit", "maybeSingle"] as const) query[name].mockReturnValue(query);
    return query;
  },
}) }));

import { assertChallengeReceiptAccess } from "@/lib/server/content";
import type { User } from "@supabase/supabase-js";

const token = "a-valid-private-invite-token";
const participant = { user: { id: "player-a" } as User, challengeId: "challenge-1", challengeToken: token };

beforeEach(() => {
  fixture.configured = true;
  fixture.errors = {};
  fixture.rows = {
    challenges: {
      id: "challenge-1", created_by: "player-a", recipient_user_id: "player-b", state: "completed",
      visibility: "private", expires_at: "2001-01-01T00:00:00Z", max_entries: 2,
      token_digest: createHash("sha256").update(token).digest("hex"),
    },
    challenge_entries: [{ entrant_id: "player-a" }, { entrant_id: "player-b" }],
    account_restrictions: [],
  };
});

describe("completed challenge receipt authorization", () => {
  it("allows an authenticated participant's receipt after completion or expiry", async () => {
    await expect(assertChallengeReceiptAccess(participant)).resolves.toBeUndefined();
    fixture.rows.challenges = { ...(fixture.rows.challenges as object), state: "expired" };
    await expect(assertChallengeReceiptAccess(participant)).resolves.toBeUndefined();
  });

  it("does not let a token or cached receipt bypass a different assigned recipient", async () => {
    await expect(assertChallengeReceiptAccess({ ...participant, user: { id: "stranger" } as User })).rejects.toMatchObject({ code: "CHALLENGE_INVALID" });
    await expect(assertChallengeReceiptAccess({ ...participant, user: null })).rejects.toMatchObject({ code: "CHALLENGE_AUTH_REQUIRED" });
  });

  it("rechecks symmetric blocks and current account deletion", async () => {
    fixture.rows.blocks = { blocker_id: "player-b" };
    await expect(assertChallengeReceiptAccess(participant)).rejects.toMatchObject({ code: "CHALLENGE_INVALID" });
    fixture.rows.blocks = null;
    fixture.rows.account_deletion_jobs = { user_id: "player-b" };
    await expect(assertChallengeReceiptAccess(participant)).rejects.toMatchObject({ code: "CHALLENGE_INVALID" });
  });

  it("rechecks active counterpart containment and canceled challenges", async () => {
    fixture.rows.account_restrictions = [{ user_id: "player-b", kind: "profile-limit", starts_at: "2001-01-01T00:00:00Z", ends_at: null }];
    await expect(assertChallengeReceiptAccess(participant)).rejects.toMatchObject({ code: "CHALLENGE_INVALID" });
    fixture.rows.account_restrictions = [];
    fixture.rows.challenges = { ...(fixture.rows.challenges as object), state: "canceled" };
    await expect(assertChallengeReceiptAccess(participant)).rejects.toMatchObject({ code: "CHALLENGE_INVALID" });
  });

  it("fails closed on unavailable privacy data or configuration", async () => {
    fixture.errors.blocks = new Error("fixture database outage");
    await expect(assertChallengeReceiptAccess(participant)).rejects.toMatchObject({ status: 503 });
    fixture.configured = false;
    await expect(assertChallengeReceiptAccess(participant)).rejects.toMatchObject({ code: "CHALLENGE_UNAVAILABLE" });
  });
});
