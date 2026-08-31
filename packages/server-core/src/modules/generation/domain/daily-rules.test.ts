import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  EnergyValues,
  ExpressionStyleValues,
  MoodValues,
  RuleFactsSchema,
  SleepValues,
  type ExpressionStyle,
  type GenerationInputSnapshot,
  type RuleFacts,
} from "@daily-energy/shared-schemas";
import { beforeAll, describe, expect, it } from "vitest";

import { parseProductDate } from "../../product-time/public/index.js";
import { deriveDailyRulesV1 } from "../application/derive-daily-rules.js";
import {
  ACTIONS_V1,
  DAILY_RULE_CATALOGS_V1,
  type DailyRuleCatalogsV1,
} from "./daily-rule-catalog.js";
import {
  clampScoreV1,
  deriveControlledExpressionPlanV1,
  deriveDailyRuleFactsV1,
  filterEligibleActionsV1,
  overallScoreV1,
  scoreBandV1,
  selectSupportingDimensionV1,
  validateRuleFactsV1,
  type DailyChoiceTrace,
  type DailyRuleSnapshot,
} from "./daily-rules.js";
import {
  DAILY_V1_GENERATION_MANIFEST,
  generationManifestFingerprintHex,
  type FrozenGenerationManifest,
} from "./manifest.js";
import { bytesToHex, deriveNamedChoiceDigest, deriveRootSeed } from "./seed.js";
import { parseStableSubjectId } from "./stable-subject.js";

interface ExpectedChoice {
  readonly candidate_count: number;
  readonly counter?: number;
  readonly digest_hex?: string;
  readonly hashed?: boolean;
  readonly index: number;
  readonly limit_u64?: string;
  readonly namespace: DailyChoiceTrace["namespace"];
  readonly x_u64?: string;
}

interface ExpectedExpressionDerivation {
  readonly allowed_state_assertion_basis_codes: readonly string[];
  readonly assertion_mode: string;
  readonly effective_expression_constraints: object;
  readonly greeting_context: object;
  readonly known_checkin_fields: readonly string[];
  readonly requested_expression_style?: string;
  readonly selected_template_variant: string;
  readonly template_candidates: readonly string[];
  readonly uncertain_checkin_fields: readonly string[];
}

interface DailyCase {
  readonly expected_choices: readonly ExpectedChoice[];
  readonly expected_expression_derivation: ExpectedExpressionDerivation;
  readonly expected_root_seed_hex: string;
  readonly expected_rule_facts: RuleFacts;
  readonly id: string;
  readonly input_snapshot: GenerationInputSnapshot;
  readonly product_date: string;
  readonly result_version: string;
  readonly stable_subject_id: string;
}

interface DailyUnitCase {
  readonly expected: {
    readonly action_candidate_ids: readonly string[];
    readonly care_dimension_id?: string;
    readonly care_dimension_id_omitted?: boolean;
    readonly choice_traces: readonly ExpectedChoice[];
    readonly dimension_scores: readonly number[];
    readonly display_order: readonly string[];
    readonly explanation_basis_codes: readonly string[];
    readonly expression_derivation: Omit<
      ExpectedExpressionDerivation,
      "greeting_context" | "requested_expression_style"
    >;
    readonly focus_candidate_ids: readonly string[];
    readonly focus_dimension_id: string;
    readonly optional_task_plan: RuleFacts["optional_task_plan"];
    readonly overall_band: string;
    readonly overall_score: number;
    readonly ritual_facts: RuleFacts["ritual_facts"];
    readonly root_seed_hex: string;
    readonly selected_action_id: string;
    readonly supporting_dimension_id_omitted?: boolean;
  };
  readonly expected_full_controlled_expression_plan?: object;
  readonly id: string;
  readonly input_snapshot: GenerationInputSnapshot;
  readonly product_date: string;
  readonly result_version: string;
  readonly stable_subject_id: string;
}

