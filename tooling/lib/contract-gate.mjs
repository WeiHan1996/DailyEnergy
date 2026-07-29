import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parse } from "yaml";

import {
  CONTRACT_GENERATOR,
  buildContractArtifacts,
  parseErrorContract,
} from "./contract-codegen.mjs";

const HTTP_METHODS = [
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
];

const ERROR_CATEGORIES = [
  "AUTH",
  "GUARD",
  "VALIDATION",
  "CONFLICT",
  "NOT_FOUND",
  "RATE_LIMIT",
  "TRANSIENT",
  "TERMINAL",
  "SAFETY",
];

const IMPLEMENTED_HTTP_STATUSES = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
  NOT_FOUND: 404,
  SERVICE_UNAVAILABLE: 503,
  TOO_MANY_REQUESTS: 429,
  UNAUTHORIZED: 401,
  UNPROCESSABLE_ENTITY: 422,
};

const IDENTITY_SCHEMA_KEYS = new Set([
  "$ref",
  "additionalProperties",
  "allOf",
  "anyOf",
  "const",
  "enum",
  "format",
  "items",
  "maxItems",
  "maxLength",
  "maximum",
  "minItems",
  "minLength",
  "minimum",
  "nullable",
  "oneOf",
  "pattern",
  "properties",
  "required",
  "type",
]);

const EXPECTED_EXPORTS = {
  apiClient: ["./admin", "./miniapp", "./testing"],
  sharedSchemas: [".", "./client", "./json-schema"],
};

const EXPECTED_EXPORT_TARGETS = {
  apiClient: {
    "./admin": {
      import: "./dist/admin.js",
      types: "./dist/admin.d.ts",
    },
    "./miniapp": {
      import: "./dist/miniapp.js",
      types: "./dist/miniapp.d.ts",
    },
    "./testing": {
      import: "./dist/testing.js",
      types: "./dist/testing.d.ts",
    },
  },
  sharedSchemas: {
    ".": {
      import: "./dist/index.js",
      types: "./dist/index.d.ts",
    },
    "./client": {
      import: "./dist/client.js",
      types: "./dist/client.d.ts",
    },
    "./json-schema": {
      import: "./dist/json-schema.js",
      types: "./dist/json-schema.d.ts",
    },
  },
};

