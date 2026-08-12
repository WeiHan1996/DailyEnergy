import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { tap } from "rxjs";
import type { Response } from "express";

import { OrdinaryLogger } from "../../observability/ordinary-logger.js";
import { ApiTelemetry } from "../../observability/api-telemetry.js";
import { RequestContextStore } from "./request-context.js";

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  public constructor(
    private readonly contextStore: RequestContextStore,
    private readonly logger: OrdinaryLogger,
    private readonly telemetry: ApiTelemetry,
  ) {}

  public intercept(
    executionContext: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const requestContext = this.contextStore.get();
    const response = executionContext.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap({
        next: () => {
          const isUnavailableReadiness =
            requestContext.operationCode === "HEALTH_READY" &&
            response.statusCode === 503;
          const elapsedSeconds =
            (performance.now() - requestContext.startedAt) / 1_000;
          const statusClass = statusClassFor(response.statusCode);
          const outcomeCode = isUnavailableReadiness ? "RETRYABLE" : "SUCCESS";
          const telemetryAttributes = {
            httpMethod: requestContext.httpMethod,
            operationCode: requestContext.operationCode,
            outcomeCode,
            statusClass,
          } as const;
          this.telemetry.record(
            "dailyenergy_http_server_requests_total",
            1,
            telemetryAttributes,
          );
          if (!isUnavailableReadiness) {
            this.telemetry.record(
              "dailyenergy_http_server_request_duration_seconds",
              elapsedSeconds,
              telemetryAttributes,
            );
          }
          requestContext.telemetrySpan.end(outcomeCode);
          this.logger.write(isUnavailableReadiness ? "WARN" : "INFO", {
            duration_ms_bucket: this.logger.durationBucket(
              performance.now() - requestContext.startedAt,
            ),
            message_code: "HTTP_REQUEST_COMPLETED",
            operation_code: requestContext.operationCode,
            outcome_code: isUnavailableReadiness ? "RETRYABLE" : "SUCCESS",
            ...(isUnavailableReadiness
              ? { reason_code: "DEPENDENCY_UNAVAILABLE" }
              : {}),
            request_id: requestContext.requestId,
          });
        },
      }),
    );
  }
}

function statusClassFor(
  status: number,
): "2xx" | "3xx" | "4xx" | "5xx" | "OTHER" {
  return status >= 200 && status < 300
    ? "2xx"
    : status >= 300 && status < 400
      ? "3xx"
      : status >= 400 && status < 500
        ? "4xx"
        : status >= 500 && status < 600
          ? "5xx"
          : "OTHER";
}
