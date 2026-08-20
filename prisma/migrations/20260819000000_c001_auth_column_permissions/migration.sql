SET search_path TO "daily_energy", pg_catalog;

-- C-001: ordinary API auth reads need stable identity/account guard columns,
-- while ciphertext-bearing columns remain unreadable to daily_energy_api.
--
-- The initial ACL intentionally revoked whole-table SELECT from every table
-- containing a *Ciphertext column. Restore only the non-ciphertext columns
-- required for account lookup, state guarding, and reauthentication.
GRANT SELECT ("id", "state")
ON TABLE "daily_energy"."app_user_account"
TO "daily_energy_api";

GRANT SELECT ("accountId", "providerCode", "subjectLookupToken")
ON TABLE "daily_energy"."app_external_identity"
TO "daily_energy_api";

-- Keep the secret-bearing identity material explicitly closed even if a
-- future migration changes broader privileges.
REVOKE SELECT ("ownerScopeToken", "stableSubjectCiphertext", "stableSubjectKeyVersion")
ON TABLE "daily_energy"."app_user_account"
FROM "daily_energy_api";

REVOKE SELECT ("subjectCiphertext", "keyVersion")
ON TABLE "daily_energy"."app_external_identity"
FROM "daily_energy_api";
