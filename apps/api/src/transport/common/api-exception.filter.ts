import {
  BadRequestException,
  Catch,
  HttpException,
  HttpStatus,
  Injectable,
  PayloadTooLargeException,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Response } from "express";

import { resolveProductDate } from "../../product-date/product-date.js";
import { OrdinaryLogger } from "../../observability/ordinary-logger.js";
import { ApiTelemetry } from "../../observability/api-telemetry.js";
import {
  type ApiErrorDetails,
  ApiException,
  type ApiErrorCategory,
  type ApiErrorCode,
} from "./api-exception.js";
import { RequestContextStore } from "./request-context.js";

interface NormalizedApiError {
  readonly category: ApiErrorCategory;
  readonly code: ApiErrorCode;
  readonly details?: ApiErrorDetails;
  readonly message: string;
  readonly messageKey: string;
  readonly productDate?: string;
  readonly retryable: boolean;
  readonly serverNow?: Date;
  readonly status: number;
}

function parserStatus(exception: unknown): number | undefined {
  if (typeof exception !== "object" || exception === null) {
    return undefined;
  }
  const candidate = exception as {
    readonly status?: unknown;
    readonly statusCode?: unknown;
  };
  if (typeof candidate.statusCode === "number") {
    return candidate.statusCode;
  }
  return typeof candidate.status === "number" ? candidate.status : undefined;
}

function normalizeException(exception: unknown): NormalizedApiError {
  let normalized: ApiException;
  if (exception instanceof ApiException) {
    normalized = exception;
  } else if (
    exception instanceof PayloadTooLargeException ||
    parserStatus(exception) === HttpStatus.PAYLOAD_TOO_LARGE ||
    (exception instanceof HttpException &&
      exception.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE)
  ) {
    normalized = new ApiException({
      code: "PAYLOAD_TOO_LARGE",
    });
  } else if (
    exception instanceof BadRequestException ||
    parserStatus(exception) === HttpStatus.BAD_REQUEST ||
    parserStatus(exception) === HttpStatus.UNSUPPORTED_MEDIA_TYPE ||
    (exception instanceof HttpException &&
      exception.getStatus() === HttpStatus.BAD_REQUEST)
  ) {
    normalized = new ApiException({
      code: "VALIDATION_FAILED",
    });
  } else if (
    exception instanceof HttpException &&
    exception.getStatus() === HttpStatus.NOT_FOUND
  ) {
    normalized = new ApiException({
      code: "RESOURCE_NOT_FOUND",
    });
  } else {
    normalized = new ApiException({
      code: "INTERNAL_TERMINAL",
    });
  }
  return {
    category: normalized.category,
    code: normalized.code,
    ...(normalized.details === undefined
      ? {}
      : { details: normalized.details }),
    message: normalized.message,
    messageKey: normalized.messageKey,
    ...(normalized.productDate === undefined
      ? {}
      : { productDate: normalized.productDate }),
    retryable: normalized.retryable,
    ...(normalized.serverNow === undefined
      ? {}
      : { serverNow: normalized.serverNow }),
    status: normalized.status,
  };
}

@Catch()
@Injectable()
export class ApiExceptionFilter implements ExceptionFilter {
  public constructor(
    private readonly contextStore: RequestContextStore,
    private readonly logger: OrdinaryLogger,
    private readonly telemetry: ApiTelemetry,
  ) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const context = this.contextStore.get();
    const normalized = normalizeException(exception);
    const details =
      normalized.details === undefined
        ? {}
        : {
            details: normalized.details,
          };
    const responseNow = normalized.serverNow ?? new Date();
    let productDate = normalized.productDate;
    if (productDate === undefined) {
      try {
        productDate = resolveProductDate(responseNow).productDate;
      } catch {
        productDate = undefined;
      }
    }

    response.setHeader("X-Request-Id", context.requestId);
    if (
      normalized.details !== undefined &&
      "retry_after_seconds" in normalized.details
    ) {
      response.setHeader(
        "Retry-After",
        String(normalized.details.retry_after_seconds),
      );
    }
    response.status(normalized.status).json({
      ok: false,
      request_id: context.requestId,
      server_now: responseNow.toISOString(),
      ...(productDate === undefined ? {} : { product_date: productDate }),
      error: {
        code: normalized.code,
        category: normalized.category,
        message_key: normalized.messageKey,
        message: normalized.message,
        retryable: normalized.retryable,
        ...details,
      },
    });

    const outcomeCode =
      normalized.status < 500
        ? "EXPECTED_REJECT"
        : normalized.retryable
          ? "RETRYABLE"
          : "TERMINAL";
    const statusClass = normalized.status >= 500 ? "5xx" : "4xx";
    this.telemetry.record("dailyenergy_http_server_requests_total", 1, {
      httpMethod: context.httpMethod,
      operationCode: context.operationCode,
      outcomeCode,
      statusClass,
    });
    context.telemetrySpan.end(outcomeCode);

    this.logger.write(normalized.status >= 500 ? "ERROR" : "INFO", {
      duration_ms_bucket: this.logger.durationBucket(
        performance.now() - context.startedAt,
      ),
      message_code: "HTTP_REQUEST_COMPLETED",
      operation_code: context.operationCode,
      outcome_code: outcomeCode,
      reason_code: normalized.code,
      request_id: context.requestId,
    });
  }
}
