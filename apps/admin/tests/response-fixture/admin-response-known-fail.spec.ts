import { expect, test } from "@playwright/test";

import {
  captureBrowserResponses,
  readBrowserExposureCanaries,
  scanCapturedBrowserResponses,
} from "../e2e/browser-response-audit";

const fixtureOrigin = "http://127.0.0.1:3211";

test.describe("E-005 real Next browser-response known-fail fixture", () => {
  test("rejects synthetic secret and user body in initial HTML", async ({
    page,
  }) => {
    const responses = await captureBrowserResponses(
      page,
      fixtureOrigin,
      async () => {
        await page.goto("/leak");
      },
    );
    const htmlResponses = responses.filter(({ channel }) => channel === "html");
    const ruleIds = scanCapturedBrowserResponses(
      htmlResponses,
      readBrowserExposureCanaries(),
    ).map(({ ruleId }) => ruleId);

    expect(htmlResponses.length).toBeGreaterThan(0);
    expect(ruleIds).toContain("ADMIN_BUNDLE_SECRET_VALUE");
    expect(ruleIds).toContain("ADMIN_BUNDLE_USER_BODY_FIXTURE");
  });

  test("rejects synthetic secret and user body in an RSC navigation response", async ({
    page,
  }) => {
    await page.goto("/");
    const responses = await captureBrowserResponses(
      page,
      fixtureOrigin,
      async () => {
        await page.getByRole("link", { name: "Open synthetic leak" }).click();
        await page.waitForURL("**/leak");
      },
    );
    const rscResponses = responses.filter(({ channel }) => channel === "rsc");
    const ruleIds = scanCapturedBrowserResponses(
      rscResponses,
      readBrowserExposureCanaries(),
    ).map(({ ruleId }) => ruleId);

    expect(rscResponses.length).toBeGreaterThan(0);
    expect(ruleIds).toContain("ADMIN_BUNDLE_SECRET_VALUE");
    expect(ruleIds).toContain("ADMIN_BUNDLE_USER_BODY_FIXTURE");
  });
});
