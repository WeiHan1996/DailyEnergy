import type { HttpStatus } from "@nestjs/common";

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

export interface ApiExceptionOptions {
  readonly category: ApiErrorCategory;
  readonly code: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly message: string;
  readonly messageKey: string;
  readonly retryable: boolean;
  readonly status: HttpStatus;
}

export class ApiException extends Error {
  public readonly category: ApiErrorCategory;
  public readonly code: string;
  public readonly details: Readonly<Record<string, unknown>> | undefined;
  public readonly messageKey: string;
  public readonly retryable: boolean;
  public readonly status: HttpStatus;

  public constructor(options: ApiExceptionOptions) {
    super(options.message);
    this.name = "ApiException";
    this.category = options.category;
    this.code = options.code;
    this.details = options.details;
    this.messageKey = options.messageKey;
    this.retryable = options.retryable;
    this.status = options.status;
  }
}
