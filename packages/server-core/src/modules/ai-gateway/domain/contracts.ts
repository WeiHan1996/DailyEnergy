import { createHash } from "node:crypto";

export const GATEWAY_CONTRACT_VERSION = "expression-gateway-v1";
export const GATEWAY_POLICY_VERSION = "gateway-policy-v1";

export const GATEWAY_WORKLOADS = [
  "DAILY_EXPRESSION_V1",
  "WEEKLY_EXPRESSION_V1",
] as const;
export const GATEWAY_RUNTIME_PROFILES = [
  "INTERACTIVE",
  "BACKGROUND",
  "EVALUATION",
] as const;
export const GATEWAY_PROVIDER_ROLES = ["PRIMARY_AI", "BACKUP_AI"] as const;
export const GATEWAY_ROUTE_ROLES = [
  ...GATEWAY_PROVIDER_ROLES,
  "CONTROLLED_TEMPLATE",
] as const;

export type GatewayWorkload = (typeof GATEWAY_WORKLOADS)[number];
export type GatewayRuntimeProfile = (typeof GATEWAY_RUNTIME_PROFILES)[number];
export type GatewayProviderRole = (typeof GATEWAY_PROVIDER_ROLES)[number];
export type GatewayRouteRole = (typeof GATEWAY_ROUTE_ROLES)[number];

export type GatewayJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly GatewayJsonValue[]
  | { readonly [key: string]: GatewayJsonValue };
export type GatewayJsonObject = Readonly<Record<string, GatewayJsonValue>>;

export interface GatewayProviderRouteV1 {
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly capabilityProfileId: string;
  readonly connectDeadlineMs: number;
  readonly dataHandlingProfileId: string;
  readonly egressTarget: string;
  readonly endpointId: string;
  readonly endpointRegion: string;
  readonly immutableModelRevision?: string;
  readonly maxOutputTokens: number;
  readonly modelId: string;
  readonly priceEntryId: string;
  readonly providerAccountRef: string;
  readonly providerId: string;
  readonly providerParameterSetId: string;
  readonly requestDeadlineMs: number;
  readonly role: GatewayProviderRole;
}

export interface GatewayTemplateRouteV1 {
  readonly localeCatalogVersion: string;
  readonly maxExecutionMs: number;
  readonly minimumReserveMs: number;
  readonly rendererId: string;
  readonly rendererVersion: string;
  readonly templateCompatibilityVersion: string;
}

export interface GatewayRouteManifestV1 {
  readonly backup: GatewayProviderRouteV1;
  readonly compatibleOutputSchemaVersions: readonly string[];
  readonly compatiblePromptVersions: readonly string[];
  readonly compatibleSafetyPolicyVersions: readonly string[];
  readonly fingerprint: string;
  readonly gatewayPolicyVersion: typeof GATEWAY_POLICY_VERSION;
  readonly inputLimits: {
    readonly preparedModelInputBytes: number;
    readonly providerResponseBytes: number;
  };
  readonly invocationCostLimitMicrounits: number;
  readonly manifestVersion: string;
  readonly outputLimits: { readonly maxOutputTokens: number };
  readonly priceCatalogVersion: string;
  readonly primary: GatewayProviderRouteV1;
  readonly status: "STAGED" | "ACTIVE" | "DISABLED" | "RETIRED";
  readonly template: GatewayTemplateRouteV1;
  readonly workload: GatewayWorkload;
}

export type GatewayRouteManifestInputV1 = Omit<
  GatewayRouteManifestV1,
  "fingerprint"
>;

export interface GatewayInvocationV1 {
  readonly acceptedAt: string;
  readonly gatewayContractVersion: typeof GATEWAY_CONTRACT_VERSION;
  readonly gatewayPolicyVersion: typeof GATEWAY_POLICY_VERSION;
  readonly hardDeadlineAt: string;
  readonly invocationId: string;
  readonly outputSchemaVersion: string;
  readonly ownerIntentRef: string;
  readonly personalizationLevel: "FULL" | "REDUCED";
  readonly planContractVersion: string;
  readonly planFingerprint: string;
  readonly planRef: string;
  readonly preparedModelInput: GatewayJsonObject;
  readonly promptVersion: string;
  readonly routeManifestFingerprint: string;
  readonly routeManifestVersion: string;
  readonly safetyPolicyVersion: string;
  readonly templateVersion: string;
  readonly workload: GatewayWorkload;
}

