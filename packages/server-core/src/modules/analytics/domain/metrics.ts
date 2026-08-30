import {
  MetricGateReportV1Schema,
  MetricIdValues,
  MetricReportV1Schema,
  type MetricGateReportV1,
  type MetricReportV1,
} from "@daily-energy/shared-schemas";

export interface OwnerDateFact {
  readonly ownerKey: string;
  readonly productDate: string;
}

export interface ResultFact extends OwnerDateFact {
  readonly generationMode: "AI" | "CONTROLLED_TEMPLATE";
  readonly latencyBucket:
    | "LT_250MS"
    | "250_999MS"
    | "1_2_99S"
    | "3_7_99S"
    | "8_14_99S"
    | "GE_15S"
    | "UNKNOWN";
}

export interface EncounterFact extends OwnerDateFact {
  readonly cycleKey: string;
}

export interface InteractionFinalFact extends OwnerDateFact {
  readonly evaluable: boolean;
  readonly hasTask: boolean;
  readonly helpfulness?: "HELPFUL" | "NEUTRAL" | "NOT_HELPFUL" | "NOT_USED";
  readonly taskStatus: "UNMARKED" | "INTERESTED" | "COMPLETED" | "SKIPPED";
}

export interface GatewayUsageFact {
  readonly costMicros?: number;
  readonly generationMode: "AI" | "CONTROLLED_TEMPLATE";
  readonly productDate: string;
  readonly terminal: boolean;
  readonly usageOutcome: "KNOWN" | "UNKNOWN";
  readonly workload: "DAILY" | "WEEKLY";
}

export interface ClientSignalDailyCount {
  readonly eventCount: number;
  readonly eventName:
    "landing_viewed" | "landing_primary_action_clicked" | "weekly_summary_read";
  readonly productDate: string;
}

export interface MetricSourceSnapshot {
  readonly checkins: readonly OwnerDateFact[];
  readonly clientSignalCounts: readonly ClientSignalDailyCount[];
  readonly encounters: readonly EncounterFact[];
  readonly evenings: readonly OwnerDateFact[];
  readonly gatewayUsage: readonly GatewayUsageFact[];
  readonly interactions: readonly InteractionFinalFact[];
  readonly lights: readonly OwnerDateFact[];
  readonly newConsentOwners: readonly OwnerDateFact[];
  readonly onboardings: readonly OwnerDateFact[];
  readonly results: readonly ResultFact[];
  readonly shareIntents: readonly OwnerDateFact[];
}

export interface ComputeMetricInput {
  readonly aggregationRevision: number;
  readonly finalizedProductDate: string;
  readonly generatedAt: Date;
  readonly reportProductDate: string;
  readonly source: MetricSourceSnapshot;
  readonly sourceContractVersion: string;
}

interface Ratio {
  readonly denominator: number;
  readonly numerator: number;
  readonly notes?: readonly MetricReportV1["notes_code"][number][];
  readonly valueOverride?: number;
  readonly wilsonEligible?: boolean;
}

export interface MetricGateInput {
  readonly aggregationRevision: number;
  readonly contractFailureCount: number;
  readonly deletionOrTtlBreachCount: number;
  readonly generatedAt: Date;
  readonly rawContentMatchCount: number;
  readonly smallCellOrJoinPathFailureCount: number;
}

