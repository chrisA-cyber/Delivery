import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { PROMPTS } from "../src/data/content";

// This is an explicit local account fixture: it exercises paid screen layout
// and client requests without signing in, provisioning, billing, or publishing.
const accountFixture = {
  authenticated: true,
  user: { id: "supporting-ui-fixture", email: "fixture@example.test" },
  subscription: { tier: "pro" },
  profile: { displayName: "Local test performer", handle: "local_fixture", avatar: "LF", level: 1, xp: 0, streak: 0, followers: 0, following: 0 },
  stats: null, history: [], badges: [],
};
const screenshotDirectory = "docs/evidence/classic-rework/after/supporting";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/account", (route) => route.fulfill({ json: accountFixture }));
  await page.route("**/api/blocks", (route) => route.fulfill({ json: { ok: true, data: { blocks: [] } } }));
  await page.route("**/api/feed?*", (route) => route.fulfill({ json: { configured: false, items: [] } }));
  await page.route("**/api/leaderboard?*", (route) => route.fulfill({ json: { configured: false, rows: [] } }));
});

for (const width of [320, 390, 768, 1440]) {
  test(`${width}px supporting screens are readable without horizontal overflow`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 960 });
    const routes = ["/discover", "/discover/internet-originals", "/challenge", "/stream", "/settings", "/profile", "/pricing", "/login", "/privacy", "/feed", "/leaderboard"];
    for (const route of routes) {
      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status(), route).toBeLessThan(500);
      await expect(page.locator("main").first()).toBeVisible();
      if (route === "/challenge") await expect(page.getByRole("heading", { name: "Make it personal." })).toBeVisible();
      if (route === "/stream") await expect(page.getByRole("heading", { name: "Your stage. Your controls." })).toBeVisible();
      const overflow = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) }));
      expect(overflow.scroll, `${route} overflows at ${width}px`).toBeLessThanOrEqual(overflow.client + 1);
      if ((width === 390 || width === 1440) && ["/discover", "/challenge", "/stream", "/settings", "/profile", "/pricing", "/feed", "/leaderboard"].includes(route)) {
        await mkdir(screenshotDirectory, { recursive: true });
        // Keep the service fixture visible in the evidence itself.
        await page.evaluate(() => {
          const marker = document.createElement("div");
          marker.id = "evidence-fixture-label";
          marker.textContent = "LOCAL TEST FIXTURE · account mocked · no live service actions";
          marker.style.cssText = "position:relative;background:#f4f0e7;color:#171715;padding:10px 12px;font:11px/1.4 monospace;text-align:center;border-top:1px solid #171715";
          document.body.appendChild(marker);
        });
        await page.screenshot({ path: `${screenshotDirectory}/${route.slice(1)}-${width}.png`, fullPage: true });
      }
    }
  });
}

test("mature pack preview requires explicit opt-in and hides immediately when lowered", async ({ page }) => {
  await page.goto("/discover/internet-originals");
  const mature = PROMPTS.find((prompt) => prompt.rating === "mature" && prompt.packIds.includes("internet-originals"))!;
  await expect(page.getByText(`“${mature.line}”`, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Mature · 18+", exact: true }).click();
  await expect(page.getByText(`“${mature.line}”`, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "I’m 18+ · Enable mature" }).click();
  await expect(page.getByText(`“${mature.line}”`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clean", exact: true }).click();
  await expect(page.getByText(`“${mature.line}”`, { exact: true })).toHaveCount(0);
});

test("challenge creation sends the opted-in rating and Stream starts cleaner independently", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/challenges", async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: { ok: true, data: { inviteUrl: "http://127.0.0.1:3000/challenge/local-test-fixture" } } });
  });
  await page.goto("/challenge");
  await page.getByRole("button", { name: "Mature · 18+", exact: true }).click();
  await page.getByRole("button", { name: "I’m 18+ · Enable mature" }).click();
  const mature = PROMPTS.find((prompt) => prompt.rating === "mature")!;
  await page.getByRole("button").filter({ hasText: mature.line }).click();
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Link copied");
  expect(submitted).toMatchObject({ maxRating: "mature", promptId: mature.id });
  expect(submitted?.energyId).toEqual(expect.any(String));
  await page.goto("/stream");
  await expect(page.getByRole("button", { name: "Clean", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Open the stage" })).toHaveAttribute("href", /maxRating=everyone/);
  await page.getByRole("button", { name: "Spicy", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open the stage" })).toHaveAttribute("href", /maxRating=teen/);
});

test("a result's challenge link keeps its exact pairing and gates a mature selected line", async ({ page }) => {
  const mature = PROMPTS.find((prompt) => prompt.rating === "mature")!;
  await page.goto(`/challenge?prompt=${mature.id}&energy=v2-sincere-confession`);
  await expect(page.getByRole("status")).toContainText("above your current content setting");
  await expect(page.getByText(`“${mature.line}”`, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy link", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Mature · 18+", exact: true }).click();
  await page.getByRole("button", { name: "I’m 18+ · Enable mature" }).click();
  await expect(page.getByRole("button").filter({ hasText: mature.line })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("combobox", { name: "Delivery direction" })).toHaveValue("v2-sincere-confession");
  await expect(page.getByRole("button", { name: "Copy link", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Clean", exact: true }).click();
  await expect(page.getByText(`“${mature.line}”`, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy link", exact: true })).toBeDisabled();
});

test("unconfigured community screens contain no invented players or scores", async ({ page }) => {
  await page.goto("/feed");
  await expect(page.getByRole("heading", { name: "The feed is unavailable." })).toBeVisible();
  await expect(page.getByText("Maya Mayhem")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hear the take" })).toHaveCount(0);
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "Rankings are unavailable." })).toBeVisible();
  await expect(page.getByText("Maya Mayhem")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Hear it" })).toHaveCount(0);
});

test("profile actions recover from request failure and immediately hide blocked content", async ({ page }) => {
  await page.route("**/api/profiles/local_peer", (route) => route.fulfill({ json: {
    profile: { id: "public-profile-fixture", handle: "local_peer", display_name: "Local public fixture", created_at: "2026-09-05T00:00:00Z" },
    stats: null, badges: [], viewer: { signedIn: true, isSelf: false, following: false, blocked: false },
    deliveries: [{ id: "public-take-fixture", prompt_body: "This is a local profile test fixture.", published_at: "2026-09-05T00:00:00Z", overall: 70, headline: "Fixture", verdict: "Synthetic fixture verdict", reaction_count: 0 }],
  } }));
  await page.route("**/api/profiles/local_peer/follow", (route) => route.fulfill({ status: 503, json: { error: "Temporary fixture failure. Try again." } }));
  await page.goto("/u/local_peer");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Temporary fixture failure");
  await expect(page.getByRole("button", { name: "Follow", exact: true })).toBeEnabled();
  await expect(page.getByText("“This is a local profile test fixture.”", { exact: true })).toBeVisible();
  await page.route("**/api/blocks", (route) => route.fulfill({ json: { ok: true, data: { blocked: true } } }));
  await page.getByRole("button", { name: "Block", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Their content is hidden");
  await expect(page.getByText("“This is a local profile test fixture.”", { exact: true })).toHaveCount(0);
});
