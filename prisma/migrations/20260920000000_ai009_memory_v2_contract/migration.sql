SET search_path TO "daily_energy", pg_catalog;

-- AI-009 Accepted Daily v2 contract: a Matter is not projection-eligible until
-- the current source revision has an irreversible CLEAR proof from the current
-- Safety Input Gate. Existing rows intentionally remain NULL and ineligible.
ALTER TABLE "daily_energy"."app_important_matter"
  ADD COLUMN "memorySafetySourceRevision" integer,
  ADD COLUMN "memorySafetyPolicyVersion" varchar(64),
  ADD COLUMN "memorySafetyRuleVersion" varchar(64),
  ADD COLUMN "memorySafetyClassifierVersion" varchar(64),
  ADD COLUMN "memorySafetyFingerprint" bytea,
  ADD COLUMN "memorySafetyClearedAt" timestamptz(3),
  ADD CONSTRAINT "app_matter_memory_safety_complete_check" CHECK (
    (
      "memorySafetySourceRevision" IS NULL
      AND "memorySafetyPolicyVersion" IS NULL
      AND "memorySafetyRuleVersion" IS NULL
      AND "memorySafetyClassifierVersion" IS NULL
      AND "memorySafetyFingerprint" IS NULL
      AND "memorySafetyClearedAt" IS NULL
    ) OR (
      "memorySafetySourceRevision" = revision
      AND length("memorySafetyPolicyVersion") BETWEEN 1 AND 64
      AND length("memorySafetyRuleVersion") BETWEEN 1 AND 64
      AND length("memorySafetyClassifierVersion") BETWEEN 1 AND 64
      AND octet_length("memorySafetyFingerprint") = 32
      AND "memorySafetyClearedAt" IS NOT NULL
    )
  );

ALTER TABLE "daily_energy"."app_source_dependency"
  ADD COLUMN "masterRevision" integer,
  ADD COLUMN "accountRevision" integer,
  ADD COLUMN "safetyEpoch" bigint,
  ADD COLUMN "deletionEpoch" bigint,
  ADD COLUMN "sourceSafetyPolicyVersion" varchar(64),
  ADD COLUMN "sourceSafetyRuleVersion" varchar(64),
  ADD COLUMN "sourceSafetyClassifierVersion" varchar(64),
  ADD COLUMN "sourceSafetyFingerprint" bytea,
  ADD COLUMN "validUntilProductDate" date,
  ADD COLUMN "temporalRelation" varchar(32),
  ADD CONSTRAINT "app_source_dependency_memory_v2_complete_check" CHECK (
    "masterRevision" IS NULL
    OR (
      "masterRevision" > 0 AND "accountRevision" > 0
      AND "safetyEpoch" >= 0 AND "deletionEpoch" >= 0
      AND length("sourceSafetyPolicyVersion") BETWEEN 1 AND 64
      AND length("sourceSafetyRuleVersion") BETWEEN 1 AND 64
      AND length("sourceSafetyClassifierVersion") BETWEEN 1 AND 64
      AND octet_length("sourceSafetyFingerprint") = 32
      AND "validUntilProductDate" IS NOT NULL
      AND "temporalRelation" IN ('TARGET_TODAY','FUTURE_WINDOW','UNSPECIFIED')
    )
  );

REVOKE UPDATE ON TABLE "daily_energy"."app_important_matter"
FROM "daily_energy_api";
GRANT UPDATE (
  "revision", "titleCiphertext", "titleKeyVersion", "targetProductDate",
  "state", "createdProductDate", "terminalAt", "updatedAt",
  "retentionAnchorAt", "expiresAt", "memorySafetySourceRevision",
  "memorySafetyPolicyVersion", "memorySafetyRuleVersion",
  "memorySafetyClassifierVersion", "memorySafetyFingerprint",
  "memorySafetyClearedAt"
) ON TABLE "daily_energy"."app_important_matter"
TO "daily_energy_api";

GRANT SELECT (
  "memorySafetySourceRevision", "memorySafetyPolicyVersion",
  "memorySafetyRuleVersion", "memorySafetyClassifierVersion",
  "memorySafetyFingerprint", "memorySafetyClearedAt"
) ON TABLE "daily_energy"."app_important_matter"
TO "daily_energy_interactive";

