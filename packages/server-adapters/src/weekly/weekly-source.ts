import { createHash } from "node:crypto";

import {
  WeeklySourceSnapshotSchema,
  type WeeklySourceSnapshot,
} from "@daily-energy/shared-schemas";
import {
  parseProductDate,
  weeklyProductDates,
} from "@daily-energy/server-core/product-time";

import { commandRefStorageUuid } from "../commands/command-ref.js";

export interface WeeklySourceQueryResult<
  Row extends Readonly<Record<string, unknown>>,
> {
  readonly rows: readonly Row[];
}

export interface WeeklySourceExecutor {
  execute<Row extends Readonly<Record<string, unknown>>>(
    statement: string,
    values?: readonly unknown[],
  ): Promise<WeeklySourceQueryResult<Row>>;
}

export interface WeeklySourceRow extends Readonly<Record<string, unknown>> {
  readonly actionKind: string | null;
  readonly checkinRef: string | null;
  readonly checkinRevision: number | null;
  readonly energy: string | null;
  readonly feedbackRef: string | null;
  readonly feedbackRevision: number | null;
  readonly helpfulnessRating: string | null;
  readonly helpfulnessRef: string | null;
  readonly helpfulnessRevision: number | null;
  readonly lightRef: string | null;
  readonly lightRevision: number | null;
  readonly mood: string | null;
  readonly overallFeeling: string | null;
  readonly productDate: string;
  readonly sleep: string | null;
  readonly taskRef: string | null;
  readonly taskRevision: number | null;
  readonly taskStatus: string | null;
}

export function weeklyWindowId(
  accountId: string,
  endProductDate: string,
): string {
  return commandRefStorageUuid(
    `c013:weekly-window:${accountId}:${endProductDate}:window-v1`,
  );
}

export async function loadWeeklySourceSnapshot(
  executor: WeeklySourceExecutor,
  input: {
    readonly accountId: string;
    readonly endProductDate: string;
    readonly windowId: string;
  },
): Promise<WeeklySourceSnapshot> {
  const rows = await executor.execute<WeeklySourceRow>(
    `SELECT *
       FROM daily_energy.list_c013_weekly_source_days($1::uuid,$2::date)`,
    [input.accountId, input.endProductDate],
  );
  return weeklySourceSnapshotFromRows(rows.rows, input);
}

export function weeklySourceSnapshotFromRows(
  rows: readonly WeeklySourceRow[],
  input: {
    readonly accountId: string;
    readonly endProductDate: string;
    readonly windowId: string;
  },
): WeeklySourceSnapshot {
  const dates = weeklyProductDates(parseProductDate(input.endProductDate));
  const byDate = new Map(rows.map((row) => [row.productDate, row]));
  if (
    rows.length !== 7 ||
    byDate.size !== 7 ||
    dates.some((date) => !byDate.has(date))
  ) {
    throw new Error("WEEKLY_SOURCE_ROWS_INVALID");
  }
  const days = dates.map((date) => {
    const row = byDate.get(date)!;
    const checkin =
      row.checkinRef === null
        ? undefined
        : {
            energy: required(row.energy, "WEEKLY_CHECKIN_ENERGY_MISSING"),
            mood: required(row.mood, "WEEKLY_CHECKIN_MOOD_MISSING"),
            revision: required(
              row.checkinRevision,
              "WEEKLY_CHECKIN_REVISION_MISSING",
            ),
            sleep: required(row.sleep, "WEEKLY_CHECKIN_SLEEP_MISSING"),
            source_ref: row.checkinRef,
          };
    const evening =
      row.feedbackRef === null
        ? undefined
        : {
            overall_feeling: required(
              row.overallFeeling,
              "WEEKLY_EVENING_VALUE_MISSING",
            ),
            revision: required(
              row.feedbackRevision,
              "WEEKLY_EVENING_REVISION_MISSING",
            ),
            source_ref: row.feedbackRef,
          };
    const helpfulness =
      row.helpfulnessRef === null
        ? undefined
        : {
            ...(row.helpfulnessRating === "HELPFUL"
              ? {
                  action_kind: required(
                    row.actionKind,
                    "WEEKLY_HELPFUL_ACTION_MISSING",
                  ),
                }
              : {}),
            rating: required(
              row.helpfulnessRating,
              "WEEKLY_HELPFULNESS_VALUE_MISSING",
            ),
            revision: required(
              row.helpfulnessRevision,
              "WEEKLY_HELPFULNESS_REVISION_MISSING",
            ),
            source_ref: row.helpfulnessRef,
          };
    const day = {
      product_date: date,
      source_state:
        checkin !== undefined || evening !== undefined
          ? ("RECORDED" as const)
          : ("MISSING" as const),
      ...(checkin === undefined ? {} : { checkin }),
      ...(evening === undefined ? {} : { evening }),
      ...(row.lightRef === null
        ? {}
        : {
            light: {
              is_lit: true,
              source_ref: row.lightRef,
            },
          }),
      ...(helpfulness === undefined ? {} : { helpfulness }),
      ...(row.taskRef === null
        ? {}
        : {
            task: {
              revision: required(
                row.taskRevision,
                "WEEKLY_TASK_REVISION_MISSING",
              ),
              source_ref: row.taskRef,
              status: required(row.taskStatus, "WEEKLY_TASK_STATUS_MISSING"),
            },
          }),
    };
    return day;
  });
  const binding = {
    contract: "weekly-source-snapshot",
    days,
    schema_version: "1.0.0",
    window_end_date: input.endProductDate,
    window_id: input.windowId,
    window_rule_version: "window-v1",
    window_start_date: dates[0],
  };
  return WeeklySourceSnapshotSchema.parse({
    ...binding,
    source_fingerprint: createHash("sha256")
      .update(
        `weekly-source-v1|${stableWeeklyJson({
          account_ref: input.accountId,
          ...binding,
          light_source_revisions: rows.map((row) => ({
            product_date: row.productDate,
            source_ref: row.lightRef,
            source_validity_revision: row.lightRevision,
          })),
        })}`,
        "utf8",
      )
      .digest("hex"),
  });
}

export function stableWeeklyJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableWeeklyJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableWeeklyJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function required<T>(value: T | null, code: string): T {
  if (value === null) {
    throw new Error(code);
  }
  return value;
}
