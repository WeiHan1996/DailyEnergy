SET search_path TO "daily_energy", pg_catalog;

-- AI-008: expose only the minimum guard facts needed by the owner-scoped
-- Matter API. The API role keeps zero direct access to restricted tables.
CREATE OR REPLACE FUNCTION "daily_energy"."resolve_ai008_matter_guard_snapshot"(
  target_account_id uuid,
  target_matter_id uuid,
  current_notice_version text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
  WITH account_row AS (
    SELECT account.state, account.revision
      FROM "daily_energy"."app_user_account" account
     WHERE account.id = target_account_id
  ), safety_row AS (
    SELECT safety.state, safety.revision, safety."guardEpoch"
      FROM "daily_energy"."restricted_safety_state" safety
     WHERE safety."accountId" = target_account_id
  ), deletion_row AS (
    SELECT guard.revision, guard."deletionEpoch"
      FROM "daily_energy"."restricted_deletion_guard" guard
     WHERE guard."accountId" = target_account_id
       AND guard."releasedAt" IS NULL
       AND (
         guard.scope IN ('ACCOUNT', 'RELATIONSHIP_DATA')
         OR (
           target_matter_id IS NOT NULL
           AND guard.scope = 'MATTER'
           AND guard."targetKey" = target_matter_id::text
         )
       )
     ORDER BY guard."deletionEpoch" DESC, guard.revision DESC, guard.id
     LIMIT 1
  )
  SELECT jsonb_build_object(
    'status', CASE
      WHEN EXISTS (
        SELECT 1 FROM safety_row
         WHERE state IN ('ACTIVE', 'RECOVERY_PENDING')
      ) THEN 'SAFETY_BLOCKED'
      WHEN NOT EXISTS (SELECT 1 FROM account_row) THEN 'ACCOUNT_RESTRICTED'
      WHEN EXISTS (SELECT 1 FROM account_row WHERE state = 'DELETING')
        THEN 'ACCOUNT_DELETING'
      WHEN EXISTS (SELECT 1 FROM account_row WHERE state = 'DELETED')
        THEN 'ACCOUNT_DELETED'
      WHEN EXISTS (SELECT 1 FROM account_row WHERE state = 'RESTRICTED')
        THEN 'ACCOUNT_RESTRICTED'
      WHEN COALESCE((
        SELECT consent.status = 'ACCEPTED'
          AND consent."noticeVersion" = current_notice_version
          FROM "daily_energy"."app_necessary_consent_record" consent
         WHERE consent."accountId" = target_account_id
           AND consent."logicalIntent" = 'ORDINARY_USE'
         ORDER BY consent."createdAt" DESC, consent.id DESC
         LIMIT 1
      ), false) = false THEN 'CONSENT_REQUIRED'
      WHEN NOT EXISTS (
        SELECT 1 FROM "daily_energy"."app_onboarding_completion" onboarding
         WHERE onboarding."accountId" = target_account_id
      ) THEN 'ONBOARDING_REQUIRED'
      WHEN EXISTS (SELECT 1 FROM deletion_row)
        THEN 'STATE_PRECONDITION_FAILED'
      ELSE 'ALLOWED'
    END,
    'account_revision', COALESCE((SELECT revision FROM account_row), 0),
    'safety_revision', COALESCE((SELECT revision FROM safety_row), 0),
    'safety_epoch', COALESCE((SELECT "guardEpoch"::text FROM safety_row), '0'),
    'deletion_revision', COALESCE((SELECT revision FROM deletion_row), 0),
    'deletion_epoch', COALESCE((SELECT "deletionEpoch"::text FROM deletion_row), '0')
  );
$$;

REVOKE ALL ON FUNCTION "daily_energy"."resolve_ai008_matter_guard_snapshot"(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "daily_energy"."resolve_ai008_matter_guard_snapshot"(uuid, uuid, text)
TO "daily_energy_api", "daily_energy_test";

-- The API may decrypt only the current owner-scoped Matter row through the
-- field-specific codec. Revision history remains outside the read surface.
GRANT SELECT (
  "id", "accountId", "revision", "titleCiphertext", "titleKeyVersion",
  "targetProductDate", "state", "createdProductDate", "terminalAt", "updatedAt",
  "expiresAt"
)
ON TABLE "daily_energy"."app_important_matter"
TO "daily_energy_api";

GRANT SELECT (
  "id", "accountId", "sourceType", "sourceRef", "purpose", "state", "revision"
)
ON TABLE "daily_energy"."app_memory_purpose_grant"
TO "daily_energy_api";

-- Matter deletion is owned by the restricted DataTask worker. Ordinary API
-- writes are limited to the reviewed current-row and grant CAS columns.
REVOKE DELETE ON TABLE
  "daily_energy"."app_important_matter",
  "daily_energy"."app_important_matter_revision",
  "daily_energy"."app_memory_purpose_grant"
FROM "daily_energy_api";

REVOKE UPDATE ON TABLE
  "daily_energy"."app_important_matter",
  "daily_energy"."app_important_matter_revision",
  "daily_energy"."app_memory_purpose_grant"
FROM "daily_energy_api";

GRANT UPDATE (
  "revision", "titleCiphertext", "titleKeyVersion", "targetProductDate",
  "state", "createdProductDate", "terminalAt", "updatedAt",
  "retentionAnchorAt", "expiresAt"
)
ON TABLE "daily_energy"."app_important_matter"
TO "daily_energy_api";

GRANT UPDATE (
  "state", "revision", "policyVersion", "consentSurfaceVersion", "updatedAt",
  "revokedAt", "retentionAnchorAt", "expiresAt"
)
ON TABLE "daily_energy"."app_memory_purpose_grant"
TO "daily_energy_api";
