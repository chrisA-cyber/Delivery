import { expect, test, type Page } from "@playwright/test";

const routes = [
  { path: "/", copy: /say the line/i },
  { path: "/play", copy: /tap to deliver/i },
  { path: "/daily", copy: /today's global line/i },
  { path: "/discover", copy: /pick your poison/i },
  { path: "/feed", copy: /fresh deliveries/i },
  { path: "/leaderboard", copy: /loudest legends/i },
  { path: "/challenge", copy: /pick their line/i },
  { path: "/endless", copy: /rounds/i },
  { path: "/impossible", copy: /no sensible delivery exists/i },
  { path: "/stream", copy: /turn chat into a co-host/i },
  { path: "/pricing", copy: /keep the mic hot/i },
  { path: "/settings", copy: /your settings/i },
  { path: "/login", copy: /save the tape/i },
  { path: "/submit", copy: /put a line in the game/i },
  { path: "/guidelines", copy: /keep the chaos kind/i },
  { path: "/privacy", copy: /privacy, without the fog machine/i },
  { path: "/terms", copy: /terms of the bit/i },
  { path: "/moderation", copy: /keep the stage safe/i },
] as const;

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("public route smoke", () => {
  for (const route of routes) {
    test(`${route.path} renders without a server or browser crash`, async ({ page }) => {
      const pageErrors = collectPageErrors(page);
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });

      expect(response, `${route.path} did not return a document response`).not.toBeNull();
      expect(response!.status(), `${route.path} returned ${response!.status()}`).toBeLessThan(500);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.locator("main").first()).toContainText(route.copy);
      await expect(page).toHaveTitle(/Delivery/i);
      await expect(page.locator("body")).not.toContainText(/application error|internal server error/i);
      expect(pageErrors, `${route.path} raised an uncaught browser error`).toEqual([]);
    });
  }

  test("an unknown pack query degrades to Classic and can reroll", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    const response = await page.goto("/play?pack=definitely-invalid", {
      waitUntil: "domcontentloaded",
    });

    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(500);
    await expect(page.getByText("Your line", { exact: true })).toBeVisible();

    const reroll = page.getByRole("button", { name: /reroll/i });
    await reroll.click();
    await expect(reroll).toBeEnabled();
    await expect(page.getByText("Tap to deliver", { exact: true })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
