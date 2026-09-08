import { createHash } from "node:crypto";

import type { RelationshipNodeCode } from "@daily-energy/shared-schemas";

export const RELATIONSHIP_CONTINUITY_PROMPT_DIRECTIVE_VERSION =
  "relationship-continuity-directive-v1";

const PROMPT_DIRECTIVES = {
  FIRST_MEETING:
    "只说明这是第一次相遇，保持礼貌、轻松和低亲密，不引用共同经历。",
  STYLE_CALIBRATION_AVAILABLE:
    "只说明已经有几个真实相遇日，可以轻量询问表达偏好；不得声称连续签到或长期了解。",
  FIRST_SEVEN_DAY_REVIEW_AVAILABLE:
    "只说明第一段真实记录已形成；共同经历只能引用有效记录，不推断成长、性格或完美连续。",
} as const;

export const RELATIONSHIP_CONTINUITY_PROMPT_REGISTRY_FINGERPRINT = createHash(
  "sha256",
)
  .update(canonicalJson(PROMPT_DIRECTIVES), "utf8")
  .digest("hex");

const EXPECTED_RELATIONSHIP_CONTINUITY_PROMPT_REGISTRY_FINGERPRINT =
  "f537e06ee7c4e52fd001b609376c52c21a9ef1643c68429409071e7f5ddfae97";

if (
  RELATIONSHIP_CONTINUITY_PROMPT_REGISTRY_FINGERPRINT !==
  EXPECTED_RELATIONSHIP_CONTINUITY_PROMPT_REGISTRY_FINGERPRINT
) {
  throw new Error("RELATIONSHIP_CONTINUITY_PROMPT_FINGERPRINT_MISMATCH");
}

export class RelationshipContinuityPromptError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = "RelationshipContinuityPromptError";
  }
}

export function relationshipPromptDirectiveV1(
  node: RelationshipNodeCode,
): string {
  const directive = PROMPT_DIRECTIVES[node as keyof typeof PROMPT_DIRECTIVES];
  if (directive === undefined) {
    throw new RelationshipContinuityPromptError(
      "RELATIONSHIP_PROMPT_DIRECTIVE_NOT_AVAILABLE",
    );
  }
  assertRelationshipPromptLanguage(directive);
  return directive;
}

export function assertRelationshipPromptLanguage(text: string): void {
  if (!/^(只说明).*(不|不得)/u.test(text)) {
    throw new RelationshipContinuityPromptError(
      "RELATIONSHIP_PROMPT_DIRECTIVE_INVALID",
    );
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
