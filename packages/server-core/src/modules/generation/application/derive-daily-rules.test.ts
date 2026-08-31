import {
  ControlledExpressionPlanV1Schema,
  type GenerationInputSnapshot,
  type RuleFacts,
} from "@daily-energy/shared-schemas";
import { describe, expect, it } from "vitest";

import { parseProductDate } from "../../product-time/public/index.js";
import {
  DAILY_V1_GENERATION_MANIFEST,
  generationManifestFingerprintHex,
  parseGenerationManifest,
  type FrozenGenerationManifest,
} from "../domain/manifest.js";
import { deriveRootSeed } from "../domain/seed.js";
import { parseStableSubjectId } from "../domain/stable-subject.js";
import { deriveDailyRulesV1 } from "./derive-daily-rules.js";

const stableSubjectId = parseStableSubjectId("user_example");
const baseSnapshot: GenerationInputSnapshot = {
  snapshot_version: "input-v1",
  product_date: "2026-07-20",
  result_version: "daily-v1",
  checkin: {
    revision: 1,
    mood: "STEADY",
    energy: "STEADY",
    sleep: "OKAY",
  },
  profile: { revision: 1, expression_style: "BALANCED" },
  relationship: { stage: "NEWLY_MET", encounter_day_count: 2 },
  permitted_context: [],
};
const rootSeed = deriveRootSeed({
  productDate: parseProductDate(baseSnapshot.product_date),
  resultVersion: baseSnapshot.result_version,
  stableSubjectId,
});
const manifest: FrozenGenerationManifest = Object.freeze({
  fingerprintHex: generationManifestFingerprintHex(
    DAILY_V1_GENERATION_MANIFEST,
  ),
  manifest: DAILY_V1_GENERATION_MANIFEST,
  manifestRef: "manifest-ref-daily-v1",
  resultVersion: "daily-v1",
});

function run(snapshot: unknown = baseSnapshot) {
  return deriveDailyRulesV1({ manifest, rootSeed, snapshot, stableSubjectId });
}

function expectCode(runInvalid: () => unknown, code: string): void {
  expect(runInvalid).toThrowError(expect.objectContaining({ code }));
}