export interface GatewayNormalizedUsageV1 {
  readonly billedCostMicrounits: number | null;
  readonly inputUnits: number | null;
  readonly outputUnits: number | null;
}

export interface GatewayValidationReceiptV1 {
  readonly validatorVersion: string;
  readonly verdict: "PASS";
}

export interface GatewayCandidateV1 {
  readonly attemptId: string;
  readonly generationMode: GatewayRouteRole;
  readonly payload: GatewayJsonObject;
  readonly payloadFingerprint: string;
  readonly validationReceipt: GatewayValidationReceiptV1;
  readonly workload: GatewayWorkload;
}

export type GatewayAdmissionV1 =
  | { readonly status: "ALLOWED" }
  | {
      readonly reasonCode:
        | "BREAKER_STATE_UNAVAILABLE"
        | "BUDGET_HARD_LIMIT"
        | "COST_UNKNOWN"
        | "ROUTE_DISABLED";
      readonly status: "PROVIDER_CALLS_DISABLED";
    }
  | {
      readonly reasonCode:
        "OWNER_CANCELLED_OR_DELETED" | "SAFETY_OVERLAY_ACTIVE";
      readonly status: "ORDINARY_GATEWAY_BLOCKED";
    };

export type GatewayOutcomeV1 =
  | {
      readonly candidate: GatewayCandidateV1;
      readonly status: "CANDIDATE_READY";
    }
  | {
      readonly reasonCode: "ATTEMPT_ALREADY_EXISTS";
      readonly status: "RECOVER_EXISTING";
    }
  | {
      readonly failedRole: GatewayProviderRole;
      readonly reasonCode: string;
      readonly replayedAttempt?: true;
      readonly status: "FALLBACK_REQUIRED";
    }
  | {
      readonly reasonCode:
        "OWNER_CANCELLED_OR_DELETED" | "SAFETY_OVERLAY_ACTIVE";
      readonly status: "BLOCKED";
    }
  | {
      readonly reasonCode: GatewayGatewayFailureCode;
      readonly status: "TERMINAL_GATEWAY_FAILURE";
    };

export type GatewayAttemptOutcome =
  | "BLOCKED"
  | "BUDGET_EXHAUSTED"
  | "CANCELLED"
  | "CIRCUIT_OPEN"
  | "INVALID_SCHEMA"
  | "OUTCOME_UNKNOWN"
  | "PROVIDER_ERROR"
  | "SUCCEEDED"
  | "UNSAFE";

export type GatewayGatewayFailureCode =
  | "ADAPTER_CONTRACT_INVALID"
  | "ATTEMPT_FINGERPRINT_CONFLICT"
  | "GATEWAY_DEADLINE_EXCEEDED"
  | "INVOCATION_SCHEMA_INVALID"
  | "INPUT_LIMIT_EXCEEDED"
  | "ROUTE_COMPATIBILITY_INVALID"
  | "ROUTE_FINGERPRINT_MISMATCH"
  | "ROUTE_MANIFEST_INVALID"
  | "TEMPLATE_PREFLIGHT_FAILED";

export class GatewayContractError extends Error {
  public constructor(public readonly code: GatewayGatewayFailureCode) {
    super(code);
    this.name = "GatewayContractError";
  }
}

const VERSION_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_HEX = /^[a-f0-9]{64}$/u;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const FORBIDDEN_PREPARED_INPUT_KEYS = new Set([
  "accountid",
  "accountref",
  "channelid",
  "choicetrace",
  "deviceid",
  "eveningnote",
  "openid",
  "ownerref",
  "providerauth",
  "providerkey",
  "rawnote",
  "rawscore",
  "rootseed",
  "safetycategory",
  "safetytext",
  "sourceref",
  "sourcerefs",
  "sourcerevision",
  "stablesubjectid",
  "unionid",
  "userid",
]);

export function createGatewayRouteManifestV1(
  input: GatewayRouteManifestInputV1,
): GatewayRouteManifestV1 {
  const parsed = parseManifestInput(input);
  return deepFreeze({
    ...parsed,
    fingerprint: fingerprintGatewayJson(parsed),
  });
}

