import {
  ControlledExpressionPlanV1Schema,
  RuleFactsSchema,
  type Band,
  type ControlledExpressionPlanV1,
  type Energy,
  type ExpressionStyle,
  type GenerationInputSnapshot,
  type Mood,
  type RuleFacts,
  type Sleep,
  type StableDimensionId,
} from "@daily-energy/shared-schemas";

import {
  ACTIONS_V1,
  ACTION_AFFINITY_ORDER_V1,
  ALL_UNSURE_ACTION_IDS_V1,
  DAILY_RULE_CATALOGS_V1,
  DIMENSION_ORDER,
  FOCUS_ACTION_IDS_V1,
  type ActionCandidate,
  type ActionDefinition,
  type DailyRuleCatalogsV1,
  type RitualFact,
} from "./daily-rule-catalog.js";
import { DeterministicGenerationError } from "./deterministic-error.js";
import {
  canonicalizeCandidates,
  selectNamedIndex,
  type CanonicalCandidate,
} from "./seed.js";

export const DAILY_RULE_VERSION = "daily-rules-v1";
export const DAILY_SCORE_VERSION = "daily-score-v1";

export type ChoiceNamespaceV1 =
  | "focus.tie.v1"
  | "support.tie.v1"
  | "action.tie.v1"
  | "ritual.set.v1"
  | "ritual.color.v1"
  | "ritual.number.v1"
  | "template.variant.v1";

export interface DailyChoiceTrace {
  readonly candidateCount: number;
  readonly counter?: number;
  readonly hashed: boolean;
  readonly index: number;
  readonly namespace: ChoiceNamespaceV1;
}

export interface DailyRuleDerivation {
  readonly choiceTrace: readonly DailyChoiceTrace[];
  readonly controlledExpressionPlan: ControlledExpressionPlanV1;
  readonly ruleFacts: RuleFacts;
}

export type DailyRuleSnapshot = GenerationInputSnapshot & {
  readonly profile: GenerationInputSnapshot["profile"] & {
    readonly expression_style: ExpressionStyle;
  };
};

interface RuleFactsDerivation {
  readonly actionCandidateIds: readonly string[];
  readonly choiceTrace: readonly DailyChoiceTrace[];
  readonly focusCandidateIds: readonly StableDimensionId[];
  readonly ruleFacts: RuleFacts;
}

interface ExpressionPlanDerivation {
  readonly choiceTrace: DailyChoiceTrace;
  readonly plan: ControlledExpressionPlanV1;
  readonly templateCandidateIds: readonly string[];
}

type CheckinField = "mood" | "energy" | "sleep";
type DimensionFact = RuleFacts["dimensions"][number];

const MOOD_ORDINAL: Readonly<Record<Mood, number>> = Object.freeze({
  VERY_LOW: -2,
  LOW: -1,
  STEADY: 0,
  GOOD: 1,
  LIGHT: 2,
  UNSURE: 0,
});
const ENERGY_ORDINAL: Readonly<Record<Energy, number>> = Object.freeze({
  EMPTY: -2,
  LOW: -1,
  STEADY: 0,
  HIGH: 1,
  FULL: 2,
  UNSURE: 0,
});
const SLEEP_ORDINAL: Readonly<Record<Sleep, number>> = Object.freeze({
  POOR: -2,
  LOW: -1,
  OKAY: 0,
  GOOD: 1,
  UNSURE: 0,
});
const WEIGHTS: Readonly<
  Record<StableDimensionId, readonly [number, number, number]>
> = deepFreeze({
  pace: [7, 10, 6],
  action: [6, 13, 7],
  connection: [9, 4, 3],
  resources: [4, 8, 5],
  recovery: [3, 5, 8],
});
const LABEL_BY_BAND = Object.freeze({
  LOW: "TAKE_IT_GENTLY",
  STEADY: "KEEP_IT_STEADY",
  HIGH: "ROOM_TO_MOVE",
} as const);
const REQUIRED_SECTIONS = Object.freeze([
  "greeting",
  "state_response",
  "overall_summary",
  "core_tip",
  "explanation_paragraphs",
  "dimension_explanations",
  "primary_action",
  "optional_task",
  "ritual_notes",
  "closing",
] as const);
const PROHIBITED_CLAIM_CLASSES = Object.freeze([
  "FUTURE_PREDICTION",
  "DIAGNOSIS_OR_TREATMENT",
  "FINANCIAL_OR_LEGAL_ADVICE",
  "OTHER_PERSON_MIND_OR_RELATIONSHIP_OUTCOME",
  "RESULT_GUARANTEE",
  "RITUAL_CAUSALITY_OR_GAMBLING",
  "TASK_PUNISHMENT_OR_SHAME",
  "EXCLUSIVE_DEPENDENCY_OR_FABRICATED_INTIMACY",
  "FABRICATED_MEMORY_OR_REAL_WORLD_EXPERIENCE",
] as const);
const CHECKIN_FIELDS = Object.freeze([
  "mood",
  "energy",
  "sleep",
] as const satisfies readonly CheckinField[]);

