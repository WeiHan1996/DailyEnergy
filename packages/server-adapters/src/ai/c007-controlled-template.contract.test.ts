import {
  DAILY_V1_GENERATION_MANIFEST,
  deriveDailyRulesV1,
  deriveRootSeed,
  generationManifestFingerprintHex,
  parseStableSubjectId,
  type FrozenGenerationManifest,
} from "@daily-energy/server-core/generation";
import { parseProductDate } from "@daily-energy/server-core/product-time";
import {
  ControlledDailyTemplateCandidateV1Schema,
  renderControlledDailyTemplateV1,
} from "@daily-energy/prompt-library";
import { describe, expect, it } from "vitest";

const manifest: FrozenGenerationManifest = Object.freeze({
  fingerprintHex: generationManifestFingerprintHex(
    DAILY_V1_GENERATION_MANIFEST,
  ),
  manifest: DAILY_V1_GENERATION_MANIFEST,
  manifestRef: "manifest-ref-c007-evaluation",
  resultVersion: "daily-v1",
});
const stableSubjectId = parseStableSubjectId("synthetic_c007_subject");

const cases = [
  ["UNSURE", "UNSURE", "UNSURE", "BALANCED"],
  ["UNSURE", "LOW", "OKAY", "GENTLE"],
  ["VERY_LOW", "EMPTY", "POOR", "LIGHT_HUMOR"],
  ["LIGHT", "FULL", "GOOD", "LIGHT_HUMOR"],
  ["STEADY", "STEADY", "OKAY", "CLEAR_DIRECT"],
] as const;

describe("C-007 C-006 plan to controlled template contract", () => {
  it("renders real C-006 plans without a mapper, provider or second fact source", () => {
    for (const [mood, energy, sleep, expressionStyle] of cases) {
      const snapshot = {
        snapshot_version: "input-v1",
        product_date: "2026-07-20",
        result_version: "daily-v1",
        checkin: { revision: 1, mood, energy, sleep },
        profile: { revision: 1, expression_style: expressionStyle },
        relationship: { stage: "NEWLY_MET", encounter_day_count: 1 },
        permitted_context: [],
      };
      const rootSeed = deriveRootSeed({
        productDate: parseProductDate(snapshot.product_date),
        resultVersion: snapshot.result_version,
        stableSubjectId,
      });
      const derived = deriveDailyRulesV1({
        manifest,
        rootSeed,
        snapshot,
        stableSubjectId,
      });
      const candidate = renderControlledDailyTemplateV1(
        derived.controlledExpressionPlan,
      );
      expect(
        ControlledDailyTemplateCandidateV1Schema.safeParse(candidate).success,
      ).toBe(true);
      expect(candidate.expression.primary_action.action_id).toBe(
        derived.ruleFacts.selected_action_id,
      );
      expect(candidate.expression.optional_task.task_id).toBe(
        derived.ruleFacts.optional_task_plan.task_id,
      );
      expect(Object.keys(candidate.expression.ritual_notes).sort()).toEqual(
        derived.ruleFacts.ritual_facts.map(({ ritual_id }) => ritual_id).sort(),
      );
      expect(candidate.generation_mode).toBe("CONTROLLED_TEMPLATE");
      expect(candidate.source_dependencies).toEqual([]);
    }
  });
});
