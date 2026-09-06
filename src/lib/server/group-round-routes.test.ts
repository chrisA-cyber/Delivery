import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), read: vi.fn(), viewer: { user: null, guest: { idempotencyScope: "a".repeat(64), scope: "scope" } } }));
vi.mock("@/lib/server/group-rounds", () => ({
  getGroupViewer: async () => mocks.viewer, createGroupRound: mocks.create, getGroupRound: mocks.read,
  mutateGroupRound: vi.fn(), submitGroupPerformance: vi.fn(),
}));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: async () => undefined, getClientKey: () => "test" }));
import { handleGroupRoute } from "@/lib/server/group-round-routes";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("round links behind the Railway proxy", () => {
  it("uses the configured public origin for creation and saved round links", async () => {
    const publicOrigin = "https://delivery-production-0577.up.railway.app";
    vi.stubEnv("NEXT_PUBLIC_APP_URL", publicOrigin);
    mocks.create.mockResolvedValue({ id: "round" }); mocks.read.mockResolvedValue({ id: "round" });
    const input = { requestId: "b815e840-b2c5-4bb9-80c8-17a4cc6e4ee2", name: "Friends", displayName: "Guest", mode: "classic", closesInHours: 24, maxRating: "everyone", promptId: "line", energyId: "direction" };
    const createResponse = await handleGroupRoute(new Request("https://0.0.0.0:3000/api/rounds", { method: "POST", headers: { "Content-Type": "application/json", Origin: publicOrigin }, body: JSON.stringify(input) }), "create");
    expect(createResponse.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(input, mocks.viewer, publicOrigin, undefined);
    const token = "a".repeat(43);
    const readResponse = await handleGroupRoute(new Request(`https://0.0.0.0:3000/api/rounds/${token}`), "read", token);
    expect(readResponse.status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith(token, mocks.viewer, publicOrigin, "everyone");
  });
});