export function clampScoreV1(rawScore: number): number {
  if (!Number.isSafeInteger(rawScore)) {
    throw ruleFactsInvariant();
  }
  return Math.min(100, Math.max(0, rawScore));
}

export function scoreBandV1(score: number): {
  readonly band: Band;
  readonly label_token: RuleFacts["overall"]["label_token"];
} {
  if (!Number.isSafeInteger(score) || score < 0 || score > 100) {
    throw ruleFactsInvariant();
  }
  const band: Band = score < 40 ? "LOW" : score < 70 ? "STEADY" : "HIGH";
  return Object.freeze({ band, label_token: LABEL_BY_BAND[band] });
}

export function overallScoreV1(scores: readonly number[]): number {
  if (
    scores.length !== DIMENSION_ORDER.length ||
    scores.some(
      (score) => !Number.isSafeInteger(score) || score < 0 || score > 100,
    )
  ) {
    throw ruleFactsInvariant();
  }
  return Math.floor((scores.reduce((sum, score) => sum + score, 0) + 2) / 5);
}

export function deriveDailyRuleFactsV1(
  snapshot: DailyRuleSnapshot,
  rootSeed: Uint8Array,
  catalogs: DailyRuleCatalogsV1 = DAILY_RULE_CATALOGS_V1,
): RuleFactsDerivation {
  validateCatalogsV1(catalogs);
  const dimensions = computeDimensions(snapshot);
  const allUnsure = CHECKIN_FIELDS.every(
    (field) => snapshot.checkin[field] === "UNSURE",
  );
  const severe = hasSevereSignal(snapshot);
  const focusSelection = selectFocusDimensionV1(
    dimensions,
    snapshot,
    rootSeed,
    allUnsure,
  );
  const focus = focusSelection.dimension;
  const focusFact = dimensions.find(({ id }) => id === focus);
  if (focusFact === undefined) {
    throw ruleFactsInvariant();
  }
  const care =
    allUnsure || (!severe && focusFact.band !== "LOW") ? undefined : focus;
  const supportSelection = allUnsure
    ? undefined
    : selectSupportingDimensionV1(dimensions, focus, rootSeed);
  const supporting = supportSelection?.dimension;
  const explanationBasis = buildExplanationBasis(
    snapshot,
    focusFact,
    supporting === undefined
      ? undefined
      : dimensions.find(({ id }) => id === supporting),
    allUnsure,
  );
  const basisCodes = explanationBasis.map(({ code }) => code);
  const actionDefinitions = filterEligibleActionsV1(
    catalogs.actions,
    allUnsure
      ? ALL_UNSURE_ACTION_IDS_V1
      : FOCUS_ACTION_IDS_V1[focus][focusFact.band],
    snapshot,
    severe,
  );
  const actionCandidates = actionDefinitions.map((definition) =>
    actionCandidateFromDefinition(definition, basisCodes),
  );
  const actionSelection = chooseCanonical(
    actionDefinitions,
    "action.tie.v1",
    rootSeed,
  );
  const selectedAction = actionCandidates[actionSelection.trace.index];
  if (selectedAction === undefined) {
    throw ruleFactsInvariant();
  }
  const optionalTask = catalogs.tasksByActionId[selectedAction.action_id];
  if (optionalTask === undefined || optionalTask.kind !== selectedAction.kind) {
    throw new DeterministicGenerationError("CATALOG_NOT_FOUND");
  }
  const ritualSelection = deriveRitualsV1(rootSeed, catalogs);
  const displayOrder = displayOrderV1(focus, selectedAction.action_id);
  const scores = dimensions.map(({ score }) => score);
  const overallScore = overallScoreV1(scores);
  const ruleFactsCandidate: RuleFacts = {
    overall: { score: overallScore, ...scoreBandV1(overallScore) },
    dimensions: [...dimensions],
    focus_dimension_id: focus,
    ...(supporting === undefined
      ? {}
      : { supporting_dimension_id: supporting }),
    ...(care === undefined ? {} : { care_dimension_id: care }),
    display_order: [...displayOrder],
    explanation_basis: explanationBasis,
    action_candidates: actionCandidates,
    selected_action_id: selectedAction.action_id,
    optional_task_plan: optionalTask,
    ritual_facts: [...ritualSelection.rituals],
  };
  const ruleFacts = validateRuleFactsV1(ruleFactsCandidate, catalogs);
  return deepFreeze({
    actionCandidateIds: actionCandidates.map(({ action_id }) => action_id),
    choiceTrace: [
      focusSelection.trace,
      ...(supportSelection === undefined ? [] : [supportSelection.trace]),
      actionSelection.trace,
      ...ritualSelection.traces,
    ],
    focusCandidateIds: focusSelection.candidateIds,
    ruleFacts,
  });
}

