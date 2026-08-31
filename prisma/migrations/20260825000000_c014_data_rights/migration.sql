SET search_path TO "daily_energy", pg_catalog;

CREATE TYPE "ExportArtifactState" AS ENUM
  ('PREPARING','READY','EXPIRED','INVALIDATED');

-- The preceding enum migration commits CANCELLED before this migration uses
-- it in constraints and function bodies. A cancelled task has no guard.
ALTER TABLE "daily_energy"."restricted_data_task"
  DROP CONSTRAINT "restricted_data_task_active_slot_ck";
ALTER TABLE "daily_energy"."restricted_data_task"
  ADD CONSTRAINT "restricted_data_task_active_slot_ck" CHECK (
    ("state" IN ('QUEUED', 'RUNNING', 'FAILED') AND "activeSlot" IS TRUE) OR
    ("state" IN ('SUCCEEDED', 'CANCELLED') AND "activeSlot" IS NULL)
  );
ALTER TABLE "daily_energy"."restricted_data_task"
  DROP CONSTRAINT "restricted_data_task_timeline_ck";
ALTER TABLE "daily_energy"."restricted_data_task"
  ADD CONSTRAINT "restricted_data_task_timeline_ck" CHECK (
    ("guardedAt" IS NULL OR "guardedAt">="requestedAt") AND
    (kind='EXPORT' OR "startedAt" IS NULL OR
      ("guardedAt" IS NOT NULL AND "startedAt">="guardedAt")) AND
    (kind='DELETE' OR "guardedAt" IS NULL) AND
    ("onlineErasedAt" IS NULL OR (kind='DELETE' AND "startedAt" IS NOT NULL
      AND "onlineErasedAt">="startedAt")) AND
    ("finishedAt" IS NULL OR "state"='CANCELLED' OR
      ("startedAt" IS NOT NULL AND "finishedAt">="startedAt")) AND
    ("state"<>'SUCCEEDED' OR
      (kind='DELETE' AND "onlineErasedAt" IS NOT NULL
        AND "backupPurgeDeadline" IS NOT NULL AND "finishedAt" IS NOT NULL) OR
      (kind='EXPORT' AND "onlineErasedAt" IS NULL
        AND "backupPurgeDeadline" IS NULL AND "finishedAt" IS NOT NULL))
  );

CREATE TABLE "restricted_deletion_confirmation_challenge" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "accountId" uuid NOT NULL,
  "commandRef" uuid NOT NULL,
  "scope" "daily_energy"."DataTaskScope" NOT NULL,
  "targetKey" varchar(160) NOT NULL,
  "frozenPayload" jsonb NOT NULL,
  "expectedRevision" integer NOT NULL,
  "confirmationVersion" varchar(64) NOT NULL,
  "identityReverificationRequired" boolean NOT NULL,
  "createdAt" timestamptz(3) NOT NULL,
  "expiresAt" timestamptz(3) NOT NULL,
  "consumedAt" timestamptz(3),
  "retentionPolicyVersion" varchar(64) NOT NULL,
  "retentionScope" "daily_energy"."RetentionScope" NOT NULL DEFAULT 'RUNTIME',
  "retentionAnchorAt" timestamptz(3) NOT NULL,
  CONSTRAINT "restricted_deletion_confirmation_challenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "restricted_deletion_confirmation_challenge_timeline_ck" CHECK (
    "expiresAt">"createdAt" AND "expiresAt"<="createdAt"+interval '10 minutes'
    AND ("consumedAt" IS NULL OR "consumedAt">="createdAt")
  ),
  CONSTRAINT "restricted_deletion_confirmation_challenge_payload_ck" CHECK (
    jsonb_typeof("frozenPayload")='object' AND "expectedRevision">0
  )
);
CREATE UNIQUE INDEX "restricted_deletion_confirmation_challenge_account_command_key"
  ON "daily_energy"."restricted_deletion_confirmation_challenge"("accountId","commandRef");
CREATE INDEX "restricted_del_challenge_account_scope_expiry_idx"
  ON "daily_energy"."restricted_deletion_confirmation_challenge"("accountId","scope","expiresAt");
CREATE INDEX "restricted_deletion_confirmation_challenge_expiry_idx"
  ON "daily_energy"."restricted_deletion_confirmation_challenge"("expiresAt");
ALTER TABLE "daily_energy"."restricted_deletion_confirmation_challenge"
  ADD CONSTRAINT "restricted_deletion_confirmation_challenge_account_fkey"
  FOREIGN KEY ("accountId") REFERENCES "daily_energy"."app_user_account"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "restricted_identity_verification" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "accountId" uuid NOT NULL,
  "challengeId" uuid NOT NULL,
  "verifiedAt" timestamptz(3) NOT NULL,
  "expiresAt" timestamptz(3) NOT NULL,
  "consumedAt" timestamptz(3),
  "retentionPolicyVersion" varchar(64) NOT NULL,
  "retentionScope" "daily_energy"."RetentionScope" NOT NULL DEFAULT 'RUNTIME',
  "retentionAnchorAt" timestamptz(3) NOT NULL,
  CONSTRAINT "restricted_identity_verification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "restricted_identity_verification_timeline_ck" CHECK (
    "expiresAt">"verifiedAt" AND "expiresAt"<="verifiedAt"+interval '5 minutes'
    AND ("consumedAt" IS NULL OR "consumedAt">="verifiedAt")
  )
);
CREATE UNIQUE INDEX "restricted_identity_verification_challenge_key"
  ON "daily_energy"."restricted_identity_verification"("challengeId");
CREATE INDEX "restricted_identity_verification_account_expiry_idx"
  ON "daily_energy"."restricted_identity_verification"("accountId","expiresAt");
CREATE INDEX "restricted_identity_verification_expiry_idx"
  ON "daily_energy"."restricted_identity_verification"("expiresAt");
ALTER TABLE "daily_energy"."restricted_identity_verification"
  ADD CONSTRAINT "restricted_identity_verification_account_fkey"
  FOREIGN KEY ("accountId") REFERENCES "daily_energy"."app_user_account"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_energy"."restricted_identity_verification"
  ADD CONSTRAINT "restricted_identity_verification_challenge_fkey"
  FOREIGN KEY ("challengeId")
  REFERENCES "daily_energy"."restricted_deletion_confirmation_challenge"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "restricted_export_manifest" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "taskId" uuid NOT NULL,
  "sourceRevisionVector" jsonb NOT NULL,
  "sourceFingerprint" bytea NOT NULL,
  "schemaVersion" varchar(64) NOT NULL,
  "policyVersion" varchar(64) NOT NULL,
  "downloadRef" uuid NOT NULL,
  "state" "daily_energy"."ExportArtifactState" NOT NULL DEFAULT 'PREPARING',
  "readyAt" timestamptz(3),
  "expiresAt" timestamptz(3) NOT NULL,
  "invalidatedAt" timestamptz(3),
  "expiredAt" timestamptz(3),
  "updatedAt" timestamptz(3) NOT NULL,
  "retentionPolicyVersion" varchar(64) NOT NULL,
  "retentionScope" "daily_energy"."RetentionScope" NOT NULL DEFAULT 'EXPORT',
  "retentionAnchorAt" timestamptz(3) NOT NULL,
  CONSTRAINT "restricted_export_manifest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "restricted_export_manifest_source_ck" CHECK (
    jsonb_typeof("sourceRevisionVector")='object'
    AND octet_length("sourceFingerprint")=32
  ),
  CONSTRAINT "restricted_export_manifest_timeline_ck" CHECK (
    "expiresAt">"retentionAnchorAt"
    AND "expiresAt"<="retentionAnchorAt"+interval '24 hours'
    AND (("state"='PREPARING' AND "readyAt" IS NULL)
      OR ("state"<>'PREPARING' AND "readyAt" IS NOT NULL))
    AND ("invalidatedAt" IS NULL OR "state"='INVALIDATED')
    AND ("expiredAt" IS NULL OR "state"='EXPIRED')
  )
);
CREATE UNIQUE INDEX "restricted_export_manifest_task_key"
  ON "daily_energy"."restricted_export_manifest"("taskId");
CREATE UNIQUE INDEX "restricted_export_manifest_download_key"
  ON "daily_energy"."restricted_export_manifest"("downloadRef");
CREATE INDEX "restricted_export_manifest_state_expiry_idx"
  ON "daily_energy"."restricted_export_manifest"("state","expiresAt");
CREATE INDEX "restricted_export_manifest_retention_anchor_idx"
  ON "daily_energy"."restricted_export_manifest"("retentionAnchorAt");
ALTER TABLE "daily_energy"."restricted_export_manifest"
  ADD CONSTRAINT "restricted_export_manifest_task_fkey"
  FOREIGN KEY ("taskId") REFERENCES "daily_energy"."restricted_data_task"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "restricted_deletion_status_grant" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "taskId" uuid NOT NULL,
  "tokenHash" bytea NOT NULL,
  "failedAttemptCount" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz(3) NOT NULL,
  "expiresAt" timestamptz(3) NOT NULL,
  "terminalObservedAt" timestamptz(3),
  "retentionPolicyVersion" varchar(64) NOT NULL,
  "retentionScope" "daily_energy"."RetentionScope" NOT NULL DEFAULT 'RUNTIME',
  "retentionAnchorAt" timestamptz(3) NOT NULL,
  CONSTRAINT "restricted_deletion_status_grant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "restricted_deletion_status_grant_token_ck" CHECK (
    octet_length("tokenHash")=32 AND "failedAttemptCount">=0
  ),
  CONSTRAINT "restricted_deletion_status_grant_timeline_ck" CHECK (
    "expiresAt">"createdAt"
    AND "expiresAt"<="createdAt"+interval '7 days'
    AND ("terminalObservedAt" IS NULL OR "terminalObservedAt">="createdAt")
  )
);
CREATE UNIQUE INDEX "restricted_deletion_status_grant_task_key"
  ON "daily_energy"."restricted_deletion_status_grant"("taskId");
CREATE UNIQUE INDEX "restricted_deletion_status_grant_token_key"
  ON "daily_energy"."restricted_deletion_status_grant"("tokenHash");
CREATE INDEX "restricted_deletion_status_grant_expiry_idx"
  ON "daily_energy"."restricted_deletion_status_grant"("expiresAt");
