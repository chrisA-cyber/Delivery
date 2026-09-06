import { describe, expect, it } from "vitest";

import { safeInternalAppPath } from "@/lib/server/redirects";

const origin = "https://delivery.example";

describe("safeInternalAppPath", () => {
  it("preserves an allowlisted internal path, query, and fragment", () => {
    expect(safeInternalAppPath("/settings?from=checkout#account", origin)).toBe(
      "/settings?from=checkout#account",
    );
  });

  it("returns players to their exact Say It Back clip, saved take, Switch challenge, or round", () => {
    for (const path of ["/a/abcdef123456?attempt=take&claim=take", "/switch?challenge=friend&attempt=take&claim=take", "/say-it-back?clip=fixture&role=lead", "/say-it-back?attempt=take&claim=take", "/say-it-back/challenge/friend?rematch=1", "/rounds/invitation?take=chosen", "/rounds/invitation/record?attempt=owned"]) {
      expect(safeInternalAppPath(path, origin)).toBe(path);
    }
  });

  it("returns to an owned Classic take for guest claiming after sign-in", () => {
    const path = "/performances/classic/00000000-0000-4000-8000-000000000001?claim=1";
    expect(safeInternalAppPath(path, origin)).toBe(path);
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example/steal",
    "/%5cevil.example/steal",
    "/api/account",
    "/auth/callback",
    "/profile-lookalike",
    "/performances/classic/not-a-take",
    "/performances/classic/00000000-0000-4000-8000-000000000001/admin",
  ])("rejects unsafe or non-user-facing destination %s", (value) => {
    expect(safeInternalAppPath(value, origin)).toBe("/profile");
  });
});