export function deriveControlledExpressionPlanV1(
  snapshot: DailyRuleSnapshot,
  ruleFacts: RuleFacts,
  rootSeed: Uint8Array,
  catalogs: DailyRuleCatalogsV1 = DAILY_RULE_CATALOGS_V1,
): ExpressionPlanDerivation {
  const templateIds: ControlledExpressionPlanV1["template_variant_id"][] = [
    "template.focus-first.v1",
  ];
  if (ruleFacts.care_dimension_id !== undefined) {
    templateIds.push("template.care-then-step.v1");
  } else if (ruleFacts.supporting_dimension_id !== undefined) {
    templateIds.push("template.support-then-focus.v1");
  }
  const templates = canonicalDefinitionsById(
    catalogs.templates,
    templateIds,
    "CATALOG_NOT_FOUND",
  );
  const templateSelection = chooseCanonical(
    templates,
    "template.variant.v1",
    rootSeed,
  );
  if (
    !templateIds.includes(
      templateSelection.candidate
        .id as ControlledExpressionPlanV1["template_variant_id"],
    )
  ) {
    throw new DeterministicGenerationError("CATALOG_NOT_FOUND");
  }
  const templateVariantId = templateSelection.candidate
    .id as ControlledExpressionPlanV1["template_variant_id"];
  const selectedAction = ruleFacts.action_candidates.find(
    ({ action_id }) => action_id === ruleFacts.selected_action_id,
  );
  if (selectedAction === undefined) {
    throw ruleFactsInvariant();
  }
  const uncertain = CHECKIN_FIELDS.filter(
    (field) => snapshot.checkin[field] === "UNSURE",
  );
  const known = CHECKIN_FIELDS.filter(
    (field) => snapshot.checkin[field] !== "UNSURE",
  );
  const assertionMode =
    uncertain.length === 3
      ? "LOW_ASSERTION"
      : uncertain.length > 0
        ? "PARTIAL_ASSERTION"
        : "STANDARD";
  const basisCodes = ruleFacts.explanation_basis.map(({ code }) => code);
  const allowedBasis =
    assertionMode === "LOW_ASSERTION"
      ? []
      : assertionMode === "PARTIAL_ASSERTION"
        ? ruleFacts.explanation_basis
            .filter(
              ({ type, code }) =>
                type === "CHECKIN_SIGNAL" &&
                known.some((field) => code.startsWith(`checkin.${field}.`)),
            )
            .map(({ code }) => code)
        : basisCodes;
  const constrained =
    ruleFacts.care_dimension_id !== undefined ||
    assertionMode === "LOW_ASSERTION";
  const plan: ControlledExpressionPlanV1 = {
    expression_contract_version: "daily-expression-v1",
    output_schema_version: "1.0.0",
    template_compatibility_version: "daily-template-v1",
    result_version: "daily-v1",
    template_variant_id: templateVariantId,
    assertion_mode: assertionMode,
    required_sections: [...REQUIRED_SECTIONS],
    semantic_slots: {
      overall: {
        band: ruleFacts.overall.band,
        label_token: ruleFacts.overall.label_token,
      },
      dimensions: ruleFacts.dimensions.map(({ id, band }) => ({ id, band })),
      focus_dimension_id: ruleFacts.focus_dimension_id,
      ...(ruleFacts.supporting_dimension_id === undefined
        ? {}
        : { supporting_dimension_id: ruleFacts.supporting_dimension_id }),
      ...(ruleFacts.care_dimension_id === undefined
        ? {}
        : { care_dimension_id: ruleFacts.care_dimension_id }),
      selected_action: selectedAction,
      optional_task: ruleFacts.optional_task_plan,
      rituals: ruleFacts.ritual_facts,
      explanation_basis_codes: basisCodes,
    },
    known_checkin_fields: known,
    uncertain_checkin_fields: uncertain,
    allowed_state_assertion_basis_codes: allowedBasis,
    requested_expression_style: snapshot.profile.expression_style,
    effective_expression_constraints: {
      humor_ceiling: constrained ? "NONE" : "LIGHT",
      pressure_ceiling: constrained ? "VERY_LOW" : "LIGHT",
      opening_requirement:
        ruleFacts.care_dimension_id !== undefined
          ? "CARE_FIRST"
          : assertionMode === "STANDARD"
            ? "FACT_FIRST"
            : "UNCERTAINTY_FIRST",
      dimension_explanation_mode:
        assertionMode === "LOW_ASSERTION"
          ? "NON_ASSERTIVE"
          : assertionMode === "PARTIAL_ASSERTION"
            ? "KNOWN_SIGNALS_ONLY"
            : "BAND_GUIDANCE",
    },
    greeting_context: {
      ...(snapshot.profile.preferred_name === undefined
        ? {}
        : { preferred_name: snapshot.profile.preferred_name }),
      relationship_mode: "GENERIC",
    },
    resolved_context_slots: [],
    source_dependency_requirements: [],
    prohibited_claim_classes: [...PROHIBITED_CLAIM_CLASSES],
  };
  validateExpressionPlanV1(plan, snapshot, ruleFacts);
  return deepFreeze({
    choiceTrace: templateSelection.trace,
    plan,
    templateCandidateIds: templates.map(({ id }) => id),
  });
}

