import { describe, expect, it } from "vitest";

import { safeInternalAppPath } from "@/lib/server/redirects";

const origin = "https://delivery.example";

describe("safeInternalAppPath", () => {
  it("preserves an allowlisted internal path, query, and fragment", () => {
    expect(safeInternalAppPath("/settings?from=checkout#account", origin)).toBe(
      "/settings?from=checkout#account",
    );
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example/steal",
    "/%5cevil.example/steal",
    "/api/account",
    "/auth/callback",
    "/profile-lookalike",
  ])("rejects unsafe or non-user-facing destination %s", (value) => {
    expect(safeInternalAppPath(value, origin)).toBe("/profile");
  });
});
