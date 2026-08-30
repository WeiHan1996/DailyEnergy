import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import * as z from "zod";
import { format } from "prettier";
import { parse } from "yaml";

export const CONTRACT_GENERATOR = "daily-energy-contract-codegen/1.0.0";

const HTTP_METHODS = [
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
];

const SCHEMA_EXPORTS = [
  [
    "generationInputSnapshot",
    "GenerationInputSnapshotSchema",
    "generation-input-snapshot",
  ],
  ["ruleFacts", "RuleFactsSchema", "rule-facts"],
  ["expressionPayload", "ExpressionPayloadSchema", "expression-payload"],
  [
    "publishedDailyResult",
    "PublishedDailyResultSchema",
    "published-daily-result",
  ],
  [
    "clientDailyContentView",
    "ClientDailyContentViewSchema",
    "client-daily-content-view",
  ],
  [
    "dailyInteractionState",
    "DailyInteractionStateSchema",
    "daily-interaction-state",
  ],
  [
    "eveningFeedbackDraft",
    "EveningFeedbackDraftSchema",
    "evening-feedback-draft",
  ],
  [
    "eveningReflectionSubmission",
    "EveningReflectionSubmissionSchema",
    "evening-reflection-submission",
  ],
  [
    "eveningFeedbackRecord",
    "EveningFeedbackRecordSchema",
    "evening-feedback-record",
  ],
  [
    "eveningFeedbackRevision",
    "EveningFeedbackRevisionSchema",
    "evening-feedback-revision",
  ],
  [
    "dailyHelpfulnessRecord",
    "DailyHelpfulnessRecordSchema",
    "daily-helpfulness-record",
  ],
  ["dailyTaskState", "DailyTaskStateSchema", "daily-task-state"],
  [
    "clientEveningFeedbackView",
    "ClientEveningFeedbackViewSchema",
    "client-evening-feedback-view",
  ],
  [
    "weeklySourceSnapshot",
    "WeeklySourceSnapshotSchema",
    "weekly-source-snapshot",
  ],
  [
    "weeklyAggregateFacts",
    "WeeklyAggregateFactsSchema",
    "weekly-aggregate-facts",
  ],
  [
    "weeklyExpressionPlan",
    "WeeklyExpressionPlanSchema",
    "weekly-expression-plan",
  ],
  [
    "weeklyExpressionPayload",
    "WeeklyExpressionPayloadSchema",
    "weekly-expression-payload",
  ],
  [
    "publishedWeeklySummary",
    "PublishedWeeklySummarySchema",
    "published-weekly-summary",
  ],
  [
    "clientWeeklySummaryView",
    "ClientWeeklySummaryViewSchema",
    "client-weekly-summary-view",
  ],
  [
    "wechatSessionRequest",
    "WechatSessionRequestSchema",
    "wechat-session-request",
  ],
  [
    "checkinSubmitRequest",
    "CheckinSubmitRequestSchema",
    "checkin-submit-request",
  ],
  [
    "checkinCorrectRequest",
    "CheckinCorrectRequestSchema",
    "checkin-correct-request",
  ],
  ["checkinView", "CheckinViewSchema", "checkin-view"],
  [
    "generationStartRequest",
    "GenerationStartRequestSchema",
    "generation-start-request",
  ],
  [
    "taskStateUpdateRequest",
    "TaskStateUpdateRequestSchema",
    "task-state-update-request",
  ],
  [
    "generationIntentView",
    "GenerationIntentViewSchema",
    "generation-intent-view",
  ],
  ["relationshipView", "RelationshipViewSchema", "relationship-view"],
  ["todayView", "TodayViewSchema", "today-view"],
  ["historyDayView", "HistoryDayViewSchema", "history-day-view"],
  ["reauthVerifyRequest", "ReauthVerifyRequestSchema", "reauth-verify-request"],
  ["exportRequest", "ExportRequestSchema", "export-request"],
  ["deleteDayRequest", "DeleteDayRequestSchema", "delete-day-request"],
  ["deleteMatterRequest", "DeleteMatterRequestSchema", "delete-matter-request"],
  ["dayExpectedRevision", "DayExpectedRevisionSchema", "day-expected-revision"],
  [
    "relationshipDeletionTarget",
    "RelationshipDeletionTargetSchema",
    "relationship-deletion-target",
  ],
  [
    "deleteRelationshipPrepareRequest",
    "DeleteRelationshipPrepareRequestSchema",
    "delete-relationship-prepare-request",
  ],
  [
    "deleteRelationshipConfirmRequest",
    "DeleteRelationshipConfirmRequestSchema",
    "delete-relationship-confirm-request",
  ],
  [
    "deleteAccountPrepareRequest",
    "DeleteAccountPrepareRequestSchema",
    "delete-account-prepare-request",
  ],
  [
    "deleteAccountConfirmRequest",
    "DeleteAccountConfirmRequestSchema",
    "delete-account-confirm-request",
  ],
  [
    "dataTaskCancelRequest",
    "DataTaskCancelRequestSchema",
    "data-task-cancel-request",
  ],
  ["dataTaskView", "DataTaskViewSchema", "data-task-view"],
  ["dataTaskListView", "DataTaskListViewSchema", "data-task-list-view"],
  [
    "dataRightsSummaryView",
    "DataRightsSummaryViewSchema",
    "data-rights-summary-view",
  ],
  ["exportArtifactView", "ExportArtifactViewSchema", "export-artifact-view"],
  [
    "deletionStatusGrantView",
    "DeletionStatusGrantViewSchema",
    "deletion-status-grant-view",
  ],
  [
    "accountDeletionAcceptedView",
    "AccountDeletionAcceptedViewSchema",
    "account-deletion-accepted-view",
  ],
  ["dataExportDocument", "DataExportDocumentSchema", "data-export-document"],
  [
    "deletionConfirmationView",
    "DeletionConfirmationViewSchema",
    "deletion-confirmation-view",
  ],
  [
    "identityVerificationView",
    "IdentityVerificationViewSchema",
    "identity-verification-view",
  ],
];

