import { HttpStatus } from "@nestjs/common";
import { z } from "zod";

export type ApiErrorCategory =
  | "AUTH"
  | "GUARD"
  | "VALIDATION"
  | "CONFLICT"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "TRANSIENT"
  | "TERMINAL"
  | "SAFETY";

interface ApiErrorDefinition {
  readonly category: ApiErrorCategory;
  readonly message: string;
  readonly messageKey: string;
  readonly retryable: boolean;
  readonly status: HttpStatus;
}

export const API_ERROR_CATALOG = {
  AUTH_ADMIN_REQUIRED: {
    category: "AUTH",
    message: "当前管理会话无权访问此内容。",
    messageKey: "error.auth_admin_required",
    retryable: false,
    status: HttpStatus.UNAUTHORIZED,
  },
  AUTH_INVALID: {
    category: "AUTH",
    message: "登录状态无效，请重新登录。",
    messageKey: "error.auth_invalid",
    retryable: false,
    status: HttpStatus.UNAUTHORIZED,
  },
  AUTH_REQUIRED: {
    category: "AUTH",
    message: "请重新登录后继续。",
    messageKey: "error.auth_required",
    retryable: false,
    status: HttpStatus.UNAUTHORIZED,
  },
  AUTH_SESSION_EXPIRED: {
    category: "AUTH",
    message: "登录状态已过期，请重新登录。",
    messageKey: "error.auth_session_expired",
    retryable: false,
    status: HttpStatus.UNAUTHORIZED,
  },
  AUTH_WECHAT_CODE_INVALID: {
    category: "AUTH",
    message: "登录凭证已失效，请重新尝试登录。",
    messageKey: "error.auth_wechat_code_invalid",
    retryable: false,
    status: HttpStatus.BAD_REQUEST,
  },
  DEPENDENCY_UNAVAILABLE: {
    category: "TRANSIENT",
    message: "服务暂时不可用，请稍后再试。",
    messageKey: "error.dependency_unavailable",
    retryable: true,
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  IDEMPOTENCY_CONFLICT: {
    category: "CONFLICT",
    message: "请求标识已用于不同内容，请检查后重试。",
    messageKey: "error.idempotency_conflict",
    retryable: false,
    status: HttpStatus.CONFLICT,
  },
  FEATURE_DISABLED: {
    category: "GUARD",
    message: "该能力尚未开放。",
    messageKey: "error.feature_disabled",
    retryable: false,
    status: HttpStatus.FORBIDDEN,
  },
  INTERNAL_TERMINAL: {
    category: "TERMINAL",
    message: "暂时无法完成请求，请稍后再试。",
    messageKey: "error.internal_terminal",
    retryable: false,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  MAINTENANCE_BLOCKING: {
    category: "GUARD",
    message: "服务正在短暂维护，请稍后再来。",
    messageKey: "error.maintenance_blocking",
    retryable: true,
    status: HttpStatus.FORBIDDEN,
  },
  PAYLOAD_TOO_LARGE: {
    category: "VALIDATION",
    message: "请求内容过大，请精简后重试。",
    messageKey: "error.payload_too_large",
    retryable: false,
    status: HttpStatus.BAD_REQUEST,
  },
  RATE_LIMITED: {
    category: "RATE_LIMIT",
    message: "请求有点频繁，请稍后再试。",
    messageKey: "error.rate_limited",
    retryable: true,
    status: HttpStatus.TOO_MANY_REQUESTS,
  },
  RESOURCE_NOT_FOUND: {
    category: "NOT_FOUND",
    message: "没有找到对应内容。",
    messageKey: "error.resource_not_found",
    retryable: false,
    status: HttpStatus.NOT_FOUND,
  },
  UPSTREAM_TRANSIENT: {
    category: "TRANSIENT",
    message: "连接暂时不稳定，请稍后再试。",
    messageKey: "error.upstream_transient",
    retryable: true,
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  VALIDATION_FAILED: {
    category: "VALIDATION",
    message: "提交内容有误，请检查后重试。",
    messageKey: "error.validation_failed",
    retryable: false,
    status: HttpStatus.BAD_REQUEST,
  },
} as const satisfies Readonly<Record<string, ApiErrorDefinition>>;

export type ApiErrorCode = keyof typeof API_ERROR_CATALOG;

const VERSION_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const ValidationErrorDetailsSchema = z.strictObject({
  fields: z
    .array(
      z.strictObject({
        field: z.string().min(1).max(160),
        reason: z.string().regex(VERSION_TOKEN_PATTERN),
      }),
    )
    .max(32),
});

export type ValidationErrorDetails = z.infer<
  typeof ValidationErrorDetailsSchema
>;
const RetryAfterErrorDetailsSchema = z.strictObject({
  retry_after_seconds: z.number().int().min(0).max(86_400),
});
export type RetryAfterErrorDetails = z.infer<
  typeof RetryAfterErrorDetailsSchema
>;
export type ApiErrorDetails = ValidationErrorDetails | RetryAfterErrorDetails;

type ApiExceptionOptions = {
  [Code in ApiErrorCode]: Code extends "VALIDATION_FAILED"
    ? {
        readonly code: Code;
        readonly details?: ValidationErrorDetails;
      }
    : Code extends
          "RATE_LIMITED" | "DEPENDENCY_UNAVAILABLE" | "UPSTREAM_TRANSIENT"
      ? {
          readonly code: Code;
          readonly details?: RetryAfterErrorDetails;
        }
      : {
          readonly code: Code;
          readonly details?: never;
        };
}[ApiErrorCode];

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(API_ERROR_CATALOG, value)
  );
}

function projectDetails(
  code: ApiErrorCode,
  details: unknown,
): ApiErrorDetails | undefined {
  if (details === undefined) {
    return undefined;
  }
  const schema =
    code === "VALIDATION_FAILED"
      ? ValidationErrorDetailsSchema
      : [
            "RATE_LIMITED",
            "DEPENDENCY_UNAVAILABLE",
            "UPSTREAM_TRANSIENT",
          ].includes(code)
        ? RetryAfterErrorDetailsSchema
        : undefined;
  if (schema === undefined) {
    return undefined;
  }
  const result = schema.safeParse(details);
  return result.success ? result.data : undefined;
}

export class ApiException extends Error {
  public readonly category: ApiErrorCategory;
  public readonly code: ApiErrorCode;
  public readonly details: ApiErrorDetails | undefined;
  public readonly messageKey: string;
  public readonly retryable: boolean;
  public readonly status: HttpStatus;

  public constructor(options: ApiExceptionOptions) {
    const requestedCode = (options as { readonly code?: unknown }).code;
    const code = isApiErrorCode(requestedCode)
      ? requestedCode
      : "INTERNAL_TERMINAL";
    const definition = API_ERROR_CATALOG[code];
    super(definition.message);
    this.name = "ApiException";
    this.category = definition.category;
    this.code = code;
    this.details = projectDetails(
      code,
      (options as { readonly details?: unknown }).details,
    );
    this.messageKey = definition.messageKey;
    this.retryable = definition.retryable;
    this.status = definition.status;
  }
}
