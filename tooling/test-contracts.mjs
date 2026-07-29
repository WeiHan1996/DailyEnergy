import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import {
  buildContractArtifacts,
  generatedArtifactDiagnostic,
} from "./lib/contract-codegen.mjs";
import {
  CONTRACT_RULE_IDS,
  loadContractGateState,
  runContractGates,
} from "./lib/contract-gate.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");

const buildSchemas = spawnSync(
  process.execPath,
  [
    resolve(repositoryRoot, "node_modules/typescript/bin/tsc"),
    "-p",
    resolve(repositoryRoot, "packages/shared-schemas/tsconfig.json"),
  ],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
  },
);
if (buildSchemas.status !== 0) {
  process.stderr.write(
    `${buildSchemas.stdout ?? ""}${buildSchemas.stderr ?? ""}`,
  );
  throw new Error("CONTRACT_FIXTURE_SCHEMA_BUILD_FAILED");
}

const firstBuild = await buildContractArtifacts(repositoryRoot);
const secondBuild = await buildContractArtifacts(repositoryRoot);
assert.deepEqual(
  [...firstBuild.artifacts],
  [...secondBuild.artifacts],
  "same inputs must generate byte-identical artifacts",
);

const knownPass = await loadContractGateState(repositoryRoot, firstBuild);
assert.deepEqual(
  runContractGates(knownPass),
  [],
  "repository contract must be a known-pass fixture",
);

function firstTwoOperations(document) {
  const operations = [];
  for (const pathItem of Object.values(document.paths)) {
    for (const method of [
      "delete",
      "get",
      "head",
      "options",
      "patch",
      "post",
      "put",
    ]) {
      if (pathItem[method]) {
        operations.push(pathItem[method]);
      }
    }
  }
  return operations.slice(0, 2);
}

function appendTypeScriptSource(state, path, addition) {
  const source = state.apiClientSources.find(
    (candidate) => candidate.path === path,
  );
  assert.ok(source, `fixture source must exist: ${path}`);
  source.source += addition;
}

const cases = [
  {
    mutate(state) {
      state.document = {};
    },
    ruleId: "CONTRACT_OPENAPI_DOCUMENT_INVALID",
  },
  {
    mutate(state) {
      const [first, second] = firstTwoOperations(state.document);
      second.operationId = first.operationId;
    },
    ruleId: "CONTRACT_OPENAPI_OPERATION_ID_DUPLICATE",
  },
  {
    mutate(state) {
      state.miniapp.paths["/admin/leak"] = {
        get: {
          operationId: "adminLeak",
          responses: {},
        },
      };
    },
    ruleId: "CONTRACT_OPENAPI_AUDIENCE_MIXED",
  },
  {
    mutate(state) {
      state.document.components.schemas.ApiErrorBody.required = ["ok"];
    },
    ruleId: "CONTRACT_OPENAPI_ERROR_ENVELOPE_INVALID",
  },
  {
    mutate(state) {
      state.document.components.schemas.ApiError.properties.stack = {
        type: "string",
      };
    },
    ruleId: "CONTRACT_OPENAPI_ERROR_ENVELOPE_INVALID",
  },
  {
    mutate(state) {
      state.document.components.schemas.ApiError.properties.code.enum.push(
        "UNKNOWN_INTERNAL_ERROR",
      );
    },
    ruleId: "CONTRACT_OPENAPI_ERROR_ENVELOPE_INVALID",
  },
  {
    mutate(state) {
      const [operation] = firstTwoOperations(state.document);
      operation.responses["418"] = {
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiErrorBody" },
          },
        },
        description: "unknown",
      };
    },
    ruleId: "CONTRACT_OPENAPI_ERROR_STATUS_UNKNOWN",
  },
  {
    mutate(state) {
      state.rawDocument.components.schemas.OpaqueRef.type = "string";
    },
    ruleId: "CONTRACT_OPENAPI_SOURCE_SCHEMA_DRIFT",
  },
  {
    mutate(state) {
      state.rawDocument.components.schemas.EveningSaveRequest[
        "x-source-mapper"
      ] = "missingMapper";
    },
    ruleId: "CONTRACT_SOURCE_MAPPER_MISSING",
  },
  {
    mutate(state) {
      appendTypeScriptSource(
        state,
        "packages/api-client/src/generated/miniapp.ts",
        "\ninterface Leak {\n  provider_payload?: string;\n}\n",
      );
    },
    ruleId: "CONTRACT_CLIENT_FORBIDDEN_FIELD",
  },
  {
    mutate(state) {
      state.miniapp.components.schemas.ApiSuccessSession.properties.provider_payload =
        {
          type: "string",
        };
    },
    ruleId: "CONTRACT_CLIENT_FORBIDDEN_FIELD",
  },
  {
    mutate(state) {
      appendTypeScriptSource(
        state,
        "packages/api-client/src/miniapp.ts",
        '\nimport "node:fs";\n',
      );
    },
    ruleId: "CONTRACT_CLIENT_FORBIDDEN_IMPORT",
  },
  {
    mutate(state) {
      appendTypeScriptSource(
        state,
        "packages/api-client/src/miniapp.ts",
        '\nimport type { operations } from "./generated/admin.js";\n',
      );
    },
    ruleId: "CONTRACT_CLIENT_FORBIDDEN_IMPORT",
  },
  {
    mutate(state) {
      state.apiClientPackage.exports["."] = "./dist/index.js";
    },
    ruleId: "CONTRACT_PACKAGE_EXPORTS_INVALID",
  },
  {
    mutate(state) {
      state.apiErrorSource = state.apiErrorSource.replace(
        'FEATURE_DISABLED: {\n    category: "GUARD"',
        'FEATURE_DISABLED: {\n    category: "AUTH"',
      );
    },
    ruleId: "CONTRACT_API_ERROR_CATALOG_DRIFT",
  },
  {
    mutate(state) {
      state.adminSource = state.adminSource.replace(
        "// @generated",
        "// generated",
      );
    },
    ruleId: "CONTRACT_GENERATED_PROVENANCE_INVALID",
  },
];