const SCHEMA_SOURCE_PATHS = [
  "packages/shared-schemas/src/client.ts",
  "packages/shared-schemas/src/client-daily-content.ts",
  "packages/shared-schemas/src/client-evening-feedback.ts",
  "packages/shared-schemas/src/client-history.ts",
  "packages/shared-schemas/src/client-weekly-summary.ts",
  "packages/shared-schemas/src/common.ts",
  "packages/shared-schemas/src/daily-content.ts",
  "packages/shared-schemas/src/evening-feedback.ts",
  "packages/shared-schemas/src/index.ts",
  "packages/shared-schemas/src/public-transport.ts",
  "packages/shared-schemas/src/weekly-contract-common.ts",
  "packages/shared-schemas/src/weekly-summary.ts",
  "tooling/lib/contract-codegen.mjs",
];

const ERROR_CATEGORIES = new Set([
  "AUTH",
  "GUARD",
  "VALIDATION",
  "CONFLICT",
  "NOT_FOUND",
  "RATE_LIMIT",
  "TRANSIENT",
  "TERMINAL",
  "SAFETY",
]);

const DEFAULT_ERROR_STATUS = {
  AUTH: 401,
  CONFLICT: 409,
  GUARD: 403,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  SAFETY: 409,
  TERMINAL: 422,
  TRANSIENT: 503,
  VALIDATION: 400,
};

const ERROR_STATUS_OVERRIDES = {
  INTERNAL_TERMINAL: 500,
};

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

export function stableJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function generatedArtifactDiagnostic(relativePath, actual, expected) {
  if (actual === undefined) {
    return {
      message: "generated artifact is missing",
      path: relativePath,
      ruleId: "CONTRACT_GENERATED_FILE_MISSING",
    };
  }
  if (actual === expected) {
    return undefined;
  }
  const fingerprintPattern =
    /source-fingerprint(?:"\s*:\s*"|:\s*)(sha256:[a-f0-9]{64})/u;
  const actualFingerprint = fingerprintPattern.exec(actual)?.[1];
  const expectedFingerprint = fingerprintPattern.exec(expected)?.[1];
  return {
    message:
      actualFingerprint !== undefined &&
      expectedFingerprint !== undefined &&
      actualFingerprint !== expectedFingerprint
        ? "generated source fingerprint is stale"
        : "generated content was edited or is stale",
    path: relativePath,
    ruleId:
      actualFingerprint !== undefined &&
      expectedFingerprint !== undefined &&
      actualFingerprint !== expectedFingerprint
        ? "CONTRACT_GENERATED_FINGERPRINT_DRIFT"
        : "CONTRACT_GENERATED_CONTENT_DRIFT",
  };
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\||\|$/gu, "")
    .split("|")
    .map((cell) => cell.trim());
}

