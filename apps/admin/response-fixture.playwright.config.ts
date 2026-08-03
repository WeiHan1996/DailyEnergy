import { defineConfig, devices } from "@playwright/test";

const fixtureBaseUrl = "http://127.0.0.1:3211";
const stickyReporter = "../../tooling/testing/sticky-playwright-reporter.mjs";

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: "test-results/response-fixture",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  reporter: [["list"], [stickyReporter]],
  retries: 1,
  testDir: "./tests/response-fixture",
  timeout: 30_000,
  use: {
    baseURL: fixtureBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "pnpm exec next start tests/fixtures/response-leak --hostname 127.0.0.1 --port 3211",
    env: {
      ADMIN_RESPONSE_SECRET_CANARY:
        process.env.ADMIN_RESPONSE_SECRET_CANARY ?? "",
      ADMIN_RESPONSE_USER_BODY_CANARY:
        process.env.ADMIN_RESPONSE_USER_BODY_CANARY ?? "",
    },
    gracefulShutdown: {
      signal: "SIGTERM",
      timeout: 1_000,
    },
    reuseExistingServer: false,
    stderr: "pipe",
    stdout: "ignore",
    timeout: 120_000,
    url: fixtureBaseUrl,
  },
  workers: 1,
});