export function verifyGatewayRouteManifestV1(
  value: GatewayRouteManifestV1,
): GatewayRouteManifestV1 {
  if (!isRecord(value) || !SHA256_HEX.test(String(value.fingerprint))) {
    throw new GatewayContractError("ROUTE_MANIFEST_INVALID");
  }
  const { fingerprint, ...input } = value;
  const parsed = parseManifestInput(input as GatewayRouteManifestInputV1);
  if (fingerprintGatewayJson(parsed) !== fingerprint) {
    throw new GatewayContractError("ROUTE_FINGERPRINT_MISMATCH");
  }
  return deepFreeze({ ...parsed, fingerprint });
}

export function canonicalGatewayJson(value: GatewayJsonValue): string {
  assertJsonValue(value);
  return JSON.stringify(canonicalize(value));
}

export function fingerprintGatewayRequestV1(input: {
  readonly invocation: GatewayInvocationV1;
  readonly role: GatewayRouteRole;
  readonly route: GatewayProviderRouteV1 | GatewayTemplateRouteV1;
}): string {
  return fingerprintGatewayJson({
    gateway_contract_version: input.invocation.gatewayContractVersion,
    invocation_id: input.invocation.invocationId,
    output_schema_version: input.invocation.outputSchemaVersion,
    plan_fingerprint: input.invocation.planFingerprint,
    prepared_model_input: input.invocation.preparedModelInput,
    prompt_version: input.invocation.promptVersion,
    role: input.role,
    route: input.route,
    route_manifest_fingerprint: input.invocation.routeManifestFingerprint,
    safety_policy_version: input.invocation.safetyPolicyVersion,
    workload: input.invocation.workload,
  });
}

export function assertMinimalPreparedModelInput(
  input: GatewayJsonObject,
): void {
  assertJsonValue(input);
  visitPreparedInput(input);
}

export function fingerprintGatewayJson(value: unknown): string {
  assertJsonValue(value);
  return createHash("sha256")
    .update(canonicalGatewayJson(value), "utf8")
    .digest("hex");
}

export function validateGatewayNormalizedUsageV1(
  value: GatewayNormalizedUsageV1,
): GatewayNormalizedUsageV1 {
  if (!isRecord(value)) {
    throw new GatewayContractError("ADAPTER_CONTRACT_INVALID");
  }
  assertExactKeys(
    value,
    ["billedCostMicrounits", "inputUnits", "outputUnits"],
    "ADAPTER_CONTRACT_INVALID",
  );
  for (const entry of [
    value.billedCostMicrounits,
    value.inputUnits,
    value.outputUnits,
  ]) {
    if (entry !== null && (!Number.isSafeInteger(entry) || Number(entry) < 0)) {
      throw new GatewayContractError("ADAPTER_CONTRACT_INVALID");
    }
  }
  return Object.freeze({ ...value });
}

export function validateGatewayInvocationV1(
  invocation: GatewayInvocationV1,
): GatewayInvocationV1 {
  if (!isRecord(invocation)) {
    throw new GatewayContractError("INVOCATION_SCHEMA_INVALID");
  }
  assertExactKeys(
    invocation,
    [
      "acceptedAt",
      "gatewayContractVersion",
      "gatewayPolicyVersion",
      "hardDeadlineAt",
      "invocationId",
      "outputSchemaVersion",
      "ownerIntentRef",
      "personalizationLevel",
      "planContractVersion",
      "planFingerprint",
      "planRef",
      "preparedModelInput",
      "promptVersion",
      "routeManifestFingerprint",
      "routeManifestVersion",
      "safetyPolicyVersion",
      "templateVersion",
      "workload",
    ],
    "INVOCATION_SCHEMA_INVALID",
  );
  const acceptedAt = Date.parse(invocation.acceptedAt);
  const hardDeadlineAt = Date.parse(invocation.hardDeadlineAt);
  if (
    invocation.gatewayContractVersion !== GATEWAY_CONTRACT_VERSION ||
    invocation.gatewayPolicyVersion !== GATEWAY_POLICY_VERSION ||
    !GATEWAY_WORKLOADS.includes(invocation.workload) ||
    !UUID.test(invocation.invocationId) ||
    !UUID.test(invocation.ownerIntentRef) ||
    !SHA256_HEX.test(invocation.planFingerprint) ||
    !SHA256_HEX.test(invocation.routeManifestFingerprint) ||
    !Number.isFinite(acceptedAt) ||
    !Number.isFinite(hardDeadlineAt) ||
    hardDeadlineAt <= acceptedAt ||
    hardDeadlineAt - acceptedAt > workloadDeadlineMs(invocation.workload) ||
    !["FULL", "REDUCED"].includes(invocation.personalizationLevel)
  ) {
    throw new GatewayContractError("INVOCATION_SCHEMA_INVALID");
  }
  for (const value of [
    invocation.outputSchemaVersion,
    invocation.planContractVersion,
    invocation.planRef,
    invocation.promptVersion,
    invocation.routeManifestVersion,
    invocation.safetyPolicyVersion,
    invocation.templateVersion,
  ]) {
    assertVersionToken(value, "INVOCATION_SCHEMA_INVALID");
  }
  assertMinimalPreparedModelInput(invocation.preparedModelInput);
  return deepFreeze({
    ...invocation,
    preparedModelInput: cloneJson(invocation.preparedModelInput),
  });
}

