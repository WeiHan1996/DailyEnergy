SET search_path TO "daily_energy", pg_catalog;

-- C-005: every continuation grant binds the exact ProductDate policy. Existing
-- development rows predate the runtime implementation and are upgraded to v1.
ALTER TABLE "daily_energy"."app_view_continuation_grant"
  ADD COLUMN "productDatePolicyVersion" varchar(64) NOT NULL DEFAULT 'product-date-v1';
ALTER TABLE "daily_energy"."app_view_continuation_grant"
  ALTER COLUMN "productDatePolicyVersion" DROP DEFAULT;

ALTER TABLE "daily_energy"."app_view_continuation_grant"
  ADD CONSTRAINT "c005_view_grant_contract" CHECK (
    "productDatePolicyVersion" = 'product-date-v1'
    AND "expiresAt" = "boundaryAt" + interval '30 minutes'
    AND "createdAt" < "boundaryAt"
    AND ("invalidatedAt" IS NULL OR "invalidatedAt" >= "createdAt")
    AND "resultRef" IS NOT NULL
    AND (
      (
        "surfaceCode" = 'DLY-003'
        AND "feedbackRevision" IS NULL
        AND "allowedOperations" = ARRAY[
          'ILLUMINATE', 'TASK_STATUS_SET', 'CONTENT_HELPFULNESS_SET'
        ]::text[]
      )
      OR
      (
        "surfaceCode" = 'EVE-001'
        AND "feedbackRevision" IS NOT NULL
        AND "feedbackRevision" >= 0
        AND "allowedOperations" = ARRAY['EVENING_SAVE']::text[]
      )
    )
  );

-- The ordinary API can create a grant and can only invalidate it by advancing
-- revision. It cannot rewrite owner/date/surface/expiry or delete history.
REVOKE UPDATE, DELETE ON TABLE
  "daily_energy"."app_view_continuation_grant"
FROM "daily_energy_api";
GRANT UPDATE (revision, "invalidatedAt")
ON TABLE "daily_energy"."app_view_continuation_grant"
TO "daily_energy_api";

