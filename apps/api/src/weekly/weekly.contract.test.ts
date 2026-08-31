import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

describe("C-013 weekly transport contract", () => {
  it("keeps both weekly endpoints authenticated and read-only", async () => {
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
    expect(document.paths["/weekly/current"]?.get?.security).toEqual([
      { userBearerAuth: [] },
    ]);
    expect(document.paths["/weekly/window/{end_date}"]?.get?.security).toEqual([
      { userBearerAuth: [] },
    ]);
    expect(document.paths["/weekly/current"]?.post).toBeUndefined();
    expect(document.paths["/weekly/window/{end_date}"]?.post).toBeUndefined();
    expect(document.components.schemas.WeeklyView).toEqual({
      "x-source-contract": "ClientWeeklySummaryViewSchema",
    });
  });
});
