import {
  AnalyticsProjectionV1Schema,
  AnonymousDailyAggregateV1Schema,
  type AnalyticsProjectionV1,
  type AnonymousDailyAggregateV1,
} from "@daily-energy/shared-schemas";

export const C015_MINIMUM_ANONYMOUS_CELL_SIZE = 10;
export const C015_MAXIMUM_DIMENSIONS = 2;
export const C015_AGGREGATE_SCHEMA_VERSION =
  "anonymous-daily-aggregate-v1" as const;

export interface TransientAnalyticsObservation {
  readonly projection: AnalyticsProjectionV1;
  readonly subjectKey?: string;
  readonly sumValue?: number;
}

export interface AnalyticsDimensionSelection {
  readonly name: string;
  readonly rareValueParent?: "OTHER";
}

export interface PublishAnonymousAggregateInput {
  readonly aggregationRevision: number;
  readonly dimensions: readonly AnalyticsDimensionSelection[];
  readonly generatedAt: Date;
  readonly observations: readonly TransientAnalyticsObservation[];
  readonly sourceContractVersion: string;
}

interface NormalizedObservation {
  readonly dimensions: Readonly<Record<string, string>>;
  readonly projection: AnalyticsProjectionV1;
  readonly subjectKey?: string;
  readonly sumValue?: number;
}

interface Cell {
  readonly dimensions: readonly {
    readonly code: string;
    readonly name: string;
  }[];
  readonly eventCount: number;
  readonly observations: readonly NormalizedObservation[];
  readonly sumValue?: number;
  readonly uniqueOwnerCount?: number;
}

export function publishAnonymousDailyAggregates(
  input: PublishAnonymousAggregateInput,
): readonly AnonymousDailyAggregateV1[] {
  assertPositiveInteger(input.aggregationRevision, "aggregationRevision");
  if (input.dimensions.length > C015_MAXIMUM_DIMENSIONS) {
    throw new Error("ANALYTICS_DIMENSION_LIMIT");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(input.sourceContractVersion)) {
    throw new Error("ANALYTICS_SOURCE_CONTRACT_INVALID");
  }
  const dimensionNames = new Set(input.dimensions.map(({ name }) => name));
  if (dimensionNames.size !== input.dimensions.length) {
    throw new Error("ANALYTICS_DIMENSION_DUPLICATE");
  }

  const observations = input.observations.map(normalizeObservation);
  if (observations.length === 0) {
    return Object.freeze([]);
  }
  const identityModes = new Set(
    observations.map(({ subjectKey }) =>
      subjectKey === undefined ? "EVENT_COUNT" : "AUTHORITY_OWNER",
    ),
  );
  if (identityModes.size !== 1) {
    throw new Error("ANALYTICS_IDENTITY_MODE_MIXED");
  }
  for (const observation of observations) {
    for (const dimension of input.dimensions) {
      if (observation.dimensions[dimension.name] === undefined) {
        throw new Error(`ANALYTICS_DIMENSION_MISSING:${dimension.name}`);
      }
    }
  }

  const groupedByContract = groupByContract(observations);
  const output: AnonymousDailyAggregateV1[] = [];
  for (const contractObservations of groupedByContract.values()) {
    const selectedCells = selectKSafePartition(
      contractObservations,
      input.dimensions,
    );
    const first = contractObservations[0];
    if (first === undefined) {
      continue;
    }
    const projection = first.projection;
    for (const cell of selectedCells) {
      const aggregate: AnonymousDailyAggregateV1 = {
        aggregate_schema_version: C015_AGGREGATE_SCHEMA_VERSION,
        aggregation_revision: input.aggregationRevision,
        dimensions: cell.dimensions.map(({ code, name }) => ({ code, name })),
        environment: projection.environment,
        event_count: cell.eventCount,
        event_name: projection.event_name,
        event_schema_version: projection.event_schema_version,
        expires_at: aggregateExpiry(projection.product_date).toISOString(),
        generated_at: input.generatedAt.toISOString(),
        plane: projection.plane,
        product_date: projection.product_date,
        source_contract_version: input.sourceContractVersion,
        ...(cell.sumValue === undefined ? {} : { sum_value: cell.sumValue }),
        ...(cell.uniqueOwnerCount === undefined
          ? {}
          : { unique_owner_count: cell.uniqueOwnerCount }),
      };
      assertNoForbiddenAnalyticsContent(aggregate);
      output.push(AnonymousDailyAggregateV1Schema.parse(aggregate));
    }
  }
  return Object.freeze(
    output.sort((left, right) =>
      aggregateKey(left).localeCompare(aggregateKey(right)),
    ),
  );
}

function normalizeObservation(
  input: TransientAnalyticsObservation,
): NormalizedObservation {
  const projection = AnalyticsProjectionV1Schema.parse(input.projection);
  if (input.subjectKey !== undefined && input.subjectKey.length === 0) {
    throw new Error("ANALYTICS_TRANSIENT_SUBJECT_INVALID");
  }
  if (
    input.sumValue !== undefined &&
    (!Number.isSafeInteger(input.sumValue) || input.sumValue < 0)
  ) {
    throw new Error("ANALYTICS_SUM_VALUE_INVALID");
  }
  const dimensions = Object.fromEntries(
    Object.entries({
      ...(projection.app_version_bucket === undefined
        ? {}
        : { app_version_bucket: projection.app_version_bucket }),
      ...(projection.locale_bucket === undefined
        ? {}
        : { locale_bucket: projection.locale_bucket }),
      ...(projection.event_properties ?? {}),
    }).flatMap(([name, value]) =>
      typeof value === "string" || typeof value === "boolean"
        ? [[name, String(value).toUpperCase()]]
        : [],
    ),
  );
  return Object.freeze({
    dimensions: Object.freeze(dimensions),
    projection,
    ...(input.subjectKey === undefined ? {} : { subjectKey: input.subjectKey }),
    ...(input.sumValue === undefined ? {} : { sumValue: input.sumValue }),
  });
}