interface Fixture {
  readonly band_unit_cases: readonly {
    readonly band: string;
    readonly label_token: string;
    readonly score: number;
  }[];
  readonly daily_cases: readonly DailyCase[];
  readonly daily_properties: {
    readonly expected_empty_action_candidate_count: number;
    readonly expected_terminal_success_count: number;
    readonly legal_input_combination_count: number;
    readonly maximum_action_candidate_count: number;
    readonly minimum_action_candidate_count: number;
  };
  readonly daily_rule_unit_cases: readonly DailyUnitCase[];
  readonly expression_style_cases: readonly {
    readonly expected_requested_expression_style?: string;
    readonly expected_rule_facts_unchanged?: boolean;
    readonly token: string;
  }[];
  readonly non_checkin_invariance_case: {
    readonly baseline_snapshot: GenerationInputSnapshot;
    readonly expected_context_slots_remain_empty_in_daily_v1: boolean;
    readonly expected_rule_facts_equal: boolean;
    readonly stable_subject_id: string;
    readonly variant_snapshot: GenerationInputSnapshot;
  };
  readonly overall_rounding_cases: readonly {
    readonly dimension_scores: readonly number[];
    readonly expected_overall: number;
  }[];
  readonly ritual_set_cases: readonly {
    readonly expected_rituals: RuleFacts["ritual_facts"];
    readonly root_seed_hex: string;
    readonly stable_subject_id: string;
  }[];
  readonly score_clamp_unit_cases: readonly {
    readonly expected_score: number;
    readonly raw_score: number;
  }[];
  readonly supporting_tie_unit_cases: readonly {
    readonly expected_supporting_dimension_id: string;
    readonly focus_dimension_id: RuleFacts["focus_dimension_id"];
    readonly stable_subject_id: string;
    readonly synthetic_dimension_scores: Readonly<Record<string, number>>;
  }[];
  readonly template_choice_cases: readonly {
    readonly expected_template_variant: string;
    readonly stable_subject_id: string;
  }[];
}

let fixture: Fixture;

const frozenManifest: FrozenGenerationManifest = Object.freeze({
  fingerprintHex: generationManifestFingerprintHex(
    DAILY_V1_GENERATION_MANIFEST,
  ),
  manifest: DAILY_V1_GENERATION_MANIFEST,
  manifestRef: "manifest-ref-daily-v1",
  resultVersion: "daily-v1",
});

beforeAll(async () => {
  fixture = JSON.parse(
    await readFile(
      resolve(
        import.meta.dirname,
        "../../../../../../docs/ai/s11-test-vectors.json",
      ),
      "utf8",
    ),
  ) as Fixture;
});

function rootSeed(stableSubjectId = "user_example"): Uint8Array {
  return deriveRootSeed({
    productDate: parseProductDate("2026-07-20"),
    resultVersion: "daily-v1",
    stableSubjectId: parseStableSubjectId(stableSubjectId),
  });
}

function derive(
  snapshot: GenerationInputSnapshot,
  stableSubjectId = "user_example",
) {
  const seed = rootSeed(stableSubjectId);
  return {
    result: deriveDailyRulesV1({
      manifest: frozenManifest,
      rootSeed: seed,
      snapshot,
      stableSubjectId: parseStableSubjectId(stableSubjectId),
    }),
    rootSeed: seed,
  };
}

function expressionProjection(
  plan: ReturnType<typeof deriveDailyRulesV1>["controlledExpressionPlan"],
  templateCandidates: readonly string[],
) {
  return {
    template_candidates: templateCandidates,
    selected_template_variant: plan.template_variant_id,
    assertion_mode: plan.assertion_mode,
    requested_expression_style: plan.requested_expression_style,
    known_checkin_fields: plan.known_checkin_fields,
    uncertain_checkin_fields: plan.uncertain_checkin_fields,
    allowed_state_assertion_basis_codes:
      plan.allowed_state_assertion_basis_codes,
    effective_expression_constraints: plan.effective_expression_constraints,
    greeting_context: plan.greeting_context,
  };
}