const covered = new Set();
for (const testCase of cases) {
  const state = structuredClone(knownPass);
  testCase.mutate(state);
  const diagnostics = runContractGates(state);
  assert.ok(
    diagnostics.some(({ ruleId }) => ruleId === testCase.ruleId),
    `known-fail mutation must produce ${testCase.ruleId}`,
  );
  covered.add(testCase.ruleId);
}

const [generatedPath, generatedContent] = firstBuild.artifacts
  .entries()
  .next().value;
const generatedCases = [
  {
    actual: undefined,
    ruleId: "CONTRACT_GENERATED_FILE_MISSING",
  },
  {
    actual: generatedContent.replace(
      /sha256:[a-f0-9]{64}/u,
      `sha256:${"0".repeat(64)}`,
    ),
    ruleId: "CONTRACT_GENERATED_FINGERPRINT_DRIFT",
  },
  {
    actual: `${generatedContent}\n// manual edit\n`,
    ruleId: "CONTRACT_GENERATED_CONTENT_DRIFT",
  },
];
for (const testCase of generatedCases) {
  const diagnostic = generatedArtifactDiagnostic(
    generatedPath,
    testCase.actual,
    generatedContent,
  );
  assert.equal(diagnostic?.ruleId, testCase.ruleId);
  covered.add(testCase.ruleId);
}
assert.equal(
  generatedArtifactDiagnostic(
    generatedPath,
    generatedContent,
    generatedContent,
  ),
  undefined,
);
const generatedOpenApi = firstBuild.artifacts.get(
  "openapi/openapi.generated.json",
);
assert.ok(generatedOpenApi);
assert.equal(
  generatedArtifactDiagnostic(
    "openapi/openapi.generated.json",
    generatedOpenApi.replace(
      /sha256:[a-f0-9]{64}/u,
      `sha256:${"0".repeat(64)}`,
    ),
    generatedOpenApi,
  )?.ruleId,
  "CONTRACT_GENERATED_FINGERPRINT_DRIFT",
);

assert.deepEqual(
  [...covered].sort(),
  [...CONTRACT_RULE_IDS].sort(),
  "every static contract rule must have one minimal known-fail fixture",
);

console.log(
  `Contract fixture Gate passed one known-pass corpus, ${covered.size} stable known-fail rules, and deterministic repeat generation.`,
);
