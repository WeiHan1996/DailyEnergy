import { OpaqueIdSchema } from "@daily-energy/shared-schemas";

import {
  addProductDateDays,
  parseProductDate,
  type ProductDate,
} from "../../product-time/public/index.js";
import {
  effectiveMatterState,
  type MatterState,
} from "../../matter/public/index.js";

export const MEMORY_MATTER_SELECTION_POLICY_VERSION = "memory-policy-v1";

export interface DailyMatterSourceV1 {
  readonly ownerRef: string;
  readonly sourceRef: string;
  readonly revision: number;
  readonly state: MatterState;
  readonly createdProductDate: string;
  readonly targetProductDate?: string;
  readonly updatedAt: Date;
  readonly grant?:
    | {
        readonly ownerRef: string;
        readonly sourceRef: string;
        readonly grantRef: string;
        readonly revision: number;
        readonly purpose: "DAILY_EXPRESSION" | "WEEKLY_SUMMARY";
        readonly state: "ACTIVE" | "REVOKED";
        readonly policyVersion: string;
      }
    | undefined;
}

export interface DailyMatterMentionV1 {
  readonly ownerRef: string;
  readonly sourceRef: string;
  readonly productDate: string;
  readonly purpose: "DAILY_EXPRESSION" | "WEEKLY_SUMMARY";
}

export interface DailyMatterSelectionRequestV1 {
  readonly ownerRef: string;
  readonly productDate: string;
  readonly access: {
    readonly accountActive: boolean;
    readonly consentActive: boolean;
    readonly safetyClear: boolean;
    readonly deletionClear: boolean;
    readonly masterEnabled: boolean;
    readonly dailyExpressionEnabled: boolean;
  };
  readonly sources: readonly DailyMatterSourceV1[];
  readonly mentions: readonly DailyMatterMentionV1[];
}

export interface SelectedDailyMatterV1 {
  readonly ownerRef: string;
  readonly sourceRef: string;
  readonly sourceRevision: number;
  readonly grantRef: string;
  readonly grantRevision: number;
  readonly validUntilProductDate: string;
  readonly policyVersion: typeof MEMORY_MATTER_SELECTION_POLICY_VERSION;
}

export type DailyMatterSelectionV1 =
  | { readonly status: "NO_ELIGIBLE_MEMORY" }
  | {
      readonly status: "SELECTED";
      readonly candidate: SelectedDailyMatterV1;
    };

const NO_MEMORY: DailyMatterSelectionV1 = Object.freeze({
  status: "NO_ELIGIBLE_MEMORY",
});

// This is server-only preselection. No title or provider payload crosses this boundary.
export function selectDailyMatterV1(
  request: DailyMatterSelectionRequestV1,
): DailyMatterSelectionV1 {
  const date = validDate(request.productDate);
  if (
    date === undefined ||
    !OpaqueIdSchema.safeParse(request.ownerRef).success ||
    !accessAllowed(request.access) ||
    !Array.isArray(request.sources) ||
    !Array.isArray(request.mentions) ||
    request.mentions.some(
      (mention) =>
        mention === null || validDate(mention.productDate) === undefined,
    )
  ) {
    return NO_MEMORY;
  }

  const sourceRefs = new Set<string>();
  for (const source of request.sources) {
    if (source === null || sourceRefs.has(source.sourceRef)) {
      return NO_MEMORY;
    }
    sourceRefs.add(source.sourceRef);
  }

  const eligible = request.sources
    .map((source) => eligibleSource(source, request, date))
    .filter((source): source is RankedMatter => source !== undefined);
  eligible.sort(
    (left, right) =>
      Number(right.targetToday) - Number(left.targetToday) ||
      left.targetDistance - right.targetDistance ||
      left.sourceDistance - right.sourceDistance ||
      right.updatedAt - left.updatedAt ||
      Buffer.compare(Buffer.from(left.sourceRef), Buffer.from(right.sourceRef)),
  );
  const winner = eligible[0];
  return winner === undefined
    ? NO_MEMORY
    : Object.freeze({ status: "SELECTED", candidate: winner.candidate });
}