const CLIENT_FORBIDDEN_FIELD_PATTERN =
  /["'](?:admin_notes|ciphertext|database_row|db_row|epoch|event_payload|job_payload|model|openid|prisma|prompt|prompt_version|provider|provider_expiry_at|provider_model|provider_payload|provider_response|redis|restricted|seed)["']\s*[?:]/iu;

const CLIENT_FORBIDDEN_IMPORT_PATTERN =
  /(?:from\s+|import\s*)["'](?:node:|@nestjs\/|@prisma\/|bullmq(?:\/|["'])|ioredis(?:\/|["'])|openai(?:\/|["'])|@anthropic-ai\/|@daily-energy\/api-client\/admin|\.\/(?:admin|daily-content|evening-feedback|index|weekly-summary)(?:\.js)?["'])/iu;

export const CONTRACT_RULE_IDS = Object.freeze([
  "CONTRACT_API_ERROR_CATALOG_DRIFT",
  "CONTRACT_CLIENT_FORBIDDEN_FIELD",
  "CONTRACT_CLIENT_FORBIDDEN_IMPORT",
  "CONTRACT_GENERATED_CONTENT_DRIFT",
  "CONTRACT_GENERATED_FILE_MISSING",
  "CONTRACT_GENERATED_FINGERPRINT_DRIFT",
  "CONTRACT_GENERATED_PROVENANCE_INVALID",
  "CONTRACT_OPENAPI_AUDIENCE_MIXED",
  "CONTRACT_OPENAPI_DOCUMENT_INVALID",
  "CONTRACT_OPENAPI_ERROR_ENVELOPE_INVALID",
  "CONTRACT_OPENAPI_ERROR_STATUS_UNKNOWN",
  "CONTRACT_OPENAPI_OPERATION_ID_DUPLICATE",
  "CONTRACT_OPENAPI_SOURCE_SCHEMA_DRIFT",
  "CONTRACT_PACKAGE_EXPORTS_INVALID",
  "CONTRACT_SOURCE_MAPPER_MISSING",
]);

function diagnostic(ruleId, path, message) {
  return { message, path, ruleId };
}

function operationEntries(document) {
  const entries = [];
  for (const [path, pathItem] of Object.entries(document?.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (operation) {
        entries.push({ method, operation, path });
      }
    }
  }
  return entries;
}

function localRefParts(ref) {
  const match = /^#\/components\/([^/]+)\/([^/]+)$/u.exec(ref);
  return match ? { group: match[1], name: match[2] } : undefined;
}

function resolveLocalRef(document, value) {
  let current = value;
  const visited = new Set();
  while (
    current &&
    typeof current === "object" &&
    typeof current.$ref === "string"
  ) {
    if (visited.has(current.$ref)) {
      return undefined;
    }
    visited.add(current.$ref);
    const parts = localRefParts(current.$ref);
    if (!parts) {
      return undefined;
    }
    current = document.components?.[parts.group]?.[parts.name];
  }
  return current;
}

function sameMembers(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    [...actual]
      .sort()
      .every((value, index) => value === [...expected].sort()[index])
  );
}

function hasOnlyProperties(schema, expected) {
  return sameMembers(Object.keys(schema?.properties ?? {}), expected);
}

function documentDiagnostics(state) {
  const document = state.document;
  if (
    !document ||
    typeof document !== "object" ||
    document.openapi !== "3.0.3" ||
    typeof document.info?.title !== "string" ||
    typeof document.info?.version !== "string" ||
    !document.paths ||
    typeof document.paths !== "object" ||
    !document.components ||
    typeof document.components !== "object"
  ) {
    return [
      diagnostic(
        "CONTRACT_OPENAPI_DOCUMENT_INVALID",
        "openapi/openapi.generated.json",
        "generated OpenAPI must be a parseable OpenAPI 3.0.3 document",
      ),
    ];
  }
  return [];
}

function operationDiagnostics(state) {
  const diagnostics = [];
  const seen = new Set();
  for (const { method, operation, path } of operationEntries(state.document)) {
    const operationId = operation.operationId;
    if (
      typeof operationId !== "string" ||
      operationId.length === 0 ||
      seen.has(operationId)
    ) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_OPENAPI_OPERATION_ID_DUPLICATE",
          `${method.toUpperCase()} ${path}`,
          "every operationId must be present and globally unique",
        ),
      );
    } else {
      seen.add(operationId);
    }
  }
  return diagnostics;
}

function audienceDiagnostics(state) {
  const diagnostics = [];
  for (const [audience, document] of [
    ["miniapp", state.miniapp],
    ["admin", state.admin],
  ]) {
    for (const { operation, path } of operationEntries(document)) {
      const adminPath = path.startsWith("/admin/");
      const adminOperation = /^admin/u.test(operation.operationId ?? "");
      const invalid =
        audience === "admin"
          ? !adminPath || !adminOperation
          : adminPath || adminOperation;
      if (invalid) {
        diagnostics.push(
          diagnostic(
            "CONTRACT_OPENAPI_AUDIENCE_MIXED",
            `${audience}:${path}`,
            "miniapp and Admin operations must remain in disjoint documents",
          ),
        );
      }
    }
  }
  return diagnostics;
}