GRANT SELECT ("id", "accountId", "productDate", "resultVersion", "schemaVersion")
ON TABLE "daily_energy"."app_published_daily_result"
TO "daily_energy_interactive";

REVOKE ALL ON TABLE
  "daily_energy"."app_result_content_slot",
  "daily_energy"."app_personalized_content_fragment",
  "daily_energy"."app_source_dependency"
FROM "daily_energy_interactive";

GRANT SELECT ("id", "resultId", "segmentPath")
ON TABLE "daily_energy"."app_result_content_slot"
TO "daily_energy_interactive";
GRANT INSERT (
  "id", "resultId", "segmentPath", "fallbackPayload", "fallbackFingerprint",
  "fallbackSchemaVersion", "createdAt", "retentionPolicyVersion",
  "retentionScope", "retentionAnchorAt"
) ON TABLE "daily_energy"."app_result_content_slot"
TO "daily_energy_interactive";

GRANT SELECT ("id", "slotId")
ON TABLE "daily_energy"."app_personalized_content_fragment"
TO "daily_energy_interactive";

-- SQL-013 checks slot completeness at deferred commit time. Keep the worker
-- unable to SELECT encrypted fragments while allowing the trigger to inspect
-- them through its fixed, non-returning integrity function.
ALTER FUNCTION "daily_energy"."assert_daily_content_slot"(uuid)
  SECURITY DEFINER;
ALTER FUNCTION "daily_energy"."assert_daily_content_slot"(uuid)
  SET search_path = "daily_energy", pg_catalog;
REVOKE ALL ON FUNCTION "daily_energy"."assert_daily_content_slot"(uuid)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "daily_energy"."assert_daily_content_slot"(uuid)
TO "daily_energy_interactive", "daily_energy_deletion", "daily_energy_test";

ALTER FUNCTION "daily_energy"."check_daily_visibility_slots"()
  SECURITY DEFINER;
ALTER FUNCTION "daily_energy"."check_daily_visibility_slots"()
  SET search_path = "daily_energy", pg_catalog;
REVOKE ALL ON FUNCTION "daily_energy"."check_daily_visibility_slots"()
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "daily_energy"."check_daily_visibility_slots"()
TO "daily_energy_interactive", "daily_energy_deletion", "daily_energy_test";

GRANT INSERT (
  "id", "slotId", "payloadCiphertext", "payloadKeyVersion",
  "payloadFingerprint", "schemaVersion", "createdAt",
  "retentionPolicyVersion", "retentionScope", "retentionAnchorAt"
) ON TABLE "daily_energy"."app_personalized_content_fragment"
TO "daily_energy_interactive";

GRANT INSERT (
  "id", "fragmentId", "sourceType", "sourceRef", "sourceRevision", "purpose",
  "grantRef", "grantRevision", "masterRevision", "accountRevision",
  "safetyEpoch", "deletionEpoch", "sourceSafetyPolicyVersion",
  "sourceSafetyRuleVersion", "sourceSafetyClassifierVersion",
  "sourceSafetyFingerprint", "validUntilProductDate", "temporalRelation",
  "policyVersion", "segmentPaths",
  "fallbackPaths", "validAtPublish", "retentionPolicyVersion",
  "retentionScope", "retentionAnchorAt"
) ON TABLE "daily_energy"."app_source_dependency"
TO "daily_energy_interactive";

GRANT SELECT (
  "fragmentId", "sourceType", "sourceRef", "sourceRevision", "purpose",
  "grantRef", "grantRevision",
  "masterRevision", "accountRevision", "safetyEpoch", "deletionEpoch",
  "sourceSafetyPolicyVersion", "sourceSafetyRuleVersion",
  "sourceSafetyClassifierVersion", "sourceSafetyFingerprint",
  "validUntilProductDate", "temporalRelation", "policyVersion"
) ON TABLE "daily_energy"."app_source_dependency"
TO "daily_energy_interactive";

GRANT INSERT (
  "id", "accountId", "sourceType", "sourceRef", "productDate", "purpose",
  "resultId", "policyVersion", "createdAt", "retentionPolicyVersion",
  "retentionScope", "retentionAnchorAt"
) ON TABLE "daily_energy"."app_memory_mention_receipt"
TO "daily_energy_interactive";
