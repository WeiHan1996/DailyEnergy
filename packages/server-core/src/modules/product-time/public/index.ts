export {
  PRODUCT_DATE_POLICY_V1,
  ProductTimeError,
  addProductDateDays,
  parseProductDate,
  productDateBounds,
  resolveProductDate,
  weeklyProductDates,
} from "../domain/product-date.js";
export type {
  ProductDate,
  ProductDateResolution,
  ProductTimeErrorCode,
} from "../domain/product-date.js";

export {
  ContinuationError,
  createViewContinuationGrant,
  evaluateWriteWindow,
  invalidateViewContinuationGrant,
  isGenerationCompletionEligible,
  validateViewContinuationGrant,
} from "../domain/continuation.js";
export type {
  ContinuationErrorCode,
  ContinuationSurface,
  ProductDateWriteOperation,
  ViewContinuationGrant,
  WriteWindow,
} from "../domain/continuation.js";