function errorEnvelopeDiagnostics(state) {
  const diagnostics = [];
  const schemas = state.document?.components?.schemas ?? {};
  const body = schemas.ApiErrorBody;
  const error = schemas.ApiError;
  const expectedCodes = state.errorContract.map(({ code }) => code);

  if (
    body?.type !== "object" ||
    body.additionalProperties !== false ||
    !sameMembers(body.required, ["error", "ok", "request_id", "server_now"]) ||
    !hasOnlyProperties(body, [
      "error",
      "ok",
      "product_date",
      "request_id",
      "server_now",
    ]) ||
    body.properties?.ok?.enum?.[0] !== false ||
    body.properties?.error?.$ref !== "#/components/schemas/ApiError"
  ) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_OPENAPI_ERROR_ENVELOPE_INVALID",
        "components.schemas.ApiErrorBody",
        "error envelope fields must match the Accepted API contract",
      ),
    );
  }

  if (
    error?.type !== "object" ||
    error.additionalProperties !== false ||
    !sameMembers(error.required, [
      "category",
      "code",
      "message",
      "message_key",
      "retryable",
    ]) ||
    !hasOnlyProperties(error, [
      "category",
      "code",
      "command_receipt",
      "details",
      "message",
      "message_key",
      "retryable",
      "safety_view",
    ]) ||
    !sameMembers(error.properties?.category?.enum, ERROR_CATEGORIES) ||
    !sameMembers(error.properties?.code?.enum, expectedCodes)
  ) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_OPENAPI_ERROR_ENVELOPE_INVALID",
        "components.schemas.ApiError",
        "error code, category, and closed field set must match error-codes.md",
      ),
    );
  }
  return diagnostics;
}

function errorStatusDiagnostics(state) {
  const diagnostics = [];
  const knownStatuses = new Set(
    state.errorContract.map(({ status }) => String(status)),
  );
  for (const { method, operation, path } of operationEntries(state.document)) {
    for (const [status, rawResponse] of Object.entries(
      operation.responses ?? {},
    )) {
      if (/^[123]\d\d$/u.test(status)) {
        continue;
      }
      const response = resolveLocalRef(state.document, rawResponse);
      const schema = response?.content?.["application/json"]?.schema;
      if (
        !knownStatuses.has(status) ||
        schema?.$ref !== "#/components/schemas/ApiErrorBody"
      ) {
        diagnostics.push(
          diagnostic(
            "CONTRACT_OPENAPI_ERROR_STATUS_UNKNOWN",
            `${method.toUpperCase()} ${path} ${status}`,
            "non-success responses must use a documented status and ApiErrorBody",
          ),
        );
      }
    }
  }
  return diagnostics;
}

function sourceSchemaDiagnostics(state) {
  const diagnostics = [];
  for (const [name, schema] of Object.entries(
    state.rawDocument?.components?.schemas ?? {},
  )) {
    const source = schema?.["x-source-contract"];
    if (typeof source !== "string" || schema["x-source-mapper"]) {
      continue;
    }
    if (Object.keys(schema).some((key) => IDENTITY_SCHEMA_KEYS.has(key))) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_OPENAPI_SOURCE_SCHEMA_DRIFT",
          `components.schemas.${name}`,
          "identity projections cannot duplicate Zod validation keywords",
        ),
      );
    }
    const generated = state.document?.components?.schemas?.[name];
    if (
      generated?.["x-source-contract"] !== source ||
      generated?.["x-source-projection"] !== "zod-openapi-3.0"
    ) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_OPENAPI_SOURCE_SCHEMA_DRIFT",
          `components.schemas.${name}`,
          "generated OpenAPI projection must retain Zod source provenance",
        ),
      );
    }
  }
  return diagnostics;
}

function mapperDiagnostics(state) {
  const diagnostics = [];
  for (const [name, schema] of Object.entries(
    state.rawDocument?.components?.schemas ?? {},
  )) {
    const mapper = schema?.["x-source-mapper"];
    if (
      typeof mapper === "string" &&
      !new RegExp(`export function ${mapper}\\s*\\(`, "u").test(
        state.mappersSource,
      )
    ) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_SOURCE_MAPPER_MISSING",
          `components.schemas.${name}`,
          `declared mapper ${mapper} must be an explicit one-way export`,
        ),
      );
    }
  }
  return diagnostics;
}

function clientBoundaryDiagnostics(state) {
  const diagnostics = [];
  const sources = [
    ["packages/api-client/src/generated/miniapp.ts", state.miniappSource],
    ["packages/api-client/src/miniapp.ts", state.miniappEntrySource],
    ["packages/api-client/src/mappers.ts", state.mappersSource],
    ["packages/api-client/src/transport.ts", state.transportSource],
    ["packages/shared-schemas/src/client.ts", state.sharedClientSource],
    ...state.sharedClientReachableSources,
  ];
  for (const [path, source] of sources) {
    if (CLIENT_FORBIDDEN_FIELD_PATTERN.test(source)) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_CLIENT_FORBIDDEN_FIELD",
          path,
          "client-safe source exposes an internal, Admin, DB, event, Prompt, or provider field",
        ),
      );
    }
    if (CLIENT_FORBIDDEN_IMPORT_PATTERN.test(source)) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_CLIENT_FORBIDDEN_IMPORT",
          path,
          "client-safe source imports an Admin, Node, server, database, or provider module",
        ),
      );
    }
  }
  return diagnostics;
}

