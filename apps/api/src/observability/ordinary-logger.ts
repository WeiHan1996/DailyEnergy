import { Inject, Injectable } from "@nestjs/common";

import type {
  RuntimeConfig,
  RuntimeLogLevel,
} from "../bootstrap/runtime-config.js";
import { ORDINARY_LOG_SINK, RUNTIME_CONFIG } from "../composition/tokens.js";
import type {
  OrdinaryLogEvent,
  OrdinaryLogSink,
} from "./ordinary-log.types.js";

export type {
  OperationCode,
  OrdinaryLogEvent,
  OrdinaryLogSink,
  OutcomeCode,
} from "./ordinary-log.types.js";

export const STANDARD_OUTPUT_LOG_SINK: OrdinaryLogSink = {
  write(event) {
    try {
      process.stdout.write(`${JSON.stringify(event)}\n`);
    } catch {
      process.stderr.write(
        '{"severity":"ERROR","service":"api","runtime_profile":"API","operation_code":"API_LIFECYCLE","outcome_code":"TERMINAL","message_code":"LOG_SERIALIZATION_FAILED","contract_version":"ordinary-log-v1"}\n',
      );
    }
  },
};

function severityRank(level: RuntimeLogLevel): number {
  return ["DEBUG", "INFO", "WARN", "ERROR"].indexOf(level);
}

@Injectable()
export class OrdinaryLogger {
  public constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Inject(ORDINARY_LOG_SINK) private readonly sink: OrdinaryLogSink,
  ) {}

  public write(
    severity: RuntimeLogLevel,
    event: Omit<
      OrdinaryLogEvent,
      | "contract_version"
      | "environment"
      | "release_id"
      | "runtime_profile"
      | "service"
      | "severity"
      | "timestamp"
    >,
  ): void {
    if (severityRank(severity) < severityRank(this.config.logLevel)) {
      return;
    }
    this.sink.write({
      ...event,
      contract_version: "ordinary-log-v1",
      environment: this.config.environment,
      release_id: this.config.releaseId,
      runtime_profile: "API",
      service: "api",
      severity,
      timestamp: new Date().toISOString(),
    });
  }
}
