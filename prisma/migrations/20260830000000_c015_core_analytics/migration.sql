SET search_path TO "daily_energy", pg_catalog;

CREATE TABLE "analytics_product_daily_aggregate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productDate" DATE NOT NULL,
  "environment" VARCHAR(16) NOT NULL,
  "eventName" VARCHAR(64) NOT NULL,
  "eventSchemaVersion" INTEGER NOT NULL DEFAULT 1,
  "dimension1Name" VARCHAR(64),
  "dimension1Code" VARCHAR(64),
  "dimension2Name" VARCHAR(64),
  "dimension2Code" VARCHAR(64),
  "eventCount" BIGINT NOT NULL,
  "uniqueOwnerCount" BIGINT,
  "sumValue" BIGINT,
  "aggregationRevision" BIGINT NOT NULL,
  "sourceContractVersion" VARCHAR(64) NOT NULL,
  "generatedAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "analytics_product_daily_aggregate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analytics_product_environment_check" CHECK ("environment" IN ('PROD','STAGING','TEST','DEV')),
  CONSTRAINT "analytics_product_event_check" CHECK ("eventName" IN (
    'app_launch_resolved','landing_viewed','landing_primary_action_clicked',
    'consent_accepted','consent_withdrawn','onboarding_completed',
    'checkin_submitted','checkin_corrected','checkin_rebuilt',
    'generation_started','daily_result_available','daily_result_read',
    'main_action_reached','dimensions_expanded','day_lit',
    'task_status_updated','helpfulness_updated','evening_saved',
    'evening_updated','evening_skipped','weekly_view_read',
    'weekly_summary_read','history_day_read','settings_viewed','faq_opened',
    'profile_updated','style_calibration_saved','matter_created','matter_updated',
    'matter_status_changed','matter_deleted','notification_settings_updated',
    'notification_permission_observed','notification_intent_outcome',
    'notification_deeplink_resolved','share_preview_created',
    'share_intent_created','support_feedback_submitted','data_rights_entry_viewed'
  )),
  CONSTRAINT "analytics_product_schema_version_check" CHECK ("eventSchemaVersion" = 1),
  CONSTRAINT "analytics_product_dimensions_check" CHECK (
    ("dimension1Name" IS NULL) = ("dimension1Code" IS NULL) AND
    ("dimension2Name" IS NULL) = ("dimension2Code" IS NULL) AND
    ("dimension2Name" IS NULL OR "dimension1Name" IS NOT NULL) AND
    ("dimension1Name" IS NULL OR "dimension1Name" <> "dimension2Name")
  ),
  CONSTRAINT "analytics_product_k_check" CHECK (
    "eventCount" >= 10 AND
    ("uniqueOwnerCount" IS NULL OR
      ("uniqueOwnerCount" >= 10 AND "uniqueOwnerCount" <= "eventCount"))
  ),
  CONSTRAINT "analytics_product_sum_check" CHECK ("sumValue" IS NULL OR "sumValue" >= 0),
  CONSTRAINT "analytics_product_revision_check" CHECK ("aggregationRevision" > 0),
  CONSTRAINT "analytics_product_expiry_check" CHECK (
    "expiresAt" = (("productDate"::timestamp AT TIME ZONE 'UTC') + INTERVAL '13 months')
  ),
  CONSTRAINT "analytics_product_daily_aggregate_key" UNIQUE NULLS NOT DISTINCT (
    "productDate","environment","eventName","eventSchemaVersion",
    "dimension1Name","dimension1Code","dimension2Name","dimension2Code"
  )
);

CREATE TABLE "analytics_runtime_daily_aggregate" (
  LIKE "analytics_product_daily_aggregate" INCLUDING DEFAULTS INCLUDING STORAGE INCLUDING COMMENTS
);
ALTER TABLE "analytics_runtime_daily_aggregate"
  ADD CONSTRAINT "analytics_runtime_daily_aggregate_pkey" PRIMARY KEY ("id"),
  ADD CONSTRAINT "analytics_runtime_environment_check" CHECK ("environment" IN ('PROD','STAGING','TEST','DEV')),
  ADD CONSTRAINT "analytics_runtime_event_check" CHECK ("eventName" IN (
    'api_operation_outcome','product_date_resolution_outcome',
    'generation_runtime_outcome','cache_lookup_outcome','queue_stage_outcome',
    'gateway_usage_aggregate','notification_dispatch_outcome',
    'raw_content_detector_outcome','provider_profile_conformance_outcome',
    'release_contract_outcome'
  )),
  ADD CONSTRAINT "analytics_runtime_schema_version_check" CHECK ("eventSchemaVersion" = 1),
  ADD CONSTRAINT "analytics_runtime_dimensions_check" CHECK (
    ("dimension1Name" IS NULL) = ("dimension1Code" IS NULL) AND
    ("dimension2Name" IS NULL) = ("dimension2Code" IS NULL) AND
    ("dimension2Name" IS NULL OR "dimension1Name" IS NOT NULL) AND
    ("dimension1Name" IS NULL OR "dimension1Name" <> "dimension2Name")
  ),
  ADD CONSTRAINT "analytics_runtime_k_check" CHECK (
    "eventCount" >= 10 AND
    ("uniqueOwnerCount" IS NULL OR
      ("uniqueOwnerCount" >= 10 AND "uniqueOwnerCount" <= "eventCount"))
  ),
  ADD CONSTRAINT "analytics_runtime_sum_check" CHECK ("sumValue" IS NULL OR "sumValue" >= 0),
  ADD CONSTRAINT "analytics_runtime_revision_check" CHECK ("aggregationRevision" > 0),
  ADD CONSTRAINT "analytics_runtime_expiry_check" CHECK ("expiresAt" = (("productDate"::timestamp AT TIME ZONE 'UTC') + INTERVAL '13 months')),
  ADD CONSTRAINT "analytics_runtime_daily_aggregate_key" UNIQUE NULLS NOT DISTINCT (
    "productDate","environment","eventName","eventSchemaVersion",
    "dimension1Name","dimension1Code","dimension2Name","dimension2Code"
  );

CREATE TABLE "analytics_governance_daily_aggregate" (
  LIKE "analytics_product_daily_aggregate" INCLUDING DEFAULTS INCLUDING STORAGE INCLUDING COMMENTS
);
ALTER TABLE "analytics_governance_daily_aggregate"
  ADD CONSTRAINT "analytics_governance_daily_aggregate_pkey" PRIMARY KEY ("id"),
  ADD CONSTRAINT "analytics_governance_environment_check" CHECK ("environment" IN ('PROD','STAGING','TEST','DEV')),
  ADD CONSTRAINT "analytics_governance_event_check" CHECK ("eventName" IN (
    'data_task_created','data_task_stage_changed','data_task_sla_outcome',
    'deleted_data_reactivation_blocked'
  )),
  ADD CONSTRAINT "analytics_governance_schema_version_check" CHECK ("eventSchemaVersion" = 1),
  ADD CONSTRAINT "analytics_governance_dimensions_check" CHECK (
    ("dimension1Name" IS NULL) = ("dimension1Code" IS NULL) AND
    ("dimension2Name" IS NULL) = ("dimension2Code" IS NULL) AND
    ("dimension2Name" IS NULL OR "dimension1Name" IS NOT NULL) AND
    ("dimension1Name" IS NULL OR "dimension1Name" <> "dimension2Name")
  ),
  ADD CONSTRAINT "analytics_governance_k_check" CHECK (
    "eventCount" >= 10 AND
    ("uniqueOwnerCount" IS NULL OR
      ("uniqueOwnerCount" >= 10 AND "uniqueOwnerCount" <= "eventCount"))
  ),
  ADD CONSTRAINT "analytics_governance_sum_check" CHECK ("sumValue" IS NULL OR "sumValue" >= 0),
  ADD CONSTRAINT "analytics_governance_revision_check" CHECK ("aggregationRevision" > 0),
  ADD CONSTRAINT "analytics_governance_expiry_check" CHECK ("expiresAt" = (("productDate"::timestamp AT TIME ZONE 'UTC') + INTERVAL '13 months')),
  ADD CONSTRAINT "analytics_governance_daily_aggregate_key" UNIQUE NULLS NOT DISTINCT (
    "productDate","environment","eventName","eventSchemaVersion",
    "dimension1Name","dimension1Code","dimension2Name","dimension2Code"
  );