export function workloadDeadlineMs(workload: GatewayWorkload): number {
  return workload === "DAILY_EXPRESSION_V1" ? 8_000 : 20_000;
}

export function allowedGatewayProfile(
  workload: GatewayWorkload,
  profile: GatewayRuntimeProfile,
): boolean {
  return (
    profile === "EVALUATION" ||
    (workload === "DAILY_EXPRESSION_V1" && profile === "INTERACTIVE") ||
    (workload === "WEEKLY_EXPRESSION_V1" && profile === "BACKGROUND")
  );
}

export function assertGatewayRouteCompatibilityV1(input: {
  readonly invocation: GatewayInvocationV1;
  readonly manifest: GatewayRouteManifestV1;
  readonly runtimeProfile: GatewayRuntimeProfile;
}): void {
  const { invocation, manifest, runtimeProfile } = input;
  if (
    invocation.gatewayContractVersion !== GATEWAY_CONTRACT_VERSION ||
    invocation.gatewayPolicyVersion !== GATEWAY_POLICY_VERSION ||
    invocation.routeManifestVersion !== manifest.manifestVersion ||
    invocation.routeManifestFingerprint !== manifest.fingerprint
  ) {
    throw new GatewayContractError("ROUTE_FINGERPRINT_MISMATCH");
  }
  if (
    manifest.status !== "ACTIVE" ||
    manifest.workload !== invocation.workload ||
    !manifest.compatiblePromptVersions.includes(invocation.promptVersion) ||
    !manifest.compatibleOutputSchemaVersions.includes(
      invocation.outputSchemaVersion,
    ) ||
    !manifest.compatibleSafetyPolicyVersions.includes(
      invocation.safetyPolicyVersion,
    ) ||
    invocation.templateVersion !==
      manifest.template.templateCompatibilityVersion ||
    !allowedGatewayProfile(invocation.workload, runtimeProfile)
  ) {
    throw new GatewayContractError("ROUTE_COMPATIBILITY_INVALID");
  }
  if (
    Buffer.byteLength(
      canonicalGatewayJson(invocation.preparedModelInput),
      "utf8",
    ) > manifest.inputLimits.preparedModelInputBytes
  ) {
    throw new GatewayContractError("INPUT_LIMIT_EXCEEDED");
  }
}

