import { HttpStatus } from "@nestjs/common";
import {
  CheckinViewSchema,
  MemoryPreferencesViewSchema,
  NotificationSettingsViewSchema,
  ProfileViewSchema,
} from "@daily-energy/shared-schemas";
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
  ACCOUNT_DELETED: {
    category: "GUARD",
    message: "当前账户已经结束，无法继续此操作。",
    messageKey: "error.account_deleted",
    retryable: false,
    status: HttpStatus.FORBIDDEN,
  },
  ACCOUNT_DELETING: {
    category: "GUARD",
    message: "数据正在处理中，暂时无法继续此操作。",
    messageKey: "error.account_deleting",
    retryable: false,
    status: HttpStatus.FORBIDDEN,
  },
  ACCOUNT_RESTRICTED: {
    category: "GUARD",
    message: "当前账户状态不允许继续此操作。",
    messageKey: "error.account_restricted",
    retryable: false,
    status: HttpStatus.FORBIDDEN,
  },
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
  CHECKIN_ALREADY_EXISTS: {
    category: "CONFLICT",
    message: "今天的状态已经保存，请读取最新记录后修改。",
    messageKey: "error.checkin_already_exists",
    retryable: false,
    status: HttpStatus.CONFLICT,
  },
  DEPENDENCY_UNAVAILABLE: {
    category: "TRANSIENT",
    message: "服务暂时不可用，请稍后再试。",
    messageKey: "error.dependency_unavailable",
    retryable: true,
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  CONSENT_REQUIRED: {
    category: "GUARD",
    message: "请先阅读并确认当前必要告知。",
    messageKey: "error.consent_required",
    retryable: false,
    status: HttpStatus.FORBIDDEN,
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
  GENERATION_FAILED_RETRYABLE: {
    category: "TRANSIENT",
    message: "今日内容暂时还没准备好，请稍后再试。",
    messageKey: "error.generation_failed_retryable",
    retryable: true,
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  GENERATION_FAILED_TERMINAL: {
    category: "TERMINAL",
    message: "今天暂时无法生成完整内容，请稍后从今日入口重试。",
    messageKey: "error.generation_failed_terminal",
    retryable: false,
    status: HttpStatus.UNPROCESSABLE_ENTITY,
  },
  GENERATION_PENDING: {
    category: "TRANSIENT",
    message: "今日内容正在准备中，请稍后再看。",
    messageKey: "error.generation_pending",
    retryable: true,
    status: HttpStatus.SERVICE_UNAVAILABLE,
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
  ONBOARDING_REQUIRED: {
    category: "GUARD",
    message: "请先完成首次认识。",
    messageKey: "error.onboarding_required",
    retryable: false,
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
  REVISION_CONFLICT: {
    category: "CONFLICT",
    message: "内容已在别处更新，请查看最新状态后重试。",
    messageKey: "error.revision_conflict",
    retryable: false,
    status: HttpStatus.CONFLICT,
  },
  SAFETY_BLOCKED: {
    category: "SAFETY",
    message: "当前普通流程已暂停。",
    messageKey: "error.safety_blocked",
    retryable: false,
    status: HttpStatus.CONFLICT,
  },
  STATE_PRECONDITION_FAILED: {
    category: "CONFLICT",
    message: "当前状态不允许继续此操作。",
    messageKey: "error.state_precondition_failed",
    retryable: false,
    status: HttpStatus.UNPROCESSABLE_ENTITY,
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
const RevisionErrorDetailsSchema = z.strictObject({
  current_revision: z.number().int().positive(),
  current: z.union([
    CheckinViewSchema,
    ProfileViewSchema,
    MemoryPreferencesViewSchema,
    NotificationSettingsViewSchema,
  ]),
});
export type RevisionErrorDetails = z.infer<typeof RevisionErrorDetailsSchema>;
export type ApiErrorDetails =
  ValidationErrorDetails | RetryAfterErrorDetails | RevisionErrorDetails;

type ApiExceptionCodeOptions = {
  [Code in ApiErrorCode]: Code extends "VALIDATION_FAILED"
    ? {
        readonly code: Code;
        readonly details?: ValidationErrorDetails;
      }
    : Code extends "REVISION_CONFLICT"
      ? {
          readonly code: Code;
          readonly details?: RevisionErrorDetails;
        }
      : Code extends
            | "RATE_LIMITED"
            | "DEPENDENCY_UNAVAILABLE"
            | "UPSTREAM_TRANSIENT"
            | "GENERATION_FAILED_RETRYABLE"
            | "GENERATION_PENDING"
        ? {
            readonly code: Code;
            readonly details?: RetryAfterErrorDetails;
          }
        : {
            readonly code: Code;
            readonly details?: never;
          };
}[ApiErrorCode];

type ApiExceptionOptions = ApiExceptionCodeOptions & {
  readonly productDate?: string;
  readonly serverNow?: Date;
};

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
            "GENERATION_FAILED_RETRYABLE",
            "GENERATION_PENDING",
          ].includes(code)
        ? RetryAfterErrorDetailsSchema
        : code === "REVISION_CONFLICT"
          ? RevisionErrorDetailsSchema
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
  public readonly productDate: string | undefined;
  public readonly retryable: boolean;
  public readonly serverNow: Date | undefined;
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
    this.productDate = options.productDate;
    this.retryable = definition.retryable;
    this.serverNow =
      options.serverNow === undefined
        ? undefined
        : new Date(options.serverNow.getTime());
    this.status = definition.status;
  }
}