export function validateRuleFactsV1(
  value: RuleFacts,
  catalogs: DailyRuleCatalogsV1 = DAILY_RULE_CATALOGS_V1,
): RuleFacts {
  const parsed = RuleFactsSchema.safeParse(value);
  if (!parsed.success) {
    throw ruleFactsInvariant();
  }
  const facts = parsed.data;
  for (const scored of [facts.overall, ...facts.dimensions]) {
    if (!sameObject(scoreBandV1(scored.score), scored, ["score", "id"])) {
      throw ruleFactsInvariant();
    }
  }
  if (
    facts.overall.score !==
    overallScoreV1(facts.dimensions.map(({ score }) => score))
  ) {
    throw ruleFactsInvariant();
  }
  if (
    (facts.care_dimension_id !== undefined &&
      facts.care_dimension_id !== facts.focus_dimension_id) ||
    (facts.supporting_dimension_id !== undefined &&
      facts.supporting_dimension_id === facts.focus_dimension_id)
  ) {
    throw ruleFactsInvariant();
  }
  const basisCodes = facts.explanation_basis.map(({ code }) => code);
  const definitions = canonicalDefinitionsById(
    catalogs.actions,
    facts.action_candidates.map(({ action_id }) => action_id),
    "CATALOG_NOT_FOUND",
  );
  const expectedCandidates = definitions.map((definition) =>
    actionCandidateFromDefinition(definition, basisCodes),
  );
  if (
    JSON.stringify(expectedCandidates) !==
    JSON.stringify(facts.action_candidates)
  ) {
    throw ruleFactsInvariant();
  }
  const selected = facts.action_candidates.find(
    ({ action_id }) => action_id === facts.selected_action_id,
  );
  const expectedTask = catalogs.tasksByActionId[facts.selected_action_id];
  if (
    selected === undefined ||
    expectedTask === undefined ||
    expectedTask.kind !== selected.kind ||
    JSON.stringify(expectedTask) !== JSON.stringify(facts.optional_task_plan) ||
    JSON.stringify(
      displayOrderV1(facts.focus_dimension_id, selected.action_id),
    ) !== JSON.stringify(facts.display_order) ||
    !ritualFactsMatchCatalogs(facts.ritual_facts, catalogs)
  ) {
    throw ruleFactsInvariant();
  }
  return deepFreeze(facts);
}

