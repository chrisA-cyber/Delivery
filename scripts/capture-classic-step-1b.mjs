import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const phase = process.env.DELIVERY_CAPTURE_PHASE || "after";
if (!["before","after"].includes(phase)) throw new Error("Use before or after");
const folder = `docs/evidence/classic-step-1b/${phase}`;
mkdirSync(folder, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      permissions: ["microphone"],
    });
    const page = await context.newPage();
    await page.bringToFront();
    page.setDefaultTimeout(15000);
    await page.route("**/api/judge", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            id: "before-fixture",
            scores: {
              overall: 82,
              commitment: 88,
              comedy: 78,
              accuracy: 90,
              chaos: 68,
            },
            verdict: "You committed to the bit. The bit would like a lawyer.",
            title: "COMMITTED TO THE BIT",
            moment: "Try a longer pause before the last word.",
            transcript: "Local synthetic microphone fixture.",
            source: "fallback",
          },
          delivery: { persisted: false, id: null },
        }),
      });
    });
    await page.goto("http://127.0.0.1:3000/");
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: `${folder}/home-${width}.png`,
      fullPage: true,
    });
    await page.goto("http://127.0.0.1:3000/play?prompt=v2-favorite-child&energy=v2-confidence-tears");
    await page
      .getByRole("button", { name: "Start recording", exact: true })
      .waitFor();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `${folder}/prepare-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Start recording", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Stop recording", exact: true })
      .waitFor()
      .catch(async (e) => {
        console.log((await page.locator("body").innerText()).slice(-1800));
        throw e;
      });
    await page.waitForTimeout(900);
    await page.screenshot({
      path: `${folder}/recording-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Stop recording", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Judge this take", exact: true })
      .waitFor();
    await page.screenshot({
      path: `${folder}/review-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Judge this take", exact: true })
      .click();
    await page.screenshot({
      path: `${folder}/judging-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "One more round", exact: false })
      .waitFor();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: `${folder}/result-${width}.png`,
      fullPage: true,
    });
    await context.close();
  }
  await browser.close();
  console.log(
    "Captured Step 1B core flow at 390 and 1440. Judge is a labeled fixture.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
