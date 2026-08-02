SET search_path TO "daily_energy", pg_catalog;

-- E-007: Restricted queue handlers need the same transaction-scoped inbox
-- receipt as ordinary workers. Keep access limited to the runtime receipt;
-- UUIDs are application-generated, so no sequence privilege is required.
GRANT INSERT, UPDATE ON TABLE
  "daily_energy"."runtime_inbox_receipt"
TO "daily_energy_deletion";

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE
  "daily_energy"."runtime_inbox_receipt"
FROM "daily_energy_deletion";
