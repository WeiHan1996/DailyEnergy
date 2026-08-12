import { z } from "zod";

export const COST_CATEGORIES = [
  "AI_PROVIDER",
  "COMPUTE",
  "POSTGRESQL",
  "REDIS_QUEUE",
  "OBJECT_CDN",
  "OBSERVABILITY",
  "CI_ARTIFACT",
  "WECHAT_PLATFORM",
  "OTHER_APPROVED",
] as const;

const KnownCostEntrySchema = z.strictObject({
  aggregation_revision: z.number().int().positive(),
  amount_micros: z.number().int().nonnegative(),
  cost_category: z.enum(COST_CATEGORIES),
  cost_date: z.iso.date(),
  currency: z.literal("CNY"),
  environment: z.enum(["LOCAL", "CI", "DEV", "STAGING", "PRODUCTION"]),
  model_revision_bucket: z
    .enum(["CURRENT", "PREVIOUS", "OTHER", "UNKNOWN"])
    .optional(),
  outcome: z.enum(["KNOWN", "ESTIMATED"]),
  price_catalog_version: z.string().min(1).max(64),
  provider_code: z.enum(["PRIMARY", "BACKUP", "OTHER"]).optional(),
  service_or_workload: z.enum([
    "API",
    "DAILY",
    "WEEKLY",
    "BACKGROUND",
    "RESTRICTED",
    "TELEMETRY",
    "OTHER",
  ]),
  source_invoice_or_usage_ref: z.string().regex(/^[a-f0-9]{64}$/u),
  unit_price_micros: z.number().int().nonnegative(),
  usage_quantity: z.number().nonnegative(),
  usage_unit: z.enum([
    "TOKEN",
    "REQUEST",
    "SECOND",
    "BYTE_DAY",
    "GB_DAY",
    "MONTH",
    "OTHER",
  ]),
});

const UnknownCostEntrySchema = KnownCostEntrySchema.extend({
  amount_micros: z.null(),
  outcome: z.literal("UNKNOWN"),
  unit_price_micros: z.null(),
  usage_quantity: z.null(),
}).strict();

export const CostEntryV1Schema = z.discriminatedUnion("outcome", [
  KnownCostEntrySchema,
  UnknownCostEntrySchema,
]);

export type CostEntryV1 = z.infer<typeof CostEntryV1Schema>;

export const BudgetEnvelopeV1Schema = z
  .strictObject({
    ai_cost_per_core_active_user_day_cap_micros: z.number().int().nonnegative(),
    approved_by_role: z.enum(["FINANCE_OWNER", "ENGINEERING_OWNER"]),
    approved_total_micros: z.number().int().positive(),
    category_caps: z
      .array(
        z.strictObject({
          category: z.enum(COST_CATEGORIES),
          cap_micros: z.number().int().positive(),
        }),
      )
      .max(COST_CATEGORIES.length),
    currency: z.literal("CNY"),
    effective_at: z.iso.datetime({ offset: true }),
    environment: z.enum(["LOCAL", "CI", "DEV", "STAGING", "PRODUCTION"]),
    expires_at: z.iso.datetime({ offset: true }),
    forecast_model_version: z.string().min(1).max(64),
    hard_limit_ratio: z.literal(1),
    high_limit_ratio: z.literal(0.85),
    owner_role: z.enum(["FINANCE_OWNER", "ENGINEERING_OWNER", "AI_OWNER"]),
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/u),
    soft_limit_ratio: z.literal(0.7),
  })
  .superRefine((value, context) => {
    if (Date.parse(value.effective_at) >= Date.parse(value.expires_at)) {
      context.addIssue({
        code: "custom",
        message: "budget envelope expiry must follow effective time",
        path: ["expires_at"],
      });
    }
    if (
      new Set(value.category_caps.map(({ category }) => category)).size !==
      value.category_caps.length
    ) {
      context.addIssue({
        code: "custom",
        message: "category caps must be unique",
        path: ["category_caps"],
      });
    }
  });

export type BudgetEnvelopeV1 = z.infer<typeof BudgetEnvelopeV1Schema>;

export type BudgetState =
  "OK" | "TICKET" | "PAGE_HIGH" | "HARD_STOP" | "BLOCKED";

export interface BudgetDecision {
  readonly providerCallsAllowed: boolean;
  readonly state: BudgetState;
  readonly templateAllowed: true;
}

export function evaluateBudget(input: {
  readonly actualMicros: number;
  readonly envelope: BudgetEnvelopeV1;
  readonly forecastMicros: number;
  readonly priceCoverageRatio: number;
  readonly unknownRatio: number;
}): BudgetDecision {
  const envelope = BudgetEnvelopeV1Schema.parse(input.envelope);
  const values = [
    input.actualMicros,
    input.forecastMicros,
    input.priceCoverageRatio,
    input.unknownRatio,
  ];
  if (values.some((item) => !Number.isFinite(item) || item < 0)) {
    throw new Error("BUDGET_INPUT_INVALID");
  }
  if (input.unknownRatio > 0.01 || input.priceCoverageRatio < 0.99) {
    return Object.freeze({
      providerCallsAllowed: false,
      state: "BLOCKED",
      templateAllowed: true,
    });
  }
  const consumed =
    Math.max(input.actualMicros, input.forecastMicros) /
    envelope.approved_total_micros;
  if (consumed >= envelope.hard_limit_ratio) {
    return Object.freeze({
      providerCallsAllowed: false,
      state: "HARD_STOP",
      templateAllowed: true,
    });
  }
  if (consumed >= envelope.high_limit_ratio) {
    return Object.freeze({
      providerCallsAllowed: true,
      state: "PAGE_HIGH",
      templateAllowed: true,
    });
  }
  if (consumed >= envelope.soft_limit_ratio) {
    return Object.freeze({
      providerCallsAllowed: true,
      state: "TICKET",
      templateAllowed: true,
    });
  }
  return Object.freeze({
    providerCallsAllowed: true,
    state: "OK",
    templateAllowed: true,
  });
}

export function aggregateCosts(entries: readonly CostEntryV1[]): {
  readonly amountMicros: number | null;
  readonly knownRatio: number;
  readonly state: "READY" | "BLOCKED";
} {
  const parsed = entries.map((entry) => CostEntryV1Schema.parse(entry));
  if (parsed.length === 0) {
    return Object.freeze({
      amountMicros: null,
      knownRatio: 0,
      state: "BLOCKED",
    });
  }
  const known = parsed.filter(({ outcome }) => outcome !== "UNKNOWN");
  const knownRatio = known.length / parsed.length;
  if (knownRatio < 0.99) {
    return Object.freeze({ amountMicros: null, knownRatio, state: "BLOCKED" });
  }
  return Object.freeze({
    amountMicros: known.reduce(
      (total, entry) => total + (entry.amount_micros ?? 0),
      0,
    ),
    knownRatio,
    state: "READY",
  });
}
