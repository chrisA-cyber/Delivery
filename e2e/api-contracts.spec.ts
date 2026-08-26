import { expect, test } from "@playwright/test";

test.describe("safe public API contracts", () => {
  test("health returns a redacted success or configuration envelope", async ({ request }) => {
    const response = await request.get("/api/health");
    expect([200, 503]).toContain(response.status());

    const body = await response.json() as {
      ok?: boolean;
      requestId?: string;
      data?: { status?: string; environment?: string; services?: Record<string, boolean> };
      error?: { code?: string; message?: string; details?: unknown };
    };
    expect(body.requestId).toEqual(expect.any(String));

    if (response.ok()) {
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(body).toMatchObject({
        ok: true,
        data: {
          status: "ok",
          services: {
            supabase: expect.any(Boolean),
            supabaseAdmin: expect.any(Boolean),
            openai: expect.any(Boolean),
            stripe: expect.any(Boolean),
          },
        },
      });
    } else {
      expect(body).toMatchObject({
        ok: false,
        error: { code: "SERVER_NOT_CONFIGURED" },
      });
      expect(body.error?.details, "production health errors must not name missing secrets").toBeUndefined();
    }

    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/sk-(?:proj-)?[a-z0-9_-]{12,}/i);
    expect(serialized).not.toMatch(/whsec_[a-z0-9_-]+/i);
  });

  test("random prompt returns playable content or a redacted fail-closed envelope", async ({ request }) => {
    const response = await request.get("/api/prompts/random?seed=e2e-smoke&market=global");
    expect([200, 503]).toContain(response.status());
    expect(response.headers()["cache-control"]).toContain("no-store");

    const body = await response.json() as Record<string, unknown>;
    if (!response.ok()) {
      expect(body).toMatchObject({
        ok: false,
        requestId: expect.any(String),
        error: {
          code: "RATE_LIMIT_NOT_CONFIGURED",
          message: expect.any(String),
        },
      });
      expect(JSON.stringify(body)).not.toMatch(/UPSTASH|TOKEN|https?:\/\//i);
      return;
    }

    expect(body).toMatchObject({
      ok: true,
      requestId: expect.any(String),
      data: {
        source: expect.stringMatching(/^(curated|database|trend)$/),
        prompt: {
          id: expect.any(String),
          line: expect.any(String),
          category: expect.any(String),
          difficulty: expect.stringMatching(/^(easy|medium|hard|impossible)$/),
        },
        energy: {
          id: expect.any(String),
          instruction: expect.any(String),
          shortLabel: expect.any(String),
          intensity: expect.any(Number),
        },
      },
    });
  });
});
