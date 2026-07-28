import { HttpStatus, Injectable, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

import { ApiException } from "./api-exception.js";

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  public constructor(private readonly schema: ZodType<T>) {}

  public transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    throw new ApiException({
      category: "VALIDATION",
      code: "VALIDATION_FAILED",
      details: {
        fields: result.error.issues.map((issue) => ({
          code: issue.code,
          field: issue.path.join("."),
        })),
      },
      message: "提交内容有误，请检查后重试。",
      messageKey: "error.validation_failed",
      retryable: false,
      status: HttpStatus.BAD_REQUEST,
    });
  }
}
