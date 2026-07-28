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
import { RequestContextStore } from "./request-context.js";

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  public constructor(
    private readonly contextStore: RequestContextStore,
    private readonly logger: OrdinaryLogger,
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
