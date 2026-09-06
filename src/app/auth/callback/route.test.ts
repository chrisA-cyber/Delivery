import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const fixture = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock("@/lib/server/env", () => ({ getServerEnv: () => ({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://delivery.example" }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({ auth: { exchangeCodeForSession: fixture.exchange } }) }));
beforeEach(() => { fixture.exchange.mockReset().mockResolvedValue({ data: { session: {} }, error: null }); });

describe("authentication callback return", () => {
  it("exchanges a normal sign-in code server-side and returns to the exact saved scene", async () => {
    const next = "/say-it-back?clip=scene&attempt=take&claim=take";
    const response = await GET(new Request(`https://delivery.example/auth/callback?code=valid&sb_flow_id=flow&next=${encodeURIComponent(next)}`));
    expect(fixture.exchange).toHaveBeenCalledWith("valid", { flowId: "flow" });
    expect(response.headers.get("Location")).toBe(`https://delivery.example${next}`);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("keeps a challenge destination when the code fails", async () => {
    fixture.exchange.mockResolvedValue({ error: new Error("expired") });
    const next = "/say-it-back?challenge=friend";
    const response = await GET(new Request(`https://delivery.example/auth/callback?code=expired&next=${encodeURIComponent(next)}`));
    expect(response.headers.get("Location")).toBe(`https://delivery.example/login?error=callback&next=${encodeURIComponent(next)}`);
  });
});
