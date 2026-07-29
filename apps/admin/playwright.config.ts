import { defineConfig, devices } from "@playwright/test";

const adminBaseUrl = "http://127.0.0.1:3210";

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: "test-results",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  reporter: [["list"]],
  retries: 0,
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: adminBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec next start --hostname 127.0.0.1 --port 3210",
    env: {
      ADMIN_API_ORIGIN: "http://127.0.0.1:4310",
      ADMIN_IDENTITY_CLIENT_SECRET_FILE:
        process.env.ADMIN_IDENTITY_CLIENT_SECRET_FILE ?? "",
      ADMIN_RUNTIME_PROFILE: "test",
      ADMIN_SESSION_SECRET_FILE: process.env.ADMIN_SESSION_SECRET_FILE ?? "",
      ADMIN_SHELL_PREVIEW: "true",
      PLAYWRIGHT_TEST: "1",
    },
    gracefulShutdown: {
      signal: "SIGTERM",
      timeout: 1_000,
    },
    reuseExistingServer: false,
    stderr: "pipe",
    stdout: "ignore",
    timeout: 120_000,
    url: `${adminBaseUrl}/login`,
  },
  workers: 1,
});