CREATE TABLE "analytics_safety_daily_aggregate" (
  LIKE "analytics_product_daily_aggregate" INCLUDING DEFAULTS INCLUDING STORAGE INCLUDING COMMENTS
);
ALTER TABLE "analytics_safety_daily_aggregate"
  ADD CONSTRAINT "analytics_safety_daily_aggregate_pkey" PRIMARY KEY ("id"),
  ADD CONSTRAINT "analytics_safety_environment_check" CHECK ("environment" IN ('PROD','STAGING','TEST','DEV')),
  ADD CONSTRAINT "analytics_safety_event_check" CHECK ("eventName" IN (
    'safety_input_gate_outcome','safety_fixed_response_outcome',
    'safety_resource_registry_outcome','safety_resource_action_aggregate',
    'safety_recovery_outcome'
  )),
  ADD CONSTRAINT "analytics_safety_schema_version_check" CHECK ("eventSchemaVersion" = 1),
  ADD CONSTRAINT "analytics_safety_dimensions_check" CHECK (
    ("dimension1Name" IS NULL) = ("dimension1Code" IS NULL) AND
    ("dimension2Name" IS NULL) = ("dimension2Code" IS NULL) AND
    ("dimension2Name" IS NULL OR "dimension1Name" IS NOT NULL) AND
    ("dimension1Name" IS NULL OR "dimension1Name" <> "dimension2Name")
  ),
  ADD CONSTRAINT "analytics_safety_k_check" CHECK (
    "eventCount" >= 10 AND
    ("uniqueOwnerCount" IS NULL OR
      ("uniqueOwnerCount" >= 10 AND "uniqueOwnerCount" <= "eventCount"))
  ),
  ADD CONSTRAINT "analytics_safety_sum_check" CHECK ("sumValue" IS NULL OR "sumValue" >= 0),
  ADD CONSTRAINT "analytics_safety_revision_check" CHECK ("aggregationRevision" > 0),
  ADD CONSTRAINT "analytics_safety_expiry_check" CHECK ("expiresAt" = (("productDate"::timestamp AT TIME ZONE 'UTC') + INTERVAL '13 months')),
  ADD CONSTRAINT "analytics_safety_daily_aggregate_key" UNIQUE NULLS NOT DISTINCT (
    "productDate","environment","eventName","eventSchemaVersion",
    "dimension1Name","dimension1Code","dimension2Name","dimension2Code"
  );

CREATE INDEX "analytics_product_daily_lookup" ON "analytics_product_daily_aggregate" ("productDate","environment","eventName");
CREATE INDEX "analytics_product_daily_expiry" ON "analytics_product_daily_aggregate" ("expiresAt");
CREATE INDEX "analytics_runtime_daily_lookup" ON "analytics_runtime_daily_aggregate" ("productDate","environment","eventName");
CREATE INDEX "analytics_runtime_daily_expiry" ON "analytics_runtime_daily_aggregate" ("expiresAt");
CREATE INDEX "analytics_governance_daily_lookup" ON "analytics_governance_daily_aggregate" ("productDate","environment","eventName");
CREATE INDEX "analytics_governance_daily_expiry" ON "analytics_governance_daily_aggregate" ("expiresAt");
CREATE INDEX "analytics_safety_daily_lookup" ON "analytics_safety_daily_aggregate" ("productDate","environment","eventName");
CREATE INDEX "analytics_safety_daily_expiry" ON "analytics_safety_daily_aggregate" ("expiresAt");

CREATE TABLE "analytics_product_metric_snapshot" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "metricId" VARCHAR(16) NOT NULL,
  "metricVersion" INTEGER NOT NULL DEFAULT 1,
  "periodOrCohort" DATE NOT NULL,
  "environment" VARCHAR(16) NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "numerator" BIGINT,
  "denominator" BIGINT,
  "value" DECIMAL(24,10),
  "wilsonLow" DECIMAL(16,12),
  "wilsonHigh" DECIMAL(16,12),
  "dimension1Name" VARCHAR(64),
  "dimension1Code" VARCHAR(64),
  "dimension2Name" VARCHAR(64),
  "dimension2Code" VARCHAR(64),
  "notesCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceContractVersion" VARCHAR(64) NOT NULL,
  "aggregationRevision" BIGINT NOT NULL,
  "generatedAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "analytics_product_metric_snapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analytics_metric_id_check" CHECK ("metricId" IN (
    'S25-M01','S25-M02','S25-M03','S25-M04','S25-M05','S25-M06',
    'S25-M07','S25-M08','S25-M09','S25-M10','S25-M11','S25-M12',
    'S25-M13','S25-M14','S25-M15','S25-M16','S25-M17','S25-M18',
    'S25-M19','S25-M20','S25-M21','S25-M22','S25-M23'
  )),
  CONSTRAINT "analytics_metric_environment_check" CHECK ("environment" IN ('PROD','STAGING','TEST','DEV')),
  CONSTRAINT "analytics_metric_version_check" CHECK ("metricVersion" = 1),
  CONSTRAINT "analytics_metric_status_check" CHECK ("status" IN ('PROVISIONAL','FINALIZED','SUPPRESSED','BLOCKED','UNAVAILABLE')),
  CONSTRAINT "analytics_metric_dimensions_check" CHECK (
    ("dimension1Name" IS NULL) = ("dimension1Code" IS NULL) AND
    ("dimension2Name" IS NULL) = ("dimension2Code" IS NULL) AND
    ("dimension2Name" IS NULL OR "dimension1Name" IS NOT NULL) AND
    ("dimension1Name" IS NULL OR "dimension1Name" <> "dimension2Name")
  ),
  CONSTRAINT "analytics_metric_exact_value_check" CHECK (
    (("status" IN ('PROVISIONAL','FINALIZED')) AND "numerator" IS NOT NULL AND
      "denominator" >= 10 AND "value" IS NOT NULL) OR
    (("status" IN ('SUPPRESSED','BLOCKED','UNAVAILABLE')) AND
      "numerator" IS NULL AND "denominator" IS NULL AND "value" IS NULL AND
      "wilsonLow" IS NULL AND "wilsonHigh" IS NULL)
  ),
  CONSTRAINT "analytics_metric_interval_check" CHECK (
    ("wilsonLow" IS NULL AND "wilsonHigh" IS NULL) OR
    ("wilsonLow" BETWEEN 0 AND 1 AND "wilsonHigh" BETWEEN 0 AND 1 AND
      "wilsonLow" <= "wilsonHigh")
  ),
  CONSTRAINT "analytics_metric_revision_check" CHECK ("aggregationRevision" > 0),
  CONSTRAINT "analytics_metric_expiry_check" CHECK ("expiresAt" = (("periodOrCohort"::timestamp AT TIME ZONE 'UTC') + INTERVAL '13 months')),
  CONSTRAINT "analytics_product_metric_snapshot_key" UNIQUE NULLS NOT DISTINCT (
    "metricId","metricVersion","periodOrCohort","environment",
    "dimension1Name","dimension1Code","dimension2Name","dimension2Code"
  )
);
CREATE INDEX "analytics_product_metric_lookup" ON "analytics_product_metric_snapshot" ("periodOrCohort","environment","metricId");
CREATE INDEX "analytics_product_metric_expiry" ON "analytics_product_metric_snapshot" ("expiresAt");

CREATE TABLE "analytics_gate_snapshot" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "gateId" VARCHAR(16) NOT NULL,
  "environment" VARCHAR(16) NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "reasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "aggregationRevision" BIGINT NOT NULL,
  "generatedAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "analytics_gate_snapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analytics_gate_id_check" CHECK ("gateId" IN ('S25-G01','S25-G02','S25-G03','S25-G04')),
  CONSTRAINT "analytics_gate_environment_check" CHECK ("environment" IN ('PROD','STAGING','TEST','DEV')),
  CONSTRAINT "analytics_gate_status_check" CHECK ("status" IN ('PASS','BLOCKED')),
  CONSTRAINT "analytics_gate_reason_check" CHECK (
    ("status" = 'PASS' AND cardinality("reasonCodes") = 0) OR
    ("status" = 'BLOCKED' AND cardinality("reasonCodes") > 0)
  ),
  CONSTRAINT "analytics_gate_revision_check" CHECK ("aggregationRevision" > 0),
  CONSTRAINT "analytics_gate_snapshot_key" UNIQUE ("gateId","environment")
);
CREATE INDEX "analytics_gate_expiry" ON "analytics_gate_snapshot" ("expiresAt");