export function computeC015MetricReports(
  input: ComputeMetricInput,
): readonly MetricReportV1[] {
  assertMetricInput(input);
  const source = normalizeSource(input.source);
  const date = input.reportProductDate;
  const checkins = ownerSet(source.checkins, date);
  const onboardings = ownerSet(source.onboardings, date);
  const newConsent = ownerSet(source.newConsentOwners, date);
  const results = source.results.filter(
    ({ productDate }) => productDate === date,
  );
  const resultOwners = new Set(results.map(({ ownerKey }) => ownerKey));
  const lights = ownerSet(source.lights, date);
  const evenings = ownerSet(source.evenings, date);
  const coreActive = new Set([...checkins, ...lights, ...evenings]);
  const interactions = source.interactions.filter(
    ({ evaluable, productDate }) => evaluable && productDate === date,
  );
  const cycles = cyclesFor(source.encounters, date, input.finalizedProductDate);
  const mature = (offset: number) =>
    cycles.filter(
      ({ d0 }) => addProductDays(d0, offset) < input.finalizedProductDate,
    );
  const retained = (offset: number) =>
    mature(offset).filter(({ dates }) =>
      dates.has(addProductDays(date, offset)),
    );
  const d6Mature = mature(6);
  const d7Mature = mature(7);
  const clientCount = (eventName: ClientSignalDailyCount["eventName"]) =>
    source.clientSignalCounts
      .filter(
        (entry) => entry.eventName === eventName && entry.productDate === date,
      )
      .reduce((sum, entry) => sum + entry.eventCount, 0);
  const terminalDaily = source.gatewayUsage.filter(
    (entry) =>
      entry.productDate === date &&
      entry.workload === "DAILY" &&
      entry.terminal,
  );
  const fastAiResults = results.filter(
    ({ generationMode, latencyBucket }) =>
      generationMode === "AI" &&
      ["LT_250MS", "250_999MS", "1_2_99S", "3_7_99S"].includes(latencyBucket),
  );
  const knownLatencyAiResults = results.filter(
    ({ generationMode, latencyBucket }) =>
      generationMode === "AI" && latencyBucket !== "UNKNOWN",
  );
  const knownDailyUsage = terminalDaily.filter(
    ({ usageOutcome }) => usageOutcome === "KNOWN",
  );
  const costMicros = knownDailyUsage.reduce(
    (sum, { costMicros }) => sum + (costMicros ?? 0),
    0,
  );

  const ratios = new Map<(typeof MetricIdValues)[number], Ratio>([
    [
      "S25-M01",
      {
        denominator: clientCount("landing_viewed"),
        numerator: clientCount("landing_primary_action_clicked"),
        notes: ["BEST_EFFORT_SIGNAL"],
        wilsonEligible: false,
      },
    ],
    [
      "S25-M02",
      {
        denominator: newConsent.size,
        numerator: intersectionSize(newConsent, onboardings),
      },
    ],
    [
      "S25-M03",
      {
        denominator: onboardings.size,
        numerator: intersectionSize(onboardings, checkins),
      },
    ],
    [
      "S25-M04",
      {
        denominator: checkins.size,
        numerator: intersectionSize(checkins, resultOwners),
        notes: ["TEMPLATE_INCLUDED"],
      },
    ],
    [
      "S25-M05",
      {
        denominator: cycles.filter(({ ownerKey }) => resultOwners.has(ownerKey))
          .length,
        numerator: cycles.filter(
          ({ ownerKey }) => resultOwners.has(ownerKey) && lights.has(ownerKey),
        ).length,
        notes: ["TEMPLATE_INCLUDED"],
      },
    ],
    [
      "S25-M06",
      {
        denominator: newConsent.size,
        numerator: intersectionSize(newConsent, lights),
      },
    ],
    retentionRatio("S25-M07", retained(1), mature(1)),
    retentionRatio("S25-M08", retained(3), mature(3)),
    retentionRatio("S25-M09", retained(7), mature(7)),
    [
      "S25-M10",
      cycleRatio(
        d6Mature.filter(({ dates, d0 }) => allOffsets(dates, d0, [0, 1, 2])),
        mature(2),
      ),
    ],
    [
      "S25-M11",
      cycleRatio(
        d6Mature.filter(({ dates, d0 }) =>
          allOffsets(dates, d0, [0, 1, 2, 3, 4, 5, 6]),
        ),
        d6Mature,
      ),
    ],
    [
      "S25-M12",
      cycleRatio(
        d6Mature.filter(({ dates, d0 }) => countInWindow(dates, d0, 6) >= 3),
        d6Mature,
      ),
    ],
    [
      "S25-M13",
      cycleRatio(
        d6Mature.filter(({ ownerKey, d0 }) =>
          source.evenings.some(
            (fact) =>
              fact.ownerKey === ownerKey &&
              fact.productDate >= d0 &&
              fact.productDate <= addProductDays(d0, 6),
          ),
        ),
        d6Mature,
      ),
    ],
    [
      "S25-M14",
      {
        denominator: interactions.length,
        numerator: interactions.filter(
          ({ helpfulness }) => helpfulness !== undefined,
        ).length,
      },
    ],
    [
      "S25-M15",
      {
        denominator: interactions.filter(({ helpfulness }) =>
          ["HELPFUL", "NEUTRAL", "NOT_HELPFUL"].includes(helpfulness ?? ""),
        ).length,
        numerator: interactions.filter(
          ({ helpfulness }) => helpfulness === "HELPFUL",
        ).length,
      },
    ],
    [
      "S25-M16",
      {
        denominator: interactions.filter(({ hasTask }) => hasTask).length,
        numerator: interactions.filter(
          ({ hasTask, taskStatus }) =>
            hasTask && ["INTERESTED", "COMPLETED"].includes(taskStatus),
        ).length,
      },
    ],
    [
      "S25-M17",
      {
        denominator: interactions.filter(({ taskStatus }) =>
          ["INTERESTED", "COMPLETED"].includes(taskStatus),
        ).length,
        numerator: interactions.filter(
          ({ taskStatus }) => taskStatus === "COMPLETED",
        ).length,
      },
    ],
    [
      "S25-M18",
      {
        denominator: d7Mature.length,
        numerator: clientCount("weekly_summary_read"),
        notes: ["BEST_EFFORT_SIGNAL"],
        wilsonEligible: false,
      },
    ],
    [
      "S25-M19",
      {
        denominator: coreActive.size,
        numerator: new Set(
          source.shareIntents
            .filter(({ productDate }) => productDate === date)
            .map(({ ownerKey }) => ownerKey),
        ).size,
      },
    ],
    [
      "S25-M20",
      {
        denominator: knownLatencyAiResults.length,
        numerator: fastAiResults.length,
      },
    ],
    [
      "S25-M21",
      {
        denominator: results.length,
        numerator: results.filter(
          ({ generationMode }) => generationMode === "CONTROLLED_TEMPLATE",
        ).length,
        notes: ["TEMPLATE_INCLUDED"],
      },
    ],
    [
      "S25-M22",
      {
        denominator: coreActive.size,
        numerator: costMicros,
        valueOverride:
          coreActive.size === 0 ? 0 : costMicros / 1_000_000 / coreActive.size,
        wilsonEligible: false,
      },
    ],
    [
      "S25-M23",
      {
        denominator: terminalDaily.length,
        numerator: knownDailyUsage.length,
      },
    ],
  ]);

  return Object.freeze(
    MetricIdValues.map((metricId) =>
      reportFor(metricId, ratios.get(metricId)!, input),
    ),
  );
}

