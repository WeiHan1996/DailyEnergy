import { describe, expect, it, vi } from "vitest";

import type { TelemetryRuntime } from "@daily-energy/server-adapters/api";

import { RequestContextStore } from "../transport/common/request-context.js";
import { ApiTelemetry } from "./api-telemetry.js";

describe("API telemetry boundary", () => {
  it("does not create an orphan span outside an HTTP request context", () => {
    const beginSpan = vi.fn<TelemetryRuntime["beginSpan"]>(() => ({
      end: vi.fn(),
    }));
    const runtime: TelemetryRuntime = {
      beginSpan,
      record: vi.fn(),
      shutdown: vi.fn(async () => undefined),
      startSpan: (_operation, _attributes, run) => run(),
    };
    const store = new RequestContextStore(new ApiTelemetry(runtime));

    const fallback = store.get();

    expect(fallback.operationCode).toBe("UNKNOWN_HTTP");
    expect(beginSpan).not.toHaveBeenCalled();
    expect(() => fallback.telemetrySpan.end("TERMINAL")).not.toThrow();
  });
});