ALTER TABLE "daily_energy"."restricted_deletion_status_grant"
  ADD CONSTRAINT "restricted_deletion_status_grant_task_fkey"
  FOREIGN KEY ("taskId") REFERENCES "daily_energy"."restricted_data_task"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "daily_energy"."c014_data_task_view"(
  task "daily_energy"."restricted_data_task"
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = "daily_energy", pg_catalog
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'task_ref',task.id::text,
    'revision',task.revision,
    'kind',task.kind::text,
    'scope',CASE task.scope
      WHEN 'EXPORT_ACCOUNT' THEN 'ACCOUNT'
      WHEN 'EXPORT_DATE_RANGE' THEN 'DAY'
      ELSE task.scope::text
    END,
    'target_summary',CASE
      WHEN task.kind='EXPORT' THEN '账户数据导出'
      WHEN task.scope='DAY' THEN task."targetKey"||' 日记录'
      WHEN task.scope='MATTER' THEN '事项数据'
      WHEN task.scope='RELATIONSHIP_DATA' THEN '关系数据'
      ELSE '账户数据'
    END,
    'status',CASE task.state WHEN 'QUEUED' THEN 'PENDING' ELSE task.state::text END,
    'online_erased_at',CASE WHEN task."onlineErasedAt" IS NULL THEN NULL
      ELSE to_char(task."onlineErasedAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
    'backup_purge_deadline',CASE WHEN task."backupPurgeDeadline" IS NULL THEN NULL
      ELSE to_char(task."backupPurgeDeadline" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
    'export_artifact',CASE WHEN task.kind<>'EXPORT' THEN NULL ELSE COALESCE((
      SELECT CASE manifest.state
        WHEN 'READY' THEN jsonb_build_object(
          'state','READY','format','JSON','download_ref',manifest."downloadRef"::text,
          'ready_at',to_char(manifest."readyAt" AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'expires_at',to_char(manifest."expiresAt" AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
        WHEN 'EXPIRED' THEN jsonb_build_object('state','EXPIRED','format','JSON')
        WHEN 'INVALIDATED' THEN jsonb_build_object('state','INVALIDATED','format','JSON')
        ELSE jsonb_build_object('state','PREPARING','format','JSON')
      END
      FROM "daily_energy"."restricted_export_manifest" manifest
      WHERE manifest."taskId"=task.id
    ),CASE WHEN task.state IN ('QUEUED','RUNNING')
      THEN jsonb_build_object('state','PREPARING','format','JSON') ELSE NULL END) END,
    'can_cancel',(task.kind='EXPORT' AND task.state='QUEUED' AND task."guardedAt" IS NULL),
    'failure_summary_code',CASE WHEN cardinality(task."failureScopeCodes")=0 THEN NULL
      ELSE task."failureScopeCodes"[1] END,
    'created_at',to_char(task."requestedAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updated_at',to_char(GREATEST(
      COALESCE(task."finishedAt",task."onlineErasedAt",task."startedAt",task."guardedAt",task."requestedAt"),
      COALESCE((SELECT manifest."updatedAt" FROM "daily_energy"."restricted_export_manifest" manifest
        WHERE manifest."taskId"=task.id),task."requestedAt"))
      AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ));
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c014_export_source_vector"(
  target_account_id uuid,
  excluded_task_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
  SELECT jsonb_build_object(
    'account',COALESCE((SELECT jsonb_build_array(account.revision,account.state::text)
      FROM "daily_energy"."app_user_account" account
      WHERE account.id=target_account_id),'null'::jsonb),
    'consent',COALESCE((SELECT jsonb_build_array(consent."noticeVersion",
        consent."logicalIntent",consent.status::text,
        consent."acceptedAt",consent."withdrawnAt",consent."createdAt")
      FROM "daily_energy"."app_necessary_consent_record" consent
      WHERE consent."accountId"=target_account_id
      ORDER BY consent."createdAt" DESC,consent.id DESC LIMIT 1),'null'::jsonb),
    'profile',COALESCE((SELECT jsonb_build_array(profile.revision,
        md5(profile."preferredNameCiphertext"),profile."preferredNameKeyVersion",
        profile."expressionStyle"::text,profile."updatedAt",
        EXISTS (SELECT 1 FROM "daily_energy"."app_onboarding_completion" onboarding
          WHERE onboarding."accountId"=target_account_id))
      FROM "daily_energy"."app_user_profile" profile
      WHERE profile."accountId"=target_account_id),'null'::jsonb),
    'days',COALESCE((SELECT jsonb_agg(jsonb_build_array(
        day.product_date,
        checkin.revision,checkin.mood::text,checkin.energy::text,checkin.sleep::text,
        checkin."updatedAt",encode(result."resultFingerprint",'hex'),
        visibility.revision,visibility.state::text,encode(visibility."sourceFingerprint",'hex'),
        interaction."aggregateRevision",light."sourceValidityRevision",
        task.revision,task.status::text,helpfulness.revision,helpfulness.rating::text,
        feedback.revision,feedback."overallFeeling"::text,
        md5(feedback."noteCiphertext"),feedback."noteKeyVersion",feedback."updatedAt")
      ORDER BY day.product_date)
      FROM (SELECT "productDate" AS product_date FROM "daily_energy"."app_morning_checkin"
              WHERE "accountId"=target_account_id
            UNION SELECT "productDate" FROM "daily_energy"."app_published_daily_result"
              WHERE "accountId"=target_account_id
            UNION SELECT "productDate" FROM "daily_energy"."app_daily_interaction"
              WHERE "accountId"=target_account_id) day
      LEFT JOIN "daily_energy"."app_morning_checkin" checkin
        ON checkin."accountId"=target_account_id AND checkin."productDate"=day.product_date
      LEFT JOIN "daily_energy"."app_published_daily_result" result
        ON result."accountId"=target_account_id AND result."productDate"=day.product_date
      LEFT JOIN "daily_energy"."app_published_result_visibility" visibility
        ON visibility."resultId"=result.id
      LEFT JOIN "daily_energy"."app_daily_interaction" interaction
        ON interaction."accountId"=target_account_id AND interaction."productDate"=day.product_date
      LEFT JOIN "daily_energy"."app_daily_light_fact" light
        ON light."interactionId"=interaction.id
      LEFT JOIN "daily_energy"."app_daily_task_state" task
        ON task."interactionId"=interaction.id
      LEFT JOIN "daily_energy"."app_daily_helpfulness_record" helpfulness
        ON helpfulness."interactionId"=interaction.id
      LEFT JOIN "daily_energy"."app_evening_feedback_record" feedback
        ON feedback."interactionId"=interaction.id),'[]'::jsonb),
    'matters',COALESCE((SELECT jsonb_agg(jsonb_build_array(matter.id,matter.revision,
        md5(matter."titleCiphertext"),matter."titleKeyVersion",matter."targetProductDate",
        matter.state::text,matter."updatedAt",
        EXISTS (SELECT 1 FROM "daily_energy"."app_memory_purpose_grant" grant_row
          WHERE grant_row."accountId"=target_account_id AND grant_row."sourceRef"=matter.id
            AND grant_row.purpose='DAILY_EXPRESSION' AND grant_row.state='ACTIVE'),
        EXISTS (SELECT 1 FROM "daily_energy"."app_memory_purpose_grant" grant_row
          WHERE grant_row."accountId"=target_account_id AND grant_row."sourceRef"=matter.id
            AND grant_row.purpose='WEEKLY_SUMMARY' AND grant_row.state='ACTIVE'))
      ORDER BY matter.id)
      FROM "daily_energy"."app_important_matter" matter
      WHERE matter."accountId"=target_account_id AND matter.state<>'DELETED'),'[]'::jsonb),
    'relationship',COALESCE((SELECT jsonb_build_array(cycle.id,cycle.revision,
        cycle.state::text,encode(cycle."projectionFingerprint",'hex'),
        COALESCE(cycle."closedAt",cycle."startedAt"),
        count(valid_link.id))
      FROM "daily_energy"."app_relationship_cycle" cycle
      LEFT JOIN "daily_energy"."app_relationship_encounter_link" valid_link
        ON valid_link."cycleId"=cycle.id AND EXISTS (
          SELECT 1 FROM "daily_energy"."app_daily_light_fact" source_light
          WHERE source_light.id=valid_link."sourceLightId"
            AND source_light."sourceValidityRevision"=valid_link."sourceValidityRevision")
      WHERE cycle."accountId"=target_account_id AND cycle."activeSlot" IS TRUE
      GROUP BY cycle.id),'null'::jsonb),
    'notifications',COALESCE((SELECT jsonb_agg(jsonb_build_array(
        preference."notificationType",preference.enabled,preference.revision,
        preference."updatedAt") ORDER BY preference."notificationType")
      FROM "daily_energy"."app_notification_preference" preference
      WHERE preference."accountId"=target_account_id),'[]'::jsonb),
    'safety',COALESCE((SELECT jsonb_build_array(safety.state::text,safety.revision,
        safety."updatedAt") FROM "daily_energy"."restricted_safety_state" safety
      WHERE safety."accountId"=target_account_id),'null'::jsonb),
    'tasks',COALESCE((SELECT jsonb_agg(jsonb_build_array(rights_task.id,
        rights_task.revision,rights_task.kind::text,rights_task.scope::text,
        rights_task.state::text,rights_task."onlineErasedAt",
        rights_task."backupPurgeDeadline",rights_task."failureScopeCodes",
        manifest.state::text,manifest."updatedAt")
      ORDER BY rights_task."requestedAt",rights_task.id)
      FROM "daily_energy"."restricted_data_task" rights_task
      LEFT JOIN "daily_energy"."restricted_export_manifest" manifest
        ON manifest."taskId"=rights_task.id
      WHERE rights_task."accountId"=target_account_id
        AND rights_task.id<>excluded_task_id),'[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c014_refresh_export_manifests"(
  target_account_id uuid,
  refreshed_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(target_account_id::text,20400));
  WITH changed AS (
    UPDATE "daily_energy"."restricted_export_manifest" manifest
      SET state='EXPIRED',"expiredAt"=refreshed_at,"updatedAt"=refreshed_at
      FROM "daily_energy"."restricted_data_task" task
      WHERE manifest."taskId"=task.id AND task."accountId"=target_account_id
        AND manifest.state='READY' AND manifest."expiresAt"<=refreshed_at
      RETURNING manifest."taskId"
  )
  UPDATE "daily_energy"."restricted_data_task" task
    SET revision=revision+1
    WHERE task.id IN (SELECT "taskId" FROM changed);

  WITH changed AS (
    UPDATE "daily_energy"."restricted_export_manifest" manifest
      SET state='INVALIDATED',"invalidatedAt"=refreshed_at,"updatedAt"=refreshed_at
      FROM "daily_energy"."restricted_data_task" task
      WHERE manifest."taskId"=task.id AND task."accountId"=target_account_id
        AND manifest.state='READY'
        AND manifest."sourceRevisionVector"<>
          c014_export_source_vector(target_account_id,task.id)
      RETURNING manifest."taskId"
  )
  UPDATE "daily_energy"."restricted_data_task" task
    SET revision=revision+1
    WHERE task.id IN (SELECT "taskId" FROM changed);
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."get_c014_export_source_vector"(
  target_task_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
  SELECT c014_export_source_vector(task."accountId",task.id)
  FROM "daily_energy"."restricted_data_task" task
  WHERE task.id=target_task_id AND task.kind='EXPORT' AND task.state='RUNNING';
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."get_c014_data_rights_summary"(
  target_account_id uuid,
  requested_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE account_revision integer; relationship_revision integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(target_account_id::text,20400));
  SELECT revision INTO account_revision FROM "daily_energy"."app_user_account"
    WHERE id=target_account_id AND state='ACTIVE';
  IF account_revision IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_ACCOUNT_RESTRICTED';
  END IF;
  SELECT revision INTO relationship_revision
    FROM "daily_energy"."app_relationship_cycle"
    WHERE "accountId"=target_account_id AND "activeSlot" IS TRUE AND state='ACTIVE';
  UPDATE "daily_energy"."app_user_account"
    SET "lastActiveUseAt"=GREATEST("lastActiveUseAt",requested_at),
        "inactivityDeletionDueAt"=GREATEST("lastActiveUseAt",requested_at)+interval '24 months',
        "updatedAt"=GREATEST("updatedAt",requested_at)
    WHERE id=target_account_id;
  RETURN jsonb_strip_nulls(jsonb_build_object(
    'account',jsonb_build_object('expected_revision',account_revision,'state','ACTIVE'),
    'relationship',CASE WHEN relationship_revision IS NULL THEN NULL ELSE
      jsonb_build_object('expected_revision',relationship_revision,'state','PRESENT') END,
    'capabilities',jsonb_build_object(
      'export_account',true,'delete_day',true,'delete_matter',true,
      'delete_relationship_data',relationship_revision IS NOT NULL,'delete_account',true),
    'confirmation_versions',jsonb_build_object(
      'export_account','data-export-v1','delete_day','data-rights-day-v1',
      'delete_matter','data-rights-matter-v1',
      'delete_relationship_data','data-rights-relationship-v1',
      'delete_account','data-rights-account-v1'),
    'online_erasure_sla_hours',72,'backup_max_days',35));
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c014_export_source_payload"(
  target_account_id uuid,
  excluded_task_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
  SELECT jsonb_build_object(
    'profile',(SELECT jsonb_strip_nulls(jsonb_build_object(
        'revision',profile.revision,
        'preferred_name_protected',CASE WHEN profile."preferredNameCiphertext" IS NULL
          THEN NULL ELSE jsonb_build_object(
            'ciphertext',encode(profile."preferredNameCiphertext",'base64'),
            'key_version',profile."preferredNameKeyVersion") END,
        'expression_style',profile."expressionStyle"::text,
        'onboarding_completed',EXISTS (SELECT 1
          FROM "daily_energy"."app_onboarding_completion" onboarding
          WHERE onboarding."accountId"=target_account_id),
        'updated_at',to_char(profile."updatedAt" AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
      FROM "daily_energy"."app_user_profile" profile
      WHERE profile."accountId"=target_account_id),
    'consent_summary',COALESCE((SELECT jsonb_strip_nulls(jsonb_build_object(
        'state',consent.status::text,'notice_version',consent."noticeVersion",
        'accepted_at',CASE WHEN consent."acceptedAt" IS NULL THEN NULL ELSE
          to_char(consent."acceptedAt" AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END))
      FROM "daily_energy"."app_necessary_consent_record" consent
      WHERE consent."accountId"=target_account_id
      ORDER BY consent."createdAt" DESC,consent.id DESC LIMIT 1),
      jsonb_build_object('state','MISSING','notice_version','necessary-consent-v1')),
    'days',COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'product_date',day.product_date::text,
        'checkin',CASE WHEN checkin.id IS NULL THEN NULL ELSE jsonb_build_object(
          'revision',checkin.revision,'mood',checkin.mood::text,
          'energy',checkin.energy::text,'sleep',checkin.sleep::text,
          'updated_at',to_char(checkin."updatedAt" AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) END,
        'result_source',CASE WHEN result.id IS NULL OR visibility.state<>'AVAILABLE'
          THEN NULL ELSE jsonb_build_object(
            'result_id',result.id::text,'input_snapshot_id',result."inputSnapshotId"::text,
            'result_version',result."resultVersion",'schema_version',result."schemaVersion",
            'generated_at',to_char(result."generatedAt" AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'rule_facts_payload',result."ruleFactsPayload",
            'expression_core_payload',result."expressionCorePayload",
            'provenance_payload',result."provenancePayload",
            'validation_receipt',result."validationReceipt",
            'result_fingerprint',encode(result."resultFingerprint",'hex')) END,
        'interaction',CASE WHEN interaction.id IS NULL THEN NULL ELSE
          jsonb_build_object('is_lit',light.id IS NOT NULL,
            'task',CASE WHEN task.id IS NULL THEN NULL ELSE jsonb_build_object(
              'revision',task.revision,'status',task.status::text) END,
            'helpfulness',jsonb_build_object(
              'revision',COALESCE(helpfulness.revision,0),
              'rating',COALESCE(helpfulness.rating::text,'UNRATED')),
            'updated_at',to_char(interaction."updatedAt" AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) END,
        'evening',CASE WHEN feedback.id IS NULL THEN NULL ELSE
          jsonb_strip_nulls(jsonb_build_object(
            'revision',feedback.revision,'overall_feeling',feedback."overallFeeling"::text,
            'note_protected',CASE WHEN feedback."noteCiphertext" IS NULL THEN NULL ELSE
              jsonb_build_object('ciphertext',encode(feedback."noteCiphertext",'base64'),
                'key_version',feedback."noteKeyVersion") END,
            'updated_at',to_char(feedback."updatedAt" AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) END)) ORDER BY day.product_date)
      FROM (SELECT "productDate" AS product_date FROM "daily_energy"."app_morning_checkin"
              WHERE "accountId"=target_account_id
            UNION SELECT "productDate" FROM "daily_energy"."app_published_daily_result"
              WHERE "accountId"=target_account_id
            UNION SELECT "productDate" FROM "daily_energy"."app_daily_interaction"
              WHERE "accountId"=target_account_id) day
      LEFT JOIN "daily_energy"."app_morning_checkin" checkin
        ON checkin."accountId"=target_account_id AND checkin."productDate"=day.product_date
      LEFT JOIN "daily_energy"."app_published_daily_result" result
        ON result."accountId"=target_account_id AND result."productDate"=day.product_date
      LEFT JOIN "daily_energy"."app_published_result_visibility" visibility
        ON visibility."resultId"=result.id
      LEFT JOIN "daily_energy"."app_daily_interaction" interaction
        ON interaction."accountId"=target_account_id AND interaction."productDate"=day.product_date
      LEFT JOIN "daily_energy"."app_daily_light_fact" light
        ON light."interactionId"=interaction.id
      LEFT JOIN "daily_energy"."app_daily_task_state" task
        ON task."interactionId"=interaction.id
      LEFT JOIN "daily_energy"."app_daily_helpfulness_record" helpfulness
        ON helpfulness."interactionId"=interaction.id
      LEFT JOIN "daily_energy"."app_evening_feedback_record" feedback
        ON feedback."interactionId"=interaction.id),'[]'::jsonb),
    'matters',COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'revision',matter.revision,
        'title_protected',jsonb_build_object(
          'ciphertext',encode(matter."titleCiphertext",'base64'),
          'key_version',matter."titleKeyVersion"),
        'target_date',matter."targetProductDate"::text,'status',matter.state::text,
        'daily_use_granted',EXISTS (SELECT 1
          FROM "daily_energy"."app_memory_purpose_grant" grant_row
          WHERE grant_row."accountId"=target_account_id AND grant_row."sourceRef"=matter.id
            AND grant_row.purpose='DAILY_EXPRESSION' AND grant_row.state='ACTIVE'),
        'weekly_use_granted',EXISTS (SELECT 1
          FROM "daily_energy"."app_memory_purpose_grant" grant_row
          WHERE grant_row."accountId"=target_account_id AND grant_row."sourceRef"=matter.id
            AND grant_row.purpose='WEEKLY_SUMMARY' AND grant_row.state='ACTIVE'),
        'updated_at',to_char(matter."updatedAt" AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY matter.id)
      FROM "daily_energy"."app_important_matter" matter
      WHERE matter."accountId"=target_account_id AND matter.state<>'DELETED'),'[]'::jsonb),
    'relationship_summary',(SELECT jsonb_build_object(
        'revision',cycle.revision,'state','PRESENT','encounter_day_count',count(valid_link.id),
        'updated_at',to_char(COALESCE(cycle."closedAt",cycle."startedAt") AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      FROM "daily_energy"."app_relationship_cycle" cycle
      LEFT JOIN "daily_energy"."app_relationship_encounter_link" valid_link
        ON valid_link."cycleId"=cycle.id AND EXISTS (
          SELECT 1 FROM "daily_energy"."app_daily_light_fact" source_light
          WHERE source_light.id=valid_link."sourceLightId"
            AND source_light."sourceValidityRevision"=valid_link."sourceValidityRevision")
      WHERE cycle."accountId"=target_account_id AND cycle."activeSlot" IS TRUE
        AND cycle.state='ACTIVE' GROUP BY cycle.id),
    'notification_preferences',jsonb_build_object('items',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'notification_type',preference."notificationType",'enabled',preference.enabled,
        'revision',preference.revision,
        'updated_at',to_char(preference."updatedAt" AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY preference."notificationType")
      FROM "daily_energy"."app_notification_preference" preference
      WHERE preference."accountId"=target_account_id),'[]'::jsonb)),
    'safety_summary',(SELECT jsonb_build_object('state',safety.state::text,
        'revision',safety.revision,
        'updated_at',to_char(safety."updatedAt" AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      FROM "daily_energy"."restricted_safety_state" safety
      WHERE safety."accountId"=target_account_id),
    'data_task_summaries',COALESCE((SELECT jsonb_agg(
        (c014_data_task_view(rights_task)
          -'task_ref'-'can_cancel'-'export_artifact') ORDER BY rights_task."requestedAt")
      FROM "daily_energy"."restricted_data_task" rights_task
      WHERE rights_task."accountId"=target_account_id
        AND rights_task.id<>excluded_task_id),'[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."read_c014_export_artifact"(
  target_account_id uuid,
  target_task_id uuid,
  target_download_ref uuid,
  requested_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE manifest record; account_state text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(target_account_id::text,20400));
  SELECT state::text INTO account_state FROM "daily_energy"."app_user_account"
    WHERE id=target_account_id;
  IF account_state IS NULL OR account_state<>'ACTIVE' THEN
    RETURN jsonb_build_object('outcome','INVALID');
  END IF;
  PERFORM c014_refresh_export_manifests(target_account_id,requested_at);
  SELECT export_manifest.* INTO manifest
    FROM "daily_energy"."restricted_export_manifest" export_manifest
    JOIN "daily_energy"."restricted_data_task" task
      ON task.id=export_manifest."taskId"
    WHERE task.id=target_task_id AND task."accountId"=target_account_id
      AND task.kind='EXPORT' AND task.state='SUCCEEDED'
      AND export_manifest."downloadRef"=target_download_ref;
  IF manifest.id IS NULL THEN RETURN jsonb_build_object('outcome','INVALID'); END IF;
  IF manifest.state='EXPIRED' THEN RETURN jsonb_build_object('outcome','EXPIRED'); END IF;
  IF manifest.state='INVALIDATED' THEN RETURN jsonb_build_object('outcome','SOURCE_CHANGED'); END IF;
  IF manifest.state<>'READY' THEN RETURN jsonb_build_object('outcome','NOT_READY'); END IF;
  UPDATE "daily_energy"."app_user_account"
    SET "lastActiveUseAt"=GREATEST("lastActiveUseAt",requested_at),
        "inactivityDeletionDueAt"=GREATEST("lastActiveUseAt",requested_at)+interval '24 months',
        "updatedAt"=GREATEST("updatedAt",requested_at)
    WHERE id=target_account_id AND state='ACTIVE';
  RETURN jsonb_build_object('outcome','READY',
    'ready_at',to_char(manifest."readyAt" AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'source_payload',c014_export_source_payload(target_account_id,target_task_id));
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."list_c014_data_tasks"(
  target_account_id uuid,
  requested_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  PERFORM c014_refresh_export_manifests(target_account_id,requested_at);
  UPDATE "daily_energy"."app_user_account"
    SET "lastActiveUseAt"=GREATEST("lastActiveUseAt",requested_at),
        "inactivityDeletionDueAt"=GREATEST("lastActiveUseAt",requested_at)+interval '24 months',
        "updatedAt"=GREATEST("updatedAt",requested_at)
    WHERE id=target_account_id AND state='ACTIVE';
  RETURN (
    SELECT jsonb_build_object(
      'items',COALESCE(jsonb_agg(c014_data_task_view(task)
        ORDER BY task."requestedAt" DESC,task.id DESC),'[]'::jsonb),
      'page_info',jsonb_build_object('has_more',false)
    )
    FROM (
      SELECT * FROM "daily_energy"."restricted_data_task"
      WHERE "accountId"=target_account_id
      ORDER BY "requestedAt" DESC,id DESC
      LIMIT 50
    ) task
  );
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."get_c014_data_task"(
  target_account_id uuid,
  target_task_id uuid,
  requested_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  PERFORM c014_refresh_export_manifests(target_account_id,requested_at);
  UPDATE "daily_energy"."app_user_account"
    SET "lastActiveUseAt"=GREATEST("lastActiveUseAt",requested_at),
        "inactivityDeletionDueAt"=GREATEST("lastActiveUseAt",requested_at)+interval '24 months',
        "updatedAt"=GREATEST("updatedAt",requested_at)
    WHERE id=target_account_id AND state='ACTIVE';
  RETURN (
    SELECT c014_data_task_view(task)
    FROM "daily_energy"."restricted_data_task" task
    WHERE task."accountId"=target_account_id AND task.id=target_task_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c014_existing_command_response"(
  target_account_id uuid,
  target_command_ref uuid,
  target_operation text,
  target_key text,
  target_fingerprint bytea
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE receipt record;
BEGIN
  SELECT * INTO receipt
  FROM "daily_energy"."runtime_command_receipt"
  WHERE "accountId"=target_account_id AND "commandRef"=target_command_ref;
  IF receipt.id IS NULL THEN RETURN NULL; END IF;
  IF receipt."operationCode"<>target_operation
     OR receipt."targetKey"<>target_key
     OR receipt."normalizedPayloadFingerprint"<>target_fingerprint THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_IDEMPOTENCY_CONFLICT';
  END IF;
  RETURN receipt."responseRef";
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c014_record_command"(
  target_account_id uuid,
  target_command_ref uuid,
  target_operation text,
  target_scope text,
  target_key text,
  target_fingerprint bytea,
  response_ref uuid,
  requested_at timestamptz
)
RETURNS void
LANGUAGE sql
SET search_path = "daily_energy", pg_catalog
AS $$
  INSERT INTO "daily_energy"."runtime_command_receipt"
    (id,"accountId","commandRef","operationCode","targetScope","targetKey",
     "normalizedPayloadFingerprint","acceptedAt","terminalAt","responseRef",
     "retentionPolicyVersion","retentionScope","retentionAnchorAt","expiresAt")
  VALUES (gen_random_uuid(),target_account_id,target_command_ref,target_operation,
    target_scope,target_key,target_fingerprint,requested_at,requested_at,response_ref,
    'retention-policy-v1','RUNTIME',requested_at,requested_at+interval '7 days');
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c014_create_task_internal"(
  target_account_id uuid,
  target_command_ref uuid,
  target_operation text,
  task_kind "daily_energy"."DataTaskKind",
  task_scope "daily_energy"."DataTaskScope",
  target_type text,
  target_key text,
  confirmation_version text,
  target_fingerprint bytea,
  requested_at timestamptz,
  create_guard boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE
  task_id uuid;
  guard_epoch bigint;
  account_state text;
  active_account_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(target_account_id::text,20400));
  SELECT state::text INTO account_state
    FROM "daily_energy"."app_user_account" WHERE id=target_account_id;
  IF account_state IS NULL OR account_state='DELETED' THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_ACCOUNT_DELETED';
  END IF;
  IF account_state='DELETING' THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_ACCOUNT_DELETING';
  END IF;
  IF account_state<>'ACTIVE' THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_ACCOUNT_RESTRICTED';
  END IF;
  UPDATE "daily_energy"."app_user_account"
    SET "lastActiveUseAt"=GREATEST("lastActiveUseAt",requested_at),
        "inactivityDeletionDueAt"=GREATEST("lastActiveUseAt",requested_at)+interval '24 months',
        "updatedAt"=GREATEST("updatedAt",requested_at)
    WHERE id=target_account_id AND state='ACTIVE';
  GET DIAGNOSTICS active_account_count=ROW_COUNT;
  IF active_account_count<>1 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_STATE_PRECONDITION';
  END IF;
  task_id:=c014_existing_command_response(target_account_id,target_command_ref,
    target_operation,target_key,target_fingerprint);
  IF task_id IS NOT NULL THEN RETURN task_id; END IF;

  SELECT id INTO task_id FROM "daily_energy"."restricted_data_task"
  WHERE "accountId"=target_account_id AND kind=task_kind AND scope=task_scope
    AND "targetKey"=target_key AND "activeSlot" IS TRUE
  ORDER BY "requestedAt" DESC LIMIT 1 FOR UPDATE;
  IF task_id IS NULL THEN
    task_id:=gen_random_uuid();
    INSERT INTO "daily_energy"."restricted_data_task"
      (id,"accountId",kind,scope,"targetType","targetKey","activeSlot",state,
       revision,"confirmationVersion","requestedAt","guardedAt","failureScopeCodes",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt")
    VALUES (task_id,target_account_id,task_kind,task_scope,target_type,target_key,true,
      'QUEUED',1,confirmation_version,requested_at,
      CASE WHEN create_guard THEN requested_at ELSE NULL END,'{}',
      'retention-policy-v1','RUNTIME',requested_at);

    IF create_guard THEN
      INSERT INTO "daily_energy"."restricted_deletion_guard"
        (id,"accountId",scope,"targetKey",revision,"deletionEpoch","taskRef",
         "semanticBlockedAt","retentionPolicyVersion","retentionScope","retentionAnchorAt")
      VALUES (gen_random_uuid(),target_account_id,task_scope,target_key,1,1,task_id,
        requested_at,'retention-policy-v1','RUNTIME',requested_at)
      ON CONFLICT ("accountId",scope,"targetKey") DO UPDATE SET
        revision="restricted_deletion_guard".revision+1,
        "deletionEpoch"="restricted_deletion_guard"."deletionEpoch"+1,
        "taskRef"=EXCLUDED."taskRef","semanticBlockedAt"=EXCLUDED."semanticBlockedAt",
        "releasedAt"=NULL,"retentionAnchorAt"=EXCLUDED."retentionAnchorAt"
      RETURNING "deletionEpoch" INTO guard_epoch;
    END IF;

    INSERT INTO "daily_energy"."runtime_outbox_event"
      (id,"aggregateType","aggregateRef","aggregateRevision","eventType",
       "eventVersion","idempotencyKey","allowlistedPayload","guardEpochs",state,
       "availableAt","attemptCount","createdAt","retentionPolicyVersion",
       "retentionScope","retentionAnchorAt","expiresAt")
    VALUES (gen_random_uuid(),'DATA_TASK',task_id,1,
      CASE WHEN create_guard THEN 'DeletionGuarded' ELSE 'DataTaskDue' END,
      'v1',decode(md5('c014:'||task_id::text||':1'),'hex'),'{}'::jsonb,
      CASE WHEN create_guard THEN jsonb_build_object('deletion',guard_epoch::text)
        ELSE '{}'::jsonb END,'PENDING',
      requested_at,0,requested_at,'retention-policy-v1','RUNTIME',requested_at,
      requested_at+interval '7 days');
  END IF;

  PERFORM c014_record_command(target_account_id,target_command_ref,target_operation,
    task_scope::text,target_key,target_fingerprint,task_id,requested_at);
  RETURN task_id;
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."create_c014_export_task"(
  target_account_id uuid,target_command_ref uuid,confirmation_version text,
  target_fingerprint bytea,requested_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE task_id uuid; account_state text;
BEGIN
  SELECT state::text INTO account_state FROM "daily_energy"."app_user_account"
  WHERE id=target_account_id FOR SHARE;
  IF account_state IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_ACCOUNT_DELETED'; END IF;
  IF account_state='DELETING' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_ACCOUNT_DELETING'; END IF;
  IF account_state<>'ACTIVE' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_ACCOUNT_RESTRICTED'; END IF;
  task_id:=c014_create_task_internal(target_account_id,target_command_ref,
    'DATA_EXPORT','EXPORT','EXPORT_ACCOUNT','ACCOUNT','SELF',confirmation_version,
    target_fingerprint,requested_at,false);
  RETURN get_c014_data_task(target_account_id,task_id,requested_at);
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."finalize_c014_export_task"(
  target_task_id uuid,
  expected_revision integer,
  source_revision_vector jsonb,
  source_fingerprint bytea,
  target_download_ref uuid,
  finalized_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE task record;
BEGIN
  SELECT * INTO task FROM "daily_energy"."restricted_data_task"
    WHERE id=target_task_id FOR UPDATE;
  IF task.id IS NULL THEN RETURN 'TASK_MISSING'; END IF;
  IF task.kind<>'EXPORT' OR task.state<>'RUNNING' THEN RETURN 'STATE_PRECONDITION'; END IF;
  IF task.revision<>expected_revision THEN RETURN 'STALE_REVISION'; END IF;
  IF jsonb_typeof(source_revision_vector)<>'object'
     OR octet_length(source_fingerprint)<>32
     OR source_revision_vector<>
       c014_export_source_vector(task."accountId",target_task_id) THEN
    RETURN 'SOURCE_CHANGED';
  END IF;
  INSERT INTO "daily_energy"."restricted_export_manifest"
    (id,"taskId","sourceRevisionVector","sourceFingerprint","schemaVersion",
     "policyVersion","downloadRef",state,"readyAt","expiresAt","updatedAt",
     "retentionPolicyVersion","retentionScope","retentionAnchorAt")
  VALUES (gen_random_uuid(),target_task_id,source_revision_vector,source_fingerprint,
    'data-export-v1','data-rights-export-policy-v1',target_download_ref,'READY',
    finalized_at,finalized_at+interval '24 hours',finalized_at,
    'retention-policy-v1','EXPORT',finalized_at)
  ON CONFLICT ("taskId") DO NOTHING;
  IF NOT FOUND THEN RETURN 'MANIFEST_EXISTS'; END IF;
  UPDATE "daily_energy"."restricted_data_task"
    SET state='SUCCEEDED',"activeSlot"=NULL,revision=revision+1,
      "finishedAt"=finalized_at,"failureScopeCodes"='{}',
      "retentionAnchorAt"=finalized_at,"expiresAt"=finalized_at+interval '30 days'
    WHERE id=target_task_id;
  RETURN 'SUCCEEDED';
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."create_c014_day_deletion"(
  target_account_id uuid,target_command_ref uuid,target_product_date date,
  expected_revision integer,confirmation_version text,target_fingerprint bytea,
  requested_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE task_id uuid; current_revision integer; existing uuid;
BEGIN
  existing:=c014_existing_command_response(target_account_id,target_command_ref,
    'DELETE_DAY',target_product_date::text,target_fingerprint);
  IF existing IS NOT NULL THEN
    RETURN get_c014_data_task(target_account_id,existing,requested_at);
  END IF;
  SELECT COALESCE((SELECT revision FROM "daily_energy"."app_morning_checkin"
    WHERE "accountId"=target_account_id AND "productDate"=target_product_date),0)
    INTO current_revision;
  IF current_revision<>expected_revision THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_REVISION_CONFLICT';
  END IF;
  IF current_revision=0 AND NOT EXISTS (
    SELECT 1 FROM "daily_energy"."app_published_daily_result"
    WHERE "accountId"=target_account_id AND "productDate"=target_product_date
    UNION ALL SELECT 1 FROM "daily_energy"."app_daily_interaction"
    WHERE "accountId"=target_account_id AND "productDate"=target_product_date
  ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_NOT_FOUND'; END IF;
  task_id:=c014_create_task_internal(target_account_id,target_command_ref,
    'DELETE_DAY','DELETE','DAY','PRODUCT_DATE',target_product_date::text,
    confirmation_version,target_fingerprint,requested_at,true);
  RETURN get_c014_data_task(target_account_id,task_id,requested_at);
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."create_c014_matter_deletion"(
  target_account_id uuid,target_command_ref uuid,target_matter_id uuid,
  expected_revision integer,confirmation_version text,target_fingerprint bytea,
  requested_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE task_id uuid; current_revision integer; existing uuid;
BEGIN
  existing:=c014_existing_command_response(target_account_id,target_command_ref,
    'DELETE_MATTER',target_matter_id::text,target_fingerprint);
  IF existing IS NOT NULL THEN
    RETURN get_c014_data_task(target_account_id,existing,requested_at);
  END IF;
  SELECT revision INTO current_revision FROM "daily_energy"."app_important_matter"
  WHERE id=target_matter_id AND "accountId"=target_account_id;
  IF current_revision IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_NOT_FOUND'; END IF;
  IF current_revision<>expected_revision THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_REVISION_CONFLICT';
  END IF;
  task_id:=c014_create_task_internal(target_account_id,target_command_ref,
    'DELETE_MATTER','DELETE','MATTER','MATTER_REF',target_matter_id::text,
    confirmation_version,target_fingerprint,requested_at,true);
  RETURN get_c014_data_task(target_account_id,task_id,requested_at);
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."prepare_c014_relationship_deletion"(
  target_account_id uuid,target_command_ref uuid,frozen_payload jsonb,
  expected_revision integer,confirmation_version text,target_fingerprint bytea,
  requested_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE challenge_id uuid; existing uuid; current_revision integer; item jsonb;
  challenge_expires_at timestamptz;
BEGIN
  IF jsonb_typeof(frozen_payload)<>'object'
     OR frozen_payload->'target'->>'relationship_scope'<>'CURRENT_CYCLE_AND_HISTORY'
     OR jsonb_typeof(frozen_payload->'target'->'included_day_product_dates')<>'array'
     OR jsonb_typeof(frozen_payload->'expected_day_revisions')<>'array'
     OR jsonb_array_length(frozen_payload->'target'->'included_day_product_dates')<>
        jsonb_array_length(frozen_payload->'expected_day_revisions') THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_STATE_PRECONDITION';
  END IF;
  existing:=c014_existing_command_response(target_account_id,target_command_ref,
    'PREPARE_RELATIONSHIP_DELETE','CURRENT_CYCLE_AND_HISTORY',target_fingerprint);
  IF existing IS NOT NULL THEN challenge_id:=existing; ELSE
    SELECT revision INTO current_revision FROM "daily_energy"."app_relationship_cycle"
    WHERE "accountId"=target_account_id AND "activeSlot" IS TRUE;
    IF current_revision IS NULL OR current_revision<>expected_revision THEN
      RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_REVISION_CONFLICT';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(frozen_payload->'expected_day_revisions') LOOP
      IF COALESCE((SELECT revision FROM "daily_energy"."app_morning_checkin"
        WHERE "accountId"=target_account_id
          AND "productDate"=(item->>'product_date')::date),0)<>
          (item->>'expected_revision')::integer THEN
        RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_REVISION_CONFLICT';
      END IF;
    END LOOP;
    challenge_id:=gen_random_uuid();
    INSERT INTO "daily_energy"."restricted_deletion_confirmation_challenge"
      (id,"accountId","commandRef",scope,"targetKey","frozenPayload",
       "expectedRevision","confirmationVersion","identityReverificationRequired",
       "createdAt","expiresAt","retentionPolicyVersion","retentionScope","retentionAnchorAt")
    VALUES (challenge_id,target_account_id,target_command_ref,'RELATIONSHIP_DATA',
      'CURRENT_CYCLE_AND_HISTORY',frozen_payload,expected_revision,confirmation_version,
      false,requested_at,requested_at+interval '10 minutes','retention-policy-v1',
      'RUNTIME',requested_at);
    PERFORM c014_record_command(target_account_id,target_command_ref,
      'PREPARE_RELATIONSHIP_DELETE','RELATIONSHIP_DATA','CURRENT_CYCLE_AND_HISTORY',
      target_fingerprint,challenge_id,requested_at);
  END IF;
  SELECT "expiresAt" INTO challenge_expires_at
    FROM "daily_energy"."restricted_deletion_confirmation_challenge"
    WHERE id=challenge_id AND "accountId"=target_account_id;
  UPDATE "daily_energy"."app_user_account"
    SET "lastActiveUseAt"=GREATEST("lastActiveUseAt",requested_at),
        "inactivityDeletionDueAt"=GREATEST("lastActiveUseAt",requested_at)+interval '24 months',
        "updatedAt"=GREATEST("updatedAt",requested_at)
    WHERE id=target_account_id AND state='ACTIVE';
  RETURN jsonb_build_object(
    'confirmation_challenge_ref',challenge_id::text,'scope','RELATIONSHIP_DATA',
    'target',frozen_payload->'target','confirmation_version',confirmation_version,
    'expected_revision',expected_revision,
    'expected_day_revisions',frozen_payload->'expected_day_revisions',
    'immediate_effects',jsonb_build_array('确认后关系阶段和关系记录立即停止使用。'),
    'derived_effects',jsonb_build_array('关系总结和依赖关系记录的表达会失效。'),
    'online_erasure_sla_hours',72,'backup_max_days',35,
    'identity_reverification_required',false,
    'expires_at',to_char(challenge_expires_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."prepare_c014_account_deletion"(
  target_account_id uuid,target_command_ref uuid,expected_revision integer,
  confirmation_version text,target_fingerprint bytea,requested_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE challenge_id uuid; existing uuid; current_revision integer;
  challenge_expires_at timestamptz;
BEGIN
  existing:=c014_existing_command_response(target_account_id,target_command_ref,
    'PREPARE_ACCOUNT_DELETE','SELF',target_fingerprint);
  IF existing IS NOT NULL THEN challenge_id:=existing; ELSE
    SELECT revision INTO current_revision FROM "daily_energy"."app_user_account"
    WHERE id=target_account_id AND state='ACTIVE';
    IF current_revision IS NULL OR current_revision<>expected_revision THEN
      RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_REVISION_CONFLICT';
    END IF;
    challenge_id:=gen_random_uuid();
    INSERT INTO "daily_energy"."restricted_deletion_confirmation_challenge"
      (id,"accountId","commandRef",scope,"targetKey","frozenPayload",
       "expectedRevision","confirmationVersion","identityReverificationRequired",
       "createdAt","expiresAt","retentionPolicyVersion","retentionScope","retentionAnchorAt")
    VALUES (challenge_id,target_account_id,target_command_ref,'ACCOUNT','SELF',
      jsonb_build_object('target',jsonb_build_object('subject','SELF')),
      expected_revision,confirmation_version,true,requested_at,
      requested_at+interval '10 minutes','retention-policy-v1','RUNTIME',requested_at);
    PERFORM c014_record_command(target_account_id,target_command_ref,
      'PREPARE_ACCOUNT_DELETE','ACCOUNT','SELF',target_fingerprint,challenge_id,requested_at);
  END IF;
  SELECT "expiresAt" INTO challenge_expires_at
    FROM "daily_energy"."restricted_deletion_confirmation_challenge"
    WHERE id=challenge_id AND "accountId"=target_account_id;
  UPDATE "daily_energy"."app_user_account"
    SET "lastActiveUseAt"=GREATEST("lastActiveUseAt",requested_at),
        "inactivityDeletionDueAt"=GREATEST("lastActiveUseAt",requested_at)+interval '24 months',
        "updatedAt"=GREATEST("updatedAt",requested_at)
    WHERE id=target_account_id AND state='ACTIVE';
  RETURN jsonb_build_object(
    'confirmation_challenge_ref',challenge_id::text,'scope','ACCOUNT',
    'target',jsonb_build_object('subject','SELF'),
    'confirmation_version',confirmation_version,'expected_revision',expected_revision,
    'immediate_effects',jsonb_build_array('确认后普通产品访问和现有登录立即停止。'),
    'derived_effects',jsonb_build_array('账户下的日记录、关系数据、资料和设置将进入在线清理。'),
    'online_erasure_sla_hours',72,'backup_max_days',35,
    'identity_reverification_required',true,
    'expires_at',to_char(challenge_expires_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."verify_c014_deletion_identity"(
  target_account_id uuid,target_challenge_id uuid,target_command_ref uuid,
  subject_lookup_token bytea,target_fingerprint bytea,verified_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE verification_id uuid; verification_expires_at timestamptz;
  existing uuid; challenge record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(target_account_id::text,20400));
  existing:=c014_existing_command_response(target_account_id,target_command_ref,
    'VERIFY_DELETION_IDENTITY',target_challenge_id::text,target_fingerprint);
  IF existing IS NOT NULL THEN
    SELECT id,"expiresAt" INTO verification_id,verification_expires_at
      FROM "daily_energy"."restricted_identity_verification"
      WHERE id=existing AND "accountId"=target_account_id
        AND "challengeId"=target_challenge_id;
    IF verification_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_build_object('identity_verification_ref',verification_id::text,
      'confirmation_challenge_ref',target_challenge_id::text,
      'expires_at',to_char(verification_expires_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  END IF;
  SELECT * INTO challenge FROM "daily_energy"."restricted_deletion_confirmation_challenge"
  WHERE id=target_challenge_id AND "accountId"=target_account_id FOR UPDATE;
  IF challenge.id IS NULL OR challenge."consumedAt" IS NOT NULL
     OR challenge."expiresAt"<=verified_at
     OR challenge."identityReverificationRequired" IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_CHALLENGE_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "daily_energy"."app_external_identity"
    WHERE "accountId"=target_account_id AND "providerCode"='WECHAT_MINIAPP'
      AND "subjectLookupToken"=subject_lookup_token) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_IDENTITY_MISMATCH';
  END IF;
  UPDATE "daily_energy"."app_user_account"
    SET "lastActiveUseAt"=GREATEST("lastActiveUseAt",verified_at),
        "inactivityDeletionDueAt"=GREATEST("lastActiveUseAt",verified_at)+interval '24 months',
        "updatedAt"=GREATEST("updatedAt",verified_at)
    WHERE id=target_account_id AND state='ACTIVE';
  SELECT id,"expiresAt" INTO verification_id,verification_expires_at
    FROM "daily_energy"."restricted_identity_verification"
  WHERE "challengeId"=target_challenge_id;
  IF verification_id IS NULL THEN
    verification_id:=gen_random_uuid();
    INSERT INTO "daily_energy"."restricted_identity_verification"
      (id,"accountId","challengeId","verifiedAt","expiresAt",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt")
    VALUES (verification_id,target_account_id,target_challenge_id,verified_at,
      LEAST(challenge."expiresAt",verified_at+interval '5 minutes'),
      'retention-policy-v1','RUNTIME',verified_at);
    verification_expires_at:=LEAST(
      challenge."expiresAt",verified_at+interval '5 minutes'
    );
  END IF;
  PERFORM c014_record_command(target_account_id,target_command_ref,
    'VERIFY_DELETION_IDENTITY','IDENTITY_VERIFICATION',target_challenge_id::text,
    target_fingerprint,verification_id,verified_at);
  RETURN jsonb_build_object('identity_verification_ref',verification_id::text,
    'confirmation_challenge_ref',target_challenge_id::text,
    'expires_at',to_char(verification_expires_at
      AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."confirm_c014_relationship_deletion"(
  target_account_id uuid,target_command_ref uuid,target_challenge_id uuid,
  frozen_payload jsonb,expected_revision integer,confirmation_version text,
  identity_verification_id uuid,target_fingerprint bytea,requested_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE challenge record; task_id uuid; existing uuid; item jsonb; day_id uuid;
  child_command uuid; child_fingerprint bytea;
BEGIN
  existing:=c014_existing_command_response(target_account_id,target_command_ref,
    'CONFIRM_RELATIONSHIP_DELETE','CURRENT_CYCLE_AND_HISTORY',target_fingerprint);
  IF existing IS NOT NULL THEN
    RETURN get_c014_data_task(target_account_id,existing,requested_at);
  END IF;
  SELECT * INTO challenge FROM "daily_energy"."restricted_deletion_confirmation_challenge"
  WHERE id=target_challenge_id AND "accountId"=target_account_id FOR UPDATE;
  IF challenge.id IS NULL OR challenge.scope<>'RELATIONSHIP_DATA'
     OR challenge."consumedAt" IS NOT NULL OR challenge."expiresAt"<=requested_at
     OR challenge."confirmationVersion"<>confirmation_version
     OR challenge."expectedRevision"<>expected_revision
     OR challenge."frozenPayload"<>frozen_payload THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_CHALLENGE_INVALID';
  END IF;
  IF challenge."identityReverificationRequired" AND NOT EXISTS (
    SELECT 1 FROM "daily_energy"."restricted_identity_verification"
    WHERE id=identity_verification_id AND "challengeId"=target_challenge_id
      AND "accountId"=target_account_id AND "consumedAt" IS NULL
      AND "expiresAt">requested_at
  ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_IDENTITY_REQUIRED'; END IF;
  IF COALESCE((SELECT revision FROM "daily_energy"."app_relationship_cycle"
    WHERE "accountId"=target_account_id AND "activeSlot" IS TRUE),0)<>expected_revision THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_REVISION_CONFLICT';
  END IF;

  task_id:=c014_create_task_internal(target_account_id,target_command_ref,
    'CONFIRM_RELATIONSHIP_DELETE','DELETE','RELATIONSHIP_DATA','RELATIONSHIP_SCOPE',
    'CURRENT_CYCLE_AND_HISTORY',confirmation_version,target_fingerprint,requested_at,true);

  FOR item IN SELECT value FROM jsonb_array_elements(frozen_payload->'expected_day_revisions') LOOP
    IF COALESCE((SELECT revision FROM "daily_energy"."app_morning_checkin"
      WHERE "accountId"=target_account_id AND "productDate"=(item->>'product_date')::date),0)<>
      (item->>'expected_revision')::integer THEN
      RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_REVISION_CONFLICT';
    END IF;
    child_command:=(substr(md5(target_command_ref::text||':'||(item->>'product_date')),1,8)||'-'||
      substr(md5(target_command_ref::text||':'||(item->>'product_date')),9,4)||'-'||
      substr(md5(target_command_ref::text||':'||(item->>'product_date')),13,4)||'-'||
      substr(md5(target_command_ref::text||':'||(item->>'product_date')),17,4)||'-'||
      substr(md5(target_command_ref::text||':'||(item->>'product_date')),21,12))::uuid;
    child_fingerprint:=decode(md5(encode(target_fingerprint,'hex')||':'||
      (item->>'product_date')),'hex');
    day_id:=c014_create_task_internal(target_account_id,child_command,
      'DELETE_DAY_WITH_RELATIONSHIP','DELETE','DAY','PRODUCT_DATE',item->>'product_date',
      confirmation_version,child_fingerprint,requested_at,true);
  END LOOP;

  UPDATE "daily_energy"."restricted_deletion_confirmation_challenge"
    SET "consumedAt"=requested_at WHERE id=target_challenge_id;
  UPDATE "daily_energy"."restricted_identity_verification"
    SET "consumedAt"=requested_at WHERE id=identity_verification_id
      AND "challengeId"=target_challenge_id;
  RETURN get_c014_data_task(target_account_id,task_id,requested_at);
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."confirm_c014_account_deletion"(
  target_account_id uuid,target_command_ref uuid,target_challenge_id uuid,
  expected_revision integer,confirmation_version text,identity_verification_id uuid,
  status_token_hash bytea,target_fingerprint bytea,requested_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE challenge record; task_id uuid; existing uuid; status_grant_record record;
  task_view jsonb;
BEGIN
  IF octet_length(status_token_hash)<>32 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_STATE_PRECONDITION';
  END IF;
  existing:=c014_existing_command_response(target_account_id,target_command_ref,
    'CONFIRM_ACCOUNT_DELETE','SELF',target_fingerprint);
  IF existing IS NOT NULL THEN
    SELECT * INTO status_grant_record FROM "daily_energy"."restricted_deletion_status_grant"
      WHERE "taskId"=existing;
    IF status_grant_record.id IS NULL
       OR status_grant_record."tokenHash"<>status_token_hash THEN
      RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_IDEMPOTENCY_CONFLICT';
    END IF;
    task_view:=get_c014_data_task(target_account_id,existing,requested_at);
    RETURN jsonb_build_object('task',task_view,'status_grant',jsonb_build_object(
      'task_ref',existing::text,
      'expires_at',to_char(status_grant_record."expiresAt" AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  END IF;
  SELECT * INTO challenge FROM "daily_energy"."restricted_deletion_confirmation_challenge"
  WHERE id=target_challenge_id AND "accountId"=target_account_id FOR UPDATE;
  IF challenge.id IS NULL OR challenge.scope<>'ACCOUNT'
     OR challenge."targetKey"<>'SELF' OR challenge."consumedAt" IS NOT NULL
     OR challenge."expiresAt"<=requested_at
     OR challenge."confirmationVersion"<>confirmation_version
     OR challenge."expectedRevision"<>expected_revision THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_CHALLENGE_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "daily_energy"."restricted_identity_verification"
    WHERE id=identity_verification_id AND "challengeId"=target_challenge_id
      AND "accountId"=target_account_id AND "consumedAt" IS NULL
      AND "expiresAt">requested_at) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_IDENTITY_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "daily_energy"."app_user_account"
    WHERE id=target_account_id AND state='ACTIVE' AND revision=expected_revision) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_REVISION_CONFLICT';
  END IF;
  task_id:=c014_create_task_internal(target_account_id,target_command_ref,
    'CONFIRM_ACCOUNT_DELETE','DELETE','ACCOUNT','ACCOUNT','SELF',confirmation_version,
    target_fingerprint,requested_at,true);
  INSERT INTO "daily_energy"."restricted_deletion_status_grant"
    (id,"taskId","tokenHash","createdAt","expiresAt",
     "retentionPolicyVersion","retentionScope","retentionAnchorAt")
  VALUES (gen_random_uuid(),task_id,status_token_hash,requested_at,
    requested_at+interval '7 days','retention-policy-v1','RUNTIME',requested_at);
  UPDATE "daily_energy"."app_user_account"
    SET state='DELETING',revision=revision+1,"activeDeletionTaskRef"=task_id,
        "updatedAt"=requested_at
    WHERE id=target_account_id AND state='ACTIVE';
  UPDATE "daily_energy"."app_session_credential"
    SET "revokedAt"=COALESCE("revokedAt",requested_at)
    WHERE "accountId"=target_account_id;
  UPDATE "daily_energy"."restricted_deletion_confirmation_challenge"
    SET "consumedAt"=requested_at WHERE id=target_challenge_id;
  UPDATE "daily_energy"."restricted_identity_verification"
    SET "consumedAt"=requested_at WHERE id=identity_verification_id;
  task_view:=get_c014_data_task(target_account_id,task_id,requested_at);
  RETURN jsonb_build_object('task',task_view,'status_grant',jsonb_build_object(
    'task_ref',task_id::text,
    'expires_at',to_char((requested_at+interval '7 days') AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."get_c014_deletion_status"(
  target_task_id uuid,
  status_token_hash bytea,
  requested_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE status_grant_record record; task_state text; task_view jsonb;
BEGIN
  IF octet_length(status_token_hash)<>32 THEN RETURN NULL; END IF;
  SELECT status_grant.* INTO status_grant_record
    FROM "daily_energy"."restricted_deletion_status_grant" status_grant
    WHERE status_grant."taskId"=target_task_id FOR UPDATE;
  IF status_grant_record.id IS NULL THEN RETURN NULL; END IF;
  IF status_grant_record."expiresAt"<=requested_at
     OR status_grant_record."terminalObservedAt" IS NOT NULL THEN
    DELETE FROM "daily_energy"."restricted_deletion_status_grant"
      WHERE id=status_grant_record.id;
    RETURN NULL;
  END IF;
  IF status_grant_record."tokenHash"<>status_token_hash THEN
    UPDATE "daily_energy"."restricted_deletion_status_grant"
      SET "failedAttemptCount"="failedAttemptCount"+1
      WHERE id=status_grant_record.id;
    RETURN NULL;
  END IF;
  SELECT task.state::text,c014_data_task_view(task) INTO task_state,task_view
    FROM "daily_energy"."restricted_data_task" task
    WHERE task.id=target_task_id AND task.kind='DELETE' AND task.scope='ACCOUNT';
  IF task_view IS NULL THEN RETURN NULL; END IF;
  IF task_state='SUCCEEDED' THEN
    DELETE FROM "daily_energy"."restricted_deletion_status_grant"
      WHERE id=status_grant_record.id;
  END IF;
  RETURN task_view;
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."cancel_c014_data_task"(
  target_account_id uuid,target_task_id uuid,target_command_ref uuid,
  expected_revision integer,target_fingerprint bytea,requested_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE task record; existing uuid;
BEGIN
  existing:=c014_existing_command_response(target_account_id,target_command_ref,
    'CANCEL_DATA_TASK',target_task_id::text,target_fingerprint);
  IF existing IS NOT NULL THEN
    RETURN get_c014_data_task(target_account_id,existing,requested_at);
  END IF;
  SELECT * INTO task FROM "daily_energy"."restricted_data_task"
  WHERE id=target_task_id AND "accountId"=target_account_id FOR UPDATE;
  IF task.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_NOT_FOUND'; END IF;
  IF task.revision<>expected_revision THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_REVISION_CONFLICT';
  END IF;
  IF task.kind<>'EXPORT' OR task.state<>'QUEUED' OR task."guardedAt" IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_STATE_PRECONDITION';
  END IF;
  UPDATE "daily_energy"."restricted_data_task"
    SET state='CANCELLED',"activeSlot"=NULL,revision=revision+1,"finishedAt"=requested_at
    WHERE id=target_task_id;
  UPDATE "daily_energy"."app_user_account"
    SET "lastActiveUseAt"=GREATEST("lastActiveUseAt",requested_at),
        "inactivityDeletionDueAt"=GREATEST("lastActiveUseAt",requested_at)+interval '24 months',
        "updatedAt"=GREATEST("updatedAt",requested_at)
    WHERE id=target_account_id AND state='ACTIVE';
  PERFORM c014_record_command(target_account_id,target_command_ref,'CANCEL_DATA_TASK',
    'DATA_TASK',target_task_id::text,target_fingerprint,target_task_id,requested_at);
  RETURN get_c014_data_task(target_account_id,target_task_id,requested_at);
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c014_cleanup_weekly_windows"(
  target_account_id uuid,target_product_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
BEGIN
  UPDATE "daily_energy"."app_weekly_window" SET "currentSummaryRef"=NULL,
    "currentSourceFingerprint"=NULL,revision=revision+1,"updatedAt"=now()
  WHERE "accountId"=target_account_id
    AND target_product_date BETWEEN "endProductDate"-6 AND "endProductDate";
  DELETE FROM "daily_energy"."app_weekly_source_dependency" dependency
  USING "daily_energy"."app_weekly_personalized_content_fragment" fragment,
    "daily_energy"."app_weekly_content_slot" slot,
    "daily_energy"."app_published_weekly_summary_revision" summary,
    "daily_energy"."app_weekly_window" weekly_window
  WHERE dependency."fragmentId"=fragment.id AND fragment."slotId"=slot.id
    AND slot."summaryId"=summary.id AND summary."windowId"=weekly_window.id
    AND weekly_window."accountId"=target_account_id
    AND target_product_date BETWEEN weekly_window."endProductDate"-6 AND weekly_window."endProductDate";
  DELETE FROM "daily_energy"."app_weekly_personalized_content_fragment" fragment
  USING "daily_energy"."app_weekly_content_slot" slot,
    "daily_energy"."app_published_weekly_summary_revision" summary,
    "daily_energy"."app_weekly_window" weekly_window
  WHERE fragment."slotId"=slot.id AND slot."summaryId"=summary.id
    AND summary."windowId"=weekly_window.id AND weekly_window."accountId"=target_account_id
    AND target_product_date BETWEEN weekly_window."endProductDate"-6 AND weekly_window."endProductDate";
  DELETE FROM "daily_energy"."app_weekly_content_slot" slot
  USING "daily_energy"."app_published_weekly_summary_revision" summary,
    "daily_energy"."app_weekly_window" weekly_window
  WHERE slot."summaryId"=summary.id AND summary."windowId"=weekly_window.id
    AND weekly_window."accountId"=target_account_id
    AND target_product_date BETWEEN weekly_window."endProductDate"-6 AND weekly_window."endProductDate";
  DELETE FROM "daily_energy"."app_memory_context_snapshot" snapshot
  USING "daily_energy"."runtime_gateway_invocation" invocation,
    "daily_energy"."app_weekly_summary_intent" intent,
    "daily_energy"."app_weekly_window" weekly_window
  WHERE snapshot."invocationId"=invocation.id
    AND invocation."weeklySummaryIntentId"=intent.id AND intent."windowId"=weekly_window.id
    AND weekly_window."accountId"=target_account_id
    AND target_product_date BETWEEN weekly_window."endProductDate"-6 AND weekly_window."endProductDate";
  DELETE FROM "daily_energy"."runtime_gateway_candidate" candidate
  USING "daily_energy"."runtime_gateway_attempt" attempt,
    "daily_energy"."runtime_gateway_invocation" invocation,
    "daily_energy"."app_weekly_summary_intent" intent,
    "daily_energy"."app_weekly_window" weekly_window
  WHERE candidate."attemptId"=attempt.id AND attempt."invocationId"=invocation.id
    AND invocation."weeklySummaryIntentId"=intent.id AND intent."windowId"=weekly_window.id
    AND weekly_window."accountId"=target_account_id
    AND target_product_date BETWEEN weekly_window."endProductDate"-6 AND weekly_window."endProductDate";
  DELETE FROM "daily_energy"."runtime_gateway_attempt" attempt
  USING "daily_energy"."runtime_gateway_invocation" invocation,
    "daily_energy"."app_weekly_summary_intent" intent,
    "daily_energy"."app_weekly_window" weekly_window
  WHERE attempt."invocationId"=invocation.id
    AND invocation."weeklySummaryIntentId"=intent.id AND intent."windowId"=weekly_window.id
    AND weekly_window."accountId"=target_account_id
    AND target_product_date BETWEEN weekly_window."endProductDate"-6 AND weekly_window."endProductDate";
  DELETE FROM "daily_energy"."runtime_gateway_invocation" invocation
  USING "daily_energy"."app_weekly_summary_intent" intent,
    "daily_energy"."app_weekly_window" weekly_window
  WHERE invocation."weeklySummaryIntentId"=intent.id AND intent."windowId"=weekly_window.id
    AND weekly_window."accountId"=target_account_id
    AND target_product_date BETWEEN weekly_window."endProductDate"-6 AND weekly_window."endProductDate";
  DELETE FROM "daily_energy"."app_published_weekly_summary_revision" summary
  USING "daily_energy"."app_weekly_window" weekly_window
  WHERE summary."windowId"=weekly_window.id AND weekly_window."accountId"=target_account_id
    AND target_product_date BETWEEN weekly_window."endProductDate"-6 AND weekly_window."endProductDate";
  DELETE FROM "daily_energy"."app_weekly_summary_intent" intent
  USING "daily_energy"."app_weekly_window" weekly_window
  WHERE intent."windowId"=weekly_window.id AND weekly_window."accountId"=target_account_id
    AND target_product_date BETWEEN weekly_window."endProductDate"-6 AND weekly_window."endProductDate";
  DELETE FROM "daily_energy"."app_weekly_source_snapshot" snapshot
  USING "daily_energy"."app_weekly_window" weekly_window
  WHERE snapshot."windowId"=weekly_window.id AND weekly_window."accountId"=target_account_id
    AND target_product_date BETWEEN weekly_window."endProductDate"-6 AND weekly_window."endProductDate";
  DELETE FROM "daily_energy"."app_weekly_window"
  WHERE "accountId"=target_account_id
    AND target_product_date BETWEEN "endProductDate"-6 AND "endProductDate";
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c014_cleanup_day"(
  target_account_id uuid,target_product_date date,target_task_id uuid,
  deletion_epoch bigint,erased_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE original_version text; owner_token bytea;
BEGIN
  SELECT "ownerScopeToken" INTO owner_token FROM "daily_energy"."app_user_account"
    WHERE id=target_account_id;
  SELECT "resultVersion" INTO original_version FROM "daily_energy"."app_generation_intent"
    WHERE "accountId"=target_account_id AND "targetProductDate"=target_product_date;
  INSERT INTO "daily_energy"."restricted_day_erasure_guard"
    (id,"ownerScopeToken","productDate","deletionEpoch","originalResultVersion",
     "deletionTaskRef","createdAt","expiresAt")
  VALUES (gen_random_uuid(),owner_token,target_product_date,deletion_epoch,
    original_version,target_task_id,erased_at,erased_at+interval '45 days')
  ON CONFLICT ("ownerScopeToken","productDate") DO UPDATE SET
    "deletionEpoch"=EXCLUDED."deletionEpoch",
    "originalResultVersion"=COALESCE("restricted_day_erasure_guard"."originalResultVersion",
      EXCLUDED."originalResultVersion"),"deletionTaskRef"=EXCLUDED."deletionTaskRef",
    "createdAt"=EXCLUDED."createdAt","expiresAt"=EXCLUDED."expiresAt";

  PERFORM c014_cleanup_weekly_windows(target_account_id,target_product_date);
  DELETE FROM "daily_energy"."runtime_notification_delivery_attempt" attempt
  USING "daily_energy"."app_notification_intent" intent
  WHERE attempt."intentId"=intent.id AND intent."accountId"=target_account_id
    AND intent."targetProductDate"=target_product_date;
  DELETE FROM "daily_energy"."app_notification_intent"
  WHERE "accountId"=target_account_id AND "targetProductDate"=target_product_date;
  DELETE FROM "daily_energy"."app_relationship_encounter_link" link
  USING "daily_energy"."app_relationship_cycle" cycle
  WHERE link."cycleId"=cycle.id AND cycle."accountId"=target_account_id
    AND link."productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_evening_feedback_revision" revision
  USING "daily_energy"."app_evening_feedback_record" feedback,
    "daily_energy"."app_daily_interaction" interaction
  WHERE revision."feedbackId"=feedback.id AND feedback."interactionId"=interaction.id
    AND interaction."accountId"=target_account_id
    AND interaction."productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_evening_feedback_record" feedback
  USING "daily_energy"."app_daily_interaction" interaction
  WHERE feedback."interactionId"=interaction.id AND interaction."accountId"=target_account_id
    AND interaction."productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_daily_helpfulness_record" item
  USING "daily_energy"."app_daily_interaction" interaction
  WHERE item."interactionId"=interaction.id AND interaction."accountId"=target_account_id
    AND interaction."productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_daily_task_state" item
  USING "daily_energy"."app_daily_interaction" interaction
  WHERE item."interactionId"=interaction.id AND interaction."accountId"=target_account_id
    AND interaction."productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_daily_light_fact" item
  USING "daily_energy"."app_daily_interaction" interaction
  WHERE item."interactionId"=interaction.id AND interaction."accountId"=target_account_id
    AND interaction."productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_daily_interaction"
  WHERE "accountId"=target_account_id AND "productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_memory_mention_receipt"
  WHERE "accountId"=target_account_id AND "productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_source_dependency" dependency
  USING "daily_energy"."app_personalized_content_fragment" fragment,
    "daily_energy"."app_result_content_slot" slot,
    "daily_energy"."app_published_daily_result" result
  WHERE dependency."fragmentId"=fragment.id AND fragment."slotId"=slot.id
    AND slot."resultId"=result.id AND result."accountId"=target_account_id
    AND result."productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_personalized_content_fragment" fragment
  USING "daily_energy"."app_result_content_slot" slot,
    "daily_energy"."app_published_daily_result" result
  WHERE fragment."slotId"=slot.id AND slot."resultId"=result.id
    AND result."accountId"=target_account_id AND result."productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_result_content_slot" slot
  USING "daily_energy"."app_published_daily_result" result
  WHERE slot."resultId"=result.id AND result."accountId"=target_account_id
    AND result."productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_published_result_visibility" visibility
  USING "daily_energy"."app_published_daily_result" result
  WHERE visibility."resultId"=result.id AND result."accountId"=target_account_id
    AND result."productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_memory_context_snapshot" snapshot
  USING "daily_energy"."runtime_gateway_invocation" invocation,
    "daily_energy"."app_generation_intent" intent
  WHERE snapshot."invocationId"=invocation.id AND invocation."generationIntentId"=intent.id
    AND intent."accountId"=target_account_id AND intent."targetProductDate"=target_product_date;
  DELETE FROM "daily_energy"."runtime_gateway_candidate" candidate
  USING "daily_energy"."runtime_gateway_attempt" attempt,
    "daily_energy"."runtime_gateway_invocation" invocation,
    "daily_energy"."app_generation_intent" intent
  WHERE candidate."attemptId"=attempt.id AND attempt."invocationId"=invocation.id
    AND invocation."generationIntentId"=intent.id AND intent."accountId"=target_account_id
    AND intent."targetProductDate"=target_product_date;
  DELETE FROM "daily_energy"."runtime_gateway_attempt" attempt
  USING "daily_energy"."runtime_gateway_invocation" invocation,
    "daily_energy"."app_generation_intent" intent
  WHERE attempt."invocationId"=invocation.id AND invocation."generationIntentId"=intent.id
    AND intent."accountId"=target_account_id AND intent."targetProductDate"=target_product_date;
  DELETE FROM "daily_energy"."runtime_gateway_invocation" invocation
  USING "daily_energy"."app_generation_intent" intent
  WHERE invocation."generationIntentId"=intent.id AND intent."accountId"=target_account_id
    AND intent."targetProductDate"=target_product_date;
  DELETE FROM "daily_energy"."app_published_daily_result"
  WHERE "accountId"=target_account_id AND "productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_generation_input_snapshot" snapshot
  USING "daily_energy"."app_generation_intent" intent
  WHERE snapshot."generationIntentId"=intent.id AND intent."accountId"=target_account_id
    AND intent."targetProductDate"=target_product_date;
  DELETE FROM "daily_energy"."app_generation_intent"
  WHERE "accountId"=target_account_id AND "targetProductDate"=target_product_date;
  DELETE FROM "daily_energy"."app_morning_checkin_revision" revision
  USING "daily_energy"."app_morning_checkin" checkin
  WHERE revision."checkinId"=checkin.id AND checkin."accountId"=target_account_id
    AND checkin."productDate"=target_product_date;
  DELETE FROM "daily_energy"."app_morning_checkin"
  WHERE "accountId"=target_account_id AND "productDate"=target_product_date;
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c014_cleanup_matter"(
  target_account_id uuid,target_matter_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE daily_fragments uuid[]; weekly_fragments uuid[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT "fragmentId"),'{}'::uuid[])
    INTO daily_fragments
    FROM "daily_energy"."app_source_dependency"
    WHERE "sourceType"='MATTER' AND "sourceRef"=target_matter_id;
  SELECT COALESCE(array_agg(DISTINCT "fragmentId"),'{}'::uuid[])
    INTO weekly_fragments
    FROM "daily_energy"."app_weekly_source_dependency"
    WHERE "sourceType"='MATTER' AND "sourceRef"=target_matter_id;
  UPDATE "daily_energy"."app_published_result_visibility" visibility
  SET state='BLOCKED',revision=revision+1,"blockedReasonCode"='SOURCE_DELETED',
      "updatedAt"=now()
  WHERE EXISTS (
    SELECT 1 FROM "daily_energy"."app_result_content_slot" slot
    JOIN "daily_energy"."app_personalized_content_fragment" fragment ON fragment."slotId"=slot.id
    JOIN "daily_energy"."app_source_dependency" dependency ON dependency."fragmentId"=fragment.id
    WHERE slot."resultId"=visibility."resultId"
      AND dependency."sourceType"='MATTER' AND dependency."sourceRef"=target_matter_id
      AND slot."fallbackPayload" IS NULL
  );
  UPDATE "daily_energy"."app_weekly_window" weekly_window
  SET "currentSummaryRef"=NULL,"currentSourceFingerprint"=NULL,
      revision=revision+1,"updatedAt"=now()
  WHERE weekly_window."accountId"=target_account_id AND EXISTS (
    SELECT 1 FROM "daily_energy"."app_published_weekly_summary_revision" summary
    JOIN "daily_energy"."app_weekly_content_slot" slot ON slot."summaryId"=summary.id
    JOIN "daily_energy"."app_weekly_personalized_content_fragment" fragment ON fragment."slotId"=slot.id
    JOIN "daily_energy"."app_weekly_source_dependency" dependency ON dependency."fragmentId"=fragment.id
    WHERE summary."windowId"=weekly_window.id AND dependency."sourceType"='MATTER'
      AND dependency."sourceRef"=target_matter_id
  );
  DELETE FROM "daily_energy"."app_source_dependency"
  WHERE "fragmentId"=ANY(daily_fragments);
  DELETE FROM "daily_energy"."app_weekly_source_dependency"
  WHERE "fragmentId"=ANY(weekly_fragments);
  DELETE FROM "daily_energy"."app_personalized_content_fragment"
  WHERE id=ANY(daily_fragments);
  DELETE FROM "daily_energy"."app_weekly_personalized_content_fragment"
  WHERE id=ANY(weekly_fragments);
  DELETE FROM "daily_energy"."app_memory_context_snapshot"
  WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."runtime_notification_delivery_attempt" attempt
  USING "daily_energy"."app_notification_intent" intent
  WHERE attempt."intentId"=intent.id AND intent."accountId"=target_account_id
    AND intent."matterRef"=target_matter_id;
  DELETE FROM "daily_energy"."app_notification_intent"
  WHERE "accountId"=target_account_id AND "matterRef"=target_matter_id;
  DELETE FROM "daily_energy"."app_memory_mention_receipt"
  WHERE "accountId"=target_account_id AND "sourceType"='MATTER'
    AND "sourceRef"=target_matter_id;
  DELETE FROM "daily_energy"."app_memory_purpose_grant"
  WHERE "accountId"=target_account_id AND "sourceType"='MATTER'
    AND "sourceRef"=target_matter_id;
  DELETE FROM "daily_energy"."app_important_matter_revision"
  WHERE "matterId"=target_matter_id;
  DELETE FROM "daily_energy"."app_important_matter"
  WHERE id=target_matter_id AND "accountId"=target_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c014_cleanup_relationship"(
  target_account_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE daily_fragments uuid[]; weekly_fragments uuid[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT dependency."fragmentId"),'{}'::uuid[])
    INTO daily_fragments
    FROM "daily_energy"."app_source_dependency" dependency
    WHERE dependency."sourceType" IN ('RELATIONSHIP','RELATIONSHIP_DATA')
      AND dependency."sourceRef" IN (
        SELECT id FROM "daily_energy"."app_relationship_cycle"
        WHERE "accountId"=target_account_id
      );
  SELECT COALESCE(array_agg(DISTINCT dependency."fragmentId"),'{}'::uuid[])
    INTO weekly_fragments
    FROM "daily_energy"."app_weekly_source_dependency" dependency
    WHERE dependency."sourceType" IN ('RELATIONSHIP','RELATIONSHIP_DATA')
      AND dependency."sourceRef" IN (
        SELECT id FROM "daily_energy"."app_relationship_cycle"
        WHERE "accountId"=target_account_id
      );
  UPDATE "daily_energy"."app_published_result_visibility" visibility
    SET state='BLOCKED',revision=revision+1,"blockedReasonCode"='SOURCE_DELETED',
        "updatedAt"=now()
    WHERE EXISTS (
      SELECT 1 FROM "daily_energy"."app_result_content_slot" slot
      JOIN "daily_energy"."app_personalized_content_fragment" fragment
        ON fragment."slotId"=slot.id
      WHERE slot."resultId"=visibility."resultId"
        AND fragment.id=ANY(daily_fragments)
        AND slot."fallbackPayload" IS NULL
    );
  UPDATE "daily_energy"."app_weekly_window" weekly_window
    SET "currentSummaryRef"=NULL,"currentSourceFingerprint"=NULL,
        revision=revision+1,"updatedAt"=now()
    WHERE weekly_window."accountId"=target_account_id AND EXISTS (
      SELECT 1 FROM "daily_energy"."app_published_weekly_summary_revision" summary
      JOIN "daily_energy"."app_weekly_content_slot" slot
        ON slot."summaryId"=summary.id
      JOIN "daily_energy"."app_weekly_personalized_content_fragment" fragment
        ON fragment."slotId"=slot.id
      WHERE summary."windowId"=weekly_window.id
        AND fragment.id=ANY(weekly_fragments)
    );
  DELETE FROM "daily_energy"."app_memory_context_snapshot"
    WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_source_dependency"
    WHERE "fragmentId"=ANY(daily_fragments);
  DELETE FROM "daily_energy"."app_weekly_source_dependency"
    WHERE "fragmentId"=ANY(weekly_fragments);
  DELETE FROM "daily_energy"."app_personalized_content_fragment"
    WHERE id=ANY(daily_fragments);
  DELETE FROM "daily_energy"."app_weekly_personalized_content_fragment"
    WHERE id=ANY(weekly_fragments);
  DELETE FROM "daily_energy"."app_memory_purpose_grant"
    WHERE "accountId"=target_account_id
      AND "sourceType" IN ('RELATIONSHIP','RELATIONSHIP_DATA');
  DELETE FROM "daily_energy"."app_relationship_node_receipt" receipt
  USING "daily_energy"."app_relationship_cycle" cycle
  WHERE receipt."cycleId"=cycle.id AND cycle."accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_relationship_encounter_link" link
  USING "daily_energy"."app_relationship_cycle" cycle
  WHERE link."cycleId"=cycle.id AND cycle."accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_relationship_cycle"
    WHERE "accountId"=target_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c014_cleanup_account"(
  target_account_id uuid,target_task_id uuid,deletion_epoch bigint,
  erased_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT DISTINCT date_value FROM (
      SELECT "productDate" AS date_value FROM "daily_energy"."app_morning_checkin"
        WHERE "accountId"=target_account_id
      UNION SELECT "productDate" FROM "daily_energy"."app_published_daily_result"
        WHERE "accountId"=target_account_id
      UNION SELECT "productDate" FROM "daily_energy"."app_daily_interaction"
        WHERE "accountId"=target_account_id
    ) dates
  LOOP
    PERFORM c014_cleanup_day(target_account_id,item.date_value,target_task_id,
      deletion_epoch,erased_at);
  END LOOP;
  FOR item IN SELECT id FROM "daily_energy"."app_important_matter"
    WHERE "accountId"=target_account_id LOOP
    PERFORM c014_cleanup_matter(target_account_id,item.id);
  END LOOP;
  PERFORM c014_cleanup_relationship(target_account_id);

  DELETE FROM "daily_energy"."runtime_notification_delivery_attempt" attempt
  USING "daily_energy"."app_notification_intent" intent
  WHERE attempt."intentId"=intent.id AND intent."accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_notification_intent" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_platform_permission_snapshot" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_notification_preference" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_memory_mention_receipt" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_memory_context_snapshot" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_memory_purpose_grant" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_memory_master_preference" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."restricted_recovery_command_receipt" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."restricted_safety_response_plan" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."restricted_safety_event" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."restricted_safety_decision" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."restricted_safety_state" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_view_continuation_grant" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_onboarding_completion" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_user_profile_revision" revision
  USING "daily_energy"."app_user_profile" profile
  WHERE revision."profileId"=profile.id AND profile."accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_user_profile" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_necessary_consent_record" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_session_credential" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."app_external_identity" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."restricted_identity_verification" WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."restricted_deletion_confirmation_challenge"
    WHERE "accountId"=target_account_id;
  DELETE FROM "daily_energy"."restricted_export_manifest" manifest
    USING "daily_energy"."restricted_data_task" export_task
    WHERE manifest."taskId"=export_task.id
      AND export_task."accountId"=target_account_id AND export_task.kind='EXPORT';
  UPDATE "daily_energy"."restricted_data_task"
    SET state='CANCELLED',"activeSlot"=NULL,revision=revision+1,"finishedAt"=erased_at,
        "failureScopeCodes"=ARRAY['ACCOUNT_DELETE_SUPERSEDED']
    WHERE "accountId"=target_account_id AND id<>target_task_id AND kind='EXPORT'
      AND state IN ('QUEUED','RUNNING','FAILED');
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."execute_c014_data_rights_retention"(
  target_task_id uuid,
  executed_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE task record; deleted_count integer; manifest_state text;
BEGIN
  SELECT * INTO task FROM "daily_energy"."restricted_data_task"
    WHERE id=target_task_id FOR UPDATE;
  IF task.id IS NULL THEN RETURN 'ALREADY_PURGED'; END IF;

  DELETE FROM "daily_energy"."restricted_deletion_status_grant"
    WHERE "taskId"=target_task_id AND "expiresAt"<=executed_at;
  GET DIAGNOSTICS deleted_count=ROW_COUNT;
  IF deleted_count>0 THEN RETURN 'STATUS_GRANT_PURGED'; END IF;

  IF task.kind='EXPORT' THEN
    IF task."activeSlot" IS NULL AND task."expiresAt" IS NOT NULL
       AND task."expiresAt"<=executed_at THEN
      DELETE FROM "daily_energy"."restricted_export_manifest"
        WHERE "taskId"=target_task_id;
      DELETE FROM "daily_energy"."restricted_data_task"
        WHERE id=target_task_id;
      RETURN 'EXPORT_METADATA_PURGED';
    END IF;
    PERFORM c014_refresh_export_manifests(task."accountId",executed_at);
    SELECT state::text INTO manifest_state
      FROM "daily_energy"."restricted_export_manifest"
      WHERE "taskId"=target_task_id;
    IF manifest_state='EXPIRED' THEN RETURN 'EXPORT_ARTIFACT_EXPIRED'; END IF;
  END IF;
  RETURN 'RETENTION_NOT_DUE';
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."execute_c014_data_task"(
  target_task_id uuid,expected_revision integer,expected_deletion_epoch bigint,
  executed_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE task record; guard record; subject_token bytea; case_ref uuid;
  backup_deadline timestamptz;
BEGIN
  SELECT * INTO task FROM "daily_energy"."restricted_data_task"
  WHERE id=target_task_id FOR UPDATE;
  IF task.id IS NULL THEN RETURN 'TASK_MISSING'; END IF;
  IF task.state='SUCCEEDED' THEN RETURN 'ALREADY_SUCCEEDED'; END IF;
  IF task.state='CANCELLED' THEN RETURN 'ALREADY_CANCELLED'; END IF;
  IF task.revision<>expected_revision THEN RETURN 'STALE_REVISION'; END IF;
  IF task.kind='EXPORT' THEN
    UPDATE "daily_energy"."restricted_data_task"
      SET state='RUNNING',revision=revision+1,
        "startedAt"=COALESCE("startedAt",executed_at),"finishedAt"=NULL,
        "failureScopeCodes"='{}'
      WHERE id=target_task_id;
    RETURN 'EXPORT_PREPARING';
  END IF;
  SELECT * INTO guard FROM "daily_energy"."restricted_deletion_guard"
  WHERE "taskRef"=target_task_id AND "releasedAt" IS NULL FOR UPDATE;
  IF guard.id IS NULL OR guard."deletionEpoch"<>expected_deletion_epoch THEN
    RETURN 'STALE_GUARD';
  END IF;
  IF EXISTS (SELECT 1 FROM "daily_energy"."restricted_legal_hold"
    WHERE "blindedSubjectToken"=(SELECT "ownerScopeToken" FROM
      "daily_energy"."app_user_account" WHERE id=task."accountId")
      AND "releasedAt" IS NULL AND "endsAt">executed_at) THEN
    UPDATE "daily_energy"."restricted_data_task" SET state='FAILED',revision=revision+1,
      "startedAt"=COALESCE("startedAt",executed_at),"finishedAt"=executed_at,
      "failureScopeCodes"=ARRAY['RESTRICTED_LEGAL_HOLD'] WHERE id=target_task_id;
    RETURN 'RESTRICTED_LEGAL_HOLD';
  END IF;

  UPDATE "daily_energy"."restricted_data_task" SET state='RUNNING',revision=revision+1,
    "startedAt"=COALESCE("startedAt",executed_at) WHERE id=target_task_id;
  INSERT INTO "daily_energy"."restricted_deletion_step_checkpoint"
    (id,"taskId","subsystemCode",state,"attemptCount","startedAt","updatedAt",
     "retentionPolicyVersion","retentionScope","retentionAnchorAt")
  VALUES (gen_random_uuid(),target_task_id,'ONLINE_ERASURE','RUNNING',1,executed_at,
    executed_at,'retention-policy-v1','RUNTIME',executed_at)
  ON CONFLICT ("taskId","subsystemCode") DO UPDATE SET state='RUNNING',
    "attemptCount"="restricted_deletion_step_checkpoint"."attemptCount"+1,
    "startedAt"=COALESCE("restricted_deletion_step_checkpoint"."startedAt",executed_at),
    "updatedAt"=executed_at,"lastStableFailureCode"=NULL;

  SELECT "ownerScopeToken" INTO subject_token
    FROM "daily_energy"."app_user_account" WHERE id=task."accountId";
  IF task.scope='DAY' THEN
    PERFORM c014_cleanup_day(task."accountId",task."targetKey"::date,target_task_id,
      guard."deletionEpoch",executed_at);
  ELSIF task.scope='MATTER' THEN
    PERFORM c014_cleanup_matter(task."accountId",task."targetKey"::uuid);
  ELSIF task.scope='RELATIONSHIP_DATA' THEN
    PERFORM c014_cleanup_relationship(task."accountId");
  ELSIF task.scope='ACCOUNT' THEN
    PERFORM c014_cleanup_account(task."accountId",target_task_id,guard."deletionEpoch",executed_at);
  ELSE
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='C014_SCOPE_UNSUPPORTED';
  END IF;

  UPDATE "daily_energy"."restricted_deletion_step_checkpoint"
    SET state='SUCCEEDED',"finishedAt"=executed_at,"updatedAt"=executed_at
    WHERE "taskId"=target_task_id AND "subsystemCode"='ONLINE_ERASURE';
  BEGIN
    case_ref:=gen_random_uuid(); backup_deadline:=executed_at+interval '35 days';
    INSERT INTO "daily_energy"."restricted_restore_deny_record"
      (id,"caseRef","blindedSubjectToken",scope,"targetToken","deletionEpoch",
       "effectiveAt","retentionPolicyVersion","retentionScope","retentionAnchorAt","expiresAt")
    VALUES (gen_random_uuid(),case_ref,subject_token,task.scope,
      CASE WHEN task.scope='ACCOUNT' THEN NULL ELSE decode(md5(task."targetKey"),'hex') END,
      guard."deletionEpoch",executed_at,'retention-policy-v1','LEGAL_EVIDENCE',
      executed_at,executed_at+interval '6 months');
    INSERT INTO "daily_energy"."restricted_deletion_receipt"
      (id,"caseRef","blindedSubjectToken","taskRef",kind,scope,"targetType",
       "confirmationVersion","policyVersion","requestedAt","guardedAt",
       "onlineErasedAt","finishedAt","backupPurgeDeadline","providerExpiryDeadlines",
       outcome,"failureScopeCodes","expiresAt")
    VALUES (gen_random_uuid(),case_ref,
      CASE WHEN task.scope='ACCOUNT' THEN NULL ELSE subject_token END,
      target_task_id,task.kind,task.scope,task."targetType",task."confirmationVersion",
      'retention-policy-v1',task."requestedAt",task."guardedAt",executed_at,executed_at,
      backup_deadline,'[]'::jsonb,'SUCCEEDED','{}',executed_at+interval '6 months');
    INSERT INTO "daily_energy"."restricted_deletion_step_checkpoint"
      (id,"taskId","subsystemCode",state,"attemptCount","startedAt","finishedAt","updatedAt",
       "retentionPolicyVersion","retentionScope","retentionAnchorAt")
    VALUES
      (gen_random_uuid(),target_task_id,'RESTORE_DENY','SUCCEEDED',1,executed_at,executed_at,
        executed_at,'retention-policy-v1','RUNTIME',executed_at),
      (gen_random_uuid(),target_task_id,'DELETION_RECEIPT','SUCCEEDED',1,executed_at,executed_at,
        executed_at,'retention-policy-v1','RUNTIME',executed_at)
    ON CONFLICT ("taskId","subsystemCode") DO UPDATE SET state='SUCCEEDED',
      "attemptCount"="restricted_deletion_step_checkpoint"."attemptCount"+1,
      "lastStableFailureCode"=NULL,"finishedAt"=executed_at,"updatedAt"=executed_at;
  EXCEPTION WHEN others THEN
    INSERT INTO "daily_energy"."restricted_deletion_step_checkpoint"
      (id,"taskId","subsystemCode",state,"attemptCount","lastStableFailureCode",
       "startedAt","finishedAt","updatedAt","retentionPolicyVersion",
       "retentionScope","retentionAnchorAt")
    VALUES (gen_random_uuid(),target_task_id,'RESTRICTED_EVIDENCE','FAILED',1,
      'RESTRICTED_EVIDENCE_WRITE_FAILED',executed_at,executed_at,executed_at,
      'retention-policy-v1','RUNTIME',executed_at)
    ON CONFLICT ("taskId","subsystemCode") DO UPDATE SET state='FAILED',
      "attemptCount"="restricted_deletion_step_checkpoint"."attemptCount"+1,
      "lastStableFailureCode"='RESTRICTED_EVIDENCE_WRITE_FAILED',
      "finishedAt"=executed_at,"updatedAt"=executed_at;
    UPDATE "daily_energy"."restricted_data_task"
      SET state='FAILED',revision=revision+1,"finishedAt"=executed_at,
        "failureScopeCodes"=ARRAY['RESTRICTED_EVIDENCE_WRITE_FAILED']
      WHERE id=target_task_id;
    RETURN 'RESTRICTED_EVIDENCE_FAILED';
  END;
  UPDATE "daily_energy"."restricted_deletion_step_checkpoint"
    SET state='SUCCEEDED',"lastStableFailureCode"=NULL,
      "finishedAt"=executed_at,"updatedAt"=executed_at
    WHERE "taskId"=target_task_id AND "subsystemCode"='RESTRICTED_EVIDENCE';
  UPDATE "daily_energy"."restricted_data_task"
    SET state='SUCCEEDED',"activeSlot"=NULL,revision=revision+1,
      "onlineErasedAt"=executed_at,"finishedAt"=executed_at,
      "backupPurgeDeadline"=backup_deadline,"providerExpiryDeadlines"='[]'::jsonb,
      "failureScopeCodes"='{}'
    WHERE id=target_task_id;
  IF task.scope='ACCOUNT' THEN
    UPDATE "daily_energy"."app_user_account"
      SET state='DELETED',revision=revision+1,
        "ownerScopeToken"=decode(md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text),'hex'),
        "stableSubjectCiphertext"=decode(md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text),'hex'),
        "stableSubjectKeyVersion"='destroyed-c014-v1',
        "restrictionCode"='ACCOUNT_DELETED',"updatedAt"=executed_at,
        "retentionAnchorAt"=executed_at,"expiresAt"=executed_at+interval '6 months'
      WHERE id=task."accountId" AND state='DELETING';
  END IF;
  IF task.scope='RELATIONSHIP_DATA' THEN
    UPDATE "daily_energy"."restricted_deletion_guard"
      SET "releasedAt"=executed_at
      WHERE id=guard.id AND "releasedAt" IS NULL;
  END IF;
  RETURN 'SUCCEEDED';
END;
$$;

REVOKE ALL ON TABLE
  "daily_energy"."restricted_deletion_confirmation_challenge",
  "daily_energy"."restricted_identity_verification",
  "daily_energy"."restricted_export_manifest",
  "daily_energy"."restricted_deletion_status_grant"
FROM PUBLIC,"daily_energy_api","daily_energy_interactive","daily_energy_background",
  "daily_energy_restricted","daily_energy_safety","daily_energy_deletion";
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE
  "daily_energy"."restricted_deletion_confirmation_challenge",
  "daily_energy"."restricted_identity_verification",
  "daily_energy"."restricted_export_manifest",
  "daily_energy"."restricted_deletion_status_grant"
TO "daily_energy_test";
GRANT SELECT,DELETE ON TABLE
  "daily_energy"."restricted_deletion_confirmation_challenge",
  "daily_energy"."restricted_identity_verification"
TO "daily_energy_deletion";
GRANT SELECT ON TABLE
  "daily_energy"."restricted_export_manifest",
  "daily_energy"."restricted_deletion_status_grant"
TO "daily_energy_deletion";

REVOKE ALL ON FUNCTION "daily_energy"."c014_data_task_view"("daily_energy"."restricted_data_task") FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."c014_export_source_vector"(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."get_c014_export_source_vector"(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."c014_refresh_export_manifests"(uuid,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."get_c014_data_rights_summary"(uuid,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."c014_export_source_payload"(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."read_c014_export_artifact"(uuid,uuid,uuid,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."list_c014_data_tasks"(uuid,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."get_c014_data_task"(uuid,uuid,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."create_c014_export_task"(uuid,uuid,text,bytea,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."finalize_c014_export_task"(uuid,integer,jsonb,bytea,uuid,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."create_c014_day_deletion"(uuid,uuid,date,integer,text,bytea,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."create_c014_matter_deletion"(uuid,uuid,uuid,integer,text,bytea,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."prepare_c014_relationship_deletion"(uuid,uuid,jsonb,integer,text,bytea,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."prepare_c014_account_deletion"(uuid,uuid,integer,text,bytea,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."verify_c014_deletion_identity"(uuid,uuid,uuid,bytea,bytea,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."confirm_c014_relationship_deletion"(uuid,uuid,uuid,jsonb,integer,text,uuid,bytea,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."confirm_c014_account_deletion"(uuid,uuid,uuid,integer,text,uuid,bytea,bytea,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."get_c014_deletion_status"(uuid,bytea,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."cancel_c014_data_task"(uuid,uuid,uuid,integer,bytea,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."execute_c014_data_task"(uuid,integer,bigint,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "daily_energy"."execute_c014_data_rights_retention"(uuid,timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "daily_energy"."list_c014_data_tasks"(uuid,timestamptz),
  "daily_energy"."get_c014_data_rights_summary"(uuid,timestamptz),
  "daily_energy"."get_c014_data_task"(uuid,uuid,timestamptz),
  "daily_energy"."read_c014_export_artifact"(uuid,uuid,uuid,timestamptz),
  "daily_energy"."get_c014_deletion_status"(uuid,bytea,timestamptz),
  "daily_energy"."create_c014_export_task"(uuid,uuid,text,bytea,timestamptz),
  "daily_energy"."create_c014_day_deletion"(uuid,uuid,date,integer,text,bytea,timestamptz),
  "daily_energy"."create_c014_matter_deletion"(uuid,uuid,uuid,integer,text,bytea,timestamptz),
  "daily_energy"."prepare_c014_relationship_deletion"(uuid,uuid,jsonb,integer,text,bytea,timestamptz),
  "daily_energy"."prepare_c014_account_deletion"(uuid,uuid,integer,text,bytea,timestamptz),
  "daily_energy"."verify_c014_deletion_identity"(uuid,uuid,uuid,bytea,bytea,timestamptz),
  "daily_energy"."confirm_c014_relationship_deletion"(uuid,uuid,uuid,jsonb,integer,text,uuid,bytea,timestamptz),
  "daily_energy"."confirm_c014_account_deletion"(uuid,uuid,uuid,integer,text,uuid,bytea,bytea,timestamptz),
  "daily_energy"."cancel_c014_data_task"(uuid,uuid,uuid,integer,bytea,timestamptz)
TO "daily_energy_api","daily_energy_test";
GRANT EXECUTE ON FUNCTION "daily_energy"."execute_c014_data_task"(uuid,integer,bigint,timestamptz)
TO "daily_energy_deletion","daily_energy_test";
GRANT EXECUTE ON FUNCTION "daily_energy"."execute_c014_data_rights_retention"(uuid,timestamptz)
TO "daily_energy_deletion","daily_energy_test";
GRANT EXECUTE ON FUNCTION
  "daily_energy"."get_c014_export_source_vector"(uuid),
  "daily_energy"."finalize_c014_export_task"(uuid,integer,jsonb,bytea,uuid,timestamptz)
TO "daily_energy_deletion","daily_energy_test";

-- Rollback requires draining C-014 DataTasks, revoking the function grants,
-- dropping the functions/tables, restoring SQL-010/011, and rebuilding the
-- enum without CANCELLED. It must never discard active deletion guards.
