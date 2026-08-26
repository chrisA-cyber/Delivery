import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseUrl || "http://127.0.0.1:3000";
const serverMode = process.env.PLAYWRIGHT_SERVER_MODE === "production" ? "production" : "development";
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (serverMode === "production" ? "https://delivery.test" : baseURL);
const serverCommand =
  process.env.PLAYWRIGHT_SERVER_COMMAND?.trim() ||
  (serverMode === "production"
    ? "node node_modules/next/dist/bin/next start --hostname 127.0.0.1"
    : "node node_modules/next/dist/bin/next dev --turbopack --hostname 127.0.0.1");

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/playwright",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],
  expect: { timeout: 10_000 },
  timeout: 45_000,
  use: {
    baseURL,
    colorScheme: "dark",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: serverCommand,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: serverMode === "production" ? 240_000 : 120_000,
        env: {
          DELIVERY_AI_MODE: process.env.DELIVERY_AI_MODE || "mock",
          DELIVERY_AI_ALLOW_MOCK_FALLBACK:
            process.env.DELIVERY_AI_ALLOW_MOCK_FALLBACK || "true",
          NEXT_PUBLIC_APP_URL: appUrl,
        },
      },
});