function codesFromCell(cell) {
  return [...cell.matchAll(/`([A-Z][A-Z0-9_]*)`/gu)].map((match) => match[1]);
}

export function parseErrorContract(markdown) {
  const lines = markdown.split(/\r?\n/gu);
  const explicitStatuses = new Map();
  const entries = [];
  let section = "";

  for (const line of lines) {
    if (line.startsWith("## ")) {
      section = line;
      continue;
    }
    if (!line.startsWith("|")) {
      continue;
    }
    const cells = tableCells(line);
    if (section.startsWith("## 4.") && /^\d{3}$/u.test(cells[0] ?? "")) {
      for (const code of codesFromCell(cells[1] ?? "")) {
        explicitStatuses.set(code, Number(cells[0]));
      }
      continue;
    }
    if (
      !section.startsWith("## 5.") ||
      !/^`[A-Z][A-Z0-9_]*`$/u.test(cells[0] ?? "")
    ) {
      continue;
    }
    const code = cells[0].slice(1, -1);
    const category = cells[1];
    const retryable = cells[2];
    if (!ERROR_CATEGORIES.has(category) || !["yes", "no"].includes(retryable)) {
      throw new Error(`ERROR_CONTRACT_ROW_INVALID:${code}`);
    }
    entries.push({
      category,
      code,
      retryable: retryable === "yes",
      status:
        explicitStatuses.get(code) ??
        ERROR_STATUS_OVERRIDES[code] ??
        DEFAULT_ERROR_STATUS[category],
    });
  }

  const codes = entries.map((entry) => entry.code);
  if (entries.length === 0 || new Set(codes).size !== entries.length) {
    throw new Error("ERROR_CONTRACT_CATALOG_INVALID");
  }
  return entries.sort((left, right) => left.code.localeCompare(right.code));
}

function jsonSchemaId(token) {
  return `urn:dailyenergy:schema:${token}:1.0.0`;
}

function schemaFromNamespace(namespace, schemaName) {
  const schema = namespace[schemaName];
  if (schema === undefined || typeof schema.safeParse !== "function") {
    throw new Error(`SCHEMA_EXPORT_MISSING:${schemaName}`);
  }
  return schema;
}

function jsonSchemaFor(schema, id) {
  return canonicalize({
    ...z.toJSONSchema(schema, {
      io: "input",
      target: "draft-2020-12",
      unrepresentable: "any",
    }),
    $id: id,
  });
}

function openApiSchemaFor(schema) {
  const projected = z.toJSONSchema(schema, {
    io: "input",
    target: "openapi-3.0",
    unrepresentable: "any",
  });
  delete projected.$schema;
  delete projected.$id;
  return canonicalize(projected);
}

function generatedHeader(fingerprint) {
  return [
    "// @generated",
    `// generator: ${CONTRACT_GENERATOR}`,
    `// source-fingerprint: ${fingerprint}`,
    "// do not edit; run `pnpm codegen`.",
  ].join("\n");
}

function renderJsonSchemaModule(ids, schemas, fingerprint) {
  return `${generatedHeader(fingerprint)}

export const JSON_SCHEMA_SOURCE_FINGERPRINT = ${JSON.stringify(fingerprint)};

export const JSON_SCHEMA_IDS = ${JSON.stringify(ids, null, 2)} as const;

export const jsonSchemas = ${JSON.stringify(schemas, null, 2)} as const;

export type JsonSchemaName = keyof typeof jsonSchemas;
`;
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
      throw new Error(`OPENAPI_REF_CYCLE:${current.$ref}`);
    }
    visited.add(current.$ref);
    const parts = localRefParts(current.$ref);
    if (!parts) {
      throw new Error(`OPENAPI_EXTERNAL_REF:${current.$ref}`);
    }
    current = document.components?.[parts.group]?.[parts.name];
    if (current === undefined) {
      throw new Error(`OPENAPI_REF_MISSING:${parts.group}/${parts.name}`);
    }
  }
  return current;
}