function parseManifestInput(
  input: GatewayRouteManifestInputV1,
): GatewayRouteManifestInputV1 {
  if (
    !isRecord(input) ||
    input.gatewayPolicyVersion !== GATEWAY_POLICY_VERSION ||
    !GATEWAY_WORKLOADS.includes(input.workload) ||
    !["STAGED", "ACTIVE", "DISABLED", "RETIRED"].includes(input.status)
  ) {
    throw new GatewayContractError("ROUTE_MANIFEST_INVALID");
  }
  assertExactKeys(
    input,
    [
      "backup",
      "compatibleOutputSchemaVersions",
      "compatiblePromptVersions",
      "compatibleSafetyPolicyVersions",
      "gatewayPolicyVersion",
      "inputLimits",
      "invocationCostLimitMicrounits",
      "manifestVersion",
      "outputLimits",
      "priceCatalogVersion",
      "primary",
      "status",
      "template",
      "workload",
    ],
    "ROUTE_MANIFEST_INVALID",
  );
  assertVersionToken(input.manifestVersion, "ROUTE_MANIFEST_INVALID");
  assertVersionToken(input.priceCatalogVersion, "ROUTE_MANIFEST_INVALID");
  const primary = parseProviderRoute(input.primary, "PRIMARY_AI");
  const backup = parseProviderRoute(input.backup, "BACKUP_AI");
  const template = parseTemplateRoute(input.template);
  const inputLimits = parsePositiveIntegerObject(input.inputLimits, [
    "preparedModelInputBytes",
    "providerResponseBytes",
  ]);
  const outputLimits = parsePositiveIntegerObject(input.outputLimits, [
    "maxOutputTokens",
  ]);
  if (
    !Number.isSafeInteger(input.invocationCostLimitMicrounits) ||
    input.invocationCostLimitMicrounits < 0 ||
    primary.maxOutputTokens > outputLimits.maxOutputTokens ||
    backup.maxOutputTokens > outputLimits.maxOutputTokens ||
    inputLimits.preparedModelInputBytes >
      (input.workload === "DAILY_EXPRESSION_V1" ? 16 * 1024 : 24 * 1024) ||
    inputLimits.providerResponseBytes > 12 * 1024 ||
    primary.requestDeadlineMs >
      (input.workload === "DAILY_EXPRESSION_V1" ? 4_000 : 8_000) ||
    backup.requestDeadlineMs >
      (input.workload === "DAILY_EXPRESSION_V1" ? 3_000 : 8_000) ||
    (primary.providerId === backup.providerId &&
      primary.providerAccountRef === backup.providerAccountRef &&
      primary.endpointId === backup.endpointId) ||
    template.minimumReserveMs <
      (input.workload === "DAILY_EXPRESSION_V1" ? 1_000 : 4_000) ||
    template.maxExecutionMs > template.minimumReserveMs
  ) {
    throw new GatewayContractError("ROUTE_MANIFEST_INVALID");
  }
  return deepFreeze({
    backup,
    compatibleOutputSchemaVersions: parseCompatibility(
      input.compatibleOutputSchemaVersions,
    ),
    compatiblePromptVersions: parseCompatibility(
      input.compatiblePromptVersions,
    ),
    compatibleSafetyPolicyVersions: parseCompatibility(
      input.compatibleSafetyPolicyVersions,
    ),
    gatewayPolicyVersion: GATEWAY_POLICY_VERSION,
    inputLimits,
    invocationCostLimitMicrounits: input.invocationCostLimitMicrounits,
    manifestVersion: input.manifestVersion,
    outputLimits,
    priceCatalogVersion: input.priceCatalogVersion,
    primary,
    status: input.status,
    template,
    workload: input.workload,
  });
}

function parseProviderRoute(
  input: GatewayProviderRouteV1,
  role: GatewayProviderRole,
): GatewayProviderRouteV1 {
  if (!isRecord(input) || input.role !== role) {
    throw new GatewayContractError("ROUTE_MANIFEST_INVALID");
  }
  assertExactKeys(
    input,
    [
      "adapterId",
      "adapterVersion",
      "capabilityProfileId",
      "connectDeadlineMs",
      "dataHandlingProfileId",
      "egressTarget",
      "endpointId",
      "endpointRegion",
      ...(input.immutableModelRevision === undefined
        ? []
        : ["immutableModelRevision"]),
      "maxOutputTokens",
      "modelId",
      "priceEntryId",
      "providerAccountRef",
      "providerId",
      "providerParameterSetId",
      "requestDeadlineMs",
      "role",
    ],
    "ROUTE_MANIFEST_INVALID",
  );
  for (const value of [
    input.adapterId,
    input.adapterVersion,
    input.capabilityProfileId,
    input.dataHandlingProfileId,
    input.egressTarget,
    input.endpointId,
    input.endpointRegion,
    input.immutableModelRevision,
    input.modelId,
    input.priceEntryId,
    input.providerAccountRef,
    input.providerId,
    input.providerParameterSetId,
  ]) {
    if (value !== undefined) {
      assertVersionToken(value, "ROUTE_MANIFEST_INVALID");
    }
  }
  for (const value of [
    input.connectDeadlineMs,
    input.maxOutputTokens,
    input.requestDeadlineMs,
  ]) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new GatewayContractError("ROUTE_MANIFEST_INVALID");
    }
  }
  if (input.connectDeadlineMs > input.requestDeadlineMs) {
    throw new GatewayContractError("ROUTE_MANIFEST_INVALID");
  }
  return deepFreeze({ ...input });
}