CREATE OR REPLACE FUNCTION "daily_energy"."upsert_c015_anonymous_aggregate"(
  p_plane TEXT,
  p_product_date DATE,
  p_environment TEXT,
  p_event_name TEXT,
  p_dimensions JSONB,
  p_event_count BIGINT,
  p_unique_owner_count BIGINT,
  p_sum_value BIGINT,
  p_aggregation_revision BIGINT,
  p_generated_at TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO daily_energy, pg_catalog
AS $$
DECLARE
  v_table TEXT;
  v_d1_name TEXT;
  v_d1_code TEXT;
  v_d2_name TEXT;
  v_d2_code TEXT;
BEGIN
  IF p_environment NOT IN ('PROD','STAGING','TEST','DEV') OR
     p_aggregation_revision <= 0 OR p_event_count < 10 OR
     (p_unique_owner_count IS NOT NULL AND
       (p_unique_owner_count < 10 OR p_unique_owner_count > p_event_count)) OR
     p_sum_value < 0 THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_dimensions) <> 'array' OR jsonb_array_length(p_dimensions) > 2 OR
     EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_dimensions) AS entry
        WHERE jsonb_typeof(entry) <> 'object'
           OR NOT (entry ? 'name' AND entry ? 'code')
           OR (SELECT count(*) FROM jsonb_object_keys(entry)) <> 2
           OR entry->>'name' !~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'
           OR entry->>'code' !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$'
     ) THEN
    RAISE EXCEPTION 'C015_ANALYTICS_DIMENSIONS_INVALID';
  END IF;
  v_d1_name := p_dimensions->0->>'name';
  v_d1_code := p_dimensions->0->>'code';
  v_d2_name := p_dimensions->1->>'name';
  v_d2_code := p_dimensions->1->>'code';
  IF v_d1_name = v_d2_name THEN
    RAISE EXCEPTION 'C015_ANALYTICS_DIMENSIONS_DUPLICATE';
  END IF;
  v_table := CASE p_plane
    WHEN 'PRODUCT' THEN 'analytics_product_daily_aggregate'
    WHEN 'RUNTIME' THEN 'analytics_runtime_daily_aggregate'
    WHEN 'GOVERNANCE' THEN 'analytics_governance_daily_aggregate'
    WHEN 'SAFETY_CONTROL' THEN 'analytics_safety_daily_aggregate'
    ELSE NULL
  END;
  IF v_table IS NULL THEN
    RAISE EXCEPTION 'C015_ANALYTICS_PLANE_INVALID';
  END IF;
  EXECUTE format(
    'INSERT INTO daily_energy.%I
      ("productDate","environment","eventName","eventSchemaVersion",
       "dimension1Name","dimension1Code","dimension2Name","dimension2Code",
       "eventCount","uniqueOwnerCount","sumValue","aggregationRevision",
       "sourceContractVersion","generatedAt","expiresAt")
     VALUES ($1,$2,$3,1,$4,$5,$6,$7,$8,$9,$10,$11,''s24-events-v1'',$12,
             ($1::timestamp AT TIME ZONE ''UTC'') + INTERVAL ''13 months'')
     ON CONFLICT ("productDate","environment","eventName","eventSchemaVersion",
                  "dimension1Name","dimension1Code","dimension2Name","dimension2Code")
     DO UPDATE SET "eventCount"=EXCLUDED."eventCount",
       "uniqueOwnerCount"=EXCLUDED."uniqueOwnerCount",
       "sumValue"=EXCLUDED."sumValue",
       "aggregationRevision"=EXCLUDED."aggregationRevision",
       "sourceContractVersion"=EXCLUDED."sourceContractVersion",
       "generatedAt"=EXCLUDED."generatedAt","expiresAt"=EXCLUDED."expiresAt"',
    v_table
  ) USING p_product_date,p_environment,p_event_name,v_d1_name,v_d1_code,
          v_d2_name,v_d2_code,p_event_count,p_unique_owner_count,p_sum_value,
          p_aggregation_revision,p_generated_at;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."increment_c015_client_signal_aggregate"(
  p_product_date DATE,
  p_environment TEXT,
  p_event_name TEXT,
  p_dimensions JSONB,
  p_event_count_delta BIGINT,
  p_generated_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO daily_energy, pg_catalog
AS $$
DECLARE
  v_d1_name TEXT;
  v_d1_code TEXT;
  v_d2_name TEXT;
  v_d2_code TEXT;
  v_existing BIGINT;
BEGIN
  IF p_event_name NOT IN (
    'landing_viewed','landing_primary_action_clicked','main_action_reached',
    'dimensions_expanded','weekly_summary_read','settings_viewed','faq_opened',
    'data_rights_entry_viewed'
  ) OR p_environment NOT IN ('PROD','STAGING','TEST','DEV') OR
     p_event_count_delta <= 0 OR p_event_count_delta > 1000 OR
     jsonb_typeof(p_dimensions) <> 'array' OR jsonb_array_length(p_dimensions) > 2 OR
     EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_dimensions) AS entry
        WHERE jsonb_typeof(entry) <> 'object'
           OR NOT (entry ? 'name' AND entry ? 'code')
           OR (SELECT count(*) FROM jsonb_object_keys(entry)) <> 2
           OR entry->>'name' !~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'
           OR entry->>'code' !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$'
     ) THEN
    RAISE EXCEPTION 'C015_CLIENT_SIGNAL_INVALID';
  END IF;
  v_d1_name := p_dimensions->0->>'name';
  v_d1_code := p_dimensions->0->>'code';
  v_d2_name := p_dimensions->1->>'name';
  v_d2_code := p_dimensions->1->>'code';
  IF v_d1_name = v_d2_name THEN
    RAISE EXCEPTION 'C015_CLIENT_SIGNAL_DIMENSION_DUPLICATE';
  END IF;
  SELECT "eventCount" INTO v_existing
    FROM analytics_product_daily_aggregate
   WHERE "productDate"=p_product_date AND "environment"=p_environment
     AND "eventName"=p_event_name AND "eventSchemaVersion"=1
     AND "dimension1Name" IS NOT DISTINCT FROM v_d1_name
     AND "dimension1Code" IS NOT DISTINCT FROM v_d1_code
     AND "dimension2Name" IS NOT DISTINCT FROM v_d2_name
     AND "dimension2Code" IS NOT DISTINCT FROM v_d2_code
   FOR UPDATE;
  IF v_existing IS NULL AND p_event_count_delta < 10 THEN
    RAISE EXCEPTION 'C015_CLIENT_SIGNAL_SUB_K_PERSISTENCE_FORBIDDEN';
  END IF;
  IF v_existing IS NOT NULL THEN
    UPDATE analytics_product_daily_aggregate
       SET "eventCount"="eventCount"+p_event_count_delta,
           "generatedAt"=p_generated_at,
           "expiresAt"=(p_product_date::timestamp AT TIME ZONE 'UTC') + INTERVAL '13 months'
     WHERE "productDate"=p_product_date AND "environment"=p_environment
       AND "eventName"=p_event_name AND "eventSchemaVersion"=1
       AND "dimension1Name" IS NOT DISTINCT FROM v_d1_name
       AND "dimension1Code" IS NOT DISTINCT FROM v_d1_code
       AND "dimension2Name" IS NOT DISTINCT FROM v_d2_name
       AND "dimension2Code" IS NOT DISTINCT FROM v_d2_code;
    RETURN;
  END IF;
  INSERT INTO analytics_product_daily_aggregate
    ("productDate","environment","eventName","eventSchemaVersion",
     "dimension1Name","dimension1Code","dimension2Name","dimension2Code",
     "eventCount","aggregationRevision","sourceContractVersion","generatedAt","expiresAt")
  VALUES (p_product_date,p_environment,p_event_name,1,v_d1_name,v_d1_code,
          v_d2_name,v_d2_code,p_event_count_delta,1,'s24-client-signal-v1',
          p_generated_at,(p_product_date::timestamp AT TIME ZONE 'UTC') + INTERVAL '13 months')
  ;
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."c015_wilson_bounds"(
  p_numerator BIGINT,
  p_denominator BIGINT
) RETURNS NUMERIC[]
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path TO pg_catalog
AS $$
  SELECT CASE WHEN p_denominator <= 0 OR p_numerator < 0 OR p_numerator > p_denominator
    THEN NULL::NUMERIC[]
    ELSE ARRAY[
      GREATEST(0,
        ((p_numerator::numeric/p_denominator) + 1.96^2/(2*p_denominator) -
         1.96*sqrt(((p_numerator::numeric/p_denominator)*(1-p_numerator::numeric/p_denominator)/p_denominator) + 1.96^2/(4*p_denominator^2))) /
        (1+1.96^2/p_denominator)),
      LEAST(1,
        ((p_numerator::numeric/p_denominator) + 1.96^2/(2*p_denominator) +
         1.96*sqrt(((p_numerator::numeric/p_denominator)*(1-p_numerator::numeric/p_denominator)/p_denominator) + 1.96^2/(4*p_denominator^2))) /
        (1+1.96^2/p_denominator))
    ] END
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."set_c015_metric"(
  p_metric_id TEXT,
  p_product_date DATE,
  p_finalized_product_date DATE,
  p_environment TEXT,
  p_numerator BIGINT,
  p_denominator BIGINT,
  p_value_override NUMERIC,
  p_wilson_eligible BOOLEAN,
  p_notes TEXT[],
  p_aggregation_revision BIGINT,
  p_generated_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO daily_energy, pg_catalog
AS $$
DECLARE
  v_status TEXT;
  v_value NUMERIC;
  v_bounds NUMERIC[];
BEGIN
  IF p_metric_id !~ '^S25-M(0[1-9]|1[0-9]|2[0-3])$' OR p_denominator < 0 OR
     p_numerator < 0 OR p_aggregation_revision <= 0 THEN
    RAISE EXCEPTION 'C015_METRIC_INPUT_INVALID';
  END IF;
  IF p_denominator < 10 THEN
    v_status := 'SUPPRESSED';
    p_numerator := NULL;
    p_denominator := NULL;
    v_value := NULL;
    v_bounds := NULL;
  ELSE
    v_status := CASE WHEN p_product_date < p_finalized_product_date
      THEN 'FINALIZED' ELSE 'PROVISIONAL' END;
    v_value := COALESCE(p_value_override, p_numerator::numeric / NULLIF(p_denominator,0));
    v_bounds := CASE WHEN p_wilson_eligible AND p_numerator <= p_denominator
      THEN c015_wilson_bounds(p_numerator,p_denominator) ELSE NULL END;
  END IF;
  INSERT INTO analytics_product_metric_snapshot
    ("metricId","metricVersion","periodOrCohort","environment","status",
     "numerator","denominator","value","wilsonLow","wilsonHigh",
     "notesCodes","sourceContractVersion","aggregationRevision","generatedAt","expiresAt")
  VALUES (p_metric_id,1,p_product_date,p_environment,v_status,p_numerator,
          p_denominator,v_value,v_bounds[1],v_bounds[2],p_notes,
          's25-metric-source-v1',p_aggregation_revision,p_generated_at,
          (p_product_date::timestamp AT TIME ZONE 'UTC') + INTERVAL '13 months')
  ON CONFLICT ("metricId","metricVersion","periodOrCohort","environment",
               "dimension1Name","dimension1Code","dimension2Name","dimension2Code")
  DO UPDATE SET "status"=EXCLUDED."status","numerator"=EXCLUDED."numerator",
    "denominator"=EXCLUDED."denominator","value"=EXCLUDED."value",
    "wilsonLow"=EXCLUDED."wilsonLow","wilsonHigh"=EXCLUDED."wilsonHigh",
    "notesCodes"=EXCLUDED."notesCodes",
    "sourceContractVersion"=EXCLUDED."sourceContractVersion",
    "aggregationRevision"=EXCLUDED."aggregationRevision",
    "generatedAt"=EXCLUDED."generatedAt","expiresAt"=EXCLUDED."expiresAt";
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."set_c015_nonpublished_metric"(
  p_metric_id TEXT,
  p_product_date DATE,
  p_environment TEXT,
  p_status TEXT,
  p_notes TEXT[],
  p_aggregation_revision BIGINT,
  p_generated_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO daily_energy, pg_catalog
AS $$
BEGIN
  IF p_metric_id !~ '^S25-M(0[1-9]|1[0-9]|2[0-3])$' OR
     p_status NOT IN ('BLOCKED','UNAVAILABLE') OR
     p_aggregation_revision <= 0 THEN
    RAISE EXCEPTION 'C015_METRIC_STATUS_INPUT_INVALID';
  END IF;
  INSERT INTO analytics_product_metric_snapshot
    ("metricId","metricVersion","periodOrCohort","environment","status",
     "notesCodes","sourceContractVersion","aggregationRevision","generatedAt","expiresAt")
  VALUES (p_metric_id,1,p_product_date,p_environment,p_status,p_notes,
          's25-metric-source-v1',p_aggregation_revision,p_generated_at,
          (p_product_date::timestamp AT TIME ZONE 'UTC') + INTERVAL '13 months')
  ON CONFLICT ("metricId","metricVersion","periodOrCohort","environment",
               "dimension1Name","dimension1Code","dimension2Name","dimension2Code")
  DO UPDATE SET "status"=EXCLUDED."status","numerator"=NULL,
    "denominator"=NULL,"value"=NULL,"wilsonLow"=NULL,"wilsonHigh"=NULL,
    "notesCodes"=EXCLUDED."notesCodes",
    "sourceContractVersion"=EXCLUDED."sourceContractVersion",
    "aggregationRevision"=EXCLUDED."aggregationRevision",
    "generatedAt"=EXCLUDED."generatedAt","expiresAt"=EXCLUDED."expiresAt";
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."rebuild_c015_analytics_date"(
  p_product_date DATE,
  p_finalized_product_date DATE,
  p_environment TEXT,
  p_aggregation_revision BIGINT,
  p_generated_at TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO daily_energy, pg_catalog
AS $$
DECLARE
  v_event RECORD;
  v_numerator BIGINT;
  v_denominator BIGINT;
  v_cost BIGINT;
  v_aggregate_rows BIGINT;
  v_metric_rows BIGINT;
  v_gate_rows BIGINT;
  v_raw_matches BIGINT;
  v_ttl_breaches BIGINT;
  v_contract_failures BIGINT;
  v_small_cell_failures BIGINT;
  v_data_task_breaches BIGINT;
  v_usage_total BIGINT;
  v_usage_known BIGINT;
BEGIN
  IF p_environment NOT IN ('PROD','STAGING','TEST','DEV') OR
     p_aggregation_revision <= 0 OR p_finalized_product_date < p_product_date THEN
    RAISE EXCEPTION 'C015_ANALYTICS_REBUILD_INPUT_INVALID';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_environment || ':' || p_product_date::text, 2015));

  DELETE FROM analytics_product_daily_aggregate
   WHERE "productDate"=p_product_date AND "environment"=p_environment
     AND "eventName" NOT IN (
       'landing_viewed','landing_primary_action_clicked','main_action_reached',
       'dimensions_expanded','weekly_summary_read','settings_viewed','faq_opened',
       'data_rights_entry_viewed'
     );
  DELETE FROM analytics_runtime_daily_aggregate
   WHERE "productDate"=p_product_date AND "environment"=p_environment
     AND "eventName" NOT IN ('raw_content_detector_outcome','release_contract_outcome');
  DELETE FROM analytics_governance_daily_aggregate
   WHERE "productDate"=p_product_date AND "environment"=p_environment
     AND "eventName" NOT IN ('data_task_sla_outcome','deleted_data_reactivation_blocked');
  DELETE FROM analytics_safety_daily_aggregate
   WHERE "productDate"=p_product_date AND "environment"=p_environment;

  CREATE TEMP TABLE c015_new_consent ON COMMIT DROP AS
    SELECT DISTINCT c."accountId" AS owner_id
      FROM app_necessary_consent_record c
      JOIN app_user_account a ON a.id=c."accountId" AND a.state='ACTIVE'
     WHERE c.status='ACCEPTED' AND c."noticeVersion"='necessary-consent-v1'
       AND ((c."acceptedAt" AT TIME ZONE 'Asia/Shanghai') - INTERVAL '4 hours')::date=p_product_date
       AND NOT EXISTS (
         SELECT 1 FROM app_onboarding_completion o
          WHERE o."accountId"=c."accountId" AND o."completedAt" < c."acceptedAt"
       );
  CREATE TEMP TABLE c015_onboarded ON COMMIT DROP AS
    SELECT DISTINCT o."accountId" AS owner_id
      FROM app_onboarding_completion o
      JOIN app_user_account a ON a.id=o."accountId" AND a.state='ACTIVE'
     WHERE ((o."completedAt" AT TIME ZONE 'Asia/Shanghai') - INTERVAL '4 hours')::date=p_product_date;
  CREATE TEMP TABLE c015_checkin ON COMMIT DROP AS
    SELECT DISTINCT c."accountId" AS owner_id
      FROM app_morning_checkin c
      JOIN app_user_account a ON a.id=c."accountId" AND a.state='ACTIVE'
     WHERE c."productDate"=p_product_date
       AND NOT EXISTS (
         SELECT 1 FROM restricted_deletion_guard dg
          WHERE dg."accountId"=c."accountId" AND dg."releasedAt" IS NULL
            AND (dg.scope='ACCOUNT' OR
              (dg.scope='DAY' AND dg."targetKey"=c."productDate"::text))
       );
  CREATE TEMP TABLE c015_result ON COMMIT DROP AS
    SELECT DISTINCT r."accountId" AS owner_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM runtime_gateway_invocation i
        JOIN runtime_gateway_attempt ga ON ga."invocationId"=i.id
        WHERE i."generationIntentId"=r."generationIntentId"
          AND ga."routeRole"='CONTROLLED_TEMPLATE' AND ga.outcome='SUCCEEDED'
      ) THEN 'CONTROLLED_TEMPLATE' ELSE 'AI' END AS generation_mode,
      EXTRACT(EPOCH FROM (r."generatedAt"-gi."acceptedAt"))*1000 AS latency_ms
      FROM app_published_daily_result r
      JOIN app_generation_intent gi ON gi.id=r."generationIntentId"
      JOIN app_user_account a ON a.id=r."accountId" AND a.state='ACTIVE'
      LEFT JOIN app_published_result_visibility v ON v."resultId"=r.id
     WHERE r."productDate"=p_product_date AND COALESCE(v.state,'AVAILABLE')='AVAILABLE'
       AND NOT EXISTS (
         SELECT 1 FROM restricted_deletion_guard dg
          WHERE dg."accountId"=r."accountId" AND dg."releasedAt" IS NULL
            AND (dg.scope='ACCOUNT' OR
              (dg.scope='DAY' AND dg."targetKey"=r."productDate"::text))
       );
  CREATE TEMP TABLE c015_first_result ON COMMIT DROP AS
    SELECT r.owner_id FROM c015_result r
     WHERE NOT EXISTS (
       SELECT 1 FROM app_published_daily_result prior
       LEFT JOIN app_published_result_visibility pv ON pv."resultId"=prior.id
       WHERE prior."accountId"=r.owner_id AND prior."productDate"<p_product_date
         AND COALESCE(pv.state,'AVAILABLE')='AVAILABLE'
         AND NOT EXISTS (
           SELECT 1 FROM restricted_deletion_guard dg
            WHERE dg."accountId"=prior."accountId" AND dg."releasedAt" IS NULL
              AND (dg.scope='ACCOUNT' OR
                (dg.scope='DAY' AND dg."targetKey"=prior."productDate"::text))
         )
     );
  CREATE TEMP TABLE c015_light ON COMMIT DROP AS
    SELECT DISTINCT di."accountId" AS owner_id
      FROM app_daily_light_fact l
      JOIN app_daily_interaction di ON di.id=l."interactionId"
      JOIN app_user_account a ON a.id=di."accountId" AND a.state='ACTIVE'
     WHERE di."productDate"=p_product_date
       AND NOT EXISTS (
         SELECT 1 FROM restricted_deletion_guard dg
          WHERE dg."accountId"=di."accountId" AND dg."releasedAt" IS NULL
            AND (dg.scope='ACCOUNT' OR
              (dg.scope='DAY' AND dg."targetKey"=di."productDate"::text))
       );
  CREATE TEMP TABLE c015_evening ON COMMIT DROP AS
    SELECT DISTINCT di."accountId" AS owner_id, e."firstSubmittedAt"
      FROM app_evening_feedback_record e
      JOIN app_daily_interaction di ON di.id=e."interactionId"
      JOIN app_user_account a ON a.id=di."accountId" AND a.state='ACTIVE'
     WHERE di."productDate" BETWEEN p_product_date AND p_product_date+6
       AND NOT EXISTS (
         SELECT 1 FROM restricted_deletion_guard dg
          WHERE dg."accountId"=di."accountId" AND dg."releasedAt" IS NULL
            AND (dg.scope='ACCOUNT' OR
              (dg.scope='DAY' AND dg."targetKey"=di."productDate"::text))
       );
  CREATE TEMP TABLE c015_interaction ON COMMIT DROP AS
    SELECT di."accountId" AS owner_id, t.status AS task_status,
           (t.id IS NOT NULL) AS has_task, h.rating AS helpfulness
      FROM app_daily_interaction di
      JOIN app_published_daily_result r ON r.id=di."resultId"
      JOIN app_user_account a ON a.id=di."accountId" AND a.state='ACTIVE'
      LEFT JOIN app_published_result_visibility v ON v."resultId"=r.id
      LEFT JOIN app_daily_task_state t ON t."interactionId"=di.id
      LEFT JOIN app_daily_helpfulness_record h ON h."interactionId"=di.id
     WHERE di."productDate"=p_product_date AND COALESCE(v.state,'AVAILABLE')='AVAILABLE'
       AND NOT EXISTS (
         SELECT 1 FROM restricted_deletion_guard dg
          WHERE dg."accountId"=di."accountId" AND dg."releasedAt" IS NULL
            AND (dg.scope='ACCOUNT' OR
              (dg.scope='DAY' AND dg."targetKey"=di."productDate"::text))
       );
  CREATE TEMP TABLE c015_encounter ON COMMIT DROP AS
    SELECT rc.id AS cycle_id, rc."accountId" AS owner_id, el."productDate"
      FROM app_relationship_cycle rc
      JOIN app_relationship_encounter_link el ON el."cycleId"=rc.id
      JOIN app_user_account a ON a.id=rc."accountId" AND a.state='ACTIVE'
     WHERE rc.state='ACTIVE'
       AND NOT EXISTS (
         SELECT 1 FROM restricted_deletion_guard dg
          WHERE dg."accountId"=rc."accountId" AND dg."releasedAt" IS NULL
            AND (dg.scope IN ('ACCOUNT','RELATIONSHIP_DATA') OR
              (dg.scope='DAY' AND dg."targetKey"=el."productDate"::text))
       );
  CREATE TEMP TABLE c015_cycle ON COMMIT DROP AS
    SELECT cycle_id, MIN(owner_id::text)::uuid AS owner_id,
           MIN("productDate") AS d0,
           ARRAY_AGG(DISTINCT "productDate" ORDER BY "productDate") AS dates
      FROM c015_encounter GROUP BY cycle_id
     HAVING MIN("productDate")=p_product_date;
  CREATE TEMP TABLE c015_core_active ON COMMIT DROP AS
    SELECT owner_id FROM c015_checkin
    UNION SELECT owner_id FROM c015_light
    UNION SELECT owner_id FROM c015_evening
      WHERE (("firstSubmittedAt" AT TIME ZONE 'Asia/Shanghai')-INTERVAL '4 hours')::date=p_product_date;

  FOR v_event IN
    SELECT * FROM (VALUES
      ('consent_accepted', (SELECT count(*) FROM c015_new_consent), (SELECT count(*) FROM c015_new_consent)),
      ('onboarding_completed', (SELECT count(*) FROM c015_onboarded), (SELECT count(*) FROM c015_onboarded)),
      ('checkin_submitted', (SELECT count(*) FROM c015_checkin), (SELECT count(*) FROM c015_checkin)),
      ('generation_started', (SELECT count(*) FROM app_generation_intent gi JOIN app_user_account a ON a.id=gi."accountId" AND a.state='ACTIVE' WHERE gi."targetProductDate"=p_product_date),
        (SELECT count(DISTINCT gi."accountId") FROM app_generation_intent gi JOIN app_user_account a ON a.id=gi."accountId" AND a.state='ACTIVE' WHERE gi."targetProductDate"=p_product_date)),
      ('daily_result_available', (SELECT count(*) FROM c015_result), (SELECT count(*) FROM c015_result)),
      ('day_lit', (SELECT count(*) FROM c015_light), (SELECT count(*) FROM c015_light)),
      ('task_status_updated', (SELECT COALESCE(sum(t.revision),0) FROM app_daily_task_state t JOIN app_daily_interaction di ON di.id=t."interactionId" WHERE di."productDate"=p_product_date),
        (SELECT count(DISTINCT di."accountId") FROM app_daily_task_state t JOIN app_daily_interaction di ON di.id=t."interactionId" WHERE di."productDate"=p_product_date)),
      ('helpfulness_updated', (SELECT COALESCE(sum(h.revision),0) FROM app_daily_helpfulness_record h JOIN app_daily_interaction di ON di.id=h."interactionId" WHERE di."productDate"=p_product_date),
        (SELECT count(DISTINCT di."accountId") FROM app_daily_helpfulness_record h JOIN app_daily_interaction di ON di.id=h."interactionId" WHERE di."productDate"=p_product_date)),
      ('evening_saved', (SELECT count(*) FROM c015_evening WHERE (("firstSubmittedAt" AT TIME ZONE 'Asia/Shanghai')-INTERVAL '4 hours')::date=p_product_date),
        (SELECT count(DISTINCT owner_id) FROM c015_evening WHERE (("firstSubmittedAt" AT TIME ZONE 'Asia/Shanghai')-INTERVAL '4 hours')::date=p_product_date))
    ) AS facts(event_name,event_count,owner_count)
  LOOP
    PERFORM upsert_c015_anonymous_aggregate('PRODUCT',p_product_date,p_environment,
      v_event.event_name,'[]'::jsonb,v_event.event_count,v_event.owner_count,NULL,
      p_aggregation_revision,p_generated_at);
  END LOOP;

  SELECT count(*),count(DISTINCT "accountId") INTO v_numerator,v_denominator
    FROM restricted_data_task
   WHERE (("requestedAt" AT TIME ZONE 'Asia/Shanghai')-INTERVAL '4 hours')::date=p_product_date
     AND scope IN ('DAY','ACCOUNT','EXPORT_ACCOUNT');
  PERFORM upsert_c015_anonymous_aggregate('GOVERNANCE',p_product_date,p_environment,
    'data_task_created','[]'::jsonb,v_numerator,v_denominator,NULL,
    p_aggregation_revision,p_generated_at);
  SELECT count(*),count(DISTINCT "accountId") INTO v_numerator,v_denominator
    FROM restricted_safety_event
   WHERE (("createdAt" AT TIME ZONE 'Asia/Shanghai')-INTERVAL '4 hours')::date=p_product_date;
  PERFORM upsert_c015_anonymous_aggregate('SAFETY_CONTROL',p_product_date,p_environment,
    'safety_input_gate_outcome','[]'::jsonb,v_numerator,v_denominator,NULL,
    p_aggregation_revision,p_generated_at);
  SELECT count(*),count(DISTINCT gi."accountId"),COALESCE(sum(ga."costMicros"),0)
    INTO v_numerator,v_denominator,v_cost
    FROM runtime_gateway_attempt ga
    JOIN runtime_gateway_invocation inv ON inv.id=ga."invocationId"
    JOIN app_generation_intent gi ON gi.id=inv."generationIntentId"
   WHERE gi."targetProductDate"=p_product_date AND ga.outcome IS NOT NULL;
  PERFORM upsert_c015_anonymous_aggregate('RUNTIME',p_product_date,p_environment,
    'gateway_usage_aggregate','[]'::jsonb,v_numerator,v_denominator,v_cost,
    p_aggregation_revision,p_generated_at);

  SELECT count(*) FILTER (WHERE o.owner_id IS NOT NULL),count(*)
    INTO v_numerator,v_denominator FROM c015_new_consent n
    LEFT JOIN c015_onboarded o USING(owner_id);
  PERFORM set_c015_metric('S25-M02',p_product_date,p_finalized_product_date,p_environment,
    v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  SELECT count(*) FILTER (WHERE c.owner_id IS NOT NULL),count(*)
    INTO v_numerator,v_denominator FROM c015_onboarded o
    LEFT JOIN c015_checkin c USING(owner_id);
  PERFORM set_c015_metric('S25-M03',p_product_date,p_finalized_product_date,p_environment,
    v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  SELECT count(*) FILTER (WHERE r.owner_id IS NOT NULL),count(*)
    INTO v_numerator,v_denominator FROM c015_checkin c
    LEFT JOIN c015_result r USING(owner_id);
  PERFORM set_c015_metric('S25-M04',p_product_date,p_finalized_product_date,p_environment,
    v_numerator,v_denominator,NULL,TRUE,ARRAY['TEMPLATE_INCLUDED','POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  SELECT count(*) FILTER (WHERE l.owner_id IS NOT NULL),count(*)
    INTO v_numerator,v_denominator FROM c015_first_result r
    LEFT JOIN c015_light l USING(owner_id);
  PERFORM set_c015_metric('S25-M05',p_product_date,p_finalized_product_date,p_environment,
    v_numerator,v_denominator,NULL,TRUE,ARRAY['TEMPLATE_INCLUDED','POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  SELECT count(*) FILTER (WHERE l.owner_id IS NOT NULL),count(*)
    INTO v_numerator,v_denominator FROM c015_new_consent n
    LEFT JOIN c015_light l USING(owner_id);
  PERFORM set_c015_metric('S25-M06',p_product_date,p_finalized_product_date,p_environment,
    v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);

  SELECT COALESCE((SELECT sum("eventCount") FROM analytics_product_daily_aggregate
    WHERE "productDate"=p_product_date AND "environment"=p_environment
      AND "eventName"='landing_primary_action_clicked'),0),
    COALESCE((SELECT sum("eventCount") FROM analytics_product_daily_aggregate
    WHERE "productDate"=p_product_date AND "environment"=p_environment
      AND "eventName"='landing_viewed'),0)
    INTO v_numerator,v_denominator;
  PERFORM set_c015_metric('S25-M01',p_product_date,p_finalized_product_date,p_environment,
    v_numerator,v_denominator,NULL,FALSE,ARRAY['BEST_EFFORT_SIGNAL','POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);

  FOR v_event IN SELECT * FROM (VALUES
    ('S25-M07',1),('S25-M08',3),('S25-M09',7)
  ) AS offsets(metric_id,day_offset)
  LOOP
    SELECT count(*) FILTER (WHERE (p_product_date+v_event.day_offset)=ANY(dates)),count(*)
      INTO v_numerator,v_denominator FROM c015_cycle
     WHERE p_product_date+v_event.day_offset < p_finalized_product_date;
    PERFORM set_c015_metric(v_event.metric_id,p_product_date,p_finalized_product_date,p_environment,
      v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  END LOOP;
  SELECT count(*) FILTER (WHERE p_product_date=ANY(dates) AND p_product_date+1=ANY(dates) AND p_product_date+2=ANY(dates)),count(*)
    INTO v_numerator,v_denominator FROM c015_cycle WHERE p_product_date+2<p_finalized_product_date;
  PERFORM set_c015_metric('S25-M10',p_product_date,p_finalized_product_date,p_environment,v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  SELECT count(*) FILTER (WHERE (SELECT count(*) FROM generate_series(0,6) AS offsets(day_offset) WHERE p_product_date+day_offset=ANY(dates))=7),count(*)
    INTO v_numerator,v_denominator FROM c015_cycle WHERE p_product_date+6<p_finalized_product_date;
  PERFORM set_c015_metric('S25-M11',p_product_date,p_finalized_product_date,p_environment,v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  SELECT count(*) FILTER (WHERE (SELECT count(*) FROM unnest(dates) AS encounter_date WHERE encounter_date BETWEEN p_product_date AND p_product_date+6)>=3),count(*)
    INTO v_numerator,v_denominator FROM c015_cycle WHERE p_product_date+6<p_finalized_product_date;
  PERFORM set_c015_metric('S25-M12',p_product_date,p_finalized_product_date,p_environment,v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  SELECT count(*) FILTER (WHERE EXISTS (SELECT 1 FROM c015_evening e WHERE e.owner_id=cy.owner_id)),count(*)
    INTO v_numerator,v_denominator FROM c015_cycle cy WHERE p_product_date+6<p_finalized_product_date;
  PERFORM set_c015_metric('S25-M13',p_product_date,p_finalized_product_date,p_environment,v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);

  SELECT count(*) FILTER (WHERE helpfulness IS NOT NULL),count(*) INTO v_numerator,v_denominator FROM c015_interaction;
  PERFORM set_c015_metric('S25-M14',p_product_date,p_finalized_product_date,p_environment,v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  SELECT count(*) FILTER (WHERE helpfulness='HELPFUL'),count(*) FILTER (WHERE helpfulness IN ('HELPFUL','NEUTRAL','NOT_HELPFUL')) INTO v_numerator,v_denominator FROM c015_interaction;
  PERFORM set_c015_metric('S25-M15',p_product_date,p_finalized_product_date,p_environment,v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  SELECT count(*) FILTER (WHERE task_status IN ('INTERESTED','COMPLETED')),count(*) FILTER (WHERE has_task) INTO v_numerator,v_denominator FROM c015_interaction;
  PERFORM set_c015_metric('S25-M16',p_product_date,p_finalized_product_date,p_environment,v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  SELECT count(*) FILTER (WHERE task_status='COMPLETED'),count(*) FILTER (WHERE task_status IN ('INTERESTED','COMPLETED')) INTO v_numerator,v_denominator FROM c015_interaction;
  PERFORM set_c015_metric('S25-M17',p_product_date,p_finalized_product_date,p_environment,v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  SELECT COALESCE((SELECT sum("eventCount") FROM analytics_product_daily_aggregate WHERE "productDate"=p_product_date AND "environment"=p_environment AND "eventName"='weekly_summary_read'),0),count(*) INTO v_numerator,v_denominator FROM c015_cycle WHERE p_product_date+7<p_finalized_product_date;
  PERFORM set_c015_metric('S25-M18',p_product_date,p_finalized_product_date,p_environment,v_numerator,v_denominator,NULL,FALSE,ARRAY['BEST_EFFORT_SIGNAL','POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  PERFORM set_c015_nonpublished_metric('S25-M19',p_product_date,p_environment,
    'UNAVAILABLE',ARRAY['SOURCE_UNAVAILABLE','POST_AGGREGATION_DELETION_NOT_RESTATED'],
    p_aggregation_revision,p_generated_at);

  SELECT count(*) FILTER (WHERE latency_ms<8000),count(*) INTO v_numerator,v_denominator FROM c015_result WHERE generation_mode='AI' AND latency_ms IS NOT NULL;
  PERFORM set_c015_metric('S25-M20',p_product_date,p_finalized_product_date,p_environment,v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  SELECT count(*) FILTER (WHERE generation_mode='CONTROLLED_TEMPLATE'),count(*) INTO v_numerator,v_denominator FROM c015_result;
  PERFORM set_c015_metric('S25-M21',p_product_date,p_finalized_product_date,p_environment,v_numerator,v_denominator,NULL,TRUE,ARRAY['TEMPLATE_INCLUDED','POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  SELECT count(*),count(*) FILTER (WHERE ga."costMicros" IS NOT NULL),
         COALESCE(sum(ga."costMicros") FILTER (WHERE ga."costMicros" IS NOT NULL),0)
    INTO v_usage_total,v_usage_known,v_numerator
    FROM runtime_gateway_attempt ga JOIN runtime_gateway_invocation inv ON inv.id=ga."invocationId"
    JOIN app_generation_intent gi ON gi.id=inv."generationIntentId"
   WHERE gi."targetProductDate"=p_product_date AND ga.outcome IS NOT NULL;
  SELECT count(*) INTO v_denominator FROM c015_core_active;
  IF v_denominator>=10 AND
     (v_usage_total=0 OR v_usage_known::numeric/v_usage_total<0.99) THEN
    PERFORM set_c015_nonpublished_metric('S25-M22',p_product_date,p_environment,
      'BLOCKED',ARRAY['SOURCE_INCOMPLETE','POST_AGGREGATION_DELETION_NOT_RESTATED'],
      p_aggregation_revision,p_generated_at);
  ELSE
    PERFORM set_c015_metric('S25-M22',p_product_date,p_finalized_product_date,p_environment,v_numerator,v_denominator,
      CASE WHEN v_denominator=0 THEN 0 ELSE v_numerator::numeric/1000000/v_denominator END,FALSE,
      ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);
  END IF;
  v_numerator:=v_usage_known;
  v_denominator:=v_usage_total;
  PERFORM set_c015_metric('S25-M23',p_product_date,p_finalized_product_date,p_environment,v_numerator,v_denominator,NULL,TRUE,ARRAY['POST_AGGREGATION_DELETION_NOT_RESTATED'],p_aggregation_revision,p_generated_at);

  SELECT count(*) INTO v_contract_failures
    FROM unnest(ARRAY['SCHEMA','API','EVENT','METRIC','DATABASE']) required(contract_group)
   WHERE NOT EXISTS (
     SELECT 1 FROM analytics_runtime_daily_aggregate evidence
      WHERE evidence."productDate"=p_product_date
        AND evidence."environment"=p_environment
        AND evidence."eventName"='release_contract_outcome'
        AND CASE WHEN evidence."dimension1Name"='contract_group'
          THEN evidence."dimension1Code" ELSE evidence."dimension2Code" END=required.contract_group
        AND CASE WHEN evidence."dimension1Name"='outcome_code'
          THEN evidence."dimension1Code" ELSE evidence."dimension2Code" END='PASS'
   );
  SELECT v_contract_failures+count(*) INTO v_contract_failures
    FROM analytics_runtime_daily_aggregate evidence
   WHERE evidence."productDate"=p_product_date
     AND evidence."environment"=p_environment
     AND evidence."eventName"='release_contract_outcome'
     AND CASE WHEN evidence."dimension1Name"='outcome_code'
       THEN evidence."dimension1Code" ELSE evidence."dimension2Code" END='FAIL';

  SELECT count(*) INTO v_raw_matches
    FROM unnest(ARRAY['CONTRACT','QUEUE','LOG','AGGREGATE','EXPORT']) required(subsystem)
   WHERE NOT EXISTS (
     SELECT 1 FROM analytics_runtime_daily_aggregate evidence
      WHERE evidence."productDate"=p_product_date
        AND evidence."environment"=p_environment
        AND evidence."eventName"='raw_content_detector_outcome'
        AND CASE WHEN evidence."dimension1Name"='subsystem'
          THEN evidence."dimension1Code" ELSE evidence."dimension2Code" END=required.subsystem
        AND CASE WHEN evidence."dimension1Name"='outcome_code'
          THEN evidence."dimension1Code" ELSE evidence."dimension2Code" END='CLEAN'
   );
  SELECT v_raw_matches+count(*) INTO v_raw_matches
    FROM analytics_runtime_daily_aggregate evidence
   WHERE evidence."productDate"=p_product_date
     AND evidence."environment"=p_environment
     AND evidence."eventName"='raw_content_detector_outcome'
     AND CASE WHEN evidence."dimension1Name"='outcome_code'
       THEN evidence."dimension1Code" ELSE evidence."dimension2Code" END IN ('MATCH','BLOCKED','FAILED');

  SELECT count(*) INTO v_small_cell_failures FROM (
    SELECT "eventCount","uniqueOwnerCount" FROM analytics_product_daily_aggregate
    UNION ALL SELECT "eventCount","uniqueOwnerCount" FROM analytics_runtime_daily_aggregate
    UNION ALL SELECT "eventCount","uniqueOwnerCount" FROM analytics_governance_daily_aggregate
    UNION ALL SELECT "eventCount","uniqueOwnerCount" FROM analytics_safety_daily_aggregate
  ) cells WHERE "eventCount"<10 OR
    ("uniqueOwnerCount" IS NOT NULL AND "uniqueOwnerCount"<10);
  IF has_table_privilege('daily_energy_api','daily_energy.analytics_product_daily_aggregate','SELECT') OR
     has_table_privilege('daily_energy_api','daily_energy.analytics_runtime_daily_aggregate','SELECT') OR
     has_table_privilege('daily_energy_api','daily_energy.analytics_governance_daily_aggregate','SELECT') OR
     has_table_privilege('daily_energy_api','daily_energy.analytics_safety_daily_aggregate','SELECT') OR
     has_table_privilege('daily_energy_background','daily_energy.analytics_product_daily_aggregate','SELECT') OR
     has_table_privilege('daily_energy_background','daily_energy.analytics_runtime_daily_aggregate','SELECT') OR
     has_table_privilege('daily_energy_background','daily_energy.analytics_governance_daily_aggregate','SELECT') OR
     has_table_privilege('daily_energy_background','daily_energy.analytics_safety_daily_aggregate','SELECT') THEN
    v_small_cell_failures:=v_small_cell_failures+1;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM analytics_runtime_daily_aggregate evidence
     WHERE evidence."productDate"=p_product_date
       AND evidence."environment"=p_environment
       AND evidence."eventName"='release_contract_outcome'
       AND CASE WHEN evidence."dimension1Name"='contract_group'
         THEN evidence."dimension1Code" ELSE evidence."dimension2Code" END='METRIC'
       AND CASE WHEN evidence."dimension1Name"='outcome_code'
         THEN evidence."dimension1Code" ELSE evidence."dimension2Code" END='PASS'
  ) THEN
    v_small_cell_failures:=v_small_cell_failures+1;
  END IF;

  SELECT count(*) INTO v_ttl_breaches FROM (
    SELECT "expiresAt" FROM analytics_product_daily_aggregate UNION ALL
    SELECT "expiresAt" FROM analytics_runtime_daily_aggregate UNION ALL
    SELECT "expiresAt" FROM analytics_governance_daily_aggregate UNION ALL
    SELECT "expiresAt" FROM analytics_safety_daily_aggregate UNION ALL
    SELECT "expiresAt" FROM analytics_product_metric_snapshot UNION ALL
    SELECT "expiresAt" FROM analytics_gate_snapshot
  ) expired WHERE "expiresAt" <= p_generated_at;
  SELECT count(*) INTO v_data_task_breaches FROM restricted_data_task task
   WHERE (task.state NOT IN ('SUCCEEDED','CANCELLED') AND
          task."requestedAt"+INTERVAL '7 days'<=p_generated_at)
      OR (task.kind='DELETE' AND task."onlineErasedAt" IS NULL AND
          task."requestedAt"+INTERVAL '72 hours'<=p_generated_at);
  SELECT v_data_task_breaches+count(*) INTO v_data_task_breaches
    FROM analytics_governance_daily_aggregate evidence
   WHERE evidence."productDate"=p_product_date
     AND evidence."environment"=p_environment
     AND evidence."eventName"='data_task_sla_outcome'
     AND CASE WHEN evidence."dimension1Name"='sla_outcome'
       THEN evidence."dimension1Code" ELSE evidence."dimension2Code" END='BREACHED';
  v_ttl_breaches:=v_ttl_breaches+v_data_task_breaches;
  INSERT INTO analytics_gate_snapshot
    ("gateId","environment","status","reasonCodes","aggregationRevision","generatedAt","expiresAt")
  VALUES
    ('S25-G01',p_environment,CASE WHEN v_contract_failures=0 THEN 'PASS' ELSE 'BLOCKED' END,CASE WHEN v_contract_failures=0 THEN ARRAY[]::text[] ELSE ARRAY['CONTRACT_FAILURE'] END,p_aggregation_revision,p_generated_at,(p_product_date::timestamp AT TIME ZONE 'UTC')+INTERVAL '13 months'),
    ('S25-G02',p_environment,CASE WHEN v_raw_matches=0 THEN 'PASS' ELSE 'BLOCKED' END,CASE WHEN v_raw_matches=0 THEN ARRAY[]::text[] ELSE ARRAY['RAW_CONTENT_MATCH'] END,p_aggregation_revision,p_generated_at,(p_product_date::timestamp AT TIME ZONE 'UTC')+INTERVAL '13 months'),
    ('S25-G03',p_environment,CASE WHEN v_small_cell_failures=0 THEN 'PASS' ELSE 'BLOCKED' END,CASE WHEN v_small_cell_failures=0 THEN ARRAY[]::text[] ELSE ARRAY['SMALL_CELL_OR_JOIN_PATH'] END,p_aggregation_revision,p_generated_at,(p_product_date::timestamp AT TIME ZONE 'UTC')+INTERVAL '13 months'),
    ('S25-G04',p_environment,CASE WHEN v_ttl_breaches=0 THEN 'PASS' ELSE 'BLOCKED' END,CASE WHEN v_ttl_breaches=0 THEN ARRAY[]::text[] ELSE ARRAY['DELETION_OR_TTL_BREACH'] END,p_aggregation_revision,p_generated_at,(p_product_date::timestamp AT TIME ZONE 'UTC')+INTERVAL '13 months')
  ON CONFLICT ("gateId","environment") DO UPDATE SET
    "status"=EXCLUDED."status","reasonCodes"=EXCLUDED."reasonCodes",
    "aggregationRevision"=EXCLUDED."aggregationRevision",
    "generatedAt"=EXCLUDED."generatedAt","expiresAt"=EXCLUDED."expiresAt";

  SELECT count(*) INTO v_aggregate_rows FROM (
    SELECT id FROM analytics_product_daily_aggregate WHERE "productDate"=p_product_date AND "environment"=p_environment
    UNION ALL SELECT id FROM analytics_runtime_daily_aggregate WHERE "productDate"=p_product_date AND "environment"=p_environment
    UNION ALL SELECT id FROM analytics_governance_daily_aggregate WHERE "productDate"=p_product_date AND "environment"=p_environment
    UNION ALL SELECT id FROM analytics_safety_daily_aggregate WHERE "productDate"=p_product_date AND "environment"=p_environment
  ) rows;
  SELECT count(*) INTO v_metric_rows FROM analytics_product_metric_snapshot WHERE "periodOrCohort"=p_product_date AND "environment"=p_environment;
  SELECT count(*) INTO v_gate_rows FROM analytics_gate_snapshot WHERE "environment"=p_environment;
  RETURN jsonb_build_object('aggregate_rows',v_aggregate_rows,'metric_rows',v_metric_rows,'gate_rows',v_gate_rows);
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."execute_c015_analytics_retention"(
  p_revision BIGINT,
  p_executed_at TIMESTAMPTZ
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO daily_energy, pg_catalog
AS $$
DECLARE
  v_deleted BIGINT := 0;
  v_count BIGINT;
BEGIN
  IF p_revision <= 0 THEN RAISE EXCEPTION 'C015_RETENTION_REVISION_INVALID'; END IF;
  DELETE FROM analytics_product_daily_aggregate WHERE "expiresAt"<=p_executed_at;
  GET DIAGNOSTICS v_count=ROW_COUNT; v_deleted:=v_deleted+v_count;
  DELETE FROM analytics_runtime_daily_aggregate WHERE "expiresAt"<=p_executed_at;
  GET DIAGNOSTICS v_count=ROW_COUNT; v_deleted:=v_deleted+v_count;
  DELETE FROM analytics_governance_daily_aggregate WHERE "expiresAt"<=p_executed_at;
  GET DIAGNOSTICS v_count=ROW_COUNT; v_deleted:=v_deleted+v_count;
  DELETE FROM analytics_safety_daily_aggregate WHERE "expiresAt"<=p_executed_at;
  GET DIAGNOSTICS v_count=ROW_COUNT; v_deleted:=v_deleted+v_count;
  DELETE FROM analytics_product_metric_snapshot WHERE "expiresAt"<=p_executed_at;
  GET DIAGNOSTICS v_count=ROW_COUNT; v_deleted:=v_deleted+v_count;
  DELETE FROM analytics_gate_snapshot WHERE "expiresAt"<=p_executed_at;
  GET DIAGNOSTICS v_count=ROW_COUNT; v_deleted:=v_deleted+v_count;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."get_c015_metric_reports"(
  p_product_date DATE,
  p_environment TEXT
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO daily_energy, pg_catalog
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'metric_id',"metricId",'metric_version',"metricVersion",
    'period_or_cohort',"periodOrCohort",'status',"status",
    'numerator',"numerator",'denominator',"denominator",'value',"value",
    'wilson_low',"wilsonLow",'wilson_high',"wilsonHigh",
    'notes_code',"notesCodes",'source_contract_version',"sourceContractVersion",
    'aggregation_revision',"aggregationRevision",'generated_at',"generatedAt",
    'expires_at',"expiresAt"
  )) ORDER BY "metricId"),'[]'::jsonb)
  FROM analytics_product_metric_snapshot
  WHERE "periodOrCohort"=p_product_date AND "environment"=p_environment
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."get_c015_gate_reports"(
  p_environment TEXT
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO daily_energy, pg_catalog
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'gate_id',"gateId",'status',"status",'reason_codes',"reasonCodes",
    'aggregation_revision',"aggregationRevision",'generated_at',"generatedAt"
  ) ORDER BY "gateId"),'[]'::jsonb)
  FROM analytics_gate_snapshot WHERE "environment"=p_environment
$$;

CREATE OR REPLACE FUNCTION "daily_energy"."get_c015_research_metric_status"(
  p_metric_id TEXT
) RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
  SELECT CASE WHEN p_metric_id IN ('S25-Q01','S25-Q02')
    THEN jsonb_build_object(
      'metric_id',p_metric_id,'status','UNAVAILABLE',
      'reason_code','RESEARCH_CONTRACT_NOT_ACCEPTED'
    )
    ELSE NULL END
$$;

ALTER TABLE "analytics_product_daily_aggregate" OWNER TO daily_energy_owner;
ALTER TABLE "analytics_runtime_daily_aggregate" OWNER TO daily_energy_owner;
ALTER TABLE "analytics_governance_daily_aggregate" OWNER TO daily_energy_owner;
ALTER TABLE "analytics_safety_daily_aggregate" OWNER TO daily_energy_owner;
ALTER TABLE "analytics_product_metric_snapshot" OWNER TO daily_energy_owner;
ALTER TABLE "analytics_gate_snapshot" OWNER TO daily_energy_owner;
ALTER FUNCTION upsert_c015_anonymous_aggregate(TEXT,DATE,TEXT,TEXT,JSONB,BIGINT,BIGINT,BIGINT,BIGINT,TIMESTAMPTZ) OWNER TO daily_energy_owner;
ALTER FUNCTION increment_c015_client_signal_aggregate(DATE,TEXT,TEXT,JSONB,BIGINT,TIMESTAMPTZ) OWNER TO daily_energy_owner;
ALTER FUNCTION c015_wilson_bounds(BIGINT,BIGINT) OWNER TO daily_energy_owner;
ALTER FUNCTION set_c015_metric(TEXT,DATE,DATE,TEXT,BIGINT,BIGINT,NUMERIC,BOOLEAN,TEXT[],BIGINT,TIMESTAMPTZ) OWNER TO daily_energy_owner;
ALTER FUNCTION set_c015_nonpublished_metric(TEXT,DATE,TEXT,TEXT,TEXT[],BIGINT,TIMESTAMPTZ) OWNER TO daily_energy_owner;
ALTER FUNCTION rebuild_c015_analytics_date(DATE,DATE,TEXT,BIGINT,TIMESTAMPTZ) OWNER TO daily_energy_owner;
ALTER FUNCTION execute_c015_analytics_retention(BIGINT,TIMESTAMPTZ) OWNER TO daily_energy_owner;
ALTER FUNCTION get_c015_metric_reports(DATE,TEXT) OWNER TO daily_energy_owner;
ALTER FUNCTION get_c015_gate_reports(TEXT) OWNER TO daily_energy_owner;
ALTER FUNCTION get_c015_research_metric_status(TEXT) OWNER TO daily_energy_owner;

REVOKE ALL ON TABLE "analytics_product_daily_aggregate" FROM PUBLIC,daily_energy_api,daily_energy_interactive,daily_energy_background,daily_energy_restricted,daily_energy_safety,daily_energy_deletion;
REVOKE ALL ON TABLE "analytics_runtime_daily_aggregate" FROM PUBLIC,daily_energy_api,daily_energy_interactive,daily_energy_background,daily_energy_restricted,daily_energy_safety,daily_energy_deletion;
REVOKE ALL ON TABLE "analytics_governance_daily_aggregate" FROM PUBLIC,daily_energy_api,daily_energy_interactive,daily_energy_background,daily_energy_restricted,daily_energy_safety,daily_energy_deletion;
REVOKE ALL ON TABLE "analytics_safety_daily_aggregate" FROM PUBLIC,daily_energy_api,daily_energy_interactive,daily_energy_background,daily_energy_restricted,daily_energy_safety,daily_energy_deletion;
REVOKE ALL ON TABLE "analytics_product_metric_snapshot" FROM PUBLIC,daily_energy_api,daily_energy_interactive,daily_energy_background,daily_energy_restricted,daily_energy_safety,daily_energy_deletion;
REVOKE ALL ON TABLE "analytics_gate_snapshot" FROM PUBLIC,daily_energy_api,daily_energy_interactive,daily_energy_background,daily_energy_restricted,daily_energy_safety,daily_energy_deletion;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE "analytics_product_daily_aggregate","analytics_runtime_daily_aggregate","analytics_governance_daily_aggregate","analytics_safety_daily_aggregate","analytics_product_metric_snapshot","analytics_gate_snapshot" TO daily_energy_test;

REVOKE ALL ON FUNCTION upsert_c015_anonymous_aggregate(TEXT,DATE,TEXT,TEXT,JSONB,BIGINT,BIGINT,BIGINT,BIGINT,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_c015_client_signal_aggregate(DATE,TEXT,TEXT,JSONB,BIGINT,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION c015_wilson_bounds(BIGINT,BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_c015_metric(TEXT,DATE,DATE,TEXT,BIGINT,BIGINT,NUMERIC,BOOLEAN,TEXT[],BIGINT,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_c015_nonpublished_metric(TEXT,DATE,TEXT,TEXT,TEXT[],BIGINT,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION rebuild_c015_analytics_date(DATE,DATE,TEXT,BIGINT,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION execute_c015_analytics_retention(BIGINT,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_c015_metric_reports(DATE,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_c015_gate_reports(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_c015_research_metric_status(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_c015_client_signal_aggregate(DATE,TEXT,TEXT,JSONB,BIGINT,TIMESTAMPTZ) TO daily_energy_api;
GRANT EXECUTE ON FUNCTION rebuild_c015_analytics_date(DATE,DATE,TEXT,BIGINT,TIMESTAMPTZ),execute_c015_analytics_retention(BIGINT,TIMESTAMPTZ) TO daily_energy_background;
GRANT EXECUTE ON FUNCTION increment_c015_client_signal_aggregate(DATE,TEXT,TEXT,JSONB,BIGINT,TIMESTAMPTZ),rebuild_c015_analytics_date(DATE,DATE,TEXT,BIGINT,TIMESTAMPTZ),execute_c015_analytics_retention(BIGINT,TIMESTAMPTZ) TO daily_energy_test;
GRANT EXECUTE ON FUNCTION get_c015_metric_reports(DATE,TEXT),get_c015_gate_reports(TEXT),get_c015_research_metric_status(TEXT) TO daily_energy_test;
