import type { Page, Request, Route } from "@playwright/test";

import {
  scanAdminBrowserExposure,
  type AdminBrowserExposureDiagnostic,
} from "../../../../tooling/lib/admin-bundle-check.mjs";

export interface BrowserExposureCanaries {
  readonly secretValues: readonly string[];
  readonly userBodyCanaries: readonly string[];
}

export interface CapturedBrowserResponse {
  readonly channel: "html" | "network" | "rsc";
  readonly content: string;
  readonly path: string;
}

function parseCanaryList(name: string): readonly string[] {
  const serialized = process.env[name];
  if (serialized === undefined) {
    throw new Error(`ADMIN_BROWSER_EXPOSURE_CANARIES_MISSING: ${name}`);
  }

  const parsed: unknown = JSON.parse(serialized);
  if (
    !Array.isArray(parsed) ||
    parsed.some((value) => typeof value !== "string" || value.length < 12)
  ) {
    throw new Error(`ADMIN_BROWSER_EXPOSURE_CANARIES_INVALID: ${name}`);
  }
  return parsed;
}

function channelFor(
  url: URL,
  contentType: string,
): CapturedBrowserResponse["channel"] {
  if (
    contentType.includes("text/x-component") ||
    url.searchParams.has("_rsc")
  ) {
    return "rsc";
  }
  return contentType.includes("text/html") ? "html" : "network";
}

export function readBrowserExposureCanaries(): BrowserExposureCanaries {
  return {
    secretValues: parseCanaryList("ADMIN_TEST_SECRET_CANARIES"),
    userBodyCanaries: parseCanaryList("ADMIN_TEST_USER_BODY_CANARIES"),
  };
}

export async function captureBrowserResponses(
  page: Page,
  expectedOrigin: string,
  action: () => Promise<unknown>,
): Promise<readonly CapturedBrowserResponse[]> {
  const responses: CapturedBrowserResponse[] = [];
  let sequence = 0;
  const routePattern = `${expectedOrigin}/**`;

  const capture = async (route: Route, request: Request) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const content = await response.body();
    const url = new URL(request.url());
    const currentSequence = sequence;
    sequence += 1;
    responses.push({
      channel: channelFor(url, response.headers()["content-type"] ?? ""),
      content: content.toString("utf8"),
      path: `browser-response/${currentSequence}-${request.resourceType()}${url.pathname}${url.search}`,
    });
    await route.fulfill({ body: content, response });
  };

  await page.route(routePattern, capture);
  try {
    await action();
    await page.waitForLoadState("networkidle");
  } finally {
    await page.unroute(routePattern, capture);
  }

  return responses.sort((left, right) => left.path.localeCompare(right.path));
}

export function scanCapturedBrowserResponses(
  responses: readonly CapturedBrowserResponse[],
  canaries: BrowserExposureCanaries,
): AdminBrowserExposureDiagnostic[] {
  return scanAdminBrowserExposure({
    files: responses,
    secretValues: canaries.secretValues,
    userBodyCanaries: canaries.userBodyCanaries,
  });
}
