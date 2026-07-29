import * as z from "zod";

const PRODUCT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const VERSION_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const OPAQUE_ID_PATTERN = /^[^\s\u0000-\u001f\u007f]{1,128}$/u;
const HTML_PATTERN = /<\/?[A-Za-z][^>]*>/u;
const URL_PATTERN = /(?:https?:\/\/|www\.)/iu;
const MARKDOWN_PATTERN =
  /(?:^#{1,6}\s|^[-+*]\s|^\d+\.\s|\*\*|__|~~|`|\[[^\]]+\]\([^)]+\))/u;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

const segmenter = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });

export function countDisplayCharacters(value: string): number {
  return Array.from(segmenter.segment(value)).length;
}

export function isActualProductDate(value: string): boolean {
  const match = PRODUCT_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function areConsecutiveProductDates(values: readonly string[]): boolean {
  return values.every((value, index) => {
    if (index === 0) {
      return true;
    }
    const previous = values[index - 1];
    if (
      !previous ||
      !isActualProductDate(value) ||
      !isActualProductDate(previous)
    ) {
      return false;
    }
    return (
      Date.parse(`${value}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`) ===
      86_400_000
    );
  });
}

export const OpaqueIdSchema = z
  .string()
  .regex(OPAQUE_ID_PATTERN, "must be a non-empty opaque identifier");
export type OpaqueId = z.infer<typeof OpaqueIdSchema>;

export const ProductDateSchema = z
  .string()
  .regex(PRODUCT_DATE_PATTERN, "must use YYYY-MM-DD")
  .refine(isActualProductDate, "must be an actual calendar date");
export type ProductDate = z.infer<typeof ProductDateSchema>;

export const Rfc3339TimestampSchema = z
  .string()
  .regex(RFC3339_PATTERN, "must be an RFC 3339 timestamp with a timezone")
  .refine(
    (value) => Number.isFinite(Date.parse(value)),
    "must be a valid timestamp",
  );
export type Rfc3339Timestamp = z.infer<typeof Rfc3339TimestampSchema>;

export const SemverSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
    "must be semantic versioning",
  );
export type Semver = z.infer<typeof SemverSchema>;

export const VersionTokenSchema = z
  .string()
  .regex(VERSION_TOKEN_PATTERN, "must be a bounded version token");
export type VersionToken = z.infer<typeof VersionTokenSchema>;

export const RevisionSchema = z.number().int().nonnegative();
export const PositiveRevisionSchema = z.number().int().positive();

export function singleLineTextSchema(min: number, max: number) {
  return z.string().superRefine((value, context) => {
    const length = countDisplayCharacters(value);
    if (value !== value.trim()) {
      context.addIssue({
        code: "custom",
        message: "must not have outer whitespace",
      });
    }
    if (/\r|\n/u.test(value)) {
      context.addIssue({ code: "custom", message: "must be a single line" });
    }
    if (CONTROL_PATTERN.test(value)) {
      context.addIssue({
        code: "custom",
        message: "must not contain control characters",
      });
    }
    if (length < min || length > max) {
      context.addIssue({
        code: "custom",
        message: `must contain ${min} to ${max} display characters`,
      });
    }
  });
}

export function generatedTextSchema(min: number, max: number) {
  return singleLineTextSchema(min, max).superRefine((value, context) => {
    if (/[ \t]{2,}/u.test(value)) {
      context.addIssue({
        code: "custom",
        message: "must not contain repeated whitespace",
      });
    }
    if (HTML_PATTERN.test(value)) {
      context.addIssue({ code: "custom", message: "must not contain HTML" });
    }
    if (URL_PATTERN.test(value)) {
      context.addIssue({ code: "custom", message: "must not contain a URL" });
    }
    if (MARKDOWN_PATTERN.test(value)) {
      context.addIssue({
        code: "custom",
        message: "must not contain Markdown",
      });
    }
    if (EMOJI_PATTERN.test(value)) {
      context.addIssue({
        code: "custom",
        message: "must not contain text emoji",
      });
    }
    if (/[!?！？]{2,}/u.test(value)) {
      context.addIssue({
        code: "custom",
        message: "must not repeat exclamation or question marks",
      });
    }
  });
}

export const SourcePathSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_.[\]-]+$/u, "must be a bounded field path");

export const StableDimensionIdValues = [
  "pace",
  "action",
  "connection",
  "resources",
  "recovery",
] as const;
export const StableDimensionIdSchema = z.enum(StableDimensionIdValues);
export type StableDimensionId = z.infer<typeof StableDimensionIdSchema>;

export const BandValues = ["LOW", "STEADY", "HIGH"] as const;
export const BandSchema = z.enum(BandValues);
export type Band = z.infer<typeof BandSchema>;

