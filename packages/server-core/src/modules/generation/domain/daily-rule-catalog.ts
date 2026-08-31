import type {
  Band,
  RuleFacts,
  StableDimensionId,
} from "@daily-energy/shared-schemas";

import type { CanonicalCandidate } from "./seed.js";

export type ActionCandidate = RuleFacts["action_candidates"][number];
export type OptionalTaskPlan = RuleFacts["optional_task_plan"];
export type RitualFact = RuleFacts["ritual_facts"][number];

export interface ActionDefinition extends CanonicalCandidate {
  readonly constraintToken: string;
  readonly effort: ActionCandidate["effort"];
  readonly kind: ActionCandidate["kind"];
  readonly targetScope: string;
  readonly timeboxMinutes: number;
}

export interface RitualSetDefinition extends CanonicalCandidate {
  readonly value: "NONE" | "COLOR_ONLY" | "NUMBER_ONLY" | "COLOR_AND_NUMBER";
}

export interface ColorRitualDefinition extends CanonicalCandidate {
  readonly kind: "COLOR";
  readonly value: string;
}

export interface NumberRitualDefinition extends CanonicalCandidate {
  readonly kind: "NUMBER";
  readonly value: number;
}

export interface TemplateDefinition extends CanonicalCandidate {}

export interface DailyRuleCatalogsV1 {
  readonly actions: readonly ActionDefinition[];
  readonly ritualColors: readonly ColorRitualDefinition[];
  readonly ritualNumbers: readonly NumberRitualDefinition[];
  readonly ritualSets: readonly RitualSetDefinition[];
  readonly tasksByActionId: Readonly<Record<string, OptionalTaskPlan>>;
  readonly templates: readonly TemplateDefinition[];
}

export const DIMENSION_ORDER = Object.freeze([
  "pace",
  "action",
  "connection",
  "resources",
  "recovery",
] as const satisfies readonly StableDimensionId[]);

export const ACTIONS_V1 = deepFreeze([
  {
    id: "action.prioritize-one.v1",
    rank: 1,
    kind: "PRIORITIZE_ONE",
    targetScope: "ONE_PRIORITY",
    effort: "VERY_LIGHT",
    timeboxMinutes: 10,
    constraintToken: "ONE_PRIORITY",
  },
  {
    id: "action.prepare-one-step.v1",
    rank: 2,
    kind: "PREPARE_ONE_STEP",
    targetScope: "ONE_NEXT_STEP",
    effort: "LIGHT",
    timeboxMinutes: 15,
    constraintToken: "STOP_AFTER_FIRST_STEP",
  },
  {
    id: "action.communicate-clearly.v1",
    rank: 3,
    kind: "COMMUNICATE_CLEARLY",
    targetScope: "ONE_CONVERSATION",
    effort: "LIGHT",
    timeboxMinutes: 10,
    constraintToken: "ONE_CLEAR_POINT",
  },
  {
    id: "action.reduce-switching.v1",
    rank: 4,
    kind: "REDUCE_SWITCHING",
    targetScope: "ONE_FOCUS_BLOCK",
    effort: "VERY_LIGHT",
    timeboxMinutes: 10,
    constraintToken: "NO_MULTITASKING",
  },
  {
    id: "action.organize-small-scope.v1",
    rank: 5,
    kind: "ORGANIZE_SMALL_SCOPE",
    targetScope: "ONE_SMALL_SCOPE",
    effort: "VERY_LIGHT",
    timeboxMinutes: 10,
    constraintToken: "STOP_AT_TIMEBOX",
  },
  {
    id: "action.pause-and-recover.v1",
    rank: 6,
    kind: "PAUSE_AND_RECOVER",
    targetScope: "ONE_SHORT_PAUSE",
    effort: "VERY_LIGHT",
    timeboxMinutes: 10,
    constraintToken: "NO_PERFORMANCE_GOAL",
  },
  {
    id: "action.reflect-briefly.v1",
    rank: 7,
    kind: "REFLECT_BRIEFLY",
    targetScope: "ONE_SENTENCE",
    effort: "VERY_LIGHT",
    timeboxMinutes: 5,
    constraintToken: "ONE_SENTENCE_ONLY",
  },
  {
    id: "action.seek-real-support.v1",
    rank: 8,
    kind: "SEEK_REAL_SUPPORT",
    targetScope: "ONE_TRUSTED_PERSON",
    effort: "VERY_LIGHT",
    timeboxMinutes: 10,
    constraintToken: "ASK_ONE_SMALL_THING",
  },
] as const satisfies readonly ActionDefinition[]);

