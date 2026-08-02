SET search_path TO "daily_energy", pg_catalog;

-- =========================================================================
-- PR #108 安全缺陷修复 (E-006)
-- 1. SQL-007: 补充 snapshot → MorningCheckin 的 owner/date/revision 一致性
-- 2. SQL-013: 补充 visibility 状态切换与 weekly current 指向路径的校验
-- 3. 拆分 daily_energy_restricted 为 daily_energy_safety 与 daily_energy_deletion
-- =========================================================================

-- -------------------------------------------------------------------------
-- SQL-007 修复：在 TX-02 snapshot 提交边界校验 snapshot→intent→checkin
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "daily_energy"."assert_generation_snapshot_lineage"(snapshot_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = "daily_energy", pg_catalog AS $$
DECLARE
  snapshot_row record;
  intent_row record;
  checkin_row record;
  checkin_revision_exists boolean;
BEGIN
  SELECT * INTO snapshot_row
  FROM app_generation_input_snapshot
  WHERE id = snapshot_id;
  IF snapshot_row.id IS NULL THEN
    PERFORM raise_integrity('SQL-007');
  END IF;

  SELECT * INTO intent_row
  FROM app_generation_intent
  WHERE id = snapshot_row."generationIntentId";
  SELECT * INTO checkin_row
  FROM app_morning_checkin
  WHERE id = snapshot_row."checkinId";
  SELECT EXISTS (
    SELECT 1
    FROM app_morning_checkin_revision revision_row
    WHERE revision_row."checkinId" = snapshot_row."checkinId"
      AND revision_row.revision = snapshot_row."checkinRevision"
  ) INTO checkin_revision_exists;
  IF intent_row.id IS NULL OR checkin_row.id IS NULL OR
     checkin_row."accountId" <> intent_row."accountId" OR
     checkin_row."productDate" <> intent_row."targetProductDate" OR
     NOT checkin_revision_exists THEN
    PERFORM raise_integrity('SQL-007');
  END IF;
END
$$;
REVOKE ALL ON FUNCTION "daily_energy"."assert_generation_snapshot_lineage"(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "daily_energy"."assert_generation_snapshot_lineage"(uuid) TO
  "daily_energy_api", "daily_energy_interactive", "daily_energy_background", "daily_energy_test";

-- Deferred runtime constraints use the shared stable-code helper as the invoking role.
-- Keep it closed to PUBLIC while allowing only active writer/test profiles to surface
-- SQL-007/012/013/014 instead of a function-permission error.
GRANT EXECUTE ON FUNCTION "daily_energy"."raise_integrity"(text) TO
  "daily_energy_api", "daily_energy_interactive", "daily_energy_background",
  "daily_energy_safety", "daily_energy_deletion", "daily_energy_test";

CREATE OR REPLACE FUNCTION "daily_energy"."check_generation_snapshot_consistency"()
RETURNS trigger LANGUAGE plpgsql SET search_path = "daily_energy", pg_catalog AS $$
BEGIN
  PERFORM assert_generation_snapshot_lineage(NEW.id);
  IF NOT EXISTS (
    SELECT 1
    FROM app_generation_input_snapshot snapshot_row
    JOIN app_morning_checkin checkin_row ON checkin_row.id = snapshot_row."checkinId"
    WHERE snapshot_row.id = NEW.id
      AND checkin_row.revision = snapshot_row."checkinRevision"
  ) THEN
    PERFORM raise_integrity('SQL-007');
  END IF;
  RETURN NEW;
END
$$;
CREATE CONSTRAINT TRIGGER "sql_007_generation_snapshot_consistency"
AFTER INSERT OR UPDATE ON "daily_energy"."app_generation_input_snapshot"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "daily_energy"."check_generation_snapshot_consistency"();

CREATE OR REPLACE FUNCTION "daily_energy"."check_daily_publication_consistency"()
RETURNS trigger LANGUAGE plpgsql SET search_path = "daily_energy", pg_catalog AS $$
DECLARE
  intent_row record;
  snapshot_row record;
  result_row record;
BEGIN
  IF TG_TABLE_NAME = 'app_published_daily_result' THEN
    SELECT * INTO intent_row FROM app_generation_intent WHERE id = NEW."generationIntentId";
    SELECT * INTO snapshot_row FROM app_generation_input_snapshot WHERE id = NEW."inputSnapshotId";
    IF intent_row.id IS NULL OR snapshot_row.id IS NULL OR
       intent_row."accountId" <> NEW."accountId" OR intent_row."targetProductDate" <> NEW."productDate" OR
       intent_row."resultVersion" <> NEW."resultVersion" OR snapshot_row."generationIntentId" <> intent_row.id THEN
      PERFORM raise_integrity('SQL-007');
    END IF;
    PERFORM assert_generation_snapshot_lineage(snapshot_row.id);
  ELSE
    SELECT * INTO result_row FROM app_published_daily_result WHERE id = NEW."resultId";
    IF result_row.id IS NULL OR result_row."accountId" <> NEW."accountId" OR result_row."productDate" <> NEW."productDate" THEN
      PERFORM raise_integrity('SQL-007');
    END IF;
  END IF;
  RETURN NEW;
END
$$;

-- Fail the upgrade if an older deployment already committed an invalid snapshot.
DO $validate_existing_generation_snapshots$
DECLARE snapshot_id uuid;
BEGIN
  FOR snapshot_id IN SELECT id FROM app_generation_input_snapshot LOOP
    PERFORM assert_generation_snapshot_lineage(snapshot_id);
  END LOOP;
END
$validate_existing_generation_snapshots$;

-- -------------------------------------------------------------------------
-- SQL-013 修复：visibility 状态切换时校验所有槽；weekly current 切换时校验所有槽
-- -------------------------------------------------------------------------

-- 日级：visibility 状态/绑定变更或删除时，同时校验失去保护的旧 result
-- 与非 BLOCKED 的新 result。删除完整 result graph 时旧 result 已无 slot，因此仍可提交。
CREATE OR REPLACE FUNCTION "daily_energy"."check_daily_visibility_slots"()
RETURNS trigger LANGUAGE plpgsql SET search_path = "daily_energy", pg_catalog AS $$
DECLARE slot_row record;
BEGIN
  IF TG_OP = 'DELETE' OR
     (TG_OP = 'UPDATE' AND NEW."resultId" IS DISTINCT FROM OLD."resultId") THEN
    FOR slot_row IN SELECT * FROM app_result_content_slot WHERE "resultId" = OLD."resultId" LOOP
      PERFORM assert_daily_content_slot(slot_row.id);
    END LOOP;
  END IF;

  IF TG_OP <> 'DELETE' AND NEW.state IS DISTINCT FROM 'BLOCKED' THEN
    FOR slot_row IN SELECT * FROM app_result_content_slot WHERE "resultId" = NEW."resultId" LOOP
      PERFORM assert_daily_content_slot(slot_row.id);
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;
CREATE CONSTRAINT TRIGGER "sql_013_daily_visibility"
AFTER INSERT OR UPDATE OF state, "resultId" OR DELETE ON "daily_energy"."app_published_result_visibility"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "daily_energy"."check_daily_visibility_slots"();

-- 周级：currentSummaryRef 变更时，对新 summary 的所有槽重新执行 SQL-013
-- （sql_012_weekly_current_summary 已校验 summary 完整性；这里补充内容槽校验）
CREATE OR REPLACE FUNCTION "daily_energy"."check_weekly_current_slots"()
RETURNS trigger LANGUAGE plpgsql SET search_path = "daily_energy", pg_catalog AS $$
DECLARE slot_row record;
BEGIN
  IF NEW."currentSummaryRef" IS NULL THEN
    RETURN NEW;
  END IF;
  FOR slot_row IN SELECT * FROM app_weekly_content_slot WHERE "summaryId" = NEW."currentSummaryRef" LOOP
    PERFORM assert_weekly_content_slot(slot_row.id);
  END LOOP;
  RETURN NEW;
END
$$;
CREATE CONSTRAINT TRIGGER "sql_013_weekly_current_slots"
AFTER INSERT OR UPDATE OF "currentSummaryRef" ON "daily_energy"."app_weekly_window"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "daily_energy"."check_weekly_current_slots"();

-- -------------------------------------------------------------------------
-- 角色拆分：daily_energy_restricted → daily_energy_safety + daily_energy_deletion
--
-- daily_energy_safety: Safety 池只处理 Safety 状态、决策、事件与恢复回执
-- daily_energy_deletion: 删除/导出 worker，具备擦除所需的最小 DML
-- 原 daily_energy_restricted 保留为空壳，防止旧凭据继续获得受限能力
-- -------------------------------------------------------------------------

-- 注：daily_energy_safety 与 daily_energy_deletion 角色由 bootstrap 创建
-- （SQL-020：migration owner 不拥有 CREATEROLE）。本 migration 只管理授权。
-- 收回三个受限角色的全部表/序列权限，再按用途显式授予。
REVOKE ALL ON ALL TABLES IN SCHEMA "daily_energy" FROM "daily_energy_restricted";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "daily_energy" FROM "daily_energy_restricted";
REVOKE ALL ON ALL TABLES IN SCHEMA "daily_energy" FROM "daily_energy_safety";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "daily_energy" FROM "daily_energy_safety";
REVOKE ALL ON ALL TABLES IN SCHEMA "daily_energy" FROM "daily_energy_deletion";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "daily_energy" FROM "daily_energy_deletion";
GRANT USAGE ON SCHEMA "daily_energy" TO "daily_energy_restricted";
GRANT USAGE ON SCHEMA "daily_energy" TO "daily_energy_safety";
GRANT USAGE ON SCHEMA "daily_energy" TO "daily_energy_deletion";

-- Safety pool 读取账户 guard 和版本化资源；只写 Safety 自有的受限事实。
GRANT SELECT ON
  "daily_energy"."app_user_account",
  "daily_energy"."system_safety_resource_entry",
  "daily_energy"."restricted_safety_state",
  "daily_energy"."restricted_safety_decision",
  "daily_energy"."restricted_safety_event",
  "daily_energy"."restricted_safety_response_plan",
  "daily_energy"."restricted_recovery_command_receipt",
  "daily_energy"."restricted_audit_event"
TO "daily_energy_safety";

GRANT INSERT, UPDATE ON
  "daily_energy"."restricted_safety_state",
  "daily_energy"."restricted_safety_decision",
  "daily_energy"."restricted_safety_event",
  "daily_energy"."restricted_safety_response_plan",
  "daily_energy"."restricted_recovery_command_receipt",
  "daily_energy"."restricted_audit_event"
TO "daily_energy_safety";
GRANT INSERT ON
  "daily_energy"."runtime_outbox_event"
TO "daily_energy_safety", "daily_energy_deletion";
GRANT DELETE ON
  "daily_energy"."restricted_safety_decision",
  "daily_energy"."restricted_safety_event",
  "daily_energy"."restricted_safety_response_plan",
  "daily_energy"."restricted_recovery_command_receipt"
TO "daily_energy_safety";

-- Deletion worker 可读取 account/safety guards 和 retention/provider catalogs。
GRANT SELECT ON
  "daily_energy"."app_user_account",
  "daily_energy"."restricted_safety_state",
  "daily_energy"."system_retention_policy_entry",
  "daily_energy"."system_provider_data_handling_profile",
  "daily_energy"."system_backup_catalog_entry",
  "daily_energy"."restricted_data_task",
  "daily_energy"."restricted_deletion_guard",
  "daily_energy"."restricted_deletion_step_checkpoint",
  "daily_energy"."restricted_day_erasure_guard",
  "daily_energy"."restricted_deletion_receipt",
  "daily_energy"."restricted_provider_deletion_request",
  "daily_energy"."restricted_restore_deny_record",
  "daily_energy"."restricted_legal_hold",
  "daily_energy"."restricted_audit_event"
TO "daily_energy_deletion";

-- 受限删除任务的生命周期表由 deletion worker 管理。
GRANT INSERT, UPDATE, DELETE ON
  "daily_energy"."restricted_data_task",
  "daily_energy"."restricted_deletion_guard",
  "daily_energy"."restricted_deletion_step_checkpoint",
  "daily_energy"."restricted_day_erasure_guard",
  "daily_energy"."restricted_deletion_receipt",
  "daily_energy"."restricted_provider_deletion_request",
  "daily_energy"."restricted_restore_deny_record",
  "daily_energy"."restricted_legal_hold",
  "daily_energy"."restricted_audit_event"
TO "daily_energy_deletion";

-- 删除范围覆盖所有可删除的用户/运行事实，但不授予 system、evaluation 或
-- Safety-owned 表的 DELETE。不可变发布对象的清理仍由专用数据权利流程控制。
DO $deletion_subject_tables$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'app_user_account', 'app_external_identity', 'app_session_credential', 'app_necessary_consent_record',
    'app_user_profile', 'app_user_profile_revision', 'app_onboarding_completion',
    'app_view_continuation_grant', 'runtime_command_receipt', 'app_morning_checkin',
    'app_morning_checkin_revision', 'app_generation_intent',
    'app_generation_input_snapshot', 'runtime_gateway_invocation',
    'runtime_gateway_attempt', 'runtime_gateway_candidate', 'app_published_result_visibility',
    'app_published_daily_result', 'app_result_content_slot',
    'app_personalized_content_fragment', 'app_source_dependency',
    'app_daily_interaction', 'app_daily_light_fact', 'app_daily_task_state',
    'app_daily_helpfulness_record', 'app_evening_feedback_record',
    'app_evening_feedback_revision', 'app_relationship_cycle',
    'app_relationship_encounter_link', 'app_relationship_node_receipt',
    'app_important_matter', 'app_important_matter_revision', 'app_memory_purpose_grant',
    'app_memory_master_preference', 'app_memory_mention_receipt',
    'app_memory_context_snapshot', 'app_weekly_window', 'app_weekly_source_snapshot',
    'app_weekly_summary_intent', 'app_published_weekly_summary_revision',
    'app_weekly_content_slot',
    'app_weekly_personalized_content_fragment', 'app_weekly_source_dependency',
    'app_notification_preference', 'app_platform_permission_snapshot',
    'app_notification_intent', 'runtime_notification_delivery_attempt',
    'runtime_outbox_event', 'runtime_inbox_receipt'
  ]
  LOOP
    EXECUTE format(
      'GRANT SELECT, DELETE ON TABLE %I.%I TO %I',
      'daily_energy', table_name, 'daily_energy_deletion'
    );
  END LOOP;
END
$deletion_subject_tables$;

-- SQL-008 禁止发布/快照的语义修改，但 retention/deletion worker 必须能按
-- Accepted 删除策略物理擦除用户冻结事实。系统目录仍不允许删除。
CREATE OR REPLACE FUNCTION "daily_energy"."reject_immutable_change"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND
     TG_TABLE_NAME IN (
       'app_generation_input_snapshot',
       'app_published_daily_result',
       'app_published_weekly_summary_revision'
     ) AND
     pg_has_role(session_user, 'daily_energy_deletion', 'MEMBER') THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'SQL-008';
END
$$;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA "daily_energy" FROM
  "daily_energy_safety", "daily_energy_deletion";

-- 新表默认不继承任何受限角色权限；后续 migration 必须显式扩展 allowlist。
ALTER DEFAULT PRIVILEGES FOR ROLE "daily_energy_owner" IN SCHEMA "daily_energy"
  REVOKE ALL ON TABLES FROM "daily_energy_restricted", "daily_energy_safety", "daily_energy_deletion";

-- 发布对象和冻结 snapshot 继续通过不可变触发器及 ACL 双重保护。
REVOKE UPDATE ON TABLE
  "daily_energy"."app_generation_input_snapshot", "daily_energy"."app_published_daily_result",
  "daily_energy"."app_published_weekly_summary_revision", "daily_energy"."system_retention_policy_entry",
  "daily_energy"."system_safety_resource_entry", "daily_energy"."system_version_catalog_entry"
FROM "daily_energy_safety", "daily_energy_deletion";
REVOKE DELETE ON TABLE
  "daily_energy"."system_retention_policy_entry",
  "daily_energy"."system_safety_resource_entry",
  "daily_energy"."system_version_catalog_entry"
FROM "daily_energy_safety", "daily_energy_deletion";
