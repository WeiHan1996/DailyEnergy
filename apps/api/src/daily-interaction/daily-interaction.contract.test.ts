import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  DailyInteractionStateSchema,
  HistoryListViewSchema,
  LightDayRequestSchema,
  TaskStateUpdateRequestSchema,
} from "@daily-energy/shared-schemas";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { API_ERROR_CATALOG } from "../transport/common/api-exception.js";

describe("C-010 daily task transport contract", () => {
  it("keeps owner, session and continuation authority server-side", () => {
    const valid = {
      command_ref: "task-command-0001",
      expected_revision: 1,
      product_date: "2026-08-24",
      status: "INTERESTED",
      task_ref: "task.close-one-distraction.v1",
    };
    expect(TaskStateUpdateRequestSchema.safeParse(valid).success).toBe(true);
    for (const field of [
      "account_id",
      "session_id",
      "continuation_grant",
      "deletion_epoch",
      "safety_epoch",
    ]) {
      expect(
        TaskStateUpdateRequestSchema.safeParse({
          ...valid,
          [field]: "forged",
        }).success,
      ).toBe(false);
    }
    expect(DailyInteractionStateSchema.keyof().options).toEqual([
      "contract",
      "schema_version",
      "result_id",
      "product_date",
      "is_lit",
      "task",
      "helpfulness",
      "updated_at",
    ]);
  });

  it("maps read/update paths to authenticated strict schemas", async () => {
    const document = parse(
      await readFile(
        resolve(import.meta.dirname, "../../../../openapi/openapi.yaml"),
        "utf8",
      ),
    ) as {
      paths: Record<
        string,
        Record<
          string,
          { responses: Record<string, unknown>; security?: unknown[] }
        >
      >;
      components: {
        schemas: Record<string, { "x-source-contract"?: string }>;
      };
    };
    for (const [path, method] of [
      ["/daily/interaction", "get"],
      ["/daily/interaction/task", "post"],
    ] as const) {
      const operation = document.paths[path]?.[method];
      expect(operation?.security).toEqual([{ userBearerAuth: [] }]);
      expect(operation?.responses["200"]).toBeDefined();
      expect(operation?.responses["403"]).toBeDefined();
    }
    expect(document.components.schemas.TaskStateUpdateRequest).toEqual({
      "x-source-contract": "TaskStateUpdateRequestSchema",
    });
    expect(document.components.schemas.DailyInteractionView).toEqual({
      "x-source-contract": "DailyInteractionStateSchema",
    });
  });

  it("exposes bounded date-window errors", () => {
    expect(API_ERROR_CATALOG.WRITE_WINDOW_CLOSED).toMatchObject({
      category: "GUARD",
      retryable: false,
      status: 403,
    });
    expect(API_ERROR_CATALOG.VIEW_CONTINUATION_EXPIRED).toMatchObject({
      category: "GUARD",
      retryable: false,
      status: 403,
    });
  });
});

describe("C-011 light and history transport contract", () => {
  it("does not accept client reading-position or guard authority", () => {
    const valid = {
      command_ref: "light-command-0001",
      product_date: "2026-08-24",
      result_ref: "33333333-3333-4333-8333-333333333333",
    };
    expect(LightDayRequestSchema.safeParse(valid).success).toBe(true);
    expect(
      LightDayRequestSchema.safeParse({
        ...valid,
        main_action_reached: true,
      }).success,
    ).toBe(false);
    expect(
      HistoryListViewSchema.safeParse({
        items: [
          {
            product_date: "2026-08-24",
            state: "MISSING",
            is_lit: false,
            has_result: false,
            has_evening_feedback: false,
          },
        ],
        page_info: { has_more: false },
      }).success,
    ).toBe(true);
  });

  it("maps authenticated OpenAPI paths to executable schemas", async () => {
    const document = parse(
      await readFile(
        resolve(import.meta.dirname, "../../../../openapi/openapi.yaml"),
        "utf8",
      ),
    ) as {
      paths: Record<string, Record<string, { security?: unknown[] }>>;
      components: {
        schemas: Record<string, { "x-source-contract"?: string }>;
      };
    };
    expect(document.paths["/daily/interaction/light"]?.post?.security).toEqual([
      { userBearerAuth: [] },
    ]);
    expect(document.paths["/history/days"]?.get?.security).toEqual([
      { userBearerAuth: [] },
    ]);
    expect(document.components.schemas.LightDayRequest).toEqual({
      "x-source-contract": "LightDayRequestSchema",
    });
    expect(document.components.schemas.HistoryListView).toEqual({
      "x-source-contract": "HistoryListViewSchema",
    });
  });
});