export const TASKS_BY_ACTION_ID_V1 = deepFreeze({
  "action.prioritize-one.v1": {
    task_id: "task.write-one-priority.v1",
    kind: "PRIORITIZE_ONE",
    effort: "VERY_LIGHT",
    timebox_minutes: 5,
  },
  "action.prepare-one-step.v1": {
    task_id: "task.name-first-step.v1",
    kind: "PREPARE_ONE_STEP",
    effort: "VERY_LIGHT",
    timebox_minutes: 5,
  },
  "action.communicate-clearly.v1": {
    task_id: "task.write-one-clear-point.v1",
    kind: "COMMUNICATE_CLEARLY",
    effort: "VERY_LIGHT",
    timebox_minutes: 5,
  },
  "action.reduce-switching.v1": {
    task_id: "task.close-one-distraction.v1",
    kind: "REDUCE_SWITCHING",
    effort: "VERY_LIGHT",
    timebox_minutes: 5,
  },
  "action.organize-small-scope.v1": {
    task_id: "task.put-away-one-item.v1",
    kind: "ORGANIZE_SMALL_SCOPE",
    effort: "VERY_LIGHT",
    timebox_minutes: 5,
  },
  "action.pause-and-recover.v1": {
    task_id: "task.take-one-short-pause.v1",
    kind: "PAUSE_AND_RECOVER",
    effort: "VERY_LIGHT",
    timebox_minutes: 5,
  },
  "action.reflect-briefly.v1": {
    task_id: "task.note-one-word.v1",
    kind: "REFLECT_BRIEFLY",
    effort: "VERY_LIGHT",
    timebox_minutes: 5,
  },
  "action.seek-real-support.v1": {
    task_id: "task.choose-one-trusted-person.v1",
    kind: "SEEK_REAL_SUPPORT",
    effort: "VERY_LIGHT",
    timebox_minutes: 5,
  },
} as const satisfies Readonly<Record<string, OptionalTaskPlan>>);

export const FOCUS_ACTION_IDS_V1: Readonly<
  Record<StableDimensionId, Readonly<Record<Band, readonly string[]>>>
> = deepFreeze({
  pace: {
    LOW: [
      "action.prioritize-one.v1",
      "action.reduce-switching.v1",
      "action.pause-and-recover.v1",
    ],
    STEADY: [
      "action.prioritize-one.v1",
      "action.prepare-one-step.v1",
      "action.reduce-switching.v1",
    ],
    HIGH: [
      "action.prepare-one-step.v1",
      "action.prioritize-one.v1",
      "action.organize-small-scope.v1",
    ],
  },
  action: {
    LOW: [
      "action.prioritize-one.v1",
      "action.reduce-switching.v1",
      "action.pause-and-recover.v1",
    ],
    STEADY: [
      "action.prepare-one-step.v1",
      "action.prioritize-one.v1",
      "action.organize-small-scope.v1",
    ],
    HIGH: [
      "action.prepare-one-step.v1",
      "action.prioritize-one.v1",
      "action.organize-small-scope.v1",
    ],
  },
  connection: {
    LOW: ["action.reflect-briefly.v1", "action.seek-real-support.v1"],
    STEADY: [
      "action.communicate-clearly.v1",
      "action.reflect-briefly.v1",
      "action.prepare-one-step.v1",
    ],
    HIGH: [
      "action.communicate-clearly.v1",
      "action.prepare-one-step.v1",
      "action.reflect-briefly.v1",
    ],
  },
  resources: {
    LOW: [
      "action.prioritize-one.v1",
      "action.reduce-switching.v1",
      "action.organize-small-scope.v1",
    ],
    STEADY: [
      "action.organize-small-scope.v1",
      "action.prioritize-one.v1",
      "action.prepare-one-step.v1",
    ],
    HIGH: [
      "action.organize-small-scope.v1",
      "action.prioritize-one.v1",
      "action.prepare-one-step.v1",
    ],
  },
  recovery: {
    LOW: ["action.pause-and-recover.v1"],
    STEADY: [
      "action.pause-and-recover.v1",
      "action.reflect-briefly.v1",
      "action.reduce-switching.v1",
    ],
    HIGH: [
      "action.pause-and-recover.v1",
      "action.reflect-briefly.v1",
      "action.reduce-switching.v1",
    ],
  },
});

