SET search_path TO "daily_energy", pg_catalog;

ALTER TABLE "daily_energy"."app_view_continuation_grant"
  DROP CONSTRAINT "app_view_continuation_grant_feedbackRevision_positive_ck";
ALTER TABLE "daily_energy"."app_view_continuation_grant"
  ADD CONSTRAINT "app_view_continuation_grant_feedbackRevision_positive_ck" CHECK (
    "feedbackRevision" IS NULL OR "feedbackRevision" >= 0
  );

-- C-012: the ordinary interaction module may decrypt only the current user's
-- evening note through its field-specific codec. Other ciphertext tables and
-- revision history remain outside the ordinary read surface.
GRANT SELECT (
  "id", "interactionId", "overallFeeling", "noteCiphertext",
  "noteKeyVersion", "firstSubmittedAt", "updatedAt", "revision"
)
ON TABLE "daily_energy"."app_evening_feedback_record"
TO "daily_energy_api";

REVOKE DELETE ON TABLE
  "daily_energy"."app_evening_feedback_record",
  "daily_energy"."app_evening_feedback_revision",
  "daily_energy"."app_daily_helpfulness_record"
FROM "daily_energy_api";

REVOKE UPDATE ON TABLE
  "daily_energy"."app_evening_feedback_revision"
FROM "daily_energy_api";

-- Rollback: restore the original feedbackRevision positive constraint only
-- after proving no EVE-001 empty grant exists; revoke the column SELECT grant
-- and restore DELETE/UPDATE only after a data-rights security review.