function assertChoices(
  actual: readonly DailyChoiceTrace[],
  expected: readonly ExpectedChoice[],
  seed: Uint8Array,
): void {
  expect(actual.map(traceToFixture)).toEqual(
    expected.map(({ namespace, candidate_count, counter, hashed, index }) => ({
      namespace,
      candidate_count,
      ...(counter === undefined ? {} : { counter }),
      hashed: hashed ?? candidate_count !== 1,
      index,
    })),
  );
  for (const choice of expected) {
    if (choice.digest_hex === undefined || choice.counter === undefined) {
      continue;
    }
    const digest = deriveNamedChoiceDigest({
      counter: choice.counter,
      namespace: choice.namespace,
      rootSeed: seed,
    });
    const x = firstU64(digest);
    const space = 1n << 64n;
    const limit = space - (space % BigInt(choice.candidate_count));
    expect(bytesToHex(digest)).toBe(choice.digest_hex);
    expect(x.toString()).toBe(choice.x_u64);
    expect(limit.toString()).toBe(choice.limit_u64);
  }
}

function traceToFixture(trace: DailyChoiceTrace) {
  return {
    namespace: trace.namespace,
    candidate_count: trace.candidateCount,
    ...(trace.counter === undefined ? {} : { counter: trace.counter }),
    hashed: trace.hashed,
    index: trace.index,
  };
}

function firstU64(value: Uint8Array): bigint {
  return new DataView(
    value.buffer,
    value.byteOffset,
    value.byteLength,
  ).getBigUint64(0, false);
}

function baseSnapshot(
  checkin: GenerationInputSnapshot["checkin"] = {
    revision: 1,
    mood: "STEADY",
    energy: "STEADY",
    sleep: "OKAY",
  },
): GenerationInputSnapshot {
  return {
    snapshot_version: "input-v1",
    product_date: "2026-07-20",
    result_version: "daily-v1",
    checkin,
    profile: { revision: 1, expression_style: "BALANCED" },
    relationship: { stage: "NEWLY_MET", encounter_day_count: 2 },
    permitted_context: [],
  };
}

