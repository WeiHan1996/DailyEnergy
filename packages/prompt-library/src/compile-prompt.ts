import * as z from "zod";

import { jsonSchemas } from "@daily-energy/shared-schemas/json-schema";

import {
  PreparedPromptInputError,
  parsePreparedPromptInputV1,
  type PreparedPromptInputV1,
} from "./prepared-prompt-input.js";
import {
  PROMPT_RELEASE_CATALOG_V1,
  PromptPackageError,
  canonicalPromptJsonV1,
  fingerprintPromptJsonV1,
  resolvePromptPackageV1,
  type PromptPackageV1,
  type PromptWorkloadV1,
} from "./prompt-package-registry.js";

const StableVersionSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u)
  .refine((value) => value.toLowerCase() !== "latest");

export const PromptVersionBindingsV1Schema = z.strictObject({
  gateway_contract_version: StableVersionSchema,
  model_revision: StableVersionSchema,
  plan_contract_version: StableVersionSchema,
  result_version: StableVersionSchema,
  route_manifest_version: StableVersionSchema,
  rule_version: StableVersionSchema,
  safety_policy_version: StableVersionSchema,
  template_version: StableVersionSchema,
});

export type PromptVersionBindingsV1 = z.infer<
  typeof PromptVersionBindingsV1Schema
>;

export interface PromptVersionTraceV1 extends PromptVersionBindingsV1 {
  readonly contract: "prompt-version-trace-v1";
  readonly input_contract_version: string;
  readonly output_schema_fingerprint: string;
  readonly output_schema_version: string;
  readonly prompt_package_fingerprint: string;
  readonly prompt_version: string;
  readonly trace_fingerprint: string;
  readonly workload: PromptWorkloadV1;
}

export interface CompiledPromptRequestV1 {
  readonly contract: "compiled-prompt-request-v1";
  readonly developer_instruction: string;
  readonly input_json: string;
  readonly output_schema: Readonly<Record<string, unknown>>;
  readonly parameter_intent: "LOW_VARIANCE_STRUCTURED";
  readonly prompt_package_fingerprint: string;
  readonly prompt_version: string;
  readonly request_fingerprint: string;
  readonly system_instruction: string;
  readonly version_trace: PromptVersionTraceV1;
  readonly workload: PromptWorkloadV1;
}

export type CompilePromptErrorCode =
  | "PROMPT_INPUT_CONTRACT_INVALID"
  | "PROMPT_INPUT_TOO_LARGE"
  | "PROMPT_PACKAGE_FINGERPRINT_MISMATCH"
  | "PROMPT_PACKAGE_NOT_FOUND"
  | "PROMPT_VERSION_BINDING_INVALID";

export class CompilePromptError extends Error {
  public constructor(public readonly code: CompilePromptErrorCode) {
    super(code);
    this.name = "CompilePromptError";
  }
}

const OUTPUT_SCHEMAS = deepFreeze({
  DAILY_EXPRESSION_V1: structuredClone(jsonSchemas.expressionPayload),
  WEEKLY_EXPRESSION_V1: structuredClone(jsonSchemas.weeklyExpressionPayload),
});

