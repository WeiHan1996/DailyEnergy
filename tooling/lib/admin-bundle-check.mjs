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

function jsonStringContent(value) {
  return JSON.stringify(value).slice(1, -1);
}

function javascriptSafeContent(value, uppercase, hexadecimal) {
  const prefix = hexadecimal ? "\\x" : "\\u00";
  const code = (value) => value.toString(16).padStart(2, "0");
  const escaped = jsonStringContent(value).replace(/[<>&']/gu, (character) => {
    const digits = code(character.codePointAt(0));
    return `${prefix}${uppercase ? digits.toUpperCase() : digits}`;
  });

  return escaped
    .replaceAll(" ", uppercase ? "\\u2028" : "\\u2028")
    .replaceAll(" ", uppercase ? "\\u2029" : "\\u2029");
}

function htmlEntityContent(value, style) {
  const named = {
    "&": "&amp;",
    "'": style === "apostrophe" ? "&apos;" : "&#x27;",
    '"': "&quot;",
    "<": "&lt;",
    ">": "&gt;",
  };

  return [...value]
    .map((character) => {
      if (style === "named" || style === "apostrophe") {
        return named[character] ?? character;
      }
      if (!["&", "'", '"', "<", ">"].includes(character)) {
        return character;
      }

      const codePoint = character.codePointAt(0);
      if (style === "decimal") {
        return `&#${codePoint};`;
      }
      const digits = codePoint.toString(16);
      return `&#x${style === "hex-upper" ? digits.toUpperCase() : digits};`;
    })
    .join("");
}

function escapedCanaryRepresentations(value) {
  const representations = new Set([value]);
  let frontier = [value];
  const transformations = [
    jsonStringContent,
    (candidate) => javascriptSafeContent(candidate, false, false),
    (candidate) => javascriptSafeContent(candidate, true, false),
    (candidate) => javascriptSafeContent(candidate, false, true),
    (candidate) => javascriptSafeContent(candidate, true, true),
    (candidate) => htmlEntityContent(candidate, "named"),
    (candidate) => htmlEntityContent(candidate, "apostrophe"),
    (candidate) => htmlEntityContent(candidate, "decimal"),
    (candidate) => htmlEntityContent(candidate, "hex-lower"),
    (candidate) => htmlEntityContent(candidate, "hex-upper"),
  ];

  for (let depth = 0; depth < 2; depth += 1) {
    const nextFrontier = [];
    for (const candidate of frontier) {
      for (const transform of transformations) {
        const transformed = transform(candidate);
        if (!representations.has(transformed)) {
          representations.add(transformed);
          nextFrontier.push(transformed);
        }
      }
    }
    frontier = nextFrontier;
  }

  return representations;
}

function includesCanary(content, values) {
  return values.some((value) => {
    if (typeof value !== "string" || value.length < 12) {
      return false;
    }
    return [...escapedCanaryRepresentations(value)].some((representation) =>
      content.includes(representation),
    );
  });
}

export function scanAdminBrowserExposure({
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

export const scanAdminBrowserBundle = scanAdminBrowserExposure;