function applyZodProjections(document, schemaNamespace) {
  const schemas = document.components?.schemas ?? {};
  for (const [name, schema] of Object.entries(schemas)) {
    const sourceContract = schema?.["x-source-contract"];
    if (typeof sourceContract !== "string") {
      continue;
    }
    if (typeof schema["x-source-mapper"] === "string") {
      continue;
    }
    const projection = openApiSchemaFor(
      schemaFromNamespace(schemaNamespace, sourceContract),
    );
    schemas[name] = {
      ...projection,
      "x-source-contract": sourceContract,
      "x-source-projection": "zod-openapi-3.0",
    };
  }
}

function injectErrorContract(document, errorContract) {
  const apiError = document.components?.schemas?.ApiError;
  if (!apiError?.properties?.code) {
    throw new Error("OPENAPI_API_ERROR_SCHEMA_MISSING");
  }
  apiError.properties.code = {
    enum: errorContract.map((entry) => entry.code),
    type: "string",
    "x-source-contract": "docs/technical/error-codes.md",
  };
}

function operationEntries(document) {
  const entries = [];
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation) {
        continue;
      }
      entries.push({ method, operation, path, pathItem });
    }
  }
  return entries.sort((left, right) =>
    left.operation.operationId.localeCompare(right.operation.operationId),
  );
}

function collectComponentRefs(value, refs) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectComponentRefs(item, refs);
    }
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  if (typeof value.$ref === "string") {
    const parts = localRefParts(value.$ref);
    if (parts) {
      refs.add(`${parts.group}/${parts.name}`);
    }
  }
  for (const entry of Object.values(value)) {
    collectComponentRefs(entry, refs);
  }
}

function audienceDocument(document, audience) {
  const selectedPaths = Object.fromEntries(
    Object.entries(document.paths ?? {}).filter(([path]) =>
      audience === "admin"
        ? path.startsWith("/admin/")
        : !path.startsWith("/admin/"),
    ),
  );
  const result = {
    ...structuredClone(document),
    paths: structuredClone(selectedPaths),
  };
  const refs = new Set();
  collectComponentRefs(result.paths, refs);

  let changed = true;
  while (changed) {
    changed = false;
    for (const key of [...refs]) {
      const [group, name] = key.split("/");
      const component = document.components?.[group]?.[name];
      if (component === undefined) {
        throw new Error(`OPENAPI_REF_MISSING:${key}`);
      }
      const before = refs.size;
      collectComponentRefs(component, refs);
      changed ||= refs.size !== before;
    }
  }

  const components = {};
  for (const key of [...refs].sort()) {
    const [group, name] = key.split("/");
    components[group] ??= {};
    components[group][name] = structuredClone(document.components[group][name]);
  }

  const usedSecurity = new Set();
  for (const security of [
    ...(document.security ?? []),
    ...operationEntries(result).flatMap(
      ({ operation }) => operation.security ?? [],
    ),
  ]) {
    for (const name of Object.keys(security)) {
      usedSecurity.add(name);
    }
  }
  for (const name of [...usedSecurity].sort()) {
    const securityScheme = document.components?.securitySchemes?.[name];
    if (securityScheme === undefined) {
      throw new Error(`OPENAPI_SECURITY_SCHEME_MISSING:${name}`);
    }
    components.securitySchemes ??= {};
    components.securitySchemes[name] = structuredClone(securityScheme);
  }

  result.components = components;
  const usedTags = new Set(
    operationEntries(result).flatMap(({ operation }) => operation.tags ?? []),
  );
  result.tags = (document.tags ?? []).filter((tag) => usedTags.has(tag.name));
  return canonicalize(result);
}