export const MoodValues = [
  "VERY_LOW",
  "LOW",
  "STEADY",
  "GOOD",
  "LIGHT",
  "UNSURE",
] as const;
export const MoodSchema = z.enum(MoodValues);
export type Mood = z.infer<typeof MoodSchema>;

export const EnergyValues = [
  "EMPTY",
  "LOW",
  "STEADY",
  "HIGH",
  "FULL",
  "UNSURE",
] as const;
export const EnergySchema = z.enum(EnergyValues);
export type Energy = z.infer<typeof EnergySchema>;

export const SleepValues = ["POOR", "LOW", "OKAY", "GOOD", "UNSURE"] as const;
export const SleepSchema = z.enum(SleepValues);
export type Sleep = z.infer<typeof SleepSchema>;

export const OverallFeelingValues = [
  "VERY_HEAVY",
  "SOMEWHAT_HEAVY",
  "STEADY",
  "PRETTY_GOOD",
  "LIGHT",
  "UNSURE",
] as const;
export const OverallFeelingSchema = z.enum(OverallFeelingValues);
export type OverallFeeling = z.infer<typeof OverallFeelingSchema>;

export const HelpfulnessRatingValues = [
  "HELPFUL",
  "NEUTRAL",
  "NOT_HELPFUL",
  "NOT_USED",
] as const;
export const HelpfulnessRatingSchema = z.enum(HelpfulnessRatingValues);
export type HelpfulnessRating = z.infer<typeof HelpfulnessRatingSchema>;

export const HelpfulnessStateValues = [
  "UNRATED",
  ...HelpfulnessRatingValues,
] as const;
export const HelpfulnessStateSchema = z.enum(HelpfulnessStateValues);
export type HelpfulnessState = z.infer<typeof HelpfulnessStateSchema>;

export const TaskStatusValues = [
  "UNMARKED",
  "INTERESTED",
  "COMPLETED",
  "SKIPPED",
] as const;
export const TaskStatusSchema = z.enum(TaskStatusValues);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const WriteWindowValues = [
  "OPEN",
  "CONTINUATION_ONLY",
  "CLOSED",
] as const;
export const WriteWindowSchema = z.enum(WriteWindowValues);
export type WriteWindow = z.infer<typeof WriteWindowSchema>;

export const ActionKindValues = [
  "PRIORITIZE_ONE",
  "PREPARE_ONE_STEP",
  "COMMUNICATE_CLEARLY",
  "REDUCE_SWITCHING",
  "ORGANIZE_SMALL_SCOPE",
  "PAUSE_AND_RECOVER",
  "REFLECT_BRIEFLY",
  "SEEK_REAL_SUPPORT",
] as const;
export const ActionKindSchema = z.enum(ActionKindValues);
export type ActionKind = z.infer<typeof ActionKindSchema>;

export const EffortValues = ["VERY_LIGHT", "LIGHT"] as const;
export const EffortSchema = z.enum(EffortValues);
export type Effort = z.infer<typeof EffortSchema>;

export const RitualKindValues = ["COLOR", "NUMBER"] as const;
export const RitualKindSchema = z.enum(RitualKindValues);
export type RitualKind = z.infer<typeof RitualKindSchema>;

export const GenerationModeValues = [
  "PRIMARY_AI",
  "BACKUP_AI",
  "CONTROLLED_TEMPLATE",
] as const;
export const GenerationModeSchema = z.enum(GenerationModeValues);
export type GenerationMode = z.infer<typeof GenerationModeSchema>;

export const PersonalizationLevelValues = ["FULL", "REDUCED"] as const;
export const PersonalizationLevelSchema = z.enum(PersonalizationLevelValues);
export type PersonalizationLevel = z.infer<typeof PersonalizationLevelSchema>;

export const RelationshipStageValues = [
  "BEFORE_FIRST_MEETING",
  "NEWLY_MET",
  "BECOMING_FAMILIAR",
  "FIRST_WEEK_RECORDED",
] as const;
export const RelationshipStageSchema = z.enum(RelationshipStageValues);
export type RelationshipStage = z.infer<typeof RelationshipStageSchema>;

export const ExpressionStyleValues = [
  "BALANCED",
  "GENTLE",
  "LIGHT_HUMOR",
  "CLEAR_DIRECT",
] as const;
export const ExpressionStyleSchema = z.enum(ExpressionStyleValues);
export type ExpressionStyle = z.infer<typeof ExpressionStyleSchema>;

export function addCustomIssue(
  context: z.RefinementCtx,
  path: Array<string | number>,
  message: string,
): void {
  context.addIssue({ code: "custom", path, message });
}
