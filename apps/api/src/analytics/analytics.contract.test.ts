import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  ClientAnalyticsSignalAcceptedViewSchema,
  ClientAnalyticsSignalRequestSchema,
} from "@daily-energy/shared-schemas";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

describe("C-015 analytics transport contract", () => {
  it("keeps the request and accepted view closed and identity-free", () => {
    const valid = {
      app_version: "1.4.2",
      event_name: "main_action_reached",
      event_schema_version: 1,
      locale: "zh-CN",
    } as const;
    expect(ClientAnalyticsSignalRequestSchema.parse(valid)).toEqual(valid);
    expect(
      ClientAnalyticsSignalAcceptedViewSchema.parse({ accepted: true }),
    ).toEqual({ accepted: true });
    for (const field of [
      "account_ref",
      "owner_ref",
      "device_ref",
      "session_ref",
      "ip",
      "product_date",
      "client_timestamp",
      "text",
    ]) {
      expect(
        ClientAnalyticsSignalRequestSchema.safeParse({
          ...valid,
          [field]: "forbidden",
        }).success,
      ).toBe(false);
    }
  });

  it("exposes one first-party best-effort operation with no user auth contract", async () => {
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
          {
            operationId?: string;
            responses: Record<string, unknown>;
            security?: unknown[];
          }
        >
      >;
      components: {
        schemas: Record<string, { "x-source-contract"?: string }>;
      };
    };
    const operation = document.paths["/analytics/signals"]?.post;
    expect(operation).toMatchObject({
      operationId: "submitAnalyticsSignal",
      security: [],
    });
    expect(operation?.responses["202"]).toBeDefined();
    expect(operation?.responses["400"]).toBeDefined();
    expect(operation?.responses["429"]).toBeDefined();
    expect(document.components.schemas.ClientAnalyticsSignalRequest).toEqual({
      "x-source-contract": "ClientAnalyticsSignalRequestSchema",
    });
    expect(
      document.components.schemas.ClientAnalyticsSignalAcceptedView,
    ).toEqual({
      "x-source-contract": "ClientAnalyticsSignalAcceptedViewSchema",
    });
  });
});
