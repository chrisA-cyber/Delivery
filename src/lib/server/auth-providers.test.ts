import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthAvailability } from "@/lib/server/auth-providers";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function configured(external: Record<string, boolean>) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-fixture");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external }) }));
}

describe("available authentication routes", () => {
  it("does not mistake the enabled hosted mailer for reliable email delivery", async () => {
    configured({ email: true, github: false, google: false });
    vi.stubEnv("DELIVERY_AUTH_EMAIL_READY", "false");
    expect(await getAuthAvailability()).toEqual({ enabledProviders: [], emailReady: false, passwordSignIn: true });
  });

  it("offers verified email and only live-enabled social providers", async () => {
    configured({ email: true, github: true, google: false });
    vi.stubEnv("DELIVERY_AUTH_EMAIL_READY", "true");
    expect(await getAuthAvailability()).toEqual({ enabledProviders: ["github"], emailReady: true, passwordSignIn: true });
  });

  it("fails closed if settings cannot be read or email is disabled", async () => {
    configured({ email: false, github: false });
    vi.stubEnv("DELIVERY_AUTH_EMAIL_READY", "true");
    expect((await getAuthAvailability()).emailReady).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unavailable")));
    expect(await getAuthAvailability()).toEqual({ enabledProviders: [], emailReady: false, passwordSignIn: false });
  });
});
