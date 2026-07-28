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
import { ApiException } from "./api-exception.js";
import { RequestContextStore } from "./request-context.js";

interface NormalizedApiError {
  readonly category:
    | "AUTH"
    | "GUARD"
    | "VALIDATION"
    | "CONFLICT"
    | "NOT_FOUND"
    | "RATE_LIMIT"
    | "TRANSIENT"
    | "TERMINAL"
    | "SAFETY";
  readonly code: string;
  readonly details?: Readonly<Record<string, unknown>>;
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
  if (exception instanceof ApiException) {
    return {
      category: exception.category,
      code: exception.code,
      ...(exception.details === undefined
        ? {}
        : { details: exception.details }),
      message: exception.message,
      messageKey: exception.messageKey,
      retryable: exception.retryable,
      status: exception.status,
    };
  }
  if (
    exception instanceof PayloadTooLargeException ||
    parserStatus(exception) === HttpStatus.PAYLOAD_TOO_LARGE ||
    (exception instanceof HttpException &&
      exception.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE)
  ) {
    return {
      category: "VALIDATION",
      code: "PAYLOAD_TOO_LARGE",
      message: "请求内容过大，请精简后重试。",
      messageKey: "error.payload_too_large",
      retryable: false,
      status: HttpStatus.BAD_REQUEST,
    };
  }
  if (
    exception instanceof BadRequestException ||
    parserStatus(exception) === HttpStatus.BAD_REQUEST ||
    parserStatus(exception) === HttpStatus.UNSUPPORTED_MEDIA_TYPE ||
    (exception instanceof HttpException &&
      exception.getStatus() === HttpStatus.BAD_REQUEST)
  ) {
    return {
      category: "VALIDATION",
      code: "VALIDATION_FAILED",
      message: "提交内容有误，请检查后重试。",
      messageKey: "error.validation_failed",
      retryable: false,
      status: HttpStatus.BAD_REQUEST,
    };
  }
  if (
    exception instanceof HttpException &&
    exception.getStatus() === HttpStatus.NOT_FOUND
  ) {
    return {
      category: "NOT_FOUND",
      code: "RESOURCE_NOT_FOUND",
      message: "没有找到对应内容。",
      messageKey: "error.resource_not_found",
      retryable: false,
      status: HttpStatus.NOT_FOUND,
    };
  }
  return {
    category: "TERMINAL",
    code: "INTERNAL_TERMINAL",
    message: "暂时无法完成请求，请稍后再试。",
    messageKey: "error.internal_terminal",
    retryable: false,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  };
}

function durationBucket(durationMs: number): string {
  if (durationMs < 10) {
    return "LT_10";
  }
  if (durationMs < 50) {
    return "LT_50";
  }
  if (durationMs < 250) {
    return "LT_250";
  }
  if (durationMs < 1_000) {
    return "LT_1000";
  }
  return "GTE_1000";
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
      duration_ms_bucket: durationBucket(performance.now() - context.startedAt),
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
