SET search_path TO "daily_energy", pg_catalog;

-- C-013 ordinary and background callers need one closed guard projection. DAY
-- deletion contributes an epoch and makes its slot missing, but does not block
-- the remaining window from being rebuilt.
CREATE OR REPLACE FUNCTION "daily_energy"."resolve_c013_weekly_guard"(
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
  SELECT jsonb_build_object(
    'status', CASE
      WHEN EXISTS (
        SELECT 1 FROM "daily_energy"."restricted_safety_state" safety
         WHERE safety."accountId"=target_account_id
           AND safety.state IN ('ACTIVE','RECOVERY_PENDING')
      ) THEN 'SAFETY_BLOCKED'
      WHEN NOT EXISTS (
        SELECT 1 FROM "daily_energy"."app_user_account" account
         WHERE account.id=target_account_id
      ) THEN 'ACCOUNT_DELETED'
      WHEN EXISTS (
        SELECT 1 FROM "daily_energy"."app_user_account" account
         WHERE account.id=target_account_id AND account.state='DELETING'
      ) THEN 'ACCOUNT_DELETING'
      WHEN EXISTS (
        SELECT 1 FROM "daily_energy"."app_user_account" account
         WHERE account.id=target_account_id AND account.state='DELETED'
      ) THEN 'ACCOUNT_DELETED'
      WHEN EXISTS (
        SELECT 1 FROM "daily_energy"."app_user_account" account
         WHERE account.id=target_account_id AND account.state='RESTRICTED'
      ) THEN 'ACCOUNT_RESTRICTED'
      WHEN COALESCE((
        SELECT consent.status='ACCEPTED'
          AND consent."noticeVersion"=current_notice_version
          FROM "daily_energy"."app_necessary_consent_record" consent
         WHERE consent."accountId"=target_account_id
           AND consent."logicalIntent"='ORDINARY_USE'
         ORDER BY consent."createdAt" DESC,consent.id DESC
         LIMIT 1
      ),false)=false THEN 'CONSENT_REQUIRED'
      WHEN NOT EXISTS (
        SELECT 1 FROM "daily_energy"."app_onboarding_completion" onboarding
         WHERE onboarding."accountId"=target_account_id
      ) THEN 'ONBOARDING_REQUIRED'
      WHEN EXISTS (
        SELECT 1 FROM "daily_energy"."restricted_deletion_guard" guard
         WHERE guard."accountId"=target_account_id
           AND guard."releasedAt" IS NULL
           AND guard.scope IN ('ACCOUNT','RELATIONSHIP_DATA')
      ) THEN 'ACCOUNT_DELETING'
      ELSE 'ALLOWED'
    END,
    'safety_epoch',COALESCE((
      SELECT max(safety."guardEpoch")::text
        FROM "daily_energy"."restricted_safety_state" safety
       WHERE safety."accountId"=target_account_id
    ),'0'),
    'deletion_epoch',COALESCE((
      SELECT max(guard."deletionEpoch")::text
        FROM "daily_energy"."restricted_deletion_guard" guard
       WHERE guard."accountId"=target_account_id
         AND (
           guard.scope IN ('ACCOUNT','RELATIONSHIP_DATA')
           OR (guard.scope='DAY' AND guard."targetKey"=target_product_date::text)
         )
    ),'0')
  );
$$;

-- The function exposes only the exact source values accepted by
-- WeeklySourceSnapshot. Ciphertext, notes, entertainment scores, model text,
-- owner internals and deletion reasons never cross this projection.
CREATE OR REPLACE FUNCTION "daily_energy"."list_c013_weekly_source_days"(
  target_account_id uuid,
  end_product_date date
)
RETURNS TABLE (
  "productDate" text,
  "checkinRef" uuid,
  "checkinRevision" integer,
  mood text,
  energy text,
  sleep text,
  "feedbackRef" uuid,
  "feedbackRevision" integer,
  "overallFeeling" text,
  "lightRef" uuid,
  "lightRevision" integer,
  "helpfulnessRef" uuid,
  "helpfulnessRevision" integer,
  "helpfulnessRating" text,
  "actionKind" text,
  "taskRef" uuid,
  "taskRevision" integer,
  "taskStatus" text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
  WITH days AS (
    SELECT day::date AS product_date
      FROM generate_series(
        end_product_date-6,
        end_product_date,
        interval '1 day'
      ) day
  )
  SELECT days.product_date::text,
         checkin.id,checkin.revision,checkin.mood::text,
         checkin.energy::text,checkin.sleep::text,
         feedback.id,feedback_overall_revision.revision,
         feedback."overallFeeling"::text,
         light.id,light."sourceValidityRevision",
         helpfulness.id,helpfulness.revision,helpfulness.rating::text,
         CASE WHEN helpfulness.rating='HELPFUL'
              THEN action_candidate.value->>'kind' END,
         task.id,task.revision,task.status::text
    FROM days
    LEFT JOIN "daily_energy"."restricted_deletion_guard" day_guard
      ON day_guard."accountId"=target_account_id
     AND day_guard.scope='DAY'
     AND day_guard."targetKey"=days.product_date::text
     AND day_guard."releasedAt" IS NULL
    LEFT JOIN "daily_energy"."app_morning_checkin" checkin
      ON day_guard.id IS NULL
     AND checkin."accountId"=target_account_id
     AND checkin."productDate"=days.product_date
    LEFT JOIN "daily_energy"."app_published_daily_result" result
      ON day_guard.id IS NULL
     AND result."accountId"=target_account_id
     AND result."productDate"=days.product_date
    LEFT JOIN "daily_energy"."app_published_result_visibility" visibility
      ON visibility."resultId"=result.id AND visibility.state='AVAILABLE'
    LEFT JOIN "daily_energy"."app_daily_interaction" interaction
      ON interaction."accountId"=target_account_id
     AND interaction."productDate"=days.product_date
     AND interaction."resultId"=visibility."resultId"
    LEFT JOIN "daily_energy"."app_evening_feedback_record" feedback
      ON feedback."interactionId"=interaction.id
    LEFT JOIN LATERAL (
      SELECT max(revision.revision)::integer AS revision
        FROM "daily_energy"."app_evening_feedback_revision" revision
       WHERE revision."feedbackId"=feedback.id
         AND 'overall_feeling'=ANY(revision."changedFieldNames")
    ) feedback_overall_revision ON true
    LEFT JOIN "daily_energy"."app_daily_light_fact" light
      ON light."interactionId"=interaction.id
    LEFT JOIN "daily_energy"."app_daily_helpfulness_record" helpfulness
      ON helpfulness."interactionId"=interaction.id
    LEFT JOIN "daily_energy"."app_daily_task_state" task
      ON task."interactionId"=interaction.id
    LEFT JOIN LATERAL jsonb_array_elements(
      COALESCE(result."ruleFactsPayload"->'action_candidates','[]'::jsonb)
    ) action_candidate(value)
      ON action_candidate.value->>'action_id'=
         result."ruleFactsPayload"->>'selected_action_id'
   ORDER BY days.product_date;
$$;

-- Queue envelopes contain only an opaque aggregate ref. This closed resolver
-- maps the three accepted source families without granting the Background
-- role direct access to restricted deletion rows.
CREATE OR REPLACE FUNCTION "daily_energy"."resolve_c013_weekly_source_event"(
  source_event_type text,
  source_aggregate_ref uuid
)
RETURNS TABLE (
  "accountId" uuid,
  "productDate" text,
  "sourceRevision" integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
  SELECT source."accountId",source."productDate",source."sourceRevision"
    FROM (
      SELECT checkin."accountId",checkin."productDate"::text AS "productDate",
             checkin.revision AS "sourceRevision"
        FROM "daily_energy"."app_morning_checkin" checkin
       WHERE source_event_type='CheckinCorrected'
         AND checkin.id=source_aggregate_ref
      UNION ALL
      SELECT result."accountId",result."productDate"::text,1
        FROM "daily_energy"."app_published_daily_result" result
       WHERE source_event_type='DailyResultPublished'
         AND result.id=source_aggregate_ref
      UNION ALL
      SELECT interaction."accountId",interaction."productDate"::text,
             interaction."aggregateRevision"
        FROM "daily_energy"."app_daily_interaction" interaction
       WHERE source_event_type='WeeklySourceChanged'
         AND interaction.id=source_aggregate_ref
      UNION ALL
      SELECT guard."accountId",guard."targetKey",guard.revision
        FROM "daily_energy"."restricted_deletion_guard" guard
       WHERE source_event_type='WeeklySourceChanged'
         AND guard.id=source_aggregate_ref AND guard.scope='DAY'
         AND guard."targetKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    ) source
   LIMIT 1;
$$;

-- Published summaries remain immutable. Background may only freeze the
-- retention clock of a superseded revision; every content or identity field
-- stays protected by SQL-008.
CREATE OR REPLACE FUNCTION "daily_energy"."reject_immutable_change"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP='UPDATE' AND TG_TABLE_NAME='app_published_weekly_summary_revision' THEN
    IF pg_has_role(session_user,'daily_energy_background','MEMBER')
       AND (to_jsonb(NEW)-ARRAY['retentionAnchorAt','expiresAt']::text[])=
           (to_jsonb(OLD)-ARRAY['retentionAnchorAt','expiresAt']::text[])
       AND (
         (OLD."expiresAt" IS NULL
          AND NEW."retentionAnchorAt">=OLD."retentionAnchorAt"
          AND NEW."expiresAt"=NEW."retentionAnchorAt"+interval '30 days')
         OR
         (OLD."expiresAt" IS NOT NULL
          AND NEW."retentionAnchorAt"=OLD."retentionAnchorAt"
          AND NEW."expiresAt"=OLD."expiresAt")
       ) THEN
      RETURN NEW;
    END IF;
  END IF;
  IF TG_OP='DELETE'
     AND TG_TABLE_NAME IN (
       'app_generation_input_snapshot',
       'app_published_daily_result',
       'app_published_weekly_summary_revision'
     )
     AND pg_has_role(session_user,'daily_energy_deletion','MEMBER') THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='SQL-008';
END
$$;

GRANT UPDATE ("retentionAnchorAt","expiresAt")
ON TABLE "daily_energy"."app_published_weekly_summary_revision"
TO "daily_energy_background";

REVOKE ALL ON FUNCTION "daily_energy"."resolve_c013_weekly_guard"(uuid,date,text)
FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."list_c013_weekly_source_days"(uuid,date)
FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."resolve_c013_weekly_source_event"(text,uuid)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "daily_energy"."resolve_c013_weekly_guard"(uuid,date,text)
TO "daily_energy_api","daily_energy_background","daily_energy_test";
GRANT EXECUTE ON FUNCTION "daily_energy"."list_c013_weekly_source_days"(uuid,date)
TO "daily_energy_api","daily_energy_background","daily_energy_test";
GRANT EXECUTE ON FUNCTION "daily_energy"."resolve_c013_weekly_source_event"(text,uuid)
TO "daily_energy_background","daily_energy_test";

-- Rollback: revoke the column UPDATE grant, restore the prior SQL-008 trigger
-- body, revoke the function grants and drop the C-013 functions. The migration
-- is additive and does not rewrite or delete user rows.
