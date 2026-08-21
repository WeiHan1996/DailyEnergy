import { describe, expect, it } from "vitest";

import { c003RouteUrl } from "./c003-navigation.js";

describe("C-003 route boundary", () => {
  it("maps each authoritative route to one registered page", () => {
    expect(c003RouteUrl({ kind: "landing" })).toBe("/pages/landing/index");
    expect(c003RouteUrl({ kind: "onboarding" })).toBe(
      "/pages/onboarding/index",
    );
    expect(c003RouteUrl({ kind: "checkin" })).toBe(
      "/pages/checkin-handoff/index",
    );
    expect(c003RouteUrl({ kind: "safety" })).toBe("/pages/safety/index");
    expect(
      c003RouteUrl({ kind: "recovery", reasonCode: "ACCOUNT_DELETING" }),
    ).toBe("/pages/recovery/index?reason=ACCOUNT_DELETING");
  });
});
