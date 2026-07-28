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

import { OrdinaryLogger } from "../../observability/ordinary-logger.js";
import {
  ApiException,
  type ApiErrorCategory,
  type ApiErrorCode,
  type ValidationErrorDetails,
} from "./api-exception.js";
import { RequestContextStore } from "./request-context.js";

interface NormalizedApiError {
  readonly category: ApiErrorCategory;
  readonly code: ApiErrorCode;
  readonly details?: ValidationErrorDetails;
  readonly message: string;
  readonly messageKey: string;
  readonly retryable: boolean;
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
    retryable: normalized.retryable,
    status: normalized.status,
  };
}

@Catch()
@Injectable()
export class ApiExceptionFilter implements ExceptionFilter {
  public constructor(
    private readonly contextStore: RequestContextStore,
    private readonly logger: OrdinaryLogger,
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

    response.setHeader("X-Request-Id", context.requestId);
    response.status(normalized.status).json({
      ok: false,
      request_id: context.requestId,
      server_now: new Date().toISOString(),
      error: {
        code: normalized.code,
        category: normalized.category,
        message_key: normalized.messageKey,
        message: normalized.message,
        retryable: normalized.retryable,
        ...details,
      },
    });

    this.logger.write(normalized.status >= 500 ? "ERROR" : "INFO", {
      duration_ms_bucket: this.logger.durationBucket(
        performance.now() - context.startedAt,
      ),
      message_code: "HTTP_REQUEST_COMPLETED",
      operation_code: context.operationCode,
      outcome_code: normalized.retryable
        ? "RETRYABLE"
        : normalized.status >= 500
          ? "TERMINAL"
          : "EXPECTED_REJECT",
      reason_code: normalized.code,
      request_id: context.requestId,
    });
  }
}