CREATE OR REPLACE FUNCTION "daily_energy"."invalidate_view_grants_for_account"(
  target_account_id uuid,
  invalidated_at timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
  UPDATE "daily_energy"."app_view_continuation_grant"
     SET "invalidatedAt" = GREATEST(invalidated_at, "createdAt"),
         revision = revision + 1
   WHERE "accountId" = target_account_id
     AND "invalidatedAt" IS NULL;
$$;

REVOKE ALL ON FUNCTION "daily_energy"."invalidate_view_grants_for_account"(uuid, timestamptz) FROM PUBLIC;

CREATE OR REPLACE FUNCTION "daily_energy"."invalidate_view_grants_for_day"(
  target_account_id uuid,
  target_product_date text,
  invalidated_at timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
  UPDATE "daily_energy"."app_view_continuation_grant"
     SET "invalidatedAt" = GREATEST(invalidated_at, "createdAt"),
         revision = revision + 1
   WHERE "accountId" = target_account_id
     AND "productDate"::text = target_product_date
     AND "invalidatedAt" IS NULL;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."invalidate_view_grants_for_result"(
  target_result_id uuid,
  invalidated_at timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
  UPDATE "daily_energy"."app_view_continuation_grant"
     SET "invalidatedAt" = GREATEST(invalidated_at, "createdAt"),
         revision = revision + 1
   WHERE "resultRef" = target_result_id
     AND "invalidatedAt" IS NULL;
$$;

REVOKE ALL ON FUNCTION "daily_energy"."invalidate_view_grants_for_day"(uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."invalidate_view_grants_for_result"(uuid, timestamptz) FROM PUBLIC;

CREATE OR REPLACE FUNCTION "daily_energy"."resolve_c005_continuation_result_guard"(
  target_result_id uuid,
  target_account_id uuid,
  target_product_date date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE allowed boolean;
BEGIN
  SELECT true INTO allowed
    FROM "daily_energy"."app_published_daily_result" result
    JOIN "daily_energy"."app_published_result_visibility" visibility
      ON visibility."resultId"=result.id
   WHERE result.id=target_result_id
     AND result."accountId"=target_account_id
     AND result."productDate"=target_product_date
     AND visibility.state IN ('AVAILABLE','FALLBACK_ONLY')
   FOR SHARE OF result,visibility;
  RETURN COALESCE(allowed,false);
END
$$;

REVOKE ALL ON FUNCTION "daily_energy"."resolve_c005_continuation_result_guard"(uuid,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "daily_energy"."resolve_c005_continuation_result_guard"(uuid,uuid,date)
TO "daily_energy_api","daily_energy_test";

CREATE OR REPLACE FUNCTION "daily_energy"."c005_invalidate_grants_on_account"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  IF NEW.state <> 'ACTIVE' THEN
    PERFORM "daily_energy"."invalidate_view_grants_for_account"(
      NEW.id, NEW."updatedAt"
    );
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c005_invalidate_grants_on_safety"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  IF NEW.state IN ('ACTIVE', 'RECOVERY_PENDING') THEN
    PERFORM "daily_energy"."invalidate_view_grants_for_account"(
      NEW."accountId", NEW."updatedAt"
    );
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c005_invalidate_grants_on_deletion"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  IF NEW."releasedAt" IS NULL AND NEW.scope = 'ACCOUNT' THEN
    PERFORM "daily_energy"."invalidate_view_grants_for_account"(
      NEW."accountId", NEW."semanticBlockedAt"
    );
  ELSIF NEW."releasedAt" IS NULL AND NEW.scope = 'DAY' THEN
    PERFORM "daily_energy"."invalidate_view_grants_for_day"(
      NEW."accountId", NEW."targetKey", NEW."semanticBlockedAt"
    );
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c005_invalidate_grants_on_session"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  IF NEW."revokedAt" IS NOT NULL AND OLD."revokedAt" IS NULL THEN
    UPDATE "daily_energy"."app_view_continuation_grant"
       SET "invalidatedAt" = GREATEST(NEW."revokedAt", "createdAt"),
           revision = revision + 1
     WHERE "sessionId" = NEW.id
       AND "invalidatedAt" IS NULL;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c005_invalidate_grants_on_visibility"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  IF NEW.state = 'BLOCKED' THEN
    PERFORM "daily_energy"."invalidate_view_grants_for_result"(
      NEW."resultId", NEW."updatedAt"
    );
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c005_invalidate_grants_on_consent"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  IF NEW.status = 'WITHDRAWN' THEN
    PERFORM "daily_energy"."invalidate_view_grants_for_account"(
      NEW."accountId", NEW."withdrawnAt"
    );
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION "daily_energy"."c005_invalidate_grants_on_account"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."c005_invalidate_grants_on_safety"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."c005_invalidate_grants_on_deletion"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."c005_invalidate_grants_on_consent"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."c005_invalidate_grants_on_session"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."c005_invalidate_grants_on_visibility"() FROM PUBLIC;

CREATE TRIGGER "c005_account_grant_invalidation"
AFTER UPDATE OF state ON "daily_energy"."app_user_account"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."c005_invalidate_grants_on_account"();

CREATE TRIGGER "c005_safety_grant_invalidation"
AFTER INSERT OR UPDATE ON "daily_energy"."restricted_safety_state"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."c005_invalidate_grants_on_safety"();

CREATE TRIGGER "c005_deletion_grant_invalidation"
AFTER INSERT OR UPDATE ON "daily_energy"."restricted_deletion_guard"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."c005_invalidate_grants_on_deletion"();

CREATE TRIGGER "c005_consent_grant_invalidation"
AFTER INSERT ON "daily_energy"."app_necessary_consent_record"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."c005_invalidate_grants_on_consent"();

CREATE TRIGGER "c005_session_grant_invalidation"
AFTER UPDATE OF "revokedAt" ON "daily_energy"."app_session_credential"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."c005_invalidate_grants_on_session"();

CREATE TRIGGER "c005_visibility_grant_invalidation"
AFTER INSERT OR UPDATE OF state ON "daily_energy"."app_published_result_visibility"
FOR EACH ROW EXECUTE FUNCTION "daily_energy"."c005_invalidate_grants_on_visibility"();

-- Rollback target: drop the six c005_* triggers, their trigger functions and
-- the three invalidate_view_grants_* functions and the continuation result guard;
-- drop c005_view_grant_contract and the
-- productDatePolicyVersion column; restore prior API UPDATE/DELETE grants only
-- after a security review. No user content is transformed.
