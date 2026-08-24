import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  GenerationIntentViewSchema,
  GenerationStartRequestSchema,
  HistoryDayViewSchema,
  TodayViewSchema,
} from "@daily-energy/shared-schemas";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { API_ERROR_CATALOG } from "../transport/common/api-exception.js";

describe("C-008 generation transport contract", () => {
  it("keeps owner, date, seed and guard fields server-side", () => {
    const valid = {
      command_ref: "generation-command-0001",
      expected_checkin_revision: 1,
    };
    expect(GenerationStartRequestSchema.safeParse(valid).success).toBe(true);
    for (const field of [
      "account_id",
      "owner_ref",
      "product_date",
      "result_version",
      "root_seed",
      "safety_epoch",
      "deletion_epoch",
    ]) {
      expect(
        GenerationStartRequestSchema.safeParse({
          ...valid,
          [field]: "forged",
        }).success,
      ).toBe(false);
    }
    expect(GenerationIntentViewSchema.keyof().options).not.toContain(
      "result_version",
    );
    expect(TodayViewSchema.keyof().options).toEqual([
      "content",
      "interaction",
      "relationship",
    ]);
    expect(HistoryDayViewSchema.keyof().options).toEqual([
      "product_date",
      "checkin",
      "content",
      "interaction",
      "evening",
    ]);
  });

  it("maps start, status and today to authenticated closed schemas", async () => {
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
      ["/daily/generation/start", "post"],
      ["/daily/generation/{intent_ref}", "get"],
      ["/daily/today", "get"],
      ["/daily/by-date/{product_date}", "get"],
    ] as const) {
      const operation = document.paths[path]?.[method];
      expect(operation?.security).toEqual([{ userBearerAuth: [] }]);
      expect(operation?.responses["200"]).toBeDefined();
      expect(operation?.responses["401"]).toBeDefined();
      expect(operation?.responses["403"]).toBeDefined();
    }
    expect(document.components.schemas.GenerationStartRequest).toEqual({
      "x-source-contract": "GenerationStartRequestSchema",
    });
    expect(document.components.schemas.GenerationIntentView).toEqual({
      "x-source-contract": "GenerationIntentViewSchema",
    });
    expect(document.components.schemas.TodayView).toEqual({
      "x-source-contract": "TodayViewSchema",
    });
    expect(document.components.schemas.HistoryDayView).toEqual({
      "x-source-contract": "HistoryDayViewSchema",
    });
  });

  it("keeps Accepted generation outcomes in the runtime catalog", () => {
    expect(API_ERROR_CATALOG.GENERATION_PENDING).toMatchObject({
      category: "TRANSIENT",
      retryable: true,
      status: 503,
    });
    expect(API_ERROR_CATALOG.GENERATION_FAILED_RETRYABLE.retryable).toBe(true);
    expect(API_ERROR_CATALOG.GENERATION_FAILED_TERMINAL).toMatchObject({
      category: "TERMINAL",
      retryable: false,
      status: 422,
    });
  });
});