function literalType(value) {
  if (value === null) {
    return "null";
  }
  return JSON.stringify(value);
}

function union(types) {
  const unique = [...new Set(types.filter(Boolean))];
  return unique.length === 0
    ? "unknown"
    : unique.length === 1
      ? unique[0]
      : unique.map((type) => `(${type})`).join(" | ");
}

function intersection(types) {
  const unique = [...new Set(types.filter(Boolean))];
  return unique.length === 0
    ? "unknown"
    : unique.length === 1
      ? unique[0]
      : unique.map((type) => `(${type})`).join(" & ");
}

function indent(value, spaces) {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

export function schemaToTypeScript(schema, depth = 0) {
  if (schema === true) {
    return "unknown";
  }
  if (schema === false) {
    return "never";
  }
  if (schema === null || typeof schema !== "object") {
    return "unknown";
  }
  if (typeof schema.$ref === "string") {
    const parts = localRefParts(schema.$ref);
    return parts?.group === "schemas"
      ? `components["schemas"][${JSON.stringify(parts.name)}]`
      : "unknown";
  }
  if (Object.hasOwn(schema, "const")) {
    return literalType(schema.const);
  }
  if (Array.isArray(schema.enum)) {
    return union(schema.enum.map(literalType));
  }
  if (Array.isArray(schema.oneOf)) {
    return union(schema.oneOf.map((entry) => schemaToTypeScript(entry, depth)));
  }
  if (Array.isArray(schema.anyOf)) {
    return union(schema.anyOf.map((entry) => schemaToTypeScript(entry, depth)));
  }
  if (Array.isArray(schema.allOf)) {
    return intersection(
      schema.allOf.map((entry) => schemaToTypeScript(entry, depth)),
    );
  }

  let result;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.length > 1) {
    result = union(
      types.map((type) => schemaToTypeScript({ ...schema, type }, depth)),
    );
  } else {
    switch (schema.type) {
      case "array": {
        const item = schemaToTypeScript(schema.items ?? true, depth);
        result = `Array<${item}>`;
        break;
      }
      case "boolean":
        result = "boolean";
        break;
      case "integer":
      case "number":
        result = "number";
        break;
      case "null":
        result = "null";
        break;
      case "object":
      default: {
        if (
          schema.type !== "object" &&
          schema.properties === undefined &&
          schema.additionalProperties === undefined
        ) {
          result = "unknown";
          break;
        }
        const required = new Set(schema.required ?? []);
        const members = [];
        for (const [name, property] of Object.entries(
          schema.properties ?? {},
        ).sort(([left], [right]) => left.localeCompare(right))) {
          const propertyType = schemaToTypeScript(property, depth + 1);
          members.push(
            `${JSON.stringify(name)}${required.has(name) ? "" : "?"}: ${propertyType};`,
          );
        }
        if (
          schema.additionalProperties === true ||
          (schema.additionalProperties &&
            typeof schema.additionalProperties === "object")
        ) {
          const additional =
            schema.additionalProperties === true
              ? "unknown"
              : schemaToTypeScript(schema.additionalProperties, depth + 1);
          members.push(`[key: string]: ${additional};`);
        }
        result =
          members.length === 0
            ? "Record<string, never>"
            : `{\n${indent(members.join("\n"), (depth + 1) * 2)}\n${" ".repeat(depth * 2)}}`;
        break;
      }
      case "string":
        result = "string";
        break;
    }
  }
  return schema.nullable === true ? union([result, "null"]) : result;
}

