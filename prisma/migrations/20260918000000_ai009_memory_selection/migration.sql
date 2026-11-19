SET search_path TO "daily_energy", pg_catalog;

-- The resolver reads current structured facts only. Neither ordinary worker
-- can read or mutate Matter ciphertext, grants, preferences or mention history
-- through the broad initial worker table grants.
REVOKE ALL ON TABLE
  "daily_energy"."app_important_matter",
  "daily_energy"."app_memory_purpose_grant",
  "daily_energy"."app_memory_master_preference",
  "daily_energy"."app_memory_mention_receipt"
FROM "daily_energy_interactive", "daily_energy_background";

GRANT SELECT (
  "id", "accountId", "revision", "state", "createdProductDate",
  "targetProductDate", "updatedAt"
) ON TABLE "daily_energy"."app_important_matter"
TO "daily_energy_interactive";

GRANT SELECT (
  "id", "accountId", "sourceType", "sourceRef", "purpose", "state",
  "revision", "policyVersion"
) ON TABLE "daily_energy"."app_memory_purpose_grant"
TO "daily_energy_interactive";

GRANT SELECT (
  "accountId", "continuityEnabled", "dailyExpressionEnabled", "revision"
) ON TABLE "daily_energy"."app_memory_master_preference"
TO "daily_energy_interactive";

GRANT SELECT (
  "accountId", "sourceRef", "productDate", "purpose"
) ON TABLE "daily_energy"."app_memory_mention_receipt"
TO "daily_energy_interactive";

GRANT EXECUTE ON FUNCTION
  "daily_energy"."resolve_ai008_matter_guard_snapshot"(uuid, uuid, text)
TO "daily_energy_interactive";
