// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

const clients = vi.hoisted(() => ({ admin: vi.fn(), scoped: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: clients.admin }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: clients.scoped }));
vi.mock("@/lib/server/env", () => ({ isSupabaseAdminConfigured: () => true }));

import { persistDelivery } from "@/lib/server/deliveries";

describe("demo score persistence boundary", () => {
  it.each(["classic", "daily", "challenge"] as const)("keeps %s demos out of Storage, scores, progression, and entry claims", async (mode) => {
    const result = await persistDelivery({
      user: { id: "test-owner" } as User,
      audio: new File([new Uint8Array(1024)], "take.wav", { type: "audio/wav" }),
      promptId: "test-prompt", energyId: "test-energy", promptText: "This is fine.",
      energy: "Whisper politely.", mode,
      challengeId: mode === "challenge" ? "test-challenge" : undefined,
      dailyDate: mode === "daily" ? "2026-09-06" : undefined,
      judgment: {
        transcript: "This is fine.",
        scores: { overall: 80, commitment: 80, comedy: 80, accuracy: 80, chaos: 80 },
        verdict: "Demo verdict.", verdictTag: "COMMITTED_TO_THE_BIT",
        highlights: ["Demo highlight."], coachNote: "Demo coaching.",
        source: "mock", model: "demo", rubricVersion: "delivery-demo-v1", scoringVersion: "delivery-demo-v1",
      },
    });
    expect(result).toMatchObject({ id: null, persisted: false });
    expect(result.warning).toContain("Demo result");
    expect(clients.admin).not.toHaveBeenCalled();
    expect(clients.scoped).not.toHaveBeenCalled();
  });
});
