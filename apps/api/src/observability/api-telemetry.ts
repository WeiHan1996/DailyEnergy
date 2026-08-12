import { Inject, Injectable } from "@nestjs/common";
import type {
  MetricName,
  TelemetryAttributes,
  TelemetryRuntime,
  TelemetrySpan,
} from "@daily-energy/server-adapters/api";

import { TELEMETRY_RUNTIME } from "../composition/tokens.js";

export const NOOP_TELEMETRY_RUNTIME: TelemetryRuntime = Object.freeze({
  beginSpan: () => Object.freeze({ end() {} }),
  record(
    _name: MetricName,
    _value: number,
    _attributes: TelemetryAttributes,
  ): void {},
  shutdown: async () => undefined,
  startSpan<Result>(
    _operationCode: TelemetryAttributes["operationCode"],
    _attributes: TelemetryAttributes,
    run: () => Result,
  ): Result {
    return run();
  },
});

@Injectable()
export class ApiTelemetry {
  private readonly inFlight = new Map<string, number>();

  public constructor(
    @Inject(TELEMETRY_RUNTIME) private readonly runtime: TelemetryRuntime,
  ) {}

  public beginRequest(
    operationCode: TelemetryAttributes["operationCode"],
    httpMethod: NonNullable<TelemetryAttributes["httpMethod"]>,
  ): TelemetrySpan {
    const inFlightAttributes = {
      httpMethod,
      operationCode,
      outcomeCode: "UNKNOWN",
    } as const;
    const inFlightKey = `${operationCode}:${httpMethod}`;
    const inFlight = (this.inFlight.get(inFlightKey) ?? 0) + 1;
    this.inFlight.set(inFlightKey, inFlight);
    this.runtime.record(
      "dailyenergy_http_in_flight_requests",
      inFlight,
      inFlightAttributes,
    );
    const span = this.runtime.beginSpan(operationCode, {
      ...inFlightAttributes,
      statusClass: "OTHER",
    });
    let ended = false;
    return Object.freeze({
      end: (outcomeCode: TelemetryAttributes["outcomeCode"]) => {
        if (ended) {
          return;
        }
        ended = true;
        const remaining = Math.max(
          0,
          (this.inFlight.get(inFlightKey) ?? 1) - 1,
        );
        if (remaining === 0) {
          this.inFlight.delete(inFlightKey);
        } else {
          this.inFlight.set(inFlightKey, remaining);
        }
        this.runtime.record(
          "dailyenergy_http_in_flight_requests",
          remaining,
          inFlightAttributes,
        );
        span.end(outcomeCode);
      },
    });
  }

  public record(
    name: MetricName,
    value: number,
    attributes: TelemetryAttributes,
  ): void {
    this.runtime.record(name, value, attributes);
  }
}
