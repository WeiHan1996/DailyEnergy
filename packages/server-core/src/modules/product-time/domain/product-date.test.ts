import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import {
  addProductDateDays,
  parseProductDate,
  resolveProductDate,
  weeklyProductDates,
} from "./product-date.js";
import {
  createViewContinuationGrant,
  evaluateWriteWindow,
  invalidateViewContinuationGrant,
  isGenerationCompletionEligible,
  validateViewContinuationGrant,
} from "./continuation.js";

interface Fixture {
  readonly date_resolution: readonly {
    readonly expected_product_date: string;
    readonly now_utc: string;
  }[];
  readonly weekly_windows: readonly {
    readonly expected_dates: readonly string[];
    readonly expected_window_start_date: string;
    readonly window_end_date: string;
  }[];
  readonly continuation_cases: readonly Record<string, unknown>[];
}

let fixture: Fixture;

beforeAll(async () => {
  fixture = JSON.parse(
    await readFile(
      resolve(
        import.meta.dirname,
        "../../../../../../docs/decisions/adr-0002-test-vectors.json",
      ),
      "utf8",
    ),
  ) as Fixture;
});

describe("C-005 product-date-v1", () => {
  it("recomputes every normative date vector", () => {
    for (const vector of fixture.date_resolution) {
      expect(resolveProductDate(new Date(vector.now_utc)).productDate).toBe(
        vector.expected_product_date,
      );
    }
  });

  it("uses civil calendar arithmetic for every normative weekly window", () => {
    for (const vector of fixture.weekly_windows) {
      const end = parseProductDate(vector.window_end_date);
      expect(weeklyProductDates(end)).toEqual(vector.expected_dates);
      expect(addProductDateDays(end, -6)).toBe(
        vector.expected_window_start_date,
      );
    }
  });

  it("fails closed for invalid dates and clocks", () => {
    expect(() => parseProductDate("2026-02-30")).toThrowError(
      expect.objectContaining({ code: "PRODUCT_DATE_INVALID" }),
    );
    expect(() => resolveProductDate(new Date(Number.NaN))).toThrowError(
      expect.objectContaining({ code: "PRODUCT_DATE_TIMEZONE_UNAVAILABLE" }),
    );
  });
});

describe("C-005 continuation and generation windows", () => {
  const ownerRef = "owner-ref-synthetic-0001";
  const sessionRef = "session-ref-synthetic-0001";
  const resultRef = "result-ref-synthetic-0001";

  it("matches every VIEW_CONTINUATION vector", () => {
    const grant = createViewContinuationGrant({
      grantRef: "grant-ref-synthetic-0001",
      openedAt: new Date("2026-07-20T19:59:00Z"),
      ownerRef,
      productDate: parseProductDate("2026-07-20"),
      resultRef,
      sessionRef,
      surface: "DLY-003",
    });
    const cases = fixture.continuation_cases.filter(
      (entry) => entry.kind === "VIEW_CONTINUATION",
    );
    for (const vector of cases) {
      const operation = String(vector.operation) as
        "ILLUMINATE" | "UPSERT_CHECKIN";
      expect(
        evaluateWriteWindow({
          grant,
          now: new Date(String(vector.now_utc)),
          operation,
          ownerRef,
          sessionRef,
          surface: "DLY-003",
          targetProductDate: parseProductDate(
            String(vector.target_product_date),
          ),
        }),
      ).toBe(vector.expected_window);
    }
  });

  it("matches every GENERATION_COMPLETION vector", () => {
    const cases = fixture.continuation_cases.filter(
      (entry) => entry.kind === "GENERATION_COMPLETION",
    );
    for (const vector of cases) {
      expect(
        isGenerationCompletionEligible({
          intentCreatedAt: new Date("2026-07-20T19:59:59Z"),
          now: new Date(String(vector.now_utc)),
          targetProductDate: parseProductDate(
            String(vector.target_product_date),
          ),
        }),
      ).toBe(vector.expected_eligible);
    }
  });

  it("binds owner/session/surface and closes immediately on invalidation", () => {
    const grant = createViewContinuationGrant({
      feedbackRevision: 0,
      grantRef: "grant-ref-synthetic-0002",
      openedAt: new Date("2026-07-20T19:59:00Z"),
      ownerRef,
      productDate: parseProductDate("2026-07-20"),
      resultRef,
      sessionRef,
      surface: "EVE-001",
    });
    const now = new Date("2026-07-20T20:10:00Z");
    expect(
      evaluateWriteWindow({
        grant,
        now,
        operation: "EVENING_SAVE",
        ownerRef,
        sessionRef,
        surface: "EVE-001",
        targetProductDate: parseProductDate("2026-07-20"),
      }),
    ).toBe("CONTINUATION_ONLY");
    expect(
      evaluateWriteWindow({
        grant,
        now,
        operation: "EVENING_SAVE",
        ownerRef,
        sessionRef: "session-ref-synthetic-other",
        surface: "EVE-001",
        targetProductDate: parseProductDate("2026-07-20"),
      }),
    ).toBe("CLOSED");
    const invalidated = invalidateViewContinuationGrant(grant, now);
    expect(invalidated.revision).toBe(2);
    expect(validateViewContinuationGrant(invalidated)).toEqual(invalidated);
    expect(invalidateViewContinuationGrant(invalidated, now)).toBe(invalidated);
    expect(() =>
      invalidateViewContinuationGrant(grant, new Date(Number.NaN)),
    ).toThrowError(
      expect.objectContaining({ code: "CONTINUATION_GRANT_INVALID" }),
    );
    expect(
      evaluateWriteWindow({
        grant: invalidated,
        now,
        operation: "EVENING_SAVE",
        ownerRef,
        sessionRef,
        surface: "EVE-001",
        targetProductDate: parseProductDate("2026-07-20"),
      }),
    ).toBe("CLOSED");
  });

  it("never grants continuation to a check-in or a newly opened old page", () => {
    expect(() =>
      createViewContinuationGrant({
        grantRef: "grant-ref-synthetic-0003",
        openedAt: new Date("2026-07-20T20:00:00Z"),
        ownerRef,
        productDate: parseProductDate("2026-07-20"),
        resultRef,
        sessionRef,
        surface: "DLY-003",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "CONTINUATION_BINDING_INVALID" }),
    );
  });
});
