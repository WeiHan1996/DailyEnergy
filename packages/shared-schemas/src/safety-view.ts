import * as z from "zod";

import {
  OpaqueIdSchema,
  PositiveRevisionSchema,
  RevisionSchema,
  Rfc3339TimestampSchema,
  VersionTokenSchema,
} from "./common.js";

export const SafetyResourceViewSchema = z
  .object({
    resource_ref: OpaqueIdSchema,
    label: z.string().min(1).max(80),
    action: z.enum(["CALL", "OPEN_URL", "SHOW_TEXT"]),
    target: z.string().min(1).max(512),
  })
  .strict();

export const SafetyBlockViewSchema = z
  .object({
    block_id: VersionTokenSchema,
    kind: z.enum([
      "DIRECT_ACKNOWLEDGEMENT",
      "IMMEDIATE_ACTION",
      "EMERGENCY_RESOURCE",
      "TRUSTED_PERSON",
      "SUPPORT_RESOURCE",
      "PRODUCT_LIMIT",
      "RECOVERY_ACTION",
    ]),
    copy: z.string().min(1).max(280),
    resources: z.array(SafetyResourceViewSchema).max(8),
  })
  .strict();

const SafetyClearViewSchema = z
  .object({
    state: z.literal("CLEAR"),
    revision: RevisionSchema,
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

export const SafetyOverlayViewSchema = z
  .object({
    state: z.enum(["ACTIVE", "RECOVERY_PENDING"]),
    revision: PositiveRevisionSchema,
    response_bundle_version: VersionTokenSchema,
    blocks: z.array(SafetyBlockViewSchema).min(1).max(7),
    recovery_ref: OpaqueIdSchema.optional(),
    safety_continuation_token: z.string().min(32).optional(),
    updated_at: Rfc3339TimestampSchema,
  })
  .strict();

export const SafetyViewSchema = z.discriminatedUnion("state", [
  SafetyClearViewSchema,
  SafetyOverlayViewSchema,
]);
export type SafetyView = z.infer<typeof SafetyViewSchema>;
export type SafetyOverlayView = z.infer<typeof SafetyOverlayViewSchema>;
