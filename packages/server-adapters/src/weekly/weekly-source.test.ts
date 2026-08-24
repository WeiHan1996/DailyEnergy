import { describe, expect, it } from "vitest";

import {
  weeklySourceSnapshotFromRows,
  type WeeklySourceRow,
} from "./weekly-source.js";

const dates = [
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-08-22",
  "2026-08-23",
  "2026-08-24",
];

function rows(lightRevision: number): WeeklySourceRow[] {
  return dates.map((productDate, index) => ({
    actionKind: null,
    checkinRef: null,
    checkinRevision: null,
    energy: null,
    feedbackRef: null,
    feedbackRevision: null,
    helpfulnessRating: null,
    helpfulnessRef: null,
    helpfulnessRevision: null,
    lightRef: index === 6 ? "11111111-1111-4111-8111-111111111111" : null,
    lightRevision: index === 6 ? lightRevision : null,
    mood: null,
    overallFeeling: null,
    productDate,
    sleep: null,
    taskRef: null,
    taskRevision: null,
    taskStatus: null,
  }));
}

describe("C-013 weekly source fingerprint", () => {
  it("binds server-only light validity without leaking its revision", () => {
    const input = {
      accountId: "22222222-2222-4222-8222-222222222222",
      endProductDate: "2026-08-24",
      windowId: "33333333-3333-4333-8333-333333333333",
    };
    const first = weeklySourceSnapshotFromRows(rows(1), input);
    const invalidated = weeklySourceSnapshotFromRows(rows(2), input);
    expect(first.source_fingerprint).not.toBe(invalidated.source_fingerprint);
    expect(first.days[6]).toMatchObject({
      light: {
        is_lit: true,
        source_ref: "11111111-1111-4111-8111-111111111111",
      },
      source_state: "MISSING",
    });
    expect(JSON.stringify(first)).not.toContain("source_validity_revision");
  });
});