export const ALL_UNSURE_ACTION_IDS_V1 = Object.freeze([
  "action.prioritize-one.v1",
  "action.pause-and-recover.v1",
  "action.reflect-briefly.v1",
]);

export const ACTION_AFFINITY_ORDER_V1: Readonly<
  Record<string, readonly StableDimensionId[]>
> = deepFreeze({
  "action.prioritize-one.v1": [
    "resources",
    "action",
    "pace",
    "recovery",
    "connection",
  ],
  "action.prepare-one-step.v1": [
    "action",
    "resources",
    "pace",
    "recovery",
    "connection",
  ],
  "action.communicate-clearly.v1": [
    "connection",
    "pace",
    "resources",
    "action",
    "recovery",
  ],
  "action.reduce-switching.v1": [
    "pace",
    "resources",
    "action",
    "recovery",
    "connection",
  ],
  "action.organize-small-scope.v1": [
    "resources",
    "pace",
    "action",
    "recovery",
    "connection",
  ],
  "action.pause-and-recover.v1": [
    "recovery",
    "pace",
    "action",
    "resources",
    "connection",
  ],
  "action.reflect-briefly.v1": [
    "recovery",
    "connection",
    "pace",
    "action",
    "resources",
  ],
  "action.seek-real-support.v1": [
    "connection",
    "recovery",
    "action",
    "pace",
    "resources",
  ],
});

export const RITUAL_SETS_V1 = deepFreeze([
  { id: "ritual-set.none.v1", rank: 0, value: "NONE" },
  { id: "ritual-set.color-only.v1", rank: 1, value: "COLOR_ONLY" },
  { id: "ritual-set.number-only.v1", rank: 2, value: "NUMBER_ONLY" },
  {
    id: "ritual-set.color-and-number.v1",
    rank: 3,
    value: "COLOR_AND_NUMBER",
  },
] as const satisfies readonly RitualSetDefinition[]);

export const RITUAL_COLORS_V1 = deepFreeze([
  {
    id: "ritual.color.mist-blue.v1",
    rank: 1,
    kind: "COLOR",
    value: "MIST_BLUE",
  },
  {
    id: "ritual.color.warm-beige.v1",
    rank: 2,
    kind: "COLOR",
    value: "WARM_BEIGE",
  },
  {
    id: "ritual.color.sage-green.v1",
    rank: 3,
    kind: "COLOR",
    value: "SAGE_GREEN",
  },
  {
    id: "ritual.color.soft-lilac.v1",
    rank: 4,
    kind: "COLOR",
    value: "SOFT_LILAC",
  },
  {
    id: "ritual.color.cloud-gray.v1",
    rank: 5,
    kind: "COLOR",
    value: "CLOUD_GRAY",
  },
] as const satisfies readonly ColorRitualDefinition[]);

export const RITUAL_NUMBERS_V1 = deepFreeze(
  Array.from({ length: 9 }, (_value, index) => ({
    id: `ritual.number.${index + 1}.v1`,
    rank: index + 1,
    kind: "NUMBER" as const,
    value: index + 1,
  })),
);

export const TEMPLATES_V1 = deepFreeze([
  { id: "template.focus-first.v1", rank: 1 },
  { id: "template.care-then-step.v1", rank: 2 },
  { id: "template.support-then-focus.v1", rank: 3 },
] as const satisfies readonly TemplateDefinition[]);

export const DAILY_RULE_CATALOGS_V1: DailyRuleCatalogsV1 = deepFreeze({
  actions: ACTIONS_V1,
  ritualColors: RITUAL_COLORS_V1,
  ritualNumbers: RITUAL_NUMBERS_V1,
  ritualSets: RITUAL_SETS_V1,
  tasksByActionId: TASKS_BY_ACTION_ID_V1,
  templates: TEMPLATES_V1,
});

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }
  }
  return value;
}
