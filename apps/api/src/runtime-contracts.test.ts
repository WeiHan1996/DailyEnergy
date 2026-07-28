import { describe, expect, it } from "vitest";

import {
  API_CONTRACT_BUNDLE_VERSION,
  API_RUNTIME_CONFIG_SCHEMA_VERSION,
  loadRuntimeConfig,
  PRODUCT_DATE_POLICY_VERSION,
} from "./bootstrap/runtime-config.js";
import {
  OrdinaryLogger,
  type OrdinaryLogEvent,
} from "./observability/ordinary-logger.js";
import { ApiException } from "./transport/common/api-exception.js";

function config() {
  return loadRuntimeConfig({
    DAILYENERGY_CONFIG_SCHEMA_VERSION: API_RUNTIME_CONFIG_SCHEMA_VERSION,
    DAILYENERGY_CONTRACT_BUNDLE_VERSION: API_CONTRACT_BUNDLE_VERSION,
    DAILYENERGY_ENVIRONMENT: "CI",
    DAILYENERGY_LOG_LEVEL: "DEBUG",
    DAILYENERGY_MAINTENANCE_MODE: "OFF",
    DAILYENERGY_PORT: "0",
    DAILYENERGY_PRODUCT_DATE_POLICY_VERSION: PRODUCT_DATE_POLICY_VERSION,
    DAILYENERGY_RELEASE_ID: "synthetic-release-v1",
    DAILYENERGY_RUNTIME_PROFILE: "API",
    DAILYENERGY_SHUTDOWN_GRACE_MS: "5000",
  });
}

describe("closed runtime contracts", () => {
  it("keeps only the code-specific validation details allowlist", () => {
    const valid = new ApiException({
      code: "VALIDATION_FAILED",
      details: {
        fields: [
          {
            field: "code",
            reason: "invalid_type",
          },
        ],
      },
    });
    const injected = new ApiException({
      code: "VALIDATION_FAILED",
      details: {
        fields: [
          {
            field: "code",
            reason: "invalid_type",
          },
        ],
        secret: "must-not-pass",
      },
    } as never);

    expect(valid.details).toEqual({
      fields: [{ field: "code", reason: "invalid_type" }],
    });
    expect(injected.details).toBeUndefined();
    expect(JSON.stringify(injected)).not.toContain("must-not-pass");
  });

  it("normalizes an unregistered error code to INTERNAL_TERMINAL", () => {
    const exception = new ApiException({
      code: "DYNAMIC_SQL_SECRET",
    } as never);

    expect(exception.code).toBe("INTERNAL_TERMINAL");
    expect(exception.message).not.toContain("DYNAMIC_SQL_SECRET");
  });

  it("rejects dynamic message and reason codes before the ordinary sink", () => {
    const events: OrdinaryLogEvent[] = [];
    const logger = new OrdinaryLogger(config(), {
      write: (event) => {
        events.push(event);
      },
    });

    logger.write("ERROR", {
      message_code: "dynamic select secret from users",
      operation_code: "API_LIFECYCLE",
      outcome_code: "TERMINAL",
      reason_code: "dynamic secret reason",
    } as never);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      message_code: "LOG_CONTRACT_REJECTED",
      operation_code: "API_LIFECYCLE",
      outcome_code: "TERMINAL",
      reason_code: "LOG_EVENT_INVALID",
    });
    expect(JSON.stringify(events)).not.toMatch(/select|users|dynamic secret/iu);
  });
});
