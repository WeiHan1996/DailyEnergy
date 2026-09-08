import { describe, expect, it } from "vitest";

import {
  RELATIONSHIP_CONTINUITY_PROMPT_REGISTRY_FINGERPRINT,
  RelationshipContinuityPromptError,
  assertRelationshipPromptLanguage,
  relationshipPromptDirectiveV1,
} from "./relationship-continuity.js";

describe("AI-007 relationship continuity Prompt policy", () => {
  it("freezes the reviewed Prompt directive registry", () => {
    expect(RELATIONSHIP_CONTINUITY_PROMPT_REGISTRY_FINGERPRINT).toBe(
      "f537e06ee7c4e52fd001b609376c52c21a9ef1643c68429409071e7f5ddfae97",
    );
  });

  it.each([
    "FIRST_MEETING",
    "STYLE_CALIBRATION_AVAILABLE",
    "FIRST_SEVEN_DAY_REVIEW_AVAILABLE",
  ] as const)("returns one bounded %s directive", (node) => {
    expect(relationshipPromptDirectiveV1(node)).toMatch(/只说明.*(不|不得)/u);
  });

  it("keeps the AI-008 matter directive outside AI-007", () => {
    expect(() =>
      relationshipPromptDirectiveV1("IMPORTANT_MATTER_INVITE_AVAILABLE"),
    ).toThrow(
      expect.objectContaining<Partial<RelationshipContinuityPromptError>>({
        code: "RELATIONSHIP_PROMPT_DIRECTIVE_NOT_AVAILABLE",
      }),
    );
  });

  it.each(["可以自由发挥", "只说明我们很熟", "不得虚构经历"])(
    "rejects an unbounded directive: %s",
    (text) => {
      expect(() => assertRelationshipPromptLanguage(text)).toThrow(
        expect.objectContaining<Partial<RelationshipContinuityPromptError>>({
          code: "RELATIONSHIP_PROMPT_DIRECTIVE_INVALID",
        }),
      );
    },
  );
});
