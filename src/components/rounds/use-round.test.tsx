import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), post: vi.fn(), authenticated: true }));
vi.mock("@/components/providers/app-provider", () => ({ useApp: () => ({ authenticated: mocks.authenticated, hydrated: true, authReady: true, contentRating: "everyone" }) }));
vi.mock("./round-api", () => ({ roundApi: mocks.read, roundPost: mocks.post, RoundApiError: class extends Error {} }));
import { useRound } from "./use-round";
const token = "a".repeat(43);
beforeEach(() => { vi.clearAllMocks(); mocks.authenticated = true; });
describe("round return after authenticated sign-in", () => {
  it("claims once and retains the same participant and submission", async () => {
    const guest = { token, state: "open", canClaim: true, viewerMemberId: "member", members: [{ id: "member", submitted: true }] };
    mocks.read.mockResolvedValue({ round: guest });
    mocks.post.mockResolvedValue({ round: { ...guest, canClaim: false } });
    const { result } = renderHook(() => useRound(token, false));
    await waitFor(() => expect(result.current.round?.canClaim).toBe(false));
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(`/api/rounds/${token}/claim`, { maxRating: "everyone" });
    expect(result.current.round?.viewerMemberId).toBe("member");
    expect(result.current.round?.members[0]?.submitted).toBe(true);
  });
  it("never claims a new identity when the original guest cookie is missing", async () => {
    mocks.read.mockResolvedValue({ round: { token, state: "open", canClaim: false, viewerMemberId: null } });
    const { result } = renderHook(() => useRound(token, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
