export const ADMIN_BUNDLE_RULE_IDS = Object.freeze([
  "ADMIN_BUNDLE_RESTRICTED_FIELD",
  "ADMIN_BUNDLE_SECRET_IDENTIFIER",
  "ADMIN_BUNDLE_SECRET_VALUE",
  "ADMIN_BUNDLE_SERVER_ONLY_DEPENDENCY",
  "ADMIN_BUNDLE_USER_BODY_FIXTURE",
]);

export const ADMIN_USER_BODY_FIXTURE_CANARY =
  "ADMIN_USER_BODY_FIXTURE_CANARY_7f4c3e2a";

const serverOnlyDependency =
  /(?:@daily-energy\/(?:prompt-library|server-adapters|server-core)|@prisma\/client|PrismaClient|\bbullmq\b|\bioredis\b|node:(?:child_process|crypto|fs|net|tls)|@anthropic-ai\/sdk|@google\/generative-ai)/u;
const serverConfigurationIdentifier =
  /\b(?:ADMIN_API_ORIGIN|ADMIN_IDENTITY_CLIENT_SECRET_FILE|ADMIN_SESSION_SECRET_FILE|ANTHROPIC_API_KEY|DATABASE_URL|OPENAI_API_KEY|PROVIDER_API_KEY|REDIS_URL)\b/u;
const restrictedField =
  /\b(?:account_ref|ciphertext|deletion_evidence|evening_note|matter_title|openid|provider_payload|raw_provider_body|safety_confidence|safety_rationale|user_note)\b/u;

function diagnostic(ruleId, path, message) {
  return {
    message,
    path,
    ruleId,
  };
}

function includesCanary(content, values) {
  return values.some(
    (value) =>
      typeof value === "string" &&
      value.length >= 12 &&
      content.includes(value),
  );
}

export function scanAdminBrowserBundle({
  files,
  secretValues = [],
  userBodyCanaries = [ADMIN_USER_BODY_FIXTURE_CANARY],
}) {
  const diagnostics = [];
  for (const file of files) {
    if (serverOnlyDependency.test(file.content)) {
      diagnostics.push(
        diagnostic(
          "ADMIN_BUNDLE_SERVER_ONLY_DEPENDENCY",
          file.path,
          "browser output contains a server-only dependency marker",
        ),
      );
    }
    if (serverConfigurationIdentifier.test(file.content)) {
      diagnostics.push(
        diagnostic(
          "ADMIN_BUNDLE_SECRET_IDENTIFIER",
          file.path,
          "browser output contains a server configuration or secret identifier",
        ),
      );
    }
    if (includesCanary(file.content, secretValues)) {
      diagnostics.push(
        diagnostic(
          "ADMIN_BUNDLE_SECRET_VALUE",
          file.path,
          "browser output contains a configured secret value canary",
        ),
      );
    }
    if (restrictedField.test(file.content)) {
      diagnostics.push(
        diagnostic(
          "ADMIN_BUNDLE_RESTRICTED_FIELD",
          file.path,
          "browser output contains a restricted field marker",
        ),
      );
    }
    if (includesCanary(file.content, userBodyCanaries)) {
      diagnostics.push(
        diagnostic(
          "ADMIN_BUNDLE_USER_BODY_FIXTURE",
          file.path,
          "browser output contains a synthetic user-body fixture",
        ),
      );
    }
  }
  return diagnostics;
}