export function filterEligibleActionsV1(
  catalog: readonly ActionDefinition[],
  candidateIds: readonly string[],
  snapshot: DailyRuleSnapshot,
  severe: boolean,
): readonly ActionDefinition[] {
  const canonical = canonicalizeCandidates(catalog);
  const selected = canonicalDefinitionsById(
    canonical,
    candidateIds,
    "CATALOG_NOT_FOUND",
  ).filter(
    (candidate) =>
      (candidate.id !== "action.seek-real-support.v1" ||
        snapshot.checkin.mood === "VERY_LOW" ||
        snapshot.checkin.energy === "EMPTY") &&
      (!severe || candidate.effort === "VERY_LIGHT"),
  );
  if (selected.length === 0) {
    throw new DeterministicGenerationError("MANDATORY_CANDIDATE_EMPTY");
  }
  if (selected.length > 3) {
    throw ruleFactsInvariant();
  }
  return selected;
}

export function selectSupportingDimensionV1(
  dimensions: readonly DimensionFact[],
  focus: StableDimensionId,
  rootSeed: Uint8Array,
):
  | {
      readonly candidateIds: readonly StableDimensionId[];
      readonly dimension: StableDimensionId;
      readonly trace: DailyChoiceTrace;
    }
  | undefined {
  const high = dimensions.filter(
    ({ id, band }) => id !== focus && band === "HIGH",
  );
  if (high.length === 0) {
    return undefined;
  }
  const maximum = Math.max(...high.map(({ score }) => score));
  const candidates = high
    .filter(({ score }) => score === maximum)
    .map(({ id }) => dimensionCandidate(id));
  const selection = chooseCanonical(candidates, "support.tie.v1", rootSeed);
  return deepFreeze({
    candidateIds: candidates.map(({ id }) => id as StableDimensionId),
    dimension: selection.candidate.id as StableDimensionId,
    trace: selection.trace,
  });
}

function computeDimensions(
  snapshot: DailyRuleSnapshot,
): readonly DimensionFact[] {
  const ordinals = [
    MOOD_ORDINAL[snapshot.checkin.mood],
    ENERGY_ORDINAL[snapshot.checkin.energy],
    SLEEP_ORDINAL[snapshot.checkin.sleep],
  ] as const;
  return DIMENSION_ORDER.map((id) => {
    const weights = WEIGHTS[id];
    const rawScore =
      50 +
      weights.reduce(
        (sum, weight, index) => sum + weight * ordinals[index]!,
        0,
      );
    const score = clampScoreV1(rawScore);
    return Object.freeze({ id, score, ...scoreBandV1(score) });
  });
}

function selectFocusDimensionV1(
  dimensions: readonly DimensionFact[],
  snapshot: DailyRuleSnapshot,
  rootSeed: Uint8Array,
  allUnsure: boolean,
): {
  readonly candidateIds: readonly StableDimensionId[];
  readonly dimension: StableDimensionId;
  readonly trace: DailyChoiceTrace;
} {
  let candidateIds: readonly StableDimensionId[];
  if (allUnsure) {
    candidateIds = ["pace"];
  } else if (hasSevereSignal(snapshot)) {
    const points = carePoints(snapshot);
    const maximum = Math.max(...DIMENSION_ORDER.map((id) => points[id]));
    candidateIds = DIMENSION_ORDER.filter((id) => points[id] === maximum);
  } else {
    const low = dimensions.filter(({ band }) => band === "LOW");
    const pool = low.length > 0 ? low : dimensions;
    const target =
      low.length > 0
        ? Math.min(...pool.map(({ score }) => score))
        : Math.max(...pool.map(({ score }) => score));
    candidateIds = pool
      .filter(({ score }) => score === target)
      .map(({ id }) => id);
  }
  const candidates = candidateIds.map(dimensionCandidate);
  const selection = chooseCanonical(candidates, "focus.tie.v1", rootSeed);
  return deepFreeze({
    candidateIds,
    dimension: selection.candidate.id as StableDimensionId,
    trace: selection.trace,
  });
}

function carePoints(
  snapshot: DailyRuleSnapshot,
): Readonly<Record<StableDimensionId, number>> {
  const points: Record<StableDimensionId, number> = {
    pace: 0,
    action: 0,
    connection: 0,
    resources: 0,
    recovery: 0,
  };
  if (snapshot.checkin.mood === "VERY_LOW") {
    addPoints(points, [1, 0, 3, 0, 2]);
  }
  if (snapshot.checkin.energy === "EMPTY") {
    addPoints(points, [2, 1, 0, 1, 3]);
  }
  if (snapshot.checkin.sleep === "POOR") {
    addPoints(points, [2, 1, 0, 1, 3]);
  }
  return Object.freeze(points);
}

