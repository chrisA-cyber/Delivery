// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  deletion: vi.fn(), query: vi.fn(), sign: vi.fn(),
  userId: "00000000-0000-4000-8000-000000000001",
}));
vi.mock("@/lib/server/account-deletion", () => ({ assertAccountNotDeleting: fixture.deletion }));
vi.mock("@/lib/supabase/auth", () => ({ requireUser: async () => ({ id: fixture.userId }) }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: vi.fn(), rateLimitHeaders: () => ({}) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: fixture.query }) }) }) }),
  storage: { from: () => ({ createSignedUrl: fixture.sign }) },
}) }));

import { GET } from "@/app/api/deliveries/[deliveryId]/route";
import { AppError } from "@/lib/server/api-error";

const deliveryId = "00000000-0000-4000-8000-000000000002";
const getAudio = () => GET(new Request(`http://localhost:3000/api/deliveries/${deliveryId}`), { params: Promise.resolve({ deliveryId }) });

beforeEach(() => {
  vi.resetAllMocks();
  fixture.deletion.mockResolvedValue(undefined);
  fixture.query.mockResolvedValue({ data: { id: deliveryId, recording_path: `${fixture.userId}/${deliveryId}.wav`, state: "judged", visibility: "private" } });
  fixture.sign.mockResolvedValue({ data: { signedUrl: "http://localhost/storage/signed-fixture" } });
});

describe("owner playback during account deletion", () => {
  it("refuses a new signed URL once account deletion has started", async () => {
    fixture.deletion.mockRejectedValue(new AppError("ACCOUNT_DELETION_IN_PROGRESS", "Account deletion is in progress.", 409));
    const response = await getAudio();
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("ACCOUNT_DELETION_IN_PROGRESS");
    expect(fixture.query).not.toHaveBeenCalled();
    expect(fixture.sign).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("keeps legitimate owner playback available without caching a signed URL", async () => {
    const response = await getAudio();
    expect(response.status).toBe(200);
    expect(fixture.deletion).toHaveBeenCalledWith(fixture.userId);
    expect(fixture.sign).toHaveBeenCalledWith(`${fixture.userId}/${deliveryId}.wav`, 300);
    expect((await response.json()).data.expiresIn).toBe(300);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
