import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
const fixture = {
  result: {
    id: "classic-reviewed-fixture",
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
      "Keep the confidence steady. Pause before the final admission, then let one word wobble.",
    transcript: "Local synthetic microphone fixture.",
    source: "fallback",
    rubricVersion: "delivery-voice-v1.1",
    scoringVersion: "delivery-voice-v1",
    transcription: {
      text: "Local synthetic microphone fixture.",
      provider: "elevenlabs",
      model: "scribe_v2",
      usedForAccuracy: false,
      words: [
        { text: "Local", start: 0, end: 0.2 },
        { text: "synthetic", start: 0.2, end: 0.4 },
        { text: "microphone", start: 0.4, end: 0.7 },
        { text: "fixture.", start: 0.7, end: 1 },
      ],
    },
  },
  delivery: { persisted: false, id: null, visibility: "private" },
};
const fixedPath = "/play?prompt=v2-favorite-child&energy=v2-confidence-tears";

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
async function record(page: Page) {
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(850);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await expect(page.locator("audio")).toBeVisible();
}
async function localJudge(page: Page, delay = 0) {
  await page.route("**/api/judge", async (route) => {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixture),
    });
  });
}

test("submission failure preserves playback and retries the same private take exactly once", async ({
  page,
}) => {
  const requests: { key: string | undefined; body: string }[] = [];
  await page.route("**/api/judge", async (route) => {
    requests.push({
      key: route.request().headers()["idempotency-key"],
      body: route.request().postDataBuffer()?.toString("latin1") ?? "",
    });
    await new Promise((r) => setTimeout(r, 300));
    await route.fulfill({
      status: requests.length === 1 ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        requests.length === 1
          ? { error: { message: "Judge temporarily unavailable." } }
          : fixture,
      ),
    });
  });
  await page.goto(fixedPath);
  await record(page);
  const original = await page.locator("audio").getAttribute("src");
  await page
    .getByRole("button", { name: "Judge this take", exact: true })
    .dblclick({ delay: 20 })
    .catch(() => undefined);
  await expect(
    page.getByRole("alert").filter({ hasText: "Your take is safe" }),
  ).toContainText("Your take is safe");
  expect(requests).toHaveLength(1);
  await expect(page.locator("audio")).toHaveAttribute("src", original!);
  await page
    .getByRole("button", { name: "Retry judgment", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAttribute(
    "aria-label",
    /Score 82/,
  );
  expect(requests).toHaveLength(2);
  expect(requests[0]!.key).toBe(requests[1]!.key);
  expect(requests[0]!.body).toContain('name="isPublic"\r\n\r\nfalse');
  expect(requests[0]!.body).toContain('name="maxRating"\r\n\r\neveryone');
  expect(requests[0]!.body).toContain('filename="delivery.wav"');
  await expect(page.locator("audio")).toHaveAttribute("src", original!);
  await page
    .getByRole("button", { name: "Replay synthetic", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((node: HTMLAudioElement) => node.currentTime),
    )
    .toBeGreaterThanOrEqual(0.2);
  await expect(
    page.getByRole("link", { name: "Challenge a friend", exact: true }),
  ).toHaveAttribute(
    "href",
    /prompt=v2-favorite-child&energy=v2-confidence-tears/,
  );
  await page
    .getByRole("button", { name: "Another take", exact: true })
    .click();
  await expect(page.getByTestId("prompt-line")).toContainText(
    "my own emergency contact",
  );
  await expect(page.getByTestId("prompt-direction")).toContainText(
    "holding back tears",
  );
  await expect(page.getByText("Take 02", { exact: true })).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
});

test("private rehearsal never uploads until the player explicitly submits", async ({
  page,
}) => {
  let count = 0;
  await page.route("**/api/judge", (route) => {
    count++;
    return route.fulfill({ json: fixture });
  });
  await page.goto(fixedPath);
  await page
    .getByRole("button", { name: "Private rehearsal", exact: true })
    .click();
  await record(page);
  await expect(
    page.getByRole("button", { name: "Judge this take", exact: true }),
  ).toHaveCount(0);
  expect(count).toBe(0);
  await page
    .getByRole("button", { name: "Ready for judgment", exact: true })
    .click();
  expect(count).toBe(0);
  await page
    .getByRole("button", { name: "Judge this take", exact: true })
    .click();
  await expect(
    page.getByText("Your result", { exact: true }),
  ).toBeVisible();
  expect(count).toBe(1);
});

test("mature direct links remain concealed until explicit adult opt-in and filter persists", async ({
  page,
}) => {
  await page.goto("/play?prompt=v3-banned-list&energy=v2-confidence-tears");
  await expect(
    page.getByRole("heading", { name: "This line is behind your filter." }),
  ).toBeVisible();
  await expect(page.getByTestId("prompt-line")).toHaveCount(0);
  await page.getByRole("button", { name: "Mature · 18+", exact: true }).click();
  await expect(page.getByTestId("prompt-line")).toHaveCount(0);
  await page.getByRole("button", { name: /I’m 18\+ · Enable mature/ }).click();
  await expect(page.getByTestId("prompt-line")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("prompt-line")).toBeVisible();
  await page.getByRole("button", { name: "Clean", exact: true }).click();
  await expect(page.getByTestId("prompt-line")).toHaveCount(0);
  await page.goto("/play");
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Clean", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("next-round failures preserve result and successful draws exclude recent lines and directions", async ({
  page,
}) => {
  await localJudge(page);
  await page.goto(fixedPath);
  await record(page);
  await page
    .getByRole("button", { name: "Judge this take", exact: true })
    .click();
  await expect(
    page.getByText("Your result", { exact: true }),
  ).toBeVisible();
  let draws = 0;
  await page.route("**/api/prompts/random?**", async (route) => {
    draws++;
    const url = new URL(route.request().url());
    expect(url.searchParams.get("exclude")).toContain("v2-favorite-child");
    expect(url.searchParams.get("excludeEnergy")).toContain(
      "v2-confidence-tears",
    );
    if (draws === 1)
      await route.fulfill({
        status: 503,
        json: {
          error: { message: "Catalog offline. Your result stays here." },
        },
      });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "New line", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Catalog offline" }),
  ).toContainText("Catalog offline");
  await expect(page.locator("audio")).toBeVisible();
  await page
    .getByRole("button", { name: "New line", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
  await expect(page.getByTestId("prompt-line")).not.toContainText(
    "my own emergency contact",
  );
  await expect(page.getByTestId("prompt-direction")).not.toContainText(
    "holding back tears",
  );
});

for (const width of [320, 390, 768, 1440])
  test(`Classic complete flow and evidence at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await localJudge(page, 2200);
    const dir = path.resolve(process.env.DELIVERY_EVIDENCE_DIR || "docs/evidence/classic-rework/after");
    mkdirSync(dir, { recursive: true });
    const capture = async (name: string) => {
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByLabel("Checking account")).toHaveCount(0);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              Math.max(
                document.documentElement.scrollWidth,
                document.body.scrollWidth,
              ) - document.documentElement.clientWidth,
          ),
        )
        .toBeLessThanOrEqual(1);
      await page.screenshot({
        path: path.join(dir, `${name}-${width}.png`),
        fullPage: true,
      });
    };
    await page.goto("/");
    await capture("home");
    await page.goto(fixedPath);
    await expect(
      page.getByRole("button", { name: "Start recording", exact: true }),
    ).toBeEnabled();
    await capture("prepare");
    await page
      .getByRole("button", { name: "Start recording", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Stop recording", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".recording-status")).toContainText("0:02");
    await capture("recording");
    await page
      .getByRole("button", { name: "Stop recording", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Judge this take", exact: true }),
    ).toBeEnabled();
    await capture("review");
    await page
      .getByRole("button", { name: "Judge this take", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /The jury is in session/i }),
    ).toBeVisible();
    await capture("judging");
    await expect(
      page.getByText("Your result", { exact: true }),
    ).toBeVisible();
    await capture("result");
    await page.getByText("Card, audio & public sharing", { exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save card", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("delivery-score-82.png");
    await file.saveAs(path.join(dir, `share-card-${width}.png`));
    expect(await file.failure()).toBeNull();
    const history = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("delivery.game.state.v2.guest") ?? "{}")
          .history,
    );
    expect(history[0].audioUrl).toBeUndefined();
    expect(history[0].prompt.energyId).toBe("v2-confidence-tears");
  });

for (const failure of [
  { name: "NotAllowedError", copy: /Microphone access is blocked/i },
  { name: "NotFoundError", copy: /No microphone/i },
])
  test(`microphone ${failure.name} is recoverable without a page reload`, async ({
    page,
  }) => {
    await page.addInitScript(({ name }) => {
      const original = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      let first = true;
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (first) {
          first = false;
          throw new DOMException("Controlled browser failure fixture", name);
        }
        return original(constraints);
      };
    }, failure);
    await page.goto(fixedPath);
    await page
      .getByRole("button", { name: "Start recording", exact: true })
      .click();
    await expect(
      page.getByText("Let’s get your mic back.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".game-error")).toContainText(failure.copy);
    await record(page);
    await expect(
      page.getByRole("button", { name: "Judge this take", exact: true }),
    ).toBeEnabled();
  });

test("keyboard menu escape and reduced motion remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Menu", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("navigation", { name: "Menu", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open menu", exact: true }),
  ).toBeFocused();
  const sizes = await page
    .locator("header button, header a, nav[aria-label='Mobile navigation'] a")
    .evaluateAll((nodes) =>
      nodes
        .filter((n) => (n as HTMLElement).offsetParent !== null)
        .map((n) => ({
          label: n.getAttribute("aria-label") ?? n.textContent,
          height: n.getBoundingClientRect().height,
        })),
    );
  expect(
    sizes.every((size) => size.height >= 44),
    JSON.stringify(sizes),
  ).toBeTruthy();
});

test("a small Clean pack cycles indefinitely without immediate repeats", async ({
  page,
}) => {
  const initialDraw = page.waitForResponse((response) =>
    response.url().includes("/api/prompts/random?"),
  );
  await page.goto("/play?pack=internet-originals");
  await initialDraw;
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
  const seen: string[] = [];
  for (let round = 0; round < 8; round++) {
    const line = await page.getByTestId("prompt-line").innerText();
    expect(line).not.toBe(seen.at(-1));
    seen.push(line);
    await expect(
      page.getByRole("button", { name: "Clean", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Reroll", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Start recording", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".game-error")).toHaveCount(0);
  }
  expect(new Set(seen.slice(0, 4)).size, JSON.stringify(seen)).toBe(4);
});

test("retired Classic links stop before recording and preserved Daily results share the Daily", async ({
  page,
}) => {
  const { PROMPTS: legacyPrompts, ENERGY_MODIFIERS: legacyDirections } =
    await import("../src/data/legacy-content");
  const prompt = legacyPrompts.find((item) => item.rating === "everyone")!;
  const energy = legacyDirections[0]!;
  await page.goto(`/play?prompt=${prompt.id}&energy=${energy.id}`);
  await expect(
    page.getByRole("heading", {
      name: "This line has left the new-round deck.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toHaveCount(0);
  await page.route("**/api/prompts/daily?**", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          dateKey: new Date().toISOString().slice(0, 10),
          market: "global",
          prompt,
          energy,
        },
      },
    }),
  );
  await localJudge(page);
  await page.goto("/daily");
  await record(page);
  await page
    .getByRole("button", { name: "Judge this take", exact: true })
    .click();
  await expect(
    page.getByText("Your result", { exact: true }),
  ).toBeVisible();
  await page.getByText("Card, audio & public sharing", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copy Daily link", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Challenge a friend", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/It has retired from new Classic draws/),
  ).toBeVisible();
});

test("silence stays local and cannot be submitted", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext();
      await context.resume();
      const silence = context.createConstantSource();
      silence.offset.value = 0;
      const output = context.createMediaStreamDestination();
      silence.connect(output);
      silence.start();
      return output.stream;
    };
  });
  let submissions = 0;
  await page.route("**/api/judge", (route) => {
    submissions++;
    return route.fulfill({ json: fixture });
  });
  await page.goto(fixedPath);
  await record(page);
  await expect(
    page.getByRole("button", { name: "Judge this take", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".game-note")).toContainText(
    /too little sound to judge/i,
  );
  expect(submissions).toBe(0);
  await expect(
    page.getByRole("button", { name: "Save audio", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Another take", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
});

test("a microphone interruption preserves the captured take for review", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints?.video)
        throw new Error("Classic requested camera access");
      const stream = await original(constraints);
      (window as unknown as { endFixtureTrack: () => void }).endFixtureTrack =
        () => stream.getAudioTracks()[0]?.dispatchEvent(new Event("ended"));
      return stream;
    };
  });
  await page.goto(fixedPath);
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(850);
  await page.evaluate(() =>
    (window as unknown as { endFixtureTrack: () => void }).endFixtureTrack(),
  );
  await expect(
    page.getByRole("button", { name: "Judge this take", exact: true }),
  ).toBeEnabled();
  await expect(page.locator("audio")).toBeVisible();
  await expect(page.locator(".game-note")).toContainText("interrupted");
});