function addPoints(
  target: Record<StableDimensionId, number>,
  values: readonly number[],
): void {
  DIMENSION_ORDER.forEach((id, index) => {
    target[id] += values[index]!;
  });
}

function hasSevereSignal(snapshot: DailyRuleSnapshot): boolean {
  return (
    snapshot.checkin.mood === "VERY_LOW" ||
    snapshot.checkin.energy === "EMPTY" ||
    snapshot.checkin.sleep === "POOR"
  );
}

function buildExplanationBasis(
  snapshot: DailyRuleSnapshot,
  focus: DimensionFact,
  supporting: DimensionFact | undefined,
  allUnsure: boolean,
): RuleFacts["explanation_basis"] {
  return [
    {
      type: "CHECKIN_SIGNAL" as const,
      code: `checkin.mood.${basisToken(snapshot.checkin.mood)}.v1`,
    },
    {
      type: "CHECKIN_SIGNAL" as const,
      code: `checkin.energy.${basisToken(snapshot.checkin.energy)}.v1`,
    },
    {
      type: "CHECKIN_SIGNAL" as const,
      code: `checkin.sleep.${basisToken(snapshot.checkin.sleep)}.v1`,
    },
    ...(allUnsure
      ? []
      : [
          {
            type: "DIMENSION_SIGNAL" as const,
            code: `dimension.${focus.id}.${focus.band.toLowerCase()}.v1`,
          },
        ]),
    ...(supporting === undefined
      ? []
      : [
          {
            type: "DIMENSION_SIGNAL" as const,
            code: `dimension.${supporting.id}.${supporting.band.toLowerCase()}.v1`,
          },
        ]),
  ];
}

function basisToken(value: string): string {
  return value.toLowerCase().replaceAll("_", "-");
}

function actionCandidateFromDefinition(
  definition: ActionDefinition,
  basisCodes: readonly string[],
): ActionCandidate {
  return Object.freeze({
    action_id: definition.id,
    kind: definition.kind,
    target_scope: definition.targetScope,
    effort: definition.effort,
    timebox_minutes: definition.timeboxMinutes,
    constraint_token: definition.constraintToken,
    basis_refs: [...basisCodes],
  });
}

function deriveRitualsV1(
  rootSeed: Uint8Array,
  catalogs: DailyRuleCatalogsV1,
): {
  readonly rituals: readonly RitualFact[];
  readonly traces: readonly DailyChoiceTrace[];
} {
  const setSelection = chooseCanonical(
    catalogs.ritualSets,
    "ritual.set.v1",
    rootSeed,
  );
  const rituals: RitualFact[] = [];
  const traces: DailyChoiceTrace[] = [setSelection.trace];
  if (
    setSelection.candidate.value === "COLOR_ONLY" ||
    setSelection.candidate.value === "COLOR_AND_NUMBER"
  ) {
    const color = chooseCanonical(
      catalogs.ritualColors,
      "ritual.color.v1",
      rootSeed,
    );
    rituals.push({
      ritual_id: color.candidate.id,
      kind: "COLOR",
      value: color.candidate.value,
    });
    traces.push(color.trace);
  }
  if (
    setSelection.candidate.value === "NUMBER_ONLY" ||
    setSelection.candidate.value === "COLOR_AND_NUMBER"
  ) {
    const number = chooseCanonical(
      catalogs.ritualNumbers,
      "ritual.number.v1",
      rootSeed,
    );
    rituals.push({
      ritual_id: number.candidate.id,
      kind: "NUMBER",
      value: number.candidate.value,
    });
    traces.push(number.trace);
  }
  return deepFreeze({ rituals, traces });
}

function displayOrderV1(
  focus: StableDimensionId,
  selectedActionId: string,
): readonly StableDimensionId[] {
  const affinity = ACTION_AFFINITY_ORDER_V1[selectedActionId];
  if (affinity === undefined) {
    throw new DeterministicGenerationError("CATALOG_NOT_FOUND");
  }
  return Object.freeze([focus, ...affinity.filter((id) => id !== focus)]);
}

