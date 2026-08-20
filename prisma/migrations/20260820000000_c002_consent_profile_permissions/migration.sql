SET search_path TO "daily_energy", pg_catalog;

-- C-002: the ordinary API may decrypt only the user's profile fields needed
-- for the closed ProfileView. Identity and unrelated ciphertext remain closed.
GRANT SELECT (
  "id", "accountId", "revision", "preferredNameCiphertext",
  "preferredNameKeyVersion", "expressionStyle", "updatedAt"
)
ON TABLE "daily_energy"."app_user_profile"
TO "daily_energy_api";

GRANT SELECT (
  "id", "profileId", "revision", "preferredNameCiphertext",
  "preferredNameKeyVersion", "expressionStyle", "createdAt", "expiresAt"
)
ON TABLE "daily_energy"."app_user_profile_revision"
TO "daily_energy_api";

-- Consent/profile/preferences are removed only by the restricted data-rights
-- workflow. The ordinary API can append or revise the current allowlist only.
REVOKE DELETE ON TABLE
  "daily_energy"."app_necessary_consent_record",
  "daily_energy"."app_user_profile",
  "daily_energy"."app_user_profile_revision",
  "daily_energy"."app_onboarding_completion",
  "daily_energy"."app_memory_master_preference",
  "daily_energy"."app_notification_preference",
  "daily_energy"."app_platform_permission_snapshot"
FROM "daily_energy_api";

REVOKE UPDATE ON TABLE
  "daily_energy"."app_onboarding_completion",
  "daily_energy"."app_platform_permission_snapshot"
FROM "daily_energy_api";

REVOKE UPDATE ON TABLE
  "daily_energy"."app_necessary_consent_record",
  "daily_energy"."app_user_profile_revision"
FROM "daily_energy_api";

GRANT UPDATE ("expiresAt")
ON TABLE "daily_energy"."app_necessary_consent_record",
         "daily_energy"."app_user_profile_revision"
TO "daily_energy_api";

-- Prevent a future broad grant from making stable identity material readable.
REVOKE SELECT ("ownerScopeToken", "stableSubjectCiphertext", "stableSubjectKeyVersion")
ON TABLE "daily_energy"."app_user_account"
FROM "daily_energy_api";

REVOKE SELECT ("subjectCiphertext", "keyVersion")
ON TABLE "daily_energy"."app_external_identity"
FROM "daily_energy_api";
