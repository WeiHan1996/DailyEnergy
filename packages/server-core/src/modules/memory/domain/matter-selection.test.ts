import { describe, expect, it } from "vitest";

import {
  recheckDailyMatterV1,
  selectDailyMatterV1,
  type DailyMatterSelectionRequestV1,
  type DailyMatterSourceV1,
} from "./matter-selection.js";

const ownerRef = "account-1";
const access = {
  accountActive: true,
  accountRevision: 1,
  consentActive: true,
  safetyClear: true,
  safetyEpoch: "0",
  deletionClear: true,
  deletionEpoch: "0",
  masterEnabled: true,
  masterRevision: 1,
  dailyExpressionEnabled: true,
};

function matter(
  sourceRef: string,
  overrides: Partial<DailyMatterSourceV1> = {},
): DailyMatterSourceV1 {
  return {
    ownerRef,
    sourceRef,
    revision: 1,
    state: "ACTIVE",
    createdProductDate: "2026-09-10",
    updatedAt: new Date("2026-09-10T12:00:00Z"),
    memorySafetyProof: {
      sourceRevision: 1,
      policyVersion: "safety-v1",
      ruleVersion: "rules-v1",
      classifierVersion: "classifier-v1",
      fingerprintHex: "ab".repeat(32),
    },
    grant: {
      ownerRef,
      sourceRef,
      grantRef: `grant-${sourceRef}`,
      revision: 1,
      purpose: "DAILY_EXPRESSION",
      state: "ACTIVE",
      policyVersion: "memory-policy-v1",
    },
    ...overrides,
  };
}

function request(
  sources: readonly DailyMatterSourceV1[],
  overrides: Partial<DailyMatterSelectionRequestV1> = {},
): DailyMatterSelectionRequestV1 {
  return {
    ownerRef,
    productDate: "2026-09-12",
    access,
    sources,
    mentions: [],
    ...overrides,
  };
}