function parseTemplateRoute(
  input: GatewayTemplateRouteV1,
): GatewayTemplateRouteV1 {
  if (!isRecord(input)) {
    throw new GatewayContractError("ROUTE_MANIFEST_INVALID");
  }
  assertExactKeys(
    input,
    [
      "localeCatalogVersion",
      "maxExecutionMs",
      "minimumReserveMs",
      "rendererId",
      "rendererVersion",
      "templateCompatibilityVersion",
    ],
    "ROUTE_MANIFEST_INVALID",
  );
  for (const value of [
    input.localeCatalogVersion,
    input.rendererId,
    input.rendererVersion,
    input.templateCompatibilityVersion,
  ]) {
    assertVersionToken(value, "ROUTE_MANIFEST_INVALID");
  }
  for (const value of [input.maxExecutionMs, input.minimumReserveMs]) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new GatewayContractError("ROUTE_MANIFEST_INVALID");
    }
  }
  return deepFreeze({ ...input });
}

function parseCompatibility(values: readonly string[]): readonly string[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new GatewayContractError("ROUTE_MANIFEST_INVALID");
  }
  values.forEach((value) =>
    assertVersionToken(value, "ROUTE_MANIFEST_INVALID"),
  );
  const sorted = [...new Set(values)].sort();
  if (
    sorted.length !== values.length ||
    JSON.stringify(sorted) !== JSON.stringify(values)
  ) {
    throw new GatewayContractError("ROUTE_MANIFEST_INVALID");
  }
  return Object.freeze(sorted);
}

function parsePositiveIntegerObject<Keys extends string>(
  value: unknown,
  keys: readonly Keys[],
): Readonly<Record<Keys, number>> {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join("|") !== [...keys].sort().join("|")
  ) {
    throw new GatewayContractError("ROUTE_MANIFEST_INVALID");
  }
  const result = {} as Record<Keys, number>;
  for (const key of keys) {
    const entry = value[key];
    if (!Number.isSafeInteger(entry) || Number(entry) <= 0) {
      throw new GatewayContractError("ROUTE_MANIFEST_INVALID");
    }
    result[key] = Number(entry);
  }
  return Object.freeze(result);
}

function visitPreparedInput(value: GatewayJsonValue): void {
  if (Array.isArray(value)) {
    value.forEach(visitPreparedInput);
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const normalized = key.replaceAll(/[^A-Za-z0-9]/gu, "").toLowerCase();
    if (FORBIDDEN_PREPARED_INPUT_KEYS.has(normalized)) {
      throw new GatewayContractError("INVOCATION_SCHEMA_INVALID");
    }
    visitPreparedInput(entry as GatewayJsonValue);
  }
}

function assertJsonValue(value: unknown): asserts value is GatewayJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new GatewayContractError("INVOCATION_SCHEMA_INVALID");
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(assertJsonValue);
    return;
  }
  if (!isRecord(value)) {
    throw new GatewayContractError("INVOCATION_SCHEMA_INVALID");
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key.length === 0 || key === "__proto__" || key === "constructor") {
      throw new GatewayContractError("INVOCATION_SCHEMA_INVALID");
    }
    assertJsonValue(entry);
  }
}

function assertVersionToken(
  value: unknown,
  code: GatewayGatewayFailureCode,
): asserts value is string {
  if (
    typeof value !== "string" ||
    !VERSION_TOKEN.test(value) ||
    value.toLowerCase() === "latest"
  ) {
    throw new GatewayContractError(code);
  }
}

function canonicalize(value: GatewayJsonValue): GatewayJsonValue {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry as GatewayJsonValue)]),
  );
}

function cloneJson<T extends GatewayJsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  code: GatewayGatewayFailureCode,
): void {
  if (
    JSON.stringify(Object.keys(value).sort()) !==
    JSON.stringify([...keys].sort())
  ) {
    throw new GatewayContractError(code);
  }
}
