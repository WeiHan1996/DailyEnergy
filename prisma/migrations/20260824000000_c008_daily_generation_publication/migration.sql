SET search_path TO "daily_energy", pg_catalog;

-- C-008: expose one closed generation guard snapshot without granting the API
-- or ordinary worker direct access to restricted Safety/deletion rows.
CREATE OR REPLACE FUNCTION "daily_energy"."resolve_generation_guard_snapshot"(
  target_account_id uuid,
  target_product_date date,
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
           guard.scope = 'DAY'
           AND guard."targetKey" = target_product_date::text
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

REVOKE ALL ON FUNCTION "daily_energy"."resolve_generation_guard_snapshot"(uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "daily_energy"."resolve_generation_guard_snapshot"(uuid, date, text)
TO "daily_energy_api", "daily_energy_interactive", "daily_energy_test";

-- Generation state is monotonic. A retry may update revision metadata while
-- keeping the same state, but terminal states never return to active work.
CREATE OR REPLACE FUNCTION "daily_energy"."c008_check_generation_transition"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.revision < OLD.revision OR NEW.revision > OLD.revision + 1 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'C008_GENERATION_REVISION';
  END IF;
  IF NEW.state <> OLD.state THEN
    IF NOT (
      (OLD.state = 'QUEUED' AND NEW.state IN (
        'RUNNING', 'RETRYABLE_FAILED', 'TERMINAL_FAILED', 'CANCELLED'
      ))
      OR (OLD.state = 'RUNNING' AND NEW.state IN (
        'FALLBACK_RUNNING', 'RETRYABLE_FAILED', 'SUCCEEDED',
        'TERMINAL_FAILED', 'CANCELLED'
      ))
      OR (OLD.state = 'FALLBACK_RUNNING' AND NEW.state IN (
        'RETRYABLE_FAILED', 'SUCCEEDED', 'TERMINAL_FAILED', 'CANCELLED'
      ))
      OR (OLD.state = 'RETRYABLE_FAILED' AND NEW.state IN (
        'RUNNING', 'TERMINAL_FAILED', 'CANCELLED'
      ))
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'C008_GENERATION_TRANSITION';
    END IF;
    IF NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'C008_GENERATION_REVISION';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION "daily_energy"."c008_check_generation_transition"() FROM PUBLIC;
CREATE TRIGGER "c008_generation_transition"
BEFORE UPDATE OF state, revision ON "daily_energy"."app_generation_intent"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."c008_check_generation_transition"();

CREATE OR REPLACE FUNCTION "daily_energy"."c008_cancel_active_generation"(
  target_account_id uuid,
  target_product_date date,
  cancelled_at timestamptz,
  reason_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_account_id::text, 20400)
  );
  UPDATE "daily_energy"."app_generation_intent"
     SET state = 'CANCELLED',
         revision = revision + 1,
         "terminalReasonCode" = reason_code,
         "updatedAt" = cancelled_at
   WHERE "accountId" = target_account_id
     AND (target_product_date IS NULL OR "targetProductDate" = target_product_date)
     AND state IN ('QUEUED', 'RUNNING', 'FALLBACK_RUNNING', 'RETRYABLE_FAILED');
END
$$;

REVOKE ALL ON FUNCTION "daily_energy"."c008_cancel_active_generation"(uuid, date, timestamptz, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION "daily_energy"."c008_cancel_generation_on_account"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  IF NEW.state <> 'ACTIVE' THEN
    PERFORM "daily_energy"."c008_cancel_active_generation"(
      NEW.id, NULL, NEW."updatedAt", 'ACCOUNT_NOT_ACTIVE'
    );
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c008_cancel_generation_on_safety"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  IF NEW.state IN ('ACTIVE', 'RECOVERY_PENDING') THEN
    PERFORM "daily_energy"."c008_cancel_active_generation"(
      NEW."accountId", NULL, NEW."updatedAt", 'SAFETY_OVERLAY_ACTIVE'
    );
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c008_cancel_generation_on_deletion"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  IF NEW."releasedAt" IS NULL AND NEW.scope IN ('ACCOUNT', 'RELATIONSHIP_DATA') THEN
    PERFORM "daily_energy"."c008_cancel_active_generation"(
      NEW."accountId", NULL, NEW."semanticBlockedAt", 'DELETION_IN_PROGRESS'
    );
  ELSIF NEW."releasedAt" IS NULL AND NEW.scope = 'DAY' THEN
    PERFORM "daily_energy"."c008_cancel_active_generation"(
      NEW."accountId", NEW."targetKey"::date,
      NEW."semanticBlockedAt", 'DAY_SOURCE_INVALID'
    );
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c008_cancel_generation_on_consent"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  IF NEW.status = 'WITHDRAWN' THEN
    PERFORM "daily_energy"."c008_cancel_active_generation"(
      NEW."accountId", NULL, NEW."withdrawnAt", 'CONSENT_REQUIRED'
    );
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION "daily_energy"."c008_cancel_generation_on_account"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."c008_cancel_generation_on_safety"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."c008_cancel_generation_on_deletion"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."c008_cancel_generation_on_consent"() FROM PUBLIC;

CREATE TRIGGER "c008_account_generation_cancel"
AFTER UPDATE OF state ON "daily_energy"."app_user_account"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."c008_cancel_generation_on_account"();
CREATE TRIGGER "c008_safety_generation_cancel"
AFTER INSERT OR UPDATE OF state ON "daily_energy"."restricted_safety_state"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."c008_cancel_generation_on_safety"();
CREATE TRIGGER "c008_deletion_generation_cancel"
AFTER INSERT OR UPDATE ON "daily_energy"."restricted_deletion_guard"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."c008_cancel_generation_on_deletion"();
CREATE TRIGGER "c008_consent_generation_cancel"
AFTER INSERT ON "daily_energy"."app_necessary_consent_record"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."c008_cancel_generation_on_consent"();

-- API creates intents/snapshots/outbox but cannot mutate the lifecycle or
-- immutable payloads after acceptance. Interactive is the sole publisher.
REVOKE UPDATE, DELETE ON TABLE
  "daily_energy"."app_generation_intent",
  "daily_energy"."app_generation_input_snapshot",
  "daily_energy"."app_published_daily_result",
  "daily_energy"."app_published_result_visibility"
FROM "daily_energy_api";

-- Rollback: drop the four c008_* cancel triggers and their functions, drop
-- c008_generation_transition/function, drop resolve_generation_guard_snapshot
-- and revoke its grants. Restore API UPDATE/DELETE only after security review.
-- No row is rewritten or deleted by this migration.
