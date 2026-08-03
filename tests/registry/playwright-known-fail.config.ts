import { resolve } from "node:path";

import { defineConfig } from "@playwright/test";

const stickyReporter = resolve(
  import.meta.dirname,
  "../../tooling/testing/sticky-playwright-reporter.mjs",
);

export default defineConfig({
  forbidOnly: true,
  outputDir: resolve(
    import.meta.dirname,
    "../artifacts/output/playwright-known-fail",
  ),
  reporter: [[stickyReporter]],
  retries: 1,
  testDir: resolve(import.meta.dirname, "fixtures"),
  testMatch: "playwright-flaky.spec.ts",
  workers: 1,
});
