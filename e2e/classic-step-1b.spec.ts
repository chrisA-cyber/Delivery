import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ENERGY_MODIFIERS, PROMPTS } from "../src/data/content";

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

for (const width of [320, 390, 768, 1440]) {
  test(`next round and direct replay remain visible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/judge", (route) =>
      route.fulfill({
        json: {
          result: {
            id: "step-1b-ui-fixture",
            scores: {
              overall: 82,
              commitment: 88,
              comedy: 78,
              accuracy: 90,
              chaos: 68,
            },
            verdict: "You committed to the bit. The bit would like a lawyer.",
            title: "COMMITTED TO THE BIT",
            moment: "A calm opening made the last word land.",
            coachNote:
              "Pause before the final admission, then let one word wobble.",
            transcript: "Synthetic UI fixture.",
            source: "fallback",
            scoringVersion: "delivery-demo-v1",
            rubricVersion: "delivery-demo-v1",
          },
          delivery: { persisted: false, id: null, visibility: "private" },
        },
      }),
    );
    await page.goto(
      "/play?prompt=v2-favorite-child&energy=v2-confidence-tears",
    );
    const start = page.getByRole("button", {
      name: "Start recording",
      exact: true,
    });
    await expect(start).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Clean", exact: true }),
    ).toBeInViewport();
    const recordBox = await start.boundingBox();
    expect(recordBox!.y + recordBox!.height).toBeLessThanOrEqual(
      width < 768 ? 844 : 1000,
    );
    await start.click();
    await expect(page.locator(".recording-status")).toContainText("0:02");
    await page
      .getByRole("button", { name: "Stop recording", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Judge this take", exact: true })
      .click();
    const next = page.getByRole("button", {
      name: "New line",
      exact: true,
    });
    await expect(next).toBeEnabled();
    const box = await next.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(width < 768 ? 844 : 1000);
    await page
      .getByRole("button", { name: "Replay take", exact: true })
      .click();
    await expect
      .poll(() =>
        page
          .locator("audio")
          .evaluate((audio: HTMLAudioElement) => audio.currentTime),
      )
      .toBeGreaterThan(0);
    await expect(
      page.getByText("How clearly you sold the direction", { exact: true }),
    ).toBeHidden();
    await page
      .getByText("Score breakdown", { exact: true })
      .click();
    await expect(
      page.getByText("How clearly you sold the direction", { exact: true }),
    ).toBeVisible();
  });
}

test("a small pack starts a fresh exclusion deck after exhaustion", async ({
  page,
}) => {
  const pool = PROMPTS.filter(
    (p) => p.rating === "everyone" && p.packIds.includes("internet-originals"),
  );
  const paths: string[] = [];
  await page.route("**/api/prompts/random?**", async (route) => {
    const url = new URL(route.request().url());
    paths.push(url.search);
    const excluded = new Set(
      (url.searchParams.get("exclude") || "").split(","),
    );
    const prompt = pool.find((p) => !excluded.has(p.id));
    if (!prompt) {
      await route.fulfill({
        status: 404,
        json: { error: { code: "NO_PROMPTS", message: "Test deck exhausted" } },
      });
      return;
    }
    await route.fulfill({
      json: {
        data: {
          prompt,
          energy: ENERGY_MODIFIERS.find(
            (e) => e.id === "v2-sincere-confession",
          ),
          source: "bundled",
        },
      },
    });
  });
  const initialDraw = page.waitForResponse(response => response.url().includes("/api/prompts/random?"));
  await page.goto("/play?pack=internet-originals");
  await initialDraw;
  await expect(page.getByTestId("prompt-line")).toHaveText(`“${pool[0]!.line}”`);
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
  const seen: string[] = [];
  for (let i = 0; i < pool.length * 2; i++) {
    const line = await page.getByTestId("prompt-line").innerText();
    expect(line).not.toBe(seen.at(-1));
    seen.push(line);
    await page.getByRole("button", { name: "Reroll", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Start recording", exact: true }),
    ).toBeEnabled();
  }
  expect(new Set(seen.slice(0, pool.length)).size).toBe(pool.length);
  expect(new Set(seen.slice(pool.length - 1, pool.length * 2 - 1)).size).toBe(
    pool.length,
  );
  // A reset excludes only the current line, then the next request grows a new
  // two-line deck instead of reusing the exhausted history forever.
  const counts = paths.map(
    (p) =>
      (new URLSearchParams(p).get("exclude") || "").split(",").filter(Boolean)
        .length,
  );
  const reset = counts.findIndex(
    (n, i) => i > 1 && n === 1 && counts[i - 1] === pool.length,
  );
  expect(reset).toBeGreaterThan(0);
  expect(counts[reset + 1]).toBe(2);
});

test("offline feedback export excludes live credibility in a fixture session", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (req) => {
    if (req.url().startsWith("http")) requests.push(req.url());
  });
  await page.goto(
    pathToFileURL(
      path.resolve("docs/playtesting/classic-step-1b/feedback.html"),
    ).href,
  );
  await page.getByLabel("Participant code").fill("P-test");
  await page.getByLabel("Date", { exact: true }).fill("2026-09-05");
  await page.getByLabel("Which judge did you see?").selectOption("live");
  await page
    .getByLabel(
      "Point to one feedback claim and the audible moment that supported or contradicted it.",
    )
    .fill("Test-only discarded value");
  await page.getByLabel("Which judge did you see?").selectOption("fixture");
  await expect(page.locator("#liveOnly")).toBeHidden();
  await page.getByLabel("Did voice-only play feel complete?").selectOption("5");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export feedback JSON" }).click();
  const download = await downloadPromise;
  const json = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(json.answers.participant).toBe("P-test");
  expect(json.answers.cameraFree).toBe("5");
  expect(json.answers.credible).toBeUndefined();
  expect(json.answers.mode).toBe("fixture");
  expect(requests).toEqual([]);
});
