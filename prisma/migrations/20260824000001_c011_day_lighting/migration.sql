SET search_path TO "daily_energy", pg_catalog;

-- C-011: ordinary history needs only a closed account/Safety/deletion decision,
-- never direct access to restricted rows.
CREATE OR REPLACE FUNCTION "daily_energy"."resolve_c011_history_guard"(
  target_account_id uuid,
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
      SELECT 1 FROM "daily_energy"."restricted_safety_state" safety
       WHERE safety."accountId" = target_account_id
         AND safety.state IN ('ACTIVE', 'RECOVERY_PENDING')
    ) THEN 'SAFETY_BLOCKED'
    WHEN NOT EXISTS (
      SELECT 1 FROM "daily_energy"."app_user_account" account
       WHERE account.id = target_account_id
    ) THEN 'ACCOUNT_DELETED'
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
       ORDER BY consent."createdAt" DESC, consent.id DESC
       LIMIT 1
    ), false) = false THEN 'CONSENT_REQUIRED'
    WHEN NOT EXISTS (
      SELECT 1 FROM "daily_energy"."app_onboarding_completion" onboarding
       WHERE onboarding."accountId" = target_account_id
    ) THEN 'ONBOARDING_REQUIRED'
    WHEN EXISTS (
      SELECT 1 FROM "daily_energy"."restricted_deletion_guard" guard
       WHERE guard."accountId" = target_account_id
         AND guard."releasedAt" IS NULL
         AND guard.scope IN ('ACCOUNT', 'RELATIONSHIP_DATA')
    ) THEN 'ACCOUNT_DELETING'
    ELSE 'ALLOWED'
  END;
$$;

-- The relationship worker receives only the monotonic cutoff and whether a
-- relationship deletion is currently semantically blocking consumption.
CREATE OR REPLACE FUNCTION "daily_energy"."resolve_c011_relationship_guard"(
  target_account_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
  SELECT jsonb_build_object(
    'blocked', EXISTS (
      SELECT 1 FROM "daily_energy"."restricted_data_task" task
       WHERE task."accountId" = target_account_id
         AND task.scope = 'RELATIONSHIP_DATA'
         AND task."activeSlot" IS TRUE
    ) OR EXISTS (
      SELECT 1 FROM "daily_energy"."restricted_deletion_guard" guard
       WHERE guard."accountId" = target_account_id
         AND guard.scope = 'RELATIONSHIP_DATA'
         AND guard."releasedAt" IS NULL
    ),
    'deletion_epoch', COALESCE((
      SELECT max(guard."deletionEpoch")::text
        FROM "daily_energy"."restricted_deletion_guard" guard
       WHERE guard."accountId" = target_account_id
         AND guard.scope = 'RELATIONSHIP_DATA'
    ), '0'),
    'cutoff_at', COALESCE((
      SELECT max(guard."semanticBlockedAt")
        FROM "daily_energy"."restricted_deletion_guard" guard
       WHERE guard."accountId" = target_account_id
         AND guard.scope = 'RELATIONSHIP_DATA'
    ), (
      SELECT account."createdAt"
        FROM "daily_energy"."app_user_account" account
       WHERE account.id = target_account_id
    ))
  );
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."list_c011_history_days"(
  target_account_id uuid,
  end_product_date date
)
RETURNS TABLE (
  product_date text,
  recorded boolean,
  has_result boolean,
  is_lit boolean,
  has_evening_feedback boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
  SELECT day."productDate"::date::text,
         (checkin.id IS NOT NULL OR visibility.id IS NOT NULL OR interaction.id IS NOT NULL),
         (visibility.id IS NOT NULL),
         (light.id IS NOT NULL),
         (feedback.id IS NOT NULL)
    FROM generate_series(
      end_product_date - 6,
      end_product_date,
      interval '1 day'
    ) AS day("productDate")
    LEFT JOIN "daily_energy"."app_morning_checkin" checkin
      ON checkin."accountId" = target_account_id
     AND checkin."productDate" = day."productDate"
    LEFT JOIN "daily_energy"."app_published_daily_result" result
      ON result."accountId" = target_account_id
     AND result."productDate" = day."productDate"
    LEFT JOIN "daily_energy"."app_published_result_visibility" visibility
      ON visibility."resultId" = result.id AND visibility.state = 'AVAILABLE'
    LEFT JOIN "daily_energy"."app_daily_interaction" interaction
      ON interaction."accountId" = target_account_id
     AND interaction."productDate" = day."productDate"
     AND interaction."resultId" = visibility."resultId"
    LEFT JOIN "daily_energy"."app_daily_light_fact" light
      ON light."interactionId" = interaction.id
    LEFT JOIN "daily_energy"."app_evening_feedback_record" feedback
      ON feedback."interactionId" = interaction.id
   ORDER BY day."productDate" DESC;
$$;

REVOKE ALL ON FUNCTION "daily_energy"."resolve_c011_history_guard"(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."resolve_c011_relationship_guard"(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."list_c011_history_days"(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "daily_energy"."resolve_c011_history_guard"(uuid, text)
TO "daily_energy_api", "daily_energy_test";
GRANT EXECUTE ON FUNCTION "daily_energy"."resolve_c011_relationship_guard"(uuid)
TO "daily_energy_background", "daily_energy_test";
GRANT EXECUTE ON FUNCTION "daily_energy"."list_c011_history_days"(uuid, date)
TO "daily_energy_api", "daily_energy_test";
GRANT EXECUTE ON FUNCTION "daily_energy"."resolve_generation_guard_snapshot"(uuid, date, text)
TO "daily_energy_background";

-- Rollback: revoke the added background grant, then drop
-- list_c011_history_days(uuid,date), resolve_c011_relationship_guard(uuid) and
-- resolve_c011_history_guard(uuid,text).
-- This migration does not rewrite or delete application rows.
