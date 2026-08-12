import type {
  TelemetryRuntime,
  TelemetryTransportConfig,
} from "@daily-energy/server-adapters/api";

import { NOOP_TELEMETRY_RUNTIME } from "./api-telemetry.js";

export function startApiTelemetrySafely(
  start: (config: TelemetryTransportConfig) => TelemetryRuntime,
  config: TelemetryTransportConfig,
): TelemetryRuntime {
  try {
    return start(config);
  } catch {
    return NOOP_TELEMETRY_RUNTIME;
  }
}