function packageExportDiagnostics(state) {
  const diagnostics = [];
  for (const [key, packageName, packageJson] of [
    ["sharedSchemas", "@daily-energy/shared-schemas", state.sharedPackage],
    ["apiClient", "@daily-energy/api-client", state.apiClientPackage],
  ]) {
    const actual = Object.keys(packageJson.exports ?? {});
    if (
      !sameMembers(actual, EXPECTED_EXPORTS[key]) ||
      EXPECTED_EXPORTS[key].some((subpath) => {
        const actualTarget = packageJson.exports?.[subpath];
        const expectedTarget = EXPECTED_EXPORT_TARGETS[key][subpath];
        return (
          actualTarget?.import !== expectedTarget.import ||
          actualTarget?.types !== expectedTarget.types ||
          Object.keys(actualTarget ?? {}).length !== 2
        );
      })
    ) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_PACKAGE_EXPORTS_INVALID",
          `${packageName}/package.json`,
          `${packageName} must expose only its reviewed contract subpaths`,
        ),
      );
    }
  }
  return diagnostics;
}

function parseImplementedErrorCatalog(source) {
  const entries = [];
  const entryPattern = /^\s{2}([A-Z][A-Z0-9_]*): \{\n([\s\S]*?)^\s{2}\},$/gmu;
  for (const match of source.matchAll(entryPattern)) {
    const body = match[2];
    const category = /category: "([A-Z_]+)"/u.exec(body)?.[1];
    const retryable = /retryable: (true|false)/u.exec(body)?.[1];
    const statusName = /status: HttpStatus\.([A-Z_]+)/u.exec(body)?.[1];
    entries.push({
      category,
      code: match[1],
      retryable: retryable === "true",
      status: IMPLEMENTED_HTTP_STATUSES[statusName],
    });
  }
  return entries;
}

function apiErrorCatalogDiagnostics(state) {
  const diagnostics = [];
  const expected = new Map(
    state.errorContract.map((entry) => [entry.code, entry]),
  );
  const implemented = parseImplementedErrorCatalog(state.apiErrorSource);
  if (implemented.length === 0) {
    return [
      diagnostic(
        "CONTRACT_API_ERROR_CATALOG_DRIFT",
        "apps/api/src/transport/common/api-exception.ts",
        "API_ERROR_CATALOG must remain machine-readable",
      ),
    ];
  }
  for (const entry of implemented) {
    const contract = expected.get(entry.code);
    if (
      !contract ||
      entry.category !== contract.category ||
      entry.retryable !== contract.retryable ||
      entry.status !== contract.status
    ) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_API_ERROR_CATALOG_DRIFT",
          `API_ERROR_CATALOG.${entry.code}`,
          "implemented error semantics must be a faithful subset of error-codes.md",
        ),
      );
    }
  }
  return diagnostics;
}

function generatedProvenanceDiagnostics(state) {
  const diagnostics = [];
  for (const [path, source, fingerprint] of [
    [
      "packages/api-client/src/generated/miniapp.ts",
      state.miniappSource,
      state.contractSourceFingerprint,
    ],
    [
      "packages/api-client/src/generated/admin.ts",
      state.adminSource,
      state.contractSourceFingerprint,
    ],
    [
      "packages/shared-schemas/src/json-schema.ts",
      state.jsonSchemaSource,
      state.schemaSourceFingerprint,
    ],
  ]) {
    const header = source.split(/\r?\n/u).slice(0, 4).join("\n");
    if (
      !header.includes("// @generated") ||
      !header.includes(`// generator: ${CONTRACT_GENERATOR}`) ||
      !header.includes(`// source-fingerprint: ${fingerprint}`) ||
      !header.includes("// do not edit;")
    ) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_GENERATED_PROVENANCE_INVALID",
          path,
          "generated source must carry generator, fingerprint, and do-not-edit provenance",
        ),
      );
    }
  }
  const metadata = state.document?.["x-generated"];
  if (
    metadata?.generator !== CONTRACT_GENERATOR ||
    metadata?.["source-fingerprint"] !== state.contractSourceFingerprint ||
    metadata?.["do-not-edit"] !== true
  ) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_GENERATED_PROVENANCE_INVALID",
        "openapi/openapi.generated.json",
        "generated OpenAPI must carry matching deterministic provenance",
      ),
    );
  }
  return diagnostics;
}