// Call with a fresh, owner-scoped source and mention snapshot under the publish lock.
export function recheckDailyMatterV1(
  selected: SelectedDailyMatterV1,
  request: DailyMatterSelectionRequestV1,
): boolean {
  if (selected.policyVersion !== MEMORY_MATTER_SELECTION_POLICY_VERSION) {
    return false;
  }
  const current = request.sources.filter(
    (source) => source.sourceRef === selected.sourceRef,
  );
  if (current.length !== 1) {
    return false;
  }
  const result = selectDailyMatterV1({
    ...request,
    sources: current,
  });
  return (
    result.status === "SELECTED" &&
    result.candidate.ownerRef === selected.ownerRef &&
    result.candidate.sourceRevision === selected.sourceRevision &&
    result.candidate.grantRef === selected.grantRef &&
    result.candidate.grantRevision === selected.grantRevision &&
    result.candidate.validUntilProductDate === selected.validUntilProductDate
  );
}

interface RankedMatter {
  readonly candidate: SelectedDailyMatterV1;
  readonly sourceRef: string;
  readonly targetToday: boolean;
  readonly targetDistance: number;
  readonly sourceDistance: number;
  readonly updatedAt: number;
}

function eligibleSource(
  source: DailyMatterSourceV1,
  request: DailyMatterSelectionRequestV1,
  date: ProductDate,
): RankedMatter | undefined {
  const created = validDate(source.createdProductDate);
  const target =
    source.targetProductDate === undefined
      ? undefined
      : validDate(source.targetProductDate);
  const grant = source.grant;
  if (
    source.ownerRef !== request.ownerRef ||
    !OpaqueIdSchema.safeParse(source.sourceRef).success ||
    !Number.isSafeInteger(source.revision) ||
    source.revision < 1 ||
    created === undefined ||
    (source.targetProductDate !== undefined && target === undefined) ||
    grant === undefined ||
    grant.ownerRef !== request.ownerRef ||
    grant.sourceRef !== source.sourceRef ||
    !OpaqueIdSchema.safeParse(grant.grantRef).success ||
    grant.purpose !== "DAILY_EXPRESSION" ||
    grant.state !== "ACTIVE" ||
    grant.policyVersion !== MEMORY_MATTER_SELECTION_POLICY_VERSION ||
    !Number.isSafeInteger(grant.revision) ||
    grant.revision < 1 ||
    !(source.updatedAt instanceof Date) ||
    !Number.isFinite(source.updatedAt.getTime()) ||
    created > date ||
    effectiveMatterState(source, date) !== "ACTIVE"
  ) {
    return undefined;
  }
  const validUntil =
    target === undefined ? addProductDateDays(created, 6) : target;
  if (
    date < (target === undefined ? created : addProductDateDays(target, -3)) ||
    date > validUntil ||
    mentionedTooOften(source.sourceRef, request, date, target === date)
  ) {
    return undefined;
  }
  return {
    candidate: Object.freeze({
      ownerRef: request.ownerRef,
      sourceRef: source.sourceRef,
      sourceRevision: source.revision,
      grantRef: grant.grantRef,
      grantRevision: grant.revision,
      validUntilProductDate: validUntil,
      policyVersion: MEMORY_MATTER_SELECTION_POLICY_VERSION,
    }),
    sourceRef: source.sourceRef,
    targetToday: target === date,
    targetDistance: target === undefined ? Infinity : daysBetween(date, target),
    sourceDistance: daysBetween(created, date),
    updatedAt: source.updatedAt.getTime(),
  };
}

function mentionedTooOften(
  sourceRef: string,
  request: DailyMatterSelectionRequestV1,
  date: ProductDate,
  targetToday: boolean,
): boolean {
  const windowStart = addProductDateDays(date, -6);
  const dates = request.mentions
    .filter(
      (mention) =>
        mention.ownerRef === request.ownerRef &&
        mention.sourceRef === sourceRef &&
        mention.purpose === "DAILY_EXPRESSION" &&
        mention.productDate >= windowStart &&
        mention.productDate <= date,
    )
    .map((mention) => mention.productDate);
  return dates.includes(date) || (!targetToday && dates.length >= 2);
}

function accessAllowed(
  access: DailyMatterSelectionRequestV1["access"],
): boolean {
  return (
    access?.accountActive === true &&
    access.consentActive === true &&
    access.safetyClear === true &&
    access.deletionClear === true &&
    access.masterEnabled === true &&
    access.dailyExpressionEnabled === true
  );
}

function validDate(value: string): ProductDate | undefined {
  try {
    return parseProductDate(value);
  } catch {
    return undefined;
  }
}

function daysBetween(start: ProductDate, end: ProductDate): number {
  return (
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
    86_400_000
  );
}
