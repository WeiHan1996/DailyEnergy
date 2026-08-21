SET search_path TO "daily_energy", pg_catalog;

-- C-004: expose only a stable daily-write guard decision to the ordinary API.
-- The API role keeps no direct SELECT privilege on Safety or deletion tables.
CREATE OR REPLACE FUNCTION "daily_energy"."resolve_checkin_guard_status"(
  target_account_id uuid,
  target_product_date date,
  current_notice_version text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM "daily_energy"."restricted_safety_state" safety
      WHERE safety."accountId" = target_account_id
        AND safety.state IN ('ACTIVE', 'RECOVERY_PENDING')
    ) THEN 'SAFETY_BLOCKED'
    WHEN NOT EXISTS (
      SELECT 1
      FROM "daily_energy"."app_user_account" account
      WHERE account.id = target_account_id
    ) THEN 'ACCOUNT_RESTRICTED'
    WHEN EXISTS (
      SELECT 1 FROM "daily_energy"."app_user_account" account
      WHERE account.id = target_account_id AND account.state = 'DELETING'
    ) THEN 'ACCOUNT_DELETING'
    WHEN EXISTS (
      SELECT 1 FROM "daily_energy"."app_user_account" account
      WHERE account.id = target_account_id AND account.state = 'DELETED'
    ) THEN 'ACCOUNT_DELETED'
    WHEN EXISTS (
      SELECT 1 FROM "daily_energy"."app_user_account" account
      WHERE account.id = target_account_id AND account.state = 'RESTRICTED'
    ) THEN 'ACCOUNT_RESTRICTED'
    WHEN COALESCE((
      SELECT consent.status = 'ACCEPTED'
        AND consent."noticeVersion" = current_notice_version
      FROM "daily_energy"."app_necessary_consent_record" consent
      WHERE consent."accountId" = target_account_id
        AND consent."logicalIntent" = 'ORDINARY_USE'
      ORDER BY consent."createdAt" DESC
      LIMIT 1
    ), false) = false THEN 'CONSENT_REQUIRED'
    WHEN NOT EXISTS (
      SELECT 1 FROM "daily_energy"."app_onboarding_completion" onboarding
      WHERE onboarding."accountId" = target_account_id
    ) THEN 'ONBOARDING_REQUIRED'
    WHEN EXISTS (
      SELECT 1
      FROM "daily_energy"."restricted_deletion_guard" deletion_guard
      WHERE deletion_guard."accountId" = target_account_id
        AND deletion_guard."releasedAt" IS NULL
        AND (
          deletion_guard.scope IN ('ACCOUNT', 'RELATIONSHIP_DATA')
          OR (
            deletion_guard.scope = 'DAY'
            AND deletion_guard."targetKey" = target_product_date::text
          )
        )
    ) THEN 'STATE_PRECONDITION_FAILED'
    ELSE 'ALLOWED'
  END;
$$;

REVOKE ALL ON FUNCTION "daily_energy"."resolve_checkin_guard_status"(uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "daily_energy"."resolve_checkin_guard_status"(uuid, date, text)
TO "daily_energy_api", "daily_energy_test";

-- Check-in revisions are append-only for the ordinary API. Current values may
-- advance only through the reviewed CAS column allowlist.
REVOKE DELETE ON TABLE
  "daily_energy"."app_morning_checkin",
  "daily_energy"."app_morning_checkin_revision"
FROM "daily_energy_api";

REVOKE UPDATE ON TABLE
  "daily_energy"."app_morning_checkin",
  "daily_energy"."app_morning_checkin_revision"
FROM "daily_energy_api";

GRANT UPDATE (revision, mood, energy, sleep, "updatedAt")
ON TABLE "daily_energy"."app_morning_checkin"
TO "daily_energy_api";

-- High-priority account/Safety/deletion/consent transitions and ordinary
-- check-in reads/writes share this transaction-scoped fence. This closes the
-- check-then-commit race without exposing restricted rows to the API role.
CREATE OR REPLACE FUNCTION "daily_energy"."lock_account_guard_from_account_id"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW."accountId"::text, 20400::bigint)
  );
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."lock_account_guard_from_account"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.id::text, 20400::bigint)
  );
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION "daily_energy"."lock_account_guard_from_account_id"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."lock_account_guard_from_account"() FROM PUBLIC;

CREATE TRIGGER "c004_account_state_guard_fence"
BEFORE UPDATE OF state ON "daily_energy"."app_user_account"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."lock_account_guard_from_account"();

CREATE TRIGGER "c004_consent_guard_fence"
BEFORE INSERT OR UPDATE ON "daily_energy"."app_necessary_consent_record"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."lock_account_guard_from_account_id"();

CREATE TRIGGER "c004_onboarding_guard_fence"
BEFORE INSERT OR UPDATE ON "daily_energy"."app_onboarding_completion"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."lock_account_guard_from_account_id"();

CREATE TRIGGER "c004_safety_guard_fence"
BEFORE INSERT OR UPDATE ON "daily_energy"."restricted_safety_state"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."lock_account_guard_from_account_id"();

CREATE TRIGGER "c004_deletion_guard_fence"
BEFORE INSERT OR UPDATE ON "daily_energy"."restricted_deletion_guard"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."lock_account_guard_from_account_id"();

-- Rollback target: drop the five c004_* triggers and their two lock functions,
-- drop resolve_checkin_guard_status(uuid,date,text), revoke its EXECUTE grant,
-- then restore the previous broad UPDATE/DELETE grants only after a security
-- review. No data-shape or destructive migration is applied.