function validateCatalogsV1(catalogs: DailyRuleCatalogsV1): void {
  for (const catalog of [
    catalogs.actions,
    catalogs.ritualColors,
    catalogs.ritualNumbers,
    catalogs.ritualSets,
    catalogs.templates,
  ]) {
    canonicalizeCandidates(catalog);
  }
  for (const action of catalogs.actions) {
    const task = catalogs.tasksByActionId[action.id];
    if (
      task === undefined ||
      task.kind !== action.kind ||
      task.effort !== "VERY_LIGHT" ||
      task.timebox_minutes !== 5 ||
      task.task_id === action.id
    ) {
      throw new DeterministicGenerationError("CATALOG_NOT_FOUND");
    }
  }
}

function validateExpressionPlanV1(
  plan: ControlledExpressionPlanV1,
  snapshot: DailyRuleSnapshot,
  facts: RuleFacts,
): void {
  const parsed = ControlledExpressionPlanV1Schema.safeParse(plan);
  const expectedAction = facts.action_candidates.find(
    ({ action_id }) => action_id === facts.selected_action_id,
  );
  if (
    !parsed.success ||
    expectedAction === undefined ||
    JSON.stringify(plan.required_sections) !==
      JSON.stringify(REQUIRED_SECTIONS) ||
    JSON.stringify(plan.prohibited_claim_classes) !==
      JSON.stringify(PROHIBITED_CLAIM_CLASSES) ||
    JSON.stringify(plan.semantic_slots.selected_action) !==
      JSON.stringify(expectedAction) ||
    JSON.stringify(plan.semantic_slots.optional_task) !==
      JSON.stringify(facts.optional_task_plan) ||
    JSON.stringify(plan.semantic_slots.rituals) !==
      JSON.stringify(facts.ritual_facts) ||
    plan.requested_expression_style !== snapshot.profile.expression_style ||
    plan.resolved_context_slots.length !== 0 ||
    plan.source_dependency_requirements.length !== 0
  ) {
    throw new DeterministicGenerationError("EXPRESSION_PLAN_INVARIANT_FAILED");
  }
}

function ritualFactsMatchCatalogs(
  facts: readonly RitualFact[],
  catalogs: DailyRuleCatalogsV1,
): boolean {
  return facts.every((fact) => {
    const catalog =
      fact.kind === "COLOR" ? catalogs.ritualColors : catalogs.ritualNumbers;
    const definition = catalog.find(({ id }) => id === fact.ritual_id);
    return (
      definition !== undefined &&
      definition.kind === fact.kind &&
      definition.value === fact.value
    );
  });
}

function canonicalDefinitionsById<T extends CanonicalCandidate>(
  catalog: readonly T[],
  ids: readonly string[],
  failureCode: "CATALOG_NOT_FOUND",
): readonly T[] {
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const selected = ids.map((id) => byId.get(id));
  if (selected.some((entry) => entry === undefined)) {
    throw new DeterministicGenerationError(failureCode);
  }
  return canonicalizeCandidates(selected as T[]);
}

function chooseCanonical<T extends CanonicalCandidate>(
  candidates: readonly T[],
  namespace: ChoiceNamespaceV1,
  rootSeed: Uint8Array,
): { readonly candidate: T; readonly trace: DailyChoiceTrace } {
  const canonical = canonicalizeCandidates(candidates);
  const choice = selectNamedIndex({
    candidateCount: canonical.length,
    namespace,
    rootSeed,
  });
  const candidate = canonical[choice.index];
  if (candidate === undefined) {
    throw new DeterministicGenerationError("CHOICE_COUNT_OUT_OF_RANGE");
  }
  return deepFreeze({
    candidate,
    trace: {
      candidateCount: canonical.length,
      ...(canonical.length === 1 ? {} : { counter: choice.counter }),
      hashed: canonical.length !== 1,
      index: choice.index,
      namespace,
    },
  });
}

function dimensionCandidate(id: StableDimensionId): CanonicalCandidate {
  return Object.freeze({ id, rank: DIMENSION_ORDER.indexOf(id) + 1 });
}

function sameObject(
  expected: object,
  actual: object,
  omittedKeys: readonly string[],
): boolean {
  const comparable = Object.fromEntries(
    Object.entries(actual).filter(([key]) => !omittedKeys.includes(key)),
  );
  return JSON.stringify(expected) === JSON.stringify(comparable);
}

function ruleFactsInvariant(): DeterministicGenerationError {
  return new DeterministicGenerationError("RULE_FACTS_INVARIANT_FAILED");
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }
  }
  return value;
}

export const DAILY_ACTION_CATALOG_V1 = ACTIONS_V1;
