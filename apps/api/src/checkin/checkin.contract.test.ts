import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  CheckinCorrectRequestSchema,
  CheckinSubmitRequestSchema,
  CheckinViewSchema,
} from "@daily-energy/shared-schemas";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { API_ERROR_CATALOG } from "../transport/common/api-exception.js";

describe("C-004 check-in transport contract", () => {
  it("keeps owner/date fields server-side and all request objects closed", () => {
    const base = {
      command_ref: "checkin-command-0001",
      energy: "STEADY" as const,
      mood: "GOOD" as const,
      sleep: "OKAY" as const,
    };
    expect(
      CheckinSubmitRequestSchema.safeParse({
        ...base,
        expected_revision: 0,
      }).success,
    ).toBe(true);
    for (const field of [
      "account_id",
      "owner_ref",
      "product_date",
      "product_date_policy_version",
      "safety_epoch",
      "deletion_epoch",
    ]) {
      expect(
        CheckinSubmitRequestSchema.safeParse({
          ...base,
          expected_revision: 0,
          [field]: "forged",
        }).success,
      ).toBe(false);
    }
    expect(
      CheckinCorrectRequestSchema.safeParse({
        ...base,
        expected_revision: 1,
      }).success,
    ).toBe(true);
    expect(CheckinViewSchema.keyof().options).not.toContain("account_id");
  });

  it("maps every C-004 endpoint to authenticated closed schemas", async () => {
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
        schemas: Record<
          string,
          { additionalProperties?: boolean; "x-source-contract"?: string }
        >;
      };
    };
    for (const [path, method] of [
      ["/daily/today/checkin", "get"],
      ["/daily/checkin/submit", "post"],
      ["/daily/checkin/correct", "post"],
    ] as const) {
      const operation = document.paths[path]?.[method];
      expect(operation?.security).toEqual([{ userBearerAuth: [] }]);
      expect(operation?.responses["200"]).toBeDefined();
      expect(operation?.responses["401"]).toBeDefined();
      expect(operation?.responses["403"]).toBeDefined();
    }
    expect(document.components.schemas.CheckinSubmitRequest).toEqual({
      "x-source-contract": "CheckinSubmitRequestSchema",
    });
    expect(document.components.schemas.CheckinCorrectRequest).toEqual({
      "x-source-contract": "CheckinCorrectRequestSchema",
    });
    expect(document.components.schemas.CheckinView).toEqual({
      "x-source-contract": "CheckinViewSchema",
    });
  });

  it("keeps stable conflict, guard and Safety errors in the runtime catalog", () => {
    expect(API_ERROR_CATALOG.CHECKIN_ALREADY_EXISTS.status).toBe(409);
    expect(API_ERROR_CATALOG.REVISION_CONFLICT.status).toBe(409);
    expect(API_ERROR_CATALOG.IDEMPOTENCY_CONFLICT.status).toBe(409);
    expect(API_ERROR_CATALOG.SAFETY_BLOCKED.category).toBe("SAFETY");
    expect(API_ERROR_CATALOG.ACCOUNT_DELETING.status).toBe(403);
  });
});
