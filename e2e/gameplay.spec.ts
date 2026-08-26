import { expect, test } from "@playwright/test";

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test("a guest can record, review, and receive a complete judgment", async ({ page }) => {
  const browserErrors: string[] = [];
  let judgeRequests = 0;
  page.on("pageerror", (error) => browserErrors.push(error.message));

  // Keep this smoke test safe against both local and deployed targets. The
  // browser still records a real PCM/WAV take, but the judge boundary is
  // fulfilled in-process so E2E never consumes AI quota or writes a delivery.
  await page.route("**/api/judge", async (route) => {
    judgeRequests += 1;
    const request = route.request();
    expect(request.method()).toBe("POST");
    expect(request.headers()["content-type"]).toContain("multipart/form-data");
    const multipart = request.postDataBuffer()?.toString("latin1") ?? "";
    expect(multipart).toContain('filename="delivery.wav"');
    expect(multipart).toMatch(/Content-Type: audio\/wav/i);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          id: "e2e-isolated-judgment",
          scores: {
            overall: 87,
            commitment: 91,
            comedy: 84,
            accuracy: 86,
            chaos: 88,
          },
          verdict: "The fake microphone brought suspiciously real commitment.",
          title: "SYNTHETIC AURA",
          moment: "The waveform never broke character.",
          transcript: "Synthetic microphone performance",
          badge: "MAIN_CHARACTER",
          xp: 35,
          source: "fallback",
        },
        delivery: { id: null, persisted: false },
      }),
    });
  });

  await page.goto("/play", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Tap to deliver", { exact: true })).toBeVisible();

  const recordButton = page.getByRole("button", { name: "Start recording" });
  const recordBounds = await recordButton.boundingBox();
  const viewport = page.viewportSize();
  expect(recordBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(recordBounds!.y + recordBounds!.height, "the first action must be above the fold").toBeLessThanOrEqual(viewport!.height);

  await recordButton.click();
  await expect(page.getByText("Recording in progress", { exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible();

  // The WAV recorder requires at least 250ms of captured PCM, and Chrome's fake
  // microphone delivers frames on the real AudioContext cadence.
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Stop recording" }).click();

  await expect(page.getByText("Recording stopped. Review your take.", { exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "Judge this take" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retake" })).toBeVisible();

  await page.getByRole("button", { name: "Judge this take" }).click();

  const resultHeading = page.getByRole("heading", { level: 1 });
  await expect(resultHeading).toHaveAttribute("aria-label", /Score \d+ out of 100/i, {
    timeout: 20_000,
  });
  await expect(page.getByText("Judgment delivered", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /One more round/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Share card/i })).toBeVisible();
  expect(judgeRequests).toBe(1);
  expect(browserErrors).toEqual([]);
});

test("the Daily mic is above the fold at a common laptop viewport", async ({ page }) => {
  await page.goto("/daily", { waitUntil: "domcontentloaded" });
  const recordButton = page.getByRole("button", { name: "Start recording" });
  await expect(recordButton).toBeVisible();

  const recordBounds = await recordButton.boundingBox();
  const viewport = page.viewportSize();
  expect(recordBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(recordBounds!.y + recordBounds!.height, "Daily should not make guests scroll before playing").toBeLessThanOrEqual(viewport!.height);
});