function renderParameters(document, pathItem, operation) {
  const parameters = [
    ...(pathItem.parameters ?? []),
    ...(operation.parameters ?? []),
  ].map((parameter) => resolveLocalRef(document, parameter));
  const groups = new Map();
  for (const parameter of parameters) {
    const group = parameter.in;
    if (!["cookie", "header", "path", "query"].includes(group)) {
      continue;
    }
    const entries = groups.get(group) ?? [];
    entries.push(parameter);
    groups.set(group, entries);
  }
  if (groups.size === 0) {
    return {
      required: false,
      type: "Record<string, never>",
    };
  }
  const rendered = [];
  for (const [group, entries] of [...groups].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const groupRequired = entries.some(
      (parameter) => parameter.required === true,
    );
    const fields = entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(
        (parameter) =>
          `${JSON.stringify(parameter.name)}${parameter.required ? "" : "?"}: ${schemaToTypeScript(parameter.schema ?? true, 3)};`,
      );
    rendered.push(
      `${JSON.stringify(group)}${groupRequired ? "" : "?"}: {\n${indent(fields.join("\n"), 6)}\n    };`,
    );
  }
  return {
    required: parameters.some((parameter) => parameter.required === true),
    type: `{\n${indent(rendered.join("\n"), 4)}\n  }`,
  };
}

function renderContent(content, depth) {
  const entries = Object.entries(content ?? {}).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (entries.length === 0) {
    return "Record<string, never>";
  }
  const fields = entries.map(
    ([mediaType, media]) =>
      `${JSON.stringify(mediaType)}: ${schemaToTypeScript(media.schema ?? true, depth + 1)};`,
  );
  return `{\n${indent(fields.join("\n"), (depth + 1) * 2)}\n${" ".repeat(depth * 2)}}`;
}

function renderOperation(document, pathItem, operation) {
  const parameters = renderParameters(document, pathItem, operation);
  const requestBody =
    operation.requestBody === undefined
      ? undefined
      : resolveLocalRef(document, operation.requestBody);
  const responses = [];
  for (const [status, rawResponse] of Object.entries(
    operation.responses ?? {},
  ).sort(([left], [right]) => left.localeCompare(right))) {
    const response = resolveLocalRef(document, rawResponse);
    responses.push(
      `${JSON.stringify(status)}: {\n      content: ${renderContent(response.content, 3)};\n    };`,
    );
  }
  return `{
    parameters${parameters.required ? "" : "?"}: ${parameters.type};
    ${
      requestBody === undefined
        ? ""
        : `requestBody${requestBody.required ? "" : "?"}: {
      content: ${renderContent(requestBody.content, 3)};
    };`
    }
    responses: {
${indent(responses.join("\n"), 6)}
    };
  }`;
}

function renderComponents(document) {
  const schemas = Object.entries(document.components?.schemas ?? {}).sort(
    ([left], [right]) => left.localeCompare(right),
  );
  const fields = schemas.map(
    ([name, schema]) =>
      `${JSON.stringify(name)}: ${schemaToTypeScript(schema, 2)};`,
  );
  return `export interface components {
  schemas: {
${indent(fields.join("\n"), 4)}
  };
}`;
}

function renderOperations(document) {
  const fields = operationEntries(document).map(
    ({ operation, pathItem }) =>
      `${JSON.stringify(operation.operationId)}: ${renderOperation(
        document,
        pathItem,
        operation,
      )};`,
  );
  return `export interface operations {
${indent(fields.join("\n"), 2)}
}`;
}

function renderPaths(document) {
  const paths = [];
  for (const [path, pathItem] of Object.entries(document.paths ?? {}).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const methods = HTTP_METHODS.flatMap((method) => {
      const operation = pathItem?.[method];
      return operation
        ? [
            `${JSON.stringify(method)}: operations[${JSON.stringify(
              operation.operationId,
            )}];`,
          ]
        : [];
    });
    paths.push(
      `${JSON.stringify(path)}: {\n${indent(methods.join("\n"), 4)}\n  };`,
    );
  }
  return `export interface paths {
${indent(paths.join("\n"), 2)}
}`;
}

function apiBasePath(document) {
  const server = document.servers?.[0]?.url;
  if (typeof server !== "string") {
    return "";
  }
  try {
    const path = new URL(server).pathname.replace(/\/$/u, "");
    return path === "/" ? "" : path;
  } catch {
    throw new Error("OPENAPI_SERVER_URL_INVALID");
  }
}