function groupByContract(
  observations: readonly NormalizedObservation[],
): ReadonlyMap<string, readonly NormalizedObservation[]> {
  const groups = new Map<string, NormalizedObservation[]>();
  for (const observation of observations) {
    const projection = observation.projection;
    const key = [
      projection.product_date,
      projection.environment,
      projection.plane,
      projection.event_name,
      projection.event_schema_version,
    ].join("|");
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }
  return groups;
}

function selectKSafePartition(
  observations: readonly NormalizedObservation[],
  requested: readonly AnalyticsDimensionSelection[],
): readonly Cell[] {
  for (let count = requested.length; count >= 0; count -= 1) {
    const dimensions = requested.slice(0, count);
    const normalized = normalizeRareValues(observations, dimensions);
    const cells = cellsFor(normalized, dimensions);
    if (cells.length > 0 && cells.every(isKSafe)) {
      return cells;
    }
  }
  return [];
}

function normalizeRareValues(
  observations: readonly NormalizedObservation[],
  dimensions: readonly AnalyticsDimensionSelection[],
): readonly NormalizedObservation[] {
  let current = observations;
  for (const dimension of dimensions) {
    if (dimension.rareValueParent !== "OTHER") {
      continue;
    }
    const byValue = new Map<string, NormalizedObservation[]>();
    for (const observation of current) {
      const value = observation.dimensions[dimension.name];
      if (value === undefined) {
        continue;
      }
      const group = byValue.get(value) ?? [];
      group.push(observation);
      byValue.set(value, group);
    }
    const rare = new Set(
      [...byValue.entries()]
        .filter(([, group]) => !isKSafe(cellFrom(group, [])))
        .map(([value]) => value),
    );
    current = current.map((observation) => {
      const value = observation.dimensions[dimension.name];
      if (value === undefined || !rare.has(value)) {
        return observation;
      }
      return Object.freeze({
        ...observation,
        dimensions: Object.freeze({
          ...observation.dimensions,
          [dimension.name]: "OTHER",
        }),
      });
    });
  }
  return current;
}

function cellsFor(
  observations: readonly NormalizedObservation[],
  dimensions: readonly AnalyticsDimensionSelection[],
): readonly Cell[] {
  const groups = new Map<string, NormalizedObservation[]>();
  for (const observation of observations) {
    const codes = dimensions.map(
      ({ name }) => observation.dimensions[name] ?? "MISSING",
    );
    const key = JSON.stringify(codes);
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) =>
    cellFrom(
      group,
      dimensions.map(({ name }) => ({
        code: group[0]?.dimensions[name] ?? "MISSING",
        name,
      })),
    ),
  );
}

function cellFrom(
  observations: readonly NormalizedObservation[],
  dimensions: readonly { readonly code: string; readonly name: string }[],
): Cell {
  const subjectKeys = observations.flatMap(({ subjectKey }) =>
    subjectKey === undefined ? [] : [subjectKey],
  );
  const sumValues = observations.flatMap(({ sumValue }) =>
    sumValue === undefined ? [] : [sumValue],
  );
  return Object.freeze({
    dimensions,
    eventCount: observations.length,
    observations,
    ...(sumValues.length === 0
      ? {}
      : { sumValue: sumValues.reduce((total, value) => total + value, 0) }),
    ...(subjectKeys.length === 0
      ? {}
      : { uniqueOwnerCount: new Set(subjectKeys).size }),
  });
}

function isKSafe(cell: Cell): boolean {
  return (
    (cell.uniqueOwnerCount ?? cell.eventCount) >=
    C015_MINIMUM_ANONYMOUS_CELL_SIZE
  );
}

function aggregateExpiry(productDate: string): Date {
  const [year, month, day] = productDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error("ANALYTICS_PRODUCT_DATE_INVALID");
  }
  const targetMonthIndex = month - 1 + 13;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
}

const forbiddenKey =
  /(?:account|owner|subject|openid|unionid|phone|token|ip|device|session|cookie|request|command|result_ref|intent_ref|task_ref|matter_ref|feedback_ref|share_ref|safety_event|source_ref|grant_ref|dependency|epoch|fingerprint|prompt|text|body|payload|note|title)/iu;
const approvedAggregateKeys = new Set(["unique_owner_count"]);

export function assertNoForbiddenAnalyticsContent(value: unknown): void {
  visit(value, []);
}

function visit(value: unknown, path: readonly string[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visit(entry, [...path, String(index)]));
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (forbiddenKey.test(key) && !approvedAggregateKeys.has(key)) {
      throw new Error(`ANALYTICS_FORBIDDEN_FIELD:${[...path, key].join(".")}`);
    }
    visit(entry, [...path, key]);
  }
}

function aggregateKey(value: AnonymousDailyAggregateV1): string {
  return JSON.stringify([
    value.product_date,
    value.environment,
    value.plane,
    value.event_name,
    value.dimensions,
  ]);
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`ANALYTICS_POSITIVE_INTEGER_REQUIRED:${field}`);
  }
}