describe("C-006 daily-rules-v1 golden vectors", () => {
  it("recomputes all complete daily RuleFacts, plans and named choices", () => {
    for (const vector of fixture.daily_cases) {
      const { result, rootSeed: seed } = derive(
        vector.input_snapshot,
        vector.stable_subject_id,
      );
      const facts = deriveDailyRuleFactsV1(
        vector.input_snapshot as DailyRuleSnapshot,
        seed,
      );
      const plan = deriveControlledExpressionPlanV1(
        vector.input_snapshot as DailyRuleSnapshot,
        facts.ruleFacts,
        seed,
      );
      expect(bytesToHex(seed), vector.id).toBe(vector.expected_root_seed_hex);
      expect(result.ruleFacts, vector.id).toEqual(vector.expected_rule_facts);
      expect(
        expressionProjection(
          result.controlledExpressionPlan,
          plan.templateCandidateIds,
        ),
        vector.id,
      ).toEqual(vector.expected_expression_derivation);
      assertChoices(result.choiceTrace, vector.expected_choices, seed);
    }
  });

  it("matches focused daily rule unit vectors and the exact full plan", () => {
    for (const vector of fixture.daily_rule_unit_cases) {
      const seed = rootSeed(vector.stable_subject_id);
      const facts = deriveDailyRuleFactsV1(
        vector.input_snapshot as DailyRuleSnapshot,
        seed,
      );
      const plan = deriveControlledExpressionPlanV1(
        vector.input_snapshot as DailyRuleSnapshot,
        facts.ruleFacts,
        seed,
      );
      const expected = vector.expected;
      expect(bytesToHex(seed), vector.id).toBe(expected.root_seed_hex);
      expect(
        facts.ruleFacts.dimensions.map(({ score }) => score),
        vector.id,
      ).toEqual(expected.dimension_scores);
      expect(facts.ruleFacts.overall.score, vector.id).toBe(
        expected.overall_score,
      );
      expect(facts.ruleFacts.overall.band, vector.id).toBe(
        expected.overall_band,
      );
      expect(facts.focusCandidateIds, vector.id).toEqual(
        expected.focus_candidate_ids,
      );
      expect(facts.ruleFacts.focus_dimension_id, vector.id).toBe(
        expected.focus_dimension_id,
      );
      expect(facts.ruleFacts.care_dimension_id, vector.id).toBe(
        expected.care_dimension_id,
      );
      expect(
        facts.ruleFacts.supporting_dimension_id,
        vector.id,
      ).toBeUndefined();
      expect(facts.actionCandidateIds, vector.id).toEqual(
        expected.action_candidate_ids,
      );
      expect(facts.ruleFacts.selected_action_id, vector.id).toBe(
        expected.selected_action_id,
      );
      expect(facts.ruleFacts.optional_task_plan, vector.id).toEqual(
        expected.optional_task_plan,
      );
      expect(facts.ruleFacts.display_order, vector.id).toEqual(
        expected.display_order,
      );
      expect(
        facts.ruleFacts.explanation_basis.map(({ code }) => code),
        vector.id,
      ).toEqual(expected.explanation_basis_codes);
      expect(facts.ruleFacts.ritual_facts, vector.id).toEqual(
        expected.ritual_facts,
      );
      expect(
        expressionProjection(plan.plan, plan.templateCandidateIds),
        vector.id,
      ).toMatchObject(expected.expression_derivation);
      const expectedNamespaces = new Set(
        expected.choice_traces.map(({ namespace }) => namespace),
      );
      assertChoices(
        [...facts.choiceTrace, plan.choiceTrace].filter(({ namespace }) =>
          expectedNamespaces.has(namespace),
        ),
        expected.choice_traces,
        seed,
      );
      if (vector.expected_full_controlled_expression_plan !== undefined) {
        expect(plan.plan, vector.id).toEqual(
          vector.expected_full_controlled_expression_plan,
        );
      }
    }
  });
});

