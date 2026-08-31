import { describe, expect, it } from "vitest";

import { resolveProductDate } from "./product-date.js";

describe("product-date-v1", () => {
  it.each([
    ["2026-07-19T19:59:59.999Z", "2026-07-19"],
    ["2026-07-19T20:00:00.000Z", "2026-07-20"],
    ["2026-12-31T19:59:59.999Z", "2026-12-31"],
    ["2026-12-31T20:00:00.000Z", "2027-01-01"],
    ["2028-02-29T19:59:59.999Z", "2028-02-29"],
    ["2028-02-29T20:00:00.000Z", "2028-03-01"],
  ])("resolves %s to the server product date %s", (timestamp, expected) => {
    expect(resolveProductDate(new Date(timestamp)).productDate).toBe(expected);
  });

  it("fails closed for an invalid clock", () => {
    expect(() => resolveProductDate(new Date(Number.NaN))).toThrow(
      "PRODUCT_DATE_CLOCK_INVALID",
    );
  });
});
