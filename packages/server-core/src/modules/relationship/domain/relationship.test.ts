import { describe, expect, it } from "vitest";

import {
  RelationshipPolicyError,
  deriveRelationshipProjectionV1,
  publishableRelationshipNodeV1,
} from "./relationship.js";

const refs = Array.from(
  { length: 8 },
  (_, index) =>
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);

function sources(count: number, gapAfter = Number.POSITIVE_INFINITY) {
  return Array.from({ length: count }, (_, index) => ({
    productDate: `2026-09-${String(index + 1 + (index >= gapAfter ? 2 : 0)).padStart(2, "0")}`,
    sourceLightRef: refs[index]!,
    sourceValidityRevision: 1,
  }));
}

describe("AI-007 relationship projection policy", () => {
  it.each([
    [0, "BEFORE_FIRST_MEETING", [], undefined],
    [1, "NEWLY_MET", ["FIRST_MEETING"], "FIRST_MEETING"],
    [2, "NEWLY_MET", ["FIRST_MEETING"], undefined],
    [
      3,
      "BECOMING_FAMILIAR",
      ["FIRST_MEETING", "STYLE_CALIBRATION_AVAILABLE"],
      "STYLE_CALIBRATION_AVAILABLE",
    ],
    [
      4,
      "BECOMING_FAMILIAR",
      [
        "FIRST_MEETING",
        "STYLE_CALIBRATION_AVAILABLE",
        "IMPORTANT_MATTER_INVITE_AVAILABLE",
      ],
      undefined,
    ],
    [
      7,
      "FIRST_WEEK_RECORDED",
      [
        "FIRST_MEETING",
        "STYLE_CALIBRATION_AVAILABLE",
        "IMPORTANT_MATTER_INVITE_AVAILABLE",
        "FIRST_SEVEN_DAY_REVIEW_AVAILABLE",
      ],
      "FIRST_SEVEN_DAY_REVIEW_AVAILABLE",
    ],
  ] as const)(
    "derives count %i without treating eligibility as intimacy or mutable state",
    (count, stage, eligibleNodeCodes, publishableNode) => {
      const projection = deriveRelationshipProjectionV1(sources(count));
      expect(projection).toMatchObject({
        eligibleNodeCodes,
        encounterDayCount: count,
        stage,
      });
      expect(publishableRelationshipNodeV1(count)).toBe(publishableNode);
      expect(Object.isFrozen(projection)).toBe(true);
    },
  );

  it("deduplicates an exact replay and ignores calendar gaps", () => {
    const gapped = sources(3, 1);
    const projection = deriveRelationshipProjectionV1([
      gapped[2]!,
      gapped[0]!,
      gapped[1]!,
      structuredClone(gapped[1]!),
    ]);
    expect(projection.encounterDayCount).toBe(3);
    expect(projection.stage).toBe("BECOMING_FAMILIAR");
    expect(projection.sourceFingerprintHex).toBe(
      deriveRelationshipProjectionV1(gapped).sourceFingerprintHex,
    );
  });

  it("changes the fingerprint and deterministically downgrades after a source is removed", () => {
    const seven = deriveRelationshipProjectionV1(sources(7));
    const six = deriveRelationshipProjectionV1(sources(7).slice(1));
    expect(six.sourceFingerprintHex).not.toBe(seven.sourceFingerprintHex);
    expect(six).toMatchObject({
      encounterDayCount: 6,
      stage: "BECOMING_FAMILIAR",
    });
  });

  it("rejects a conflicting source for one product date", () => {
    const [first] = sources(1);
    expect(() =>
      deriveRelationshipProjectionV1([
        first!,
        { ...first!, sourceLightRef: refs[1]! },
      ]),
    ).toThrow(
      expect.objectContaining<Partial<RelationshipPolicyError>>({
        code: "RELATIONSHIP_SOURCE_DATE_CONFLICT",
      }),
    );
  });

  it.each([
    { opened: true },
    { checkinSubmitted: true },
    { notificationClicked: true },
    { safetyState: "CLEARED" },
    { userVulnerability: "LOW_ENERGY" },
  ])("rejects non-LightFact relationship evidence: %j", (extra) => {
    expect(() =>
      deriveRelationshipProjectionV1([
        { ...sources(1)[0]!, ...extra } as never,
      ]),
    ).toThrow(
      expect.objectContaining<Partial<RelationshipPolicyError>>({
        code: "RELATIONSHIP_SOURCE_INVALID",
      }),
    );
  });
});
