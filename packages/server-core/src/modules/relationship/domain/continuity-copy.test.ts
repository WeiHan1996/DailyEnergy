import { describe, expect, it } from "vitest";

import {
  RELATIONSHIP_CONTINUITY_COPY_REGISTRY_FINGERPRINT,
  RelationshipContinuityCopyError,
  assertRelationshipCopyLanguage,
  renderRelationshipNodeDisplayV1,
} from "./continuity-copy.js";

describe("AI-007 controlled relationship continuity copy", () => {
  it("freezes the reviewed copy registry", () => {
    expect(RELATIONSHIP_CONTINUITY_COPY_REGISTRY_FINGERPRINT).toBe(
      "e66b7196aae2804cffee024ea8b0d0306c88431529928656ba61f4620139557a",
    );
  });

  it.each([
    "FIRST_MEETING",
    "STYLE_CALIBRATION_AVAILABLE",
    "FIRST_SEVEN_DAY_REVIEW_AVAILABLE",
  ] as const)("renders one reviewed %s node", (node) => {
    const display = renderRelationshipNodeDisplayV1(node);
    expect(display.token).toBe(node);
    expect(display.copy_version).toBe("relationship-continuity-copy-v1");
    expect(JSON.stringify(display)).not.toMatch(
      /亲密度|等级|脆弱|Safety|prompt|source|fingerprint/iu,
    );
    expect(Object.isFrozen(display)).toBe(true);
  });

  it("keeps AI-008's important-matter invitation outside this copy set", () => {
    expect(() =>
      renderRelationshipNodeDisplayV1("IMPORTANT_MATTER_INVITE_AVAILABLE"),
    ).toThrow(
      expect.objectContaining<Partial<RelationshipContinuityCopyError>>({
        code: "RELATIONSHIP_NODE_COPY_NOT_AVAILABLE",
      }),
    );
  });

  it.each([
    "只有我懂你",
    "你终于回来了",
    "连续记录断了，需要补签",
    "为了我别离开",
    "你很脆弱，所以更需要我",
  ])("rejects unsafe relationship copy: %s", (text) => {
    expect(() => assertRelationshipCopyLanguage(text)).toThrow(
      expect.objectContaining<Partial<RelationshipContinuityCopyError>>({
        code: "RELATIONSHIP_LANGUAGE_SAFETY_REJECTED",
      }),
    );
  });
});