describe("C-006 integer, catalog and property invariants", () => {
  it("matches every clamp, band and overall rounding boundary", () => {
    for (const vector of fixture.score_clamp_unit_cases) {
      expect(clampScoreV1(vector.raw_score)).toBe(vector.expected_score);
    }
    for (const vector of fixture.band_unit_cases) {
      expect(scoreBandV1(vector.score)).toEqual({
        band: vector.band,
        label_token: vector.label_token,
      });
    }
    for (const vector of fixture.overall_rounding_cases) {
      expect(overallScoreV1(vector.dimension_scores)).toBe(
        vector.expected_overall,
      );
    }
  });

  it("terminates all 180 legal check-ins with monotonic scores and 1-3 actions", () => {
    const outputs = new Map<string, RuleFacts>();
    let emptyActions = 0;
    for (const mood of MoodValues) {
      for (const energy of EnergyValues) {
        for (const sleep of SleepValues) {
          const snapshot = baseSnapshot({ revision: 1, mood, energy, sleep });
          const facts = derive(snapshot).result.ruleFacts;
          outputs.set(`${mood}:${energy}:${sleep}`, facts);
          expect(RuleFactsSchema.safeParse(facts).success).toBe(true);
          expect(facts.action_candidates.length).toBeGreaterThanOrEqual(
            fixture.daily_properties.minimum_action_candidate_count,
          );
          expect(facts.action_candidates.length).toBeLessThanOrEqual(
            fixture.daily_properties.maximum_action_candidate_count,
          );
          if (facts.action_candidates.length === 0) {
            emptyActions += 1;
          }
        }
      }
    }
    expect(outputs.size).toBe(
      fixture.daily_properties.legal_input_combination_count,
    );
    expect(outputs.size).toBe(
      fixture.daily_properties.expected_terminal_success_count,
    );
    expect(emptyActions).toBe(
      fixture.daily_properties.expected_empty_action_candidate_count,
    );

    const adjacent = [
      ["mood", MoodValues.filter((value) => value !== "UNSURE")],
      ["energy", EnergyValues.filter((value) => value !== "UNSURE")],
      ["sleep", SleepValues.filter((value) => value !== "UNSURE")],
    ] as const;
    for (const [field, values] of adjacent) {
      for (let index = 0; index < values.length - 1; index += 1) {
        for (const mood of MoodValues) {
          for (const energy of EnergyValues) {
            for (const sleep of SleepValues) {
              const base = { mood, energy, sleep };
              const lowerKey = `${field === "mood" ? values[index] : mood}:${
                field === "energy" ? values[index] : energy
              }:${field === "sleep" ? values[index] : sleep}`;
              const upperKey = `${
                field === "mood" ? values[index + 1] : base.mood
              }:${field === "energy" ? values[index + 1] : base.energy}:${
                field === "sleep" ? values[index + 1] : base.sleep
              }`;
              const lower = outputs.get(lowerKey)!;
              const upper = outputs.get(upperKey)!;
              expect(
                upper.dimensions.every(
                  ({ score }, dimensionIndex) =>
                    score >= lower.dimensions[dimensionIndex]!.score,
                ),
                `${field}:${values[index]}->${values[index + 1]}`,
              ).toBe(true);
            }
          }
        }
      }
    }
  });

  it("keeps non-checkin fields out of RuleFacts and keeps rituals seed-only", () => {
    const invariance = fixture.non_checkin_invariance_case;
    const baseline = derive(
      invariance.baseline_snapshot,
      invariance.stable_subject_id,
    ).result;
    const variant = derive(
      invariance.variant_snapshot,
      invariance.stable_subject_id,
    ).result;
    expect(invariance.expected_rule_facts_equal).toBe(true);
    expect(variant.ruleFacts).toEqual(baseline.ruleFacts);
    expect(
      variant.controlledExpressionPlan.requested_expression_style,
    ).not.toBe(baseline.controlledExpressionPlan.requested_expression_style);
    expect(variant.controlledExpressionPlan.resolved_context_slots).toEqual([]);
    expect(invariance.expected_context_slots_remain_empty_in_daily_v1).toBe(
      true,
    );

    const low = derive(
      baseSnapshot({
        revision: 1,
        mood: "VERY_LOW",
        energy: "EMPTY",
        sleep: "POOR",
      }),
    ).result;
    expect(low.ruleFacts.ritual_facts).toEqual(baseline.ruleFacts.ritual_facts);
  });

  it("accepts all four expression styles without changing RuleFacts", () => {
    const baseline = derive(baseSnapshot()).result;
    for (const token of ExpressionStyleValues) {
      const snapshot = baseSnapshot();
      snapshot.profile.expression_style = token;
      const result = derive(snapshot).result;
      expect(result.ruleFacts).toEqual(baseline.ruleFacts);
      expect(result.controlledExpressionPlan.requested_expression_style).toBe(
        token,
      );
    }
    expect(
      fixture.expression_style_cases
        .filter(({ expected_rule_facts_unchanged }) =>
          Boolean(expected_rule_facts_unchanged),
        )
        .map(({ token }) => token),
    ).toEqual([...ExpressionStyleValues]);
  });

  it("matches all ritual-set fixtures and the two-candidate template fixture", () => {
    for (const vector of fixture.ritual_set_cases) {
      const result = derive(baseSnapshot(), vector.stable_subject_id).result;
      expect(bytesToHex(rootSeed(vector.stable_subject_id))).toBe(
        vector.root_seed_hex,
      );
      expect(result.ruleFacts.ritual_facts).toEqual(vector.expected_rituals);
    }
    const template = fixture.template_choice_cases[0]!;
    const careSnapshot = baseSnapshot({
      revision: 1,
      mood: "VERY_LOW",
      energy: "EMPTY",
      sleep: "POOR",
    });
    expect(
      derive(careSnapshot, template.stable_subject_id).result
        .controlledExpressionPlan.template_variant_id,
    ).toBe(template.expected_template_variant);
  });

  it("selects synthetic supporting ties and ignores catalog storage order", () => {
    const vector = fixture.supporting_tie_unit_cases[0]!;
    const dimensions = Object.entries(vector.synthetic_dimension_scores).map(
      ([id, score]) => ({
        id: id as RuleFacts["focus_dimension_id"],
        score,
        ...scoreBandV1(score),
      }),
    );
    expect(
      selectSupportingDimensionV1(
        dimensions,
        vector.focus_dimension_id,
        rootSeed(vector.stable_subject_id),
      )?.dimension,
    ).toBe(vector.expected_supporting_dimension_id);

    const snapshot = baseSnapshot();
    const seed = rootSeed();
    const baseline = deriveDailyRuleFactsV1(
      snapshot as DailyRuleSnapshot,
      seed,
    ).ruleFacts;
    const shuffledCatalogs: DailyRuleCatalogsV1 = {
      ...DAILY_RULE_CATALOGS_V1,
      actions: [...ACTIONS_V1].reverse(),
    };
    expect(
      deriveDailyRuleFactsV1(
        snapshot as DailyRuleSnapshot,
        seed,
        shuffledCatalogs,
      ).ruleFacts,
    ).toEqual(baseline);
    deriveNamedChoiceDigest({
      counter: 0,
      namespace: "ritual.color.v1",
      rootSeed: seed,
    });
    expect(
      deriveDailyRuleFactsV1(snapshot as DailyRuleSnapshot, seed).ruleFacts,
    ).toEqual(baseline);
  });

  it("fails closed for duplicate/empty catalogs and score-band mismatch", () => {
    const snapshot = baseSnapshot({
      revision: 1,
      mood: "VERY_LOW",
      energy: "EMPTY",
      sleep: "POOR",
    }) as DailyRuleSnapshot;
    expect(() =>
      deriveDailyRuleFactsV1(snapshot, rootSeed(), {
        ...DAILY_RULE_CATALOGS_V1,
        actions: [...ACTIONS_V1, { ...ACTIONS_V1[0]!, rank: 99 }],
      }),
    ).toThrowError(expect.objectContaining({ code: "CATALOG_DUPLICATE_ID" }));

    const noVeryLight = ACTIONS_V1.map((action) => ({
      ...action,
      effort: "LIGHT" as const,
    }));
    expect(() =>
      filterEligibleActionsV1(
        noVeryLight,
        ["action.pause-and-recover.v1"],
        snapshot,
        true,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "MANDATORY_CANDIDATE_EMPTY" }),
    );

    const facts = deriveDailyRuleFactsV1(snapshot, rootSeed()).ruleFacts;
    expect(() =>
      validateRuleFactsV1({
        ...facts,
        overall: {
          score: 39,
          band: "STEADY",
          label_token: "KEEP_IT_STEADY",
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "RULE_FACTS_INVARIANT_FAILED" }),
    );

    const inconsistentOverallScore =
      facts.overall.band === "LOW"
        ? facts.overall.score === 0
          ? 1
          : facts.overall.score - 1
        : facts.overall.band === "STEADY"
          ? facts.overall.score === 40
            ? 41
            : facts.overall.score - 1
          : facts.overall.score === 70
            ? 71
            : facts.overall.score - 1;
    expect(() =>
      validateRuleFactsV1({
        ...facts,
        overall: {
          score: inconsistentOverallScore,
          ...scoreBandV1(inconsistentOverallScore),
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "RULE_FACTS_INVARIANT_FAILED" }),
    );
  });
});