const gates = [
  documentDiagnostics,
  operationDiagnostics,
  audienceDiagnostics,
  errorEnvelopeDiagnostics,
  errorStatusDiagnostics,
  sourceSchemaDiagnostics,
  mapperDiagnostics,
  clientBoundaryDiagnostics,
  packageExportDiagnostics,
  apiErrorCatalogDiagnostics,
  generatedProvenanceDiagnostics,
];

export function runContractGates(state) {
  return gates.flatMap((gate) => gate(state));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadContractGateState(repositoryRoot, providedBuild) {
  const build = providedBuild ?? (await buildContractArtifacts(repositoryRoot));
  const openApiSource = await readFile(
    resolve(repositoryRoot, "openapi/openapi.yaml"),
    "utf8",
  );
  const errorSource = await readFile(
    resolve(repositoryRoot, "docs/technical/error-codes.md"),
    "utf8",
  );
  let rawDocument;
  let document;
  try {
    rawDocument = parse(openApiSource);
    document = await readJson(
      resolve(repositoryRoot, "openapi/openapi.generated.json"),
    );
  } catch {
    rawDocument = undefined;
    document = undefined;
  }
  return {
    admin: structuredClone(build.admin),
    adminSource: await readFile(
      resolve(repositoryRoot, "packages/api-client/src/generated/admin.ts"),
      "utf8",
    ),
    apiClientPackage: await readJson(
      resolve(repositoryRoot, "packages/api-client/package.json"),
    ),
    apiErrorSource: await readFile(
      resolve(repositoryRoot, "apps/api/src/transport/common/api-exception.ts"),
      "utf8",
    ),
    contractSourceFingerprint: build.contractSourceFingerprint,
    document,
    errorContract: parseErrorContract(errorSource),
    jsonSchemaSource: await readFile(
      resolve(repositoryRoot, "packages/shared-schemas/src/json-schema.ts"),
      "utf8",
    ),
    mappersSource: await readFile(
      resolve(repositoryRoot, "packages/api-client/src/mappers.ts"),
      "utf8",
    ),
    miniapp: structuredClone(build.miniapp),
    miniappEntrySource: await readFile(
      resolve(repositoryRoot, "packages/api-client/src/miniapp.ts"),
      "utf8",
    ),
    miniappSource: await readFile(
      resolve(repositoryRoot, "packages/api-client/src/generated/miniapp.ts"),
      "utf8",
    ),
    rawDocument,
    schemaSourceFingerprint: build.schemaSourceFingerprint,
    sharedClientSource: await readFile(
      resolve(repositoryRoot, "packages/shared-schemas/src/client.ts"),
      "utf8",
    ),
    sharedClientReachableSources: await Promise.all(
      [
        "client-daily-content.ts",
        "client-evening-feedback.ts",
        "client-weekly-summary.ts",
        "common.ts",
        "public-transport.ts",
        "weekly-contract-common.ts",
      ].map(async (file) => [
        `packages/shared-schemas/src/${file}`,
        await readFile(
          resolve(repositoryRoot, "packages/shared-schemas/src", file),
          "utf8",
        ),
      ]),
    ),
    sharedPackage: await readJson(
      resolve(repositoryRoot, "packages/shared-schemas/package.json"),
    ),
    transportSource: await readFile(
      resolve(repositoryRoot, "packages/api-client/src/transport.ts"),
      "utf8",
    ),
  };
}