export function compilePromptRequestV1(input: {
  readonly expectedPackageFingerprint: string;
  readonly preparedInput: unknown;
  readonly promptVersion: string;
  readonly versionBindings: unknown;
  readonly workload: PromptWorkloadV1;
}): CompiledPromptRequestV1 {
  assertExactKeys(input, [
    "expectedPackageFingerprint",
    "preparedInput",
    "promptVersion",
    "versionBindings",
    "workload",
  ]);
  let promptPackage: PromptPackageV1;
  let preparedInput: PreparedPromptInputV1;
  try {
    promptPackage = resolvePromptPackageV1({
      promptVersion: input.promptVersion,
      workload: input.workload,
    });
    preparedInput = parsePreparedPromptInputV1(
      input.preparedInput,
      input.workload,
    );
  } catch (error) {
    if (error instanceof PromptPackageError) {
      throw new CompilePromptError(error.code);
    }
    if (error instanceof PreparedPromptInputError) {
      throw new CompilePromptError("PROMPT_INPUT_CONTRACT_INVALID");
    }
    throw new CompilePromptError("PROMPT_INPUT_CONTRACT_INVALID");
  }
  if (input.expectedPackageFingerprint !== promptPackage.packageFingerprint) {
    throw new CompilePromptError("PROMPT_PACKAGE_FINGERPRINT_MISMATCH");
  }
  const bindings = PromptVersionBindingsV1Schema.safeParse(
    input.versionBindings,
  );
  if (!bindings.success) {
    throw new CompilePromptError("PROMPT_VERSION_BINDING_INVALID");
  }
  assertVersionBindings(promptPackage, bindings.data);

  const inputJson = canonicalPromptJsonV1(preparedInput);
  const outputSchema = OUTPUT_SCHEMAS[input.workload];
  const schemaJson = canonicalPromptJsonV1(outputSchema);
  assertBudgets(promptPackage, inputJson, schemaJson);
  const traceSource = {
    ...bindings.data,
    contract: "prompt-version-trace-v1" as const,
    input_contract_version: promptPackage.inputContractVersion,
    output_schema_fingerprint: promptPackage.outputSchemaFingerprint,
    output_schema_version: promptPackage.outputSchemaVersion,
    prompt_package_fingerprint: promptPackage.packageFingerprint,
    prompt_version: promptPackage.promptVersion,
    workload: promptPackage.workload,
  };
  const versionTrace = deepFreeze({
    ...traceSource,
    trace_fingerprint: fingerprintPromptJsonV1(traceSource),
  });
  const requestSource = {
    contract: "compiled-prompt-request-v1" as const,
    developer_instruction: promptPackage.canonicalWorkloadInstruction,
    input_json: inputJson,
    output_schema: outputSchema,
    parameter_intent: promptPackage.parameterIntent,
    prompt_package_fingerprint: promptPackage.packageFingerprint,
    prompt_version: promptPackage.promptVersion,
    system_instruction: promptPackage.canonicalCommonInstruction,
    version_trace: versionTrace,
    workload: promptPackage.workload,
  };
  return deepFreeze({
    ...requestSource,
    request_fingerprint: fingerprintPromptJsonV1(requestSource),
  });
}

function assertVersionBindings(
  promptPackage: PromptPackageV1,
  bindings: PromptVersionBindingsV1,
): void {
  const release = PROMPT_RELEASE_CATALOG_V1.entries[promptPackage.workload];
  if (
    !promptPackage.compatibleGatewayContractVersions.includes(
      bindings.gateway_contract_version as "expression-gateway-v1",
    ) ||
    !promptPackage.compatiblePlanContractVersions.includes(
      bindings.plan_contract_version,
    ) ||
    !promptPackage.compatibleSafetyPolicyVersions.includes(
      bindings.safety_policy_version as "safety-policy-v1",
    ) ||
    bindings.result_version !== release.resultVersion ||
    bindings.rule_version !== release.ruleVersion ||
    bindings.template_version !== release.templateVersion
  ) {
    throw new CompilePromptError("PROMPT_VERSION_BINDING_INVALID");
  }
}

function assertBudgets(
  promptPackage: PromptPackageV1,
  inputJson: string,
  schemaJson: string,
): void {
  const daily = promptPackage.workload === "DAILY_EXPRESSION_V1";
  const instructionBytes = Buffer.byteLength(
    `${promptPackage.canonicalCommonInstruction}${promptPackage.canonicalWorkloadInstruction}`,
    "utf8",
  );
  const schemaBytes = Buffer.byteLength(schemaJson, "utf8");
  const inputBytes = Buffer.byteLength(inputJson, "utf8");
  const reserveBytes = daily ? 1_024 : 2_048;
  if (
    instructionBytes > 4 * 1_024 ||
    schemaBytes > (daily ? 6 : 5) * 1_024 ||
    inputBytes > (daily ? 5 : 13) * 1_024 ||
    instructionBytes + schemaBytes + inputBytes + reserveBytes >
      (daily ? 16 : 24) * 1_024
  ) {
    throw new CompilePromptError("PROMPT_INPUT_TOO_LARGE");
  }
}

function assertExactKeys(value: unknown, keys: readonly string[]): void {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new CompilePromptError("PROMPT_INPUT_CONTRACT_INVALID");
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