describe("memory-policy-v1 Daily matter preselection", () => {
  it("keeps absence, disabled use and another owner's source out of selection", () => {
    expect(selectDailyMatterV1(request([])).status).toBe("NO_ELIGIBLE_MEMORY");
    expect(
      selectDailyMatterV1(
        request([matter("matter-1")], {
          access: { ...access, masterEnabled: false },
        }),
      ).status,
    ).toBe("NO_ELIGIBLE_MEMORY");
    expect(
      selectDailyMatterV1(request([matter("matter-1", { ownerRef: "other" })]))
        .status,
    ).toBe("NO_ELIGIBLE_MEMORY");
  });

  it("requires exact Daily grant and all live account guards", () => {
    const source = matter("matter-1");
    expect(
      selectDailyMatterV1(
        request([
          {
            ...source,
            grant: { ...source.grant!, purpose: "WEEKLY_SUMMARY" },
          },
        ]),
      ).status,
    ).toBe("NO_ELIGIBLE_MEMORY");
    expect(
      selectDailyMatterV1(
        request([{ ...source, memorySafetyProof: undefined }]),
      ).status,
    ).toBe("NO_ELIGIBLE_MEMORY");
    expect(
      selectDailyMatterV1(request([{ ...source, grant: undefined }])).status,
    ).toBe("NO_ELIGIBLE_MEMORY");
    for (const state of [
      "PAUSED",
      "COMPLETED",
      "EXPIRED",
      "DELETED",
    ] as const) {
      expect(selectDailyMatterV1(request([{ ...source, state }])).status).toBe(
        "NO_ELIGIBLE_MEMORY",
      );
    }
    for (const key of [
      "accountActive",
      "consentActive",
      "safetyClear",
      "deletionClear",
      "masterEnabled",
      "dailyExpressionEnabled",
    ] as const) {
      expect(
        selectDailyMatterV1(
          request([source], { access: { ...access, [key]: false } }),
        ).status,
      ).toBe("NO_ELIGIBLE_MEMORY");
    }
  });

  it("uses the exact dated and undated windows without inferring completion", () => {
    const dated = matter("dated", {
      createdProductDate: "2026-09-01",
      targetProductDate: "2026-09-12",
    });
    const undated = matter("undated");
    expect(
      selectDailyMatterV1(request([dated], { productDate: "2026-09-08" }))
        .status,
    ).toBe("NO_ELIGIBLE_MEMORY");
    expect(
      selectDailyMatterV1(request([dated], { productDate: "2026-09-09" }))
        .status,
    ).toBe("SELECTED");
    expect(selectDailyMatterV1(request([dated])).status).toBe("SELECTED");
    expect(
      selectDailyMatterV1(request([dated], { productDate: "2026-09-13" }))
        .status,
    ).toBe("NO_ELIGIBLE_MEMORY");
    expect(
      selectDailyMatterV1(request([undated], { productDate: "2026-09-10" }))
        .status,
    ).toBe("SELECTED");
    expect(
      selectDailyMatterV1(request([undated], { productDate: "2026-09-16" }))
        .status,
    ).toBe("SELECTED");
    expect(
      selectDailyMatterV1(request([undated], { productDate: "2026-09-17" }))
        .status,
    ).toBe("NO_ELIGIBLE_MEMORY");
  });

  it("selects deterministically, independent of source order or unrelated items", () => {
    const sources = [
      matter("b", { targetProductDate: "2026-09-14" }),
      matter("a", { targetProductDate: "2026-09-14" }),
      matter("today", { targetProductDate: "2026-09-12" }),
    ];
    const selected = selectDailyMatterV1(request(sources));
    expect(selected.status).toBe("SELECTED");
    expect(selectDailyMatterV1(request([...sources].reverse()))).toEqual(
      selected,
    );
    expect(
      selectDailyMatterV1(
        request([...sources, { ...matter("ungranted"), grant: undefined }]),
      ),
    ).toEqual(selected);
    if (selected.status === "SELECTED") {
      expect(selected.candidate.sourceRef).toBe("today");
      expect(JSON.stringify(selected)).not.toContain("title");
    }
  });

  it("enforces same-day and rolling seven-day mention limits", () => {
    const source = matter("matter-1");
    const mention = (productDate: string) => ({
      ownerRef,
      sourceRef: source.sourceRef,
      purpose: "DAILY_EXPRESSION" as const,
      productDate,
    });
    expect(
      selectDailyMatterV1(
        request([source], { mentions: [mention("2026-09-12")] }),
      ).status,
    ).toBe("NO_ELIGIBLE_MEMORY");
    expect(
      selectDailyMatterV1(
        request([source], {
          mentions: [mention("2026-09-10"), mention("2026-09-11")],
        }),
      ).status,
    ).toBe("NO_ELIGIBLE_MEMORY");
    expect(
      selectDailyMatterV1(
        request([matter("today", { targetProductDate: "2026-09-12" })], {
          mentions: [
            { ...mention("2026-09-10"), sourceRef: "today" },
            { ...mention("2026-09-11"), sourceRef: "today" },
          ],
        }),
      ).status,
    ).toBe("SELECTED");
  });

  it("rejects stale source or grant revisions and revoked or paused changes at recheck", () => {
    const source = matter("matter-1");
    const selected = selectDailyMatterV1(request([source]));
    expect(selected.status).toBe("SELECTED");
    if (selected.status !== "SELECTED") {
      return;
    }
    expect(recheckDailyMatterV1(selected.candidate, request([source]))).toBe(
      true,
    );
    expect(
      recheckDailyMatterV1(
        selected.candidate,
        request([source], { ownerRef: "other" }),
      ),
    ).toBe(false);
    for (const changed of [
      { accountRevision: 2 },
      { safetyEpoch: "2" },
      { deletionEpoch: "3" },
      { masterRevision: 2 },
    ]) {
      expect(
        recheckDailyMatterV1(
          selected.candidate,
          request([source], { access: { ...access, ...changed } }),
        ),
      ).toBe(false);
    }
    expect(
      recheckDailyMatterV1(
        selected.candidate,
        request([{ ...source, revision: 2 }]),
      ),
    ).toBe(false);
    expect(
      recheckDailyMatterV1(
        selected.candidate,
        request([{ ...source, grant: { ...source.grant!, revision: 2 } }]),
      ),
    ).toBe(false);
    expect(
      recheckDailyMatterV1(
        selected.candidate,
        request([{ ...source, state: "PAUSED" }]),
      ),
    ).toBe(false);
    expect(
      recheckDailyMatterV1(
        selected.candidate,
        request([{ ...source, grant: { ...source.grant!, state: "REVOKED" } }]),
      ),
    ).toBe(false);
    expect(recheckDailyMatterV1(selected.candidate, request([]))).toBe(false);
  });

  it("fails closed on duplicate source snapshots and invalid mention dates", () => {
    const source = matter("matter-1");
    expect(selectDailyMatterV1(request([source, source])).status).toBe(
      "NO_ELIGIBLE_MEMORY",
    );
    expect(
      selectDailyMatterV1(
        request([source], {
          mentions: [
            {
              ownerRef,
              sourceRef: source.sourceRef,
              purpose: "DAILY_EXPRESSION",
              productDate: "2026-09-32",
            },
          ],
        }),
      ).status,
    ).toBe("NO_ELIGIBLE_MEMORY");
  });
});
