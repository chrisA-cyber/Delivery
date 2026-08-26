import { expect, test } from "@playwright/test";

const routes = ["/", "/play", "/daily", "/discover", "/feed", "/leaderboard", "/pricing", "/settings"] as const;
const activeGameRoutes = ["/play", "/daily", "/endless", "/impossible"] as const;

test.describe("mobile layout smoke", () => {
  for (const width of [320, 390]) {
    test(`${width}px pages do not create document-level horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });

      for (const path of routes) {
        const response = await page.goto(path, { waitUntil: "domcontentloaded" });
        expect(response, `${path} did not return a document response`).not.toBeNull();
        expect(response!.status(), `${path} returned ${response!.status()}`).toBeLessThan(500);
        await expect(page.locator("main").first()).toBeVisible();
        // Several pages intentionally refresh live rankings/feed data. Two animation
        // frames are enough for layout to settle without waiting for a silent network.
        await page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            }),
        );

        const layout = await page.evaluate(() => {
          const root = document.documentElement;
          const overflow = [...document.querySelectorAll<HTMLElement>("body *")]
            .filter((element) => {
              const style = getComputedStyle(element);
              if (style.display === "none" || style.visibility === "hidden") return false;
              const rect = element.getBoundingClientRect();
              return rect.width > 0 && (rect.right > root.clientWidth + 1 || rect.left < -1);
            })
            .slice(0, 8)
            .map((element) => ({
              tag: element.tagName.toLowerCase(),
              className: element.className.toString().slice(0, 120),
              left: Math.round(element.getBoundingClientRect().left),
              right: Math.round(element.getBoundingClientRect().right),
            }));
          return {
            clientWidth: root.clientWidth,
            scrollWidth: Math.max(root.scrollWidth, document.body.scrollWidth),
            overflow,
          };
        });

        expect(
          layout.scrollWidth,
          `${path} is ${layout.scrollWidth - layout.clientWidth}px wider than a ${width}px viewport. Suspects: ${JSON.stringify(layout.overflow)}`,
        ).toBeLessThanOrEqual(layout.clientWidth + 1);
      }
    });
  }

  test("the fixed mobile dock stays out of active game routes", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    for (const path of activeGameRoutes) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveCount(0);
    }
  });
});
