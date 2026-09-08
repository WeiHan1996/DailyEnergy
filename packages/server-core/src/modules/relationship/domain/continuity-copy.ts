import { createHash } from "node:crypto";

import {
  RELATIONSHIP_CONTINUITY_COPY_VERSION,
  RelationshipNodeDisplaySchema,
  type RelationshipNodeCode,
  type RelationshipNodeDisplay,
} from "@daily-energy/shared-schemas";

const COPY_REGISTRY = {
  FIRST_MEETING: {
    body: "先从今天这一小步开始，不急着把彼此说得很熟。",
    title: "今天是第一次相遇",
  },
  STYLE_CALIBRATION_AVAILABLE: {
    body: "如果你愿意，之后可以选择更温柔、更轻松或更直接的表达。",
    title: "我们已经见过几次",
  },
  FIRST_SEVEN_DAY_REVIEW_AVAILABLE: {
    body: "中间有空缺也没关系，回看时只会使用确实存在的记录。",
    title: "第一段真实记录已经留下",
  },
} as const;

const FORBIDDEN_RELATIONSHIP_COPY = [
  "只有我懂你",
  "你只需要我",
  "别离开",
  "永远陪着你",
  "为了我",
  "终于回来了",
  "怎么这么久没来",
  "我一直在等你",
  "连续记录断了",
  "需要补签",
  "关系退步",
  "关系受伤",
  "你很脆弱",
] as const;

export const RELATIONSHIP_CONTINUITY_COPY_REGISTRY_FINGERPRINT = createHash(
  "sha256",
)
  .update(canonicalJson(COPY_REGISTRY), "utf8")
  .digest("hex");

const EXPECTED_RELATIONSHIP_CONTINUITY_COPY_REGISTRY_FINGERPRINT =
  "e66b7196aae2804cffee024ea8b0d0306c88431529928656ba61f4620139557a";

if (
  RELATIONSHIP_CONTINUITY_COPY_REGISTRY_FINGERPRINT !==
  EXPECTED_RELATIONSHIP_CONTINUITY_COPY_REGISTRY_FINGERPRINT
) {
  throw new Error("RELATIONSHIP_CONTINUITY_COPY_FINGERPRINT_MISMATCH");
}

export class RelationshipContinuityCopyError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = "RelationshipContinuityCopyError";
  }
}

export function renderRelationshipNodeDisplayV1(
  node: RelationshipNodeCode,
): RelationshipNodeDisplay {
  const entry = COPY_REGISTRY[node as keyof typeof COPY_REGISTRY];
  if (entry === undefined) {
    throw new RelationshipContinuityCopyError(
      "RELATIONSHIP_NODE_COPY_NOT_AVAILABLE",
    );
  }
  assertRelationshipCopyLanguage(`${entry.title}${entry.body}`);
  const parsed = RelationshipNodeDisplaySchema.safeParse({
    body: entry.body,
    copy_version: RELATIONSHIP_CONTINUITY_COPY_VERSION,
    title: entry.title,
    token: node,
  });
  if (!parsed.success) {
    throw new RelationshipContinuityCopyError(
      "RELATIONSHIP_NODE_COPY_SCHEMA_INVALID",
    );
  }
  return deepFreeze(parsed.data);
}

export function assertRelationshipCopyLanguage(text: string): void {
  if (FORBIDDEN_RELATIONSHIP_COPY.some((phrase) => text.includes(phrase))) {
    throw new RelationshipContinuityCopyError(
      "RELATIONSHIP_LANGUAGE_SAFETY_REJECTED",
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

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