describe("C-006 daily derivation bindings", () => {
  it("returns frozen RuleFacts, plan and a limited server-only choice trace", () => {
    const result = run();
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.ruleFacts.dimensions)).toBe(true);
    expect(
      Object.isFrozen(result.controlledExpressionPlan.semantic_slots),
    ).toBe(true);
    expect(Object.isFrozen(result.choiceTrace)).toBe(true);
    const serializedTrace = JSON.stringify(result.choiceTrace);
    expect(serializedTrace).not.toMatch(
      /digest|rootSeed|stableSubject|xU64|limit/u,
    );
    const serializedPlan = JSON.stringify(result.controlledExpressionPlan);
    expect(serializedPlan).not.toMatch(
      /"score"|root_seed|choice_trace|stable_subject|manifest_fingerprint/u,
    );
    expect(result.controlledExpressionPlan.resolved_context_slots).toEqual([]);
    expect(
      result.controlledExpressionPlan.source_dependency_requirements,
    ).toEqual([]);
    expect(
      ControlledExpressionPlanV1Schema.safeParse(
        result.controlledExpressionPlan,
      ).success,
    ).toBe(true);
    expect(
      ControlledExpressionPlanV1Schema.safeParse({
        ...result.controlledExpressionPlan,
        unknown_template_input: true,
      }).success,
    ).toBe(false);
  });

  it("rejects closed-world snapshot field and semantic style violations", () => {
    expectCode(
      () => run({ ...baseSnapshot, unexpected: true }),
      "SNAPSHOT_FIELD_INVALID",
    );
    const { checkin: _checkin, ...withoutCheckin } = baseSnapshot;
    expectCode(() => run(withoutCheckin), "SNAPSHOT_FIELD_INVALID");
    expectCode(
      () =>
        run({
          ...baseSnapshot,
          checkin: { ...baseSnapshot.checkin, mood: "UNKNOWN" },
        }),
      "SNAPSHOT_FIELD_INVALID",
    );
    expectCode(
      () =>
        run({
          ...baseSnapshot,
          profile: {
            ...baseSnapshot.profile,
            expression_style: "CUSTOM_COACH",
          },
        }),
      "SNAPSHOT_FIELD_INVALID",
    );
    expectCode(
      () =>
        run({
          ...baseSnapshot,
          permitted_context: [
            {
              source_ref: "context-ref-invalid-date",
              source_type: "RECENT_RECORD",
              source_revision: 1,
              purpose: "daily-context-v1",
              valid_for_product_date: "2026-07-19",
            },
          ],
        }),
      "SNAPSHOT_FIELD_INVALID",
    );
  });

  it("rejects snapshot version, result binding, unregistered product and root mismatches", () => {
    expectCode(
      () => run({ ...baseSnapshot, snapshot_version: "input-v2" }),
      "SNAPSHOT_VERSION_MISMATCH",
    );
    expectCode(
      () => run({ ...baseSnapshot, result_version: "daily-v2" }),
      "SNAPSHOT_BINDING_MISMATCH",
    );
    expectCode(
      () =>
        run({
          ...baseSnapshot,
          product: {
            locale: "zh-CN",
            personality_version: "personality-v1",
            content_policy_version: "content-policy-v1",
            experiment_version: "experiment-v1",
          },
        }),
      "SNAPSHOT_FIELD_INVALID",
    );
    expectCode(
      () =>
        deriveDailyRulesV1({
          manifest,
          rootSeed: new Uint8Array(32),
          snapshot: baseSnapshot,
          stableSubjectId,
        }),
      "ROOT_SEED_MISMATCH",
    );
    expectCode(
      () =>
        deriveDailyRulesV1({
          manifest,
          rootSeed: new Uint8Array(31),
          snapshot: baseSnapshot,
          stableSubjectId,
        }),
      "ROOT_SEED_MISMATCH",
    );
  });

  it("rejects manifest fingerprint and dependency closure mismatches", () => {
    expectCode(
      () =>
        deriveDailyRulesV1({
          manifest: { ...manifest, fingerprintHex: "0".repeat(64) },
          rootSeed,
          snapshot: baseSnapshot,
          stableSubjectId,
        }),
      "MANIFEST_FINGERPRINT_MISMATCH",
    );
    const changedManifest = parseGenerationManifest({
      ...DAILY_V1_GENERATION_MANIFEST,
      rule_version: "daily-rules-v2",
    });
    expectCode(
      () =>
        deriveDailyRulesV1({
          manifest: {
            fingerprintHex: generationManifestFingerprintHex(changedManifest),
            manifest: changedManifest,
            manifestRef: "manifest-ref-mutated-daily-v1",
            resultVersion: "daily-v1",
          },
          rootSeed,
          snapshot: baseSnapshot,
          stableSubjectId,
        }),
      "MANIFEST_DEPENDENCY_INVALID",
    );
  });

  it("keeps RuleFacts separate from profile, relationship and context expression data", () => {
    const baseline = run();
    const variant = run({
      ...baseSnapshot,
      user_ref: "user-ref-variant",
      profile: {
        revision: 9,
        preferred_name: "小陈",
        expression_style: "GENTLE",
      },
      relationship: {
        stage: "FIRST_WEEK_RECORDED",
        encounter_day_count: 99,
      },
      permitted_context: [
        {
          source_ref: "context-ref-variant",
          source_type: "RECENT_RECORD",
          source_revision: 7,
          purpose: "daily-context-v1",
          valid_for_product_date: "2026-07-20",
        },
      ],
    });
    expect(variant.ruleFacts).toEqual(baseline.ruleFacts);
    expect(variant.controlledExpressionPlan.greeting_context).toEqual({
      preferred_name: "小陈",
      relationship_mode: "GENERIC",
    });
    expect(variant.controlledExpressionPlan.requested_expression_style).toBe(
      "GENTLE",
    );
    expect(variant.controlledExpressionPlan.semantic_slots).toEqual(
      expect.objectContaining({
        selected_action: expect.objectContaining({
          action_id: baseline.ruleFacts.selected_action_id,
        }),
      }),
    );
    expect(
      (variant.ruleFacts as RuleFacts & { relationship?: unknown })
        .relationship,
    ).toBeUndefined();
  });
});