function renderOperationManifest(document, audience) {
  const name = audience.toUpperCase();
  const basePath = apiBasePath(document);
  const entries = operationEntries(document).map(
    ({ method, operation, path }) =>
      `  ${JSON.stringify(operation.operationId)}: { method: ${JSON.stringify(
        method.toUpperCase(),
      )}, path: ${JSON.stringify(`${basePath}${path}`)} },`,
  );
  return `export const ${name}_OPERATIONS = {
${entries.join("\n")}
} as const;
`;
}

function renderClientTypes(document, audience, fingerprint) {
  const name = audience.toUpperCase();
  return `${generatedHeader(fingerprint)}

export const ${name}_CONTRACT_SOURCE_FINGERPRINT = ${JSON.stringify(
    fingerprint,
  )};

${renderPaths(document)}

${renderComponents(document)}

${renderOperations(document)}

${renderOperationManifest(document, audience)}`;
}

async function schemaNamespace(repositoryRoot) {
  const path = resolve(repositoryRoot, "packages/shared-schemas/dist/index.js");
  return import(`${pathToFileURL(path).href}?codegen=1`);
}

async function sourceFingerprint(repositoryRoot) {
  const sources = [];
  for (const path of SCHEMA_SOURCE_PATHS) {
    sources.push(
      `${path}\n${await readFile(resolve(repositoryRoot, path), "utf8")}`,
    );
  }
  const toolVersions = [];
  for (const packageName of ["prettier", "yaml", "zod"]) {
    const manifest = JSON.parse(
      await readFile(
        resolve(repositoryRoot, "node_modules", packageName, "package.json"),
        "utf8",
      ),
    );
    toolVersions.push(`${packageName}=${manifest.version}`);
  }
  return sha256(
    `${CONTRACT_GENERATOR}\n${toolVersions.join("\n")}\n${sources.join("\n")}`,
  );
}

export async function buildContractArtifacts(repositoryRoot) {
  const openApiSource = await readFile(
    resolve(repositoryRoot, "openapi/openapi.yaml"),
    "utf8",
  );
  const errorSource = await readFile(
    resolve(repositoryRoot, "docs/technical/error-codes.md"),
    "utf8",
  );
  const namespace = await schemaNamespace(repositoryRoot);
  const schemaSourceFingerprint = await sourceFingerprint(repositoryRoot);
  const ids = {};
  const schemas = {};
  for (const [key, schemaName, token] of SCHEMA_EXPORTS) {
    const id = jsonSchemaId(token);
    ids[key] = id;
    schemas[key] = jsonSchemaFor(
      schemaFromNamespace(namespace, schemaName),
      id,
    );
  }

  const errorContract = parseErrorContract(errorSource);
  const document = parse(openApiSource);
  if (!document || typeof document !== "object") {
    throw new Error("OPENAPI_DOCUMENT_INVALID");
  }
  applyZodProjections(document, namespace);
  injectErrorContract(document, errorContract);

  const contractSourceFingerprint = sha256(
    [
      CONTRACT_GENERATOR,
      schemaSourceFingerprint,
      openApiSource,
      stableJson(errorContract),
    ].join("\n"),
  );
  document["x-generated"] = {
    "do-not-edit": true,
    generator: CONTRACT_GENERATOR,
    "source-fingerprint": contractSourceFingerprint,
  };

  const miniapp = audienceDocument(document, "miniapp");
  const admin = audienceDocument(document, "admin");
  const artifacts = new Map([
    [
      "packages/shared-schemas/src/json-schema.ts",
      await format(
        renderJsonSchemaModule(ids, schemas, schemaSourceFingerprint),
        { parser: "typescript" },
      ),
    ],
    ["openapi/openapi.generated.json", stableJson(document)],
    [
      "packages/api-client/src/generated/miniapp.ts",
      await format(
        renderClientTypes(miniapp, "miniapp", contractSourceFingerprint),
        { parser: "typescript" },
      ),
    ],
    [
      "packages/api-client/src/generated/admin.ts",
      await format(
        renderClientTypes(admin, "admin", contractSourceFingerprint),
        { parser: "typescript" },
      ),
    ],
  ]);

  return {
    admin,
    artifacts,
    contractSourceFingerprint,
    document: canonicalize(document),
    errorContract,
    miniapp,
    schemaSourceFingerprint,
  };
}
