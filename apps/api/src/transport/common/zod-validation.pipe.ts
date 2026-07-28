import { Injectable, type PipeTransform } from "@nestjs/common";
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
      code: "VALIDATION_FAILED",
      details: {
        fields: result.error.issues.map((issue) => ({
          field: issue.path.join(".") || "$",
          reason: issue.code,
        })),
      },
    });
  }
}