export function computeC015MetricGates(
  input: MetricGateInput,
): readonly MetricGateReportV1[] {
  const definitions = [
    ["S25-G01", input.contractFailureCount, "CONTRACT_FAILURE"],
    ["S25-G02", input.rawContentMatchCount, "RAW_CONTENT_MATCH"],
    [
      "S25-G03",
      input.smallCellOrJoinPathFailureCount,
      "SMALL_CELL_OR_JOIN_PATH",
    ],
    ["S25-G04", input.deletionOrTtlBreachCount, "DELETION_OR_TTL_BREACH"],
  ] as const;
  return Object.freeze(
    definitions.map(([gateId, failureCount, reason]) =>
      MetricGateReportV1Schema.parse({
        aggregation_revision: input.aggregationRevision,
        gate_id: gateId,
        generated_at: input.generatedAt.toISOString(),
        reason_codes: failureCount === 0 ? [] : [reason],
        status: failureCount === 0 ? "PASS" : "BLOCKED",
      }),
    ),
  );
}

export function wilson95(numerator: number, denominator: number) {
  if (denominator <= 0 || numerator < 0 || numerator > denominator) {
    throw new Error("METRIC_WILSON_INPUT_INVALID");
  }
  const z = 1.96;
  const p = numerator / denominator;
  const denominatorAdjustment = 1 + (z * z) / denominator;
  const center = (p + (z * z) / (2 * denominator)) / denominatorAdjustment;
  const margin =
    (z / denominatorAdjustment) *
    Math.sqrt(
      (p * (1 - p)) / denominator + (z * z) / (4 * denominator * denominator),
    );
  return Object.freeze({
    high: Math.min(1, center + margin),
    low: Math.max(0, center - margin),
  });
}

