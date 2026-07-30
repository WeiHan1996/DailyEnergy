SET search_path TO "daily_energy", pg_catalog;

-- SQL-001 / SQL-020: prove the migration owner can alter an existing E-006 table.
ALTER TABLE "daily_energy"."app_user_account"
  ADD CONSTRAINT "app_user_account_revision_positive_ck" CHECK ("revision" >= 1);
