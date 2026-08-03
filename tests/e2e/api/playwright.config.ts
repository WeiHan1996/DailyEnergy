import { resolve } from "node:path";

import { defineConfig } from "@playwright/test";

const stickyReporter = resolve(
  import.meta.dirname,
  "../../../tooling/testing/sticky-playwright-reporter.mjs",
);

export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  globalSetup: resolve(import.meta.dirname, "global-setup.mjs"),
  outputDir: resolve(
    import.meta.dirname,
    "../../artifacts/output/api-playwright",
  ),
  projects: [{ name: "api-http" }],
  reporter: [["list"], [stickyReporter]],
  retries: 1,
  testDir: import.meta.dirname,
  testMatch: "api-http.spec.ts",
  timeout: 30_000,
  workers: 1,
});
