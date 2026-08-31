import { describe, expect, it, vi } from "vitest";

import type { C015Api } from "../../services/miniapp-api.js";
import { BestEffortClientSignalSender } from "./client-signal.js";

const signal = {
  app_version: "1.4.2",
  event_name: "main_action_reached",
  event_schema_version: 1,
  locale: "zh-CN",
} as const;

describe("C-015 miniapp best-effort analytics", () => {
  it("suppresses a duplicate only within one page lifecycle", async () => {
    const submitAnalyticsSignal = vi.fn(
      async (_input: Parameters<C015Api["submitAnalyticsSignal"]>[0]) =>
        undefined,
    );
    const sender = new BestEffortClientSignalSender(
      { submitAnalyticsSignal } satisfies C015Api,
      "0.1.0",
    );
    await expect(sender.sendOncePerPage("today-1", signal)).resolves.toBe(true);
    await expect(sender.sendOncePerPage("today-1", signal)).resolves.toBe(true);
    await expect(sender.sendOncePerPage("today-2", signal)).resolves.toBe(true);
    expect(submitAnalyticsSignal).toHaveBeenCalledTimes(2);
  });

  it("drops an offline failure without storage, retry, identity or a timestamp", async () => {
    const submitAnalyticsSignal = vi.fn(
      async (_input: Parameters<C015Api["submitAnalyticsSignal"]>[0]) => {
        throw new Error("offline");
      },
    );
    const sender = new BestEffortClientSignalSender(
      { submitAnalyticsSignal } satisfies C015Api,
      "0.1.0",
    );
    await expect(sender.sendOncePerPage("today-1", signal)).resolves.toBe(
      false,
    );
    await expect(sender.sendOncePerPage("today-1", signal)).resolves.toBe(true);
    expect(submitAnalyticsSignal).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(signal)).not.toMatch(
      /account|owner|device|session|product_date|timestamp/iu,
    );
  });

  it("builds registered page signals from the public app version", async () => {
    const submitAnalyticsSignal = vi.fn(
      async (_input: Parameters<C015Api["submitAnalyticsSignal"]>[0]) =>
        undefined,
    );
    const sender = new BestEffortClientSignalSender(
      { submitAnalyticsSignal } satisfies C015Api,
      "0.1.0",
    );
    const landing = sender.beginPage("ENT-001");
    const today = sender.beginPage("DLY-003");
    await sender.landingViewed(landing);
    await sender.landingPrimaryActionClicked(landing);
    await sender.mainActionReached(today);
    await sender.dimensionsExpanded(today);
    expect(submitAnalyticsSignal.mock.calls.map(([value]) => value)).toEqual([
      {
        app_version: "0.1.0",
        event_name: "landing_viewed",
        event_schema_version: 1,
        locale: "zh-CN",
        scene_code: "DIRECT",
        surface_version_bucket: "LANDING_V1",
      },
      {
        app_version: "0.1.0",
        event_name: "landing_primary_action_clicked",
        event_schema_version: 1,
        locale: "zh-CN",
        scene_code: "DIRECT",
        surface_version_bucket: "LANDING_V1",
      },
      {
        app_version: "0.1.0",
        event_name: "main_action_reached",
        event_schema_version: 1,
        locale: "zh-CN",
      },
      {
        app_version: "0.1.0",
        event_name: "dimensions_expanded",
        event_schema_version: 1,
        locale: "zh-CN",
      },
    ]);
  });
});
