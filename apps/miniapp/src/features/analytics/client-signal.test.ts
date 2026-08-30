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
    const submitAnalyticsSignal = vi.fn(async () => undefined);
    const sender = new BestEffortClientSignalSender({
      submitAnalyticsSignal,
    } satisfies C015Api);
    await expect(sender.sendOncePerPage("today-1", signal)).resolves.toBe(true);
    await expect(sender.sendOncePerPage("today-1", signal)).resolves.toBe(true);
    await expect(sender.sendOncePerPage("today-2", signal)).resolves.toBe(true);
    expect(submitAnalyticsSignal).toHaveBeenCalledTimes(2);
  });

  it("drops an offline failure without storage, retry, identity or a timestamp", async () => {
    const submitAnalyticsSignal = vi.fn(async () => {
      throw new Error("offline");
    });
    const sender = new BestEffortClientSignalSender({
      submitAnalyticsSignal,
    } satisfies C015Api);
    await expect(sender.sendOncePerPage("today-1", signal)).resolves.toBe(
      false,
    );
    await expect(sender.sendOncePerPage("today-1", signal)).resolves.toBe(true);
    expect(submitAnalyticsSignal).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(signal)).not.toMatch(
      /account|owner|device|session|product_date|timestamp/iu,
    );
  });
});