function reportFor(
  metricId: (typeof MetricIdValues)[number],
  ratio: Ratio,
  input: ComputeMetricInput,
): MetricReportV1 {
  const base = {
    aggregation_revision: input.aggregationRevision,
    dimensions: [],
    expires_at: expiry(input.reportProductDate).toISOString(),
    generated_at: input.generatedAt.toISOString(),
    metric_id: metricId,
    metric_version: 1,
    notes_code: [
      ...(ratio.notes ?? []),
      "POST_AGGREGATION_DELETION_NOT_RESTATED" as const,
    ],
    period_or_cohort: input.reportProductDate,
    source_contract_version: input.sourceContractVersion,
  } as const;
  if (ratio.denominator < 10) {
    return MetricReportV1Schema.parse({ ...base, status: "SUPPRESSED" });
  }
  const value =
    ratio.valueOverride ?? ratio.numerator / Math.max(1, ratio.denominator);
  const interval =
    ratio.wilsonEligible === false || ratio.numerator > ratio.denominator
      ? undefined
      : wilson95(ratio.numerator, ratio.denominator);
  return MetricReportV1Schema.parse({
    ...base,
    denominator: ratio.denominator,
    numerator: ratio.numerator,
    status:
      input.reportProductDate < input.finalizedProductDate
        ? "FINALIZED"
        : "PROVISIONAL",
    value,
    ...(interval === undefined
      ? {}
      : { wilson_high: interval.high, wilson_low: interval.low }),
  });
}

function normalizeSource(source: MetricSourceSnapshot): MetricSourceSnapshot {
  for (const collection of [
    source.checkins,
    source.encounters,
    source.evenings,
    source.interactions,
    source.lights,
    source.newConsentOwners,
    source.onboardings,
    source.results,
    source.shareIntents,
  ]) {
    for (const fact of collection) {
      if (!fact.ownerKey || !/^\d{4}-\d{2}-\d{2}$/u.test(fact.productDate)) {
        throw new Error("METRIC_TRANSIENT_SOURCE_INVALID");
      }
    }
  }
  return source;
}

function ownerSet(facts: readonly OwnerDateFact[], date: string): Set<string> {
  return new Set(
    facts
      .filter(({ productDate }) => productDate === date)
      .map(({ ownerKey }) => ownerKey),
  );
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  return [...left].filter((value) => right.has(value)).length;
}

function cyclesFor(
  encounters: readonly EncounterFact[],
  cohortDate: string,
  _finalizedProductDate: string,
) {
  const cycles = new Map<string, { dates: Set<string>; ownerKey: string }>();
  for (const encounter of encounters) {
    const current = cycles.get(encounter.cycleKey) ?? {
      dates: new Set<string>(),
      ownerKey: encounter.ownerKey,
    };
    if (current.ownerKey !== encounter.ownerKey) {
      throw new Error("METRIC_CYCLE_OWNER_CONFLICT");
    }
    current.dates.add(encounter.productDate);
    cycles.set(encounter.cycleKey, current);
  }
  return [...cycles.entries()]
    .map(([cycleKey, { dates, ownerKey }]) => ({
      cycleKey,
      d0: [...dates].sort()[0]!,
      dates,
      ownerKey,
    }))
    .filter(({ d0 }) => d0 === cohortDate);
}

function retentionRatio(
  metricId: "S25-M07" | "S25-M08" | "S25-M09",
  retained: readonly unknown[],
  mature: readonly unknown[],
): readonly [typeof metricId, Ratio] {
  return [metricId, cycleRatio(retained, mature)];
}

function cycleRatio(
  numerator: readonly unknown[],
  denominator: readonly unknown[],
): Ratio {
  return { denominator: denominator.length, numerator: numerator.length };
}

function allOffsets(
  dates: ReadonlySet<string>,
  d0: string,
  offsets: readonly number[],
): boolean {
  return offsets.every((offset) => dates.has(addProductDays(d0, offset)));
}

function countInWindow(
  dates: ReadonlySet<string>,
  d0: string,
  lastOffset: number,
): number {
  return [...dates].filter(
    (date) => date >= d0 && date <= addProductDays(d0, lastOffset),
  ).length;
}

function addProductDays(productDate: string, days: number): string {
  const date = new Date(`${productDate}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) {
    throw new Error("METRIC_PRODUCT_DATE_INVALID");
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function expiry(productDate: string): Date {
  const date = new Date(`${productDate}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 13);
  return date;
}

function assertMetricInput(input: ComputeMetricInput): void {
  if (
    !Number.isSafeInteger(input.aggregationRevision) ||
    input.aggregationRevision <= 0
  ) {
    throw new Error("METRIC_AGGREGATION_REVISION_INVALID");
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(input.reportProductDate) ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(input.finalizedProductDate)
  ) {
    throw new Error("METRIC_PRODUCT_DATE_INVALID");
  }
}
