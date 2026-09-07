import {
  GatewayContractError,
  allowedGatewayProfile,
  assertMinimalPreparedModelInput,
  validateGatewayNormalizedUsageV1,
  type GatewayNormalizedUsageV1,
  type GatewayRuntimeProfile,
} from "@daily-energy/server-core/ai-gateway";
import type {
  GatewayProviderAdapterV1,
  GatewayProviderCapabilityProfileV1,
  GatewayProviderHealthResultV1,
  GatewayProviderInvocationContextV1,
  GatewayProviderRequestV1,
  GatewayProviderResultV1,
} from "@daily-energy/server-core/ai-gateway/spi";

const UNKNOWN_REASON_CODES = new Set([
  "PROVIDER_CONNECT_TIMEOUT",
  "PROVIDER_NETWORK_ERROR",
  "PROVIDER_RESPONSE_TIMEOUT",
]);
const FAILURE_REASON_CODES = new Set([
  "PROVIDER_AUTH_INVALID",
  "PROVIDER_CANCELLED",
  "PROVIDER_CONNECT_TIMEOUT",
  "PROVIDER_CONTENT_BLOCKED",
  "PROVIDER_NETWORK_ERROR",
  "PROVIDER_PROTOCOL_INVALID",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_RESPONSE_TIMEOUT",
  "PROVIDER_UNAVAILABLE",
]);

export type ProviderTransactionStateV1 =
  "OUTSIDE_TRANSACTION" | "IN_TRANSACTION";

export interface ProviderTransportV1 {
  healthProbe(signal: AbortSignal): Promise<GatewayProviderHealthResultV1>;
  invoke(
    request: GatewayProviderRequestV1,
    context: GatewayProviderInvocationContextV1,
  ): Promise<GatewayProviderResultV1>;
}

export interface GatewayProviderAdapterConfigV1 {
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly capabilityProfile: GatewayProviderCapabilityProfileV1;
  readonly egressAllowlist: readonly string[];
  readonly now?: () => Date;
  readonly runtimeProfile: GatewayRuntimeProfile;
  readonly transactionState: () => ProviderTransactionStateV1;
  readonly transport: ProviderTransportV1;
}

export type ProviderAdapterBoundaryCode =
  | "PROVIDER_ADAPTER_BINDING_INVALID"
  | "PROVIDER_CALL_IN_TRANSACTION"
  | "PROVIDER_DEADLINE_EXPIRED"
  | "PROVIDER_EGRESS_REJECTED"
  | "PROVIDER_PROFILE_REJECTED"
  | "PROVIDER_RESULT_INVALID";

export class ProviderAdapterBoundaryError extends Error {
  public constructor(public readonly code: ProviderAdapterBoundaryCode) {
    super(code);
    this.name = "ProviderAdapterBoundaryError";
  }
}

export function createGatewayProviderAdapterV1(
  config: GatewayProviderAdapterConfigV1,
): GatewayProviderAdapterV1 {
  const adapterId = config.adapterId;
  const adapterVersion = config.adapterVersion;
  const runtimeProfile = config.runtimeProfile;
  const transactionState = config.transactionState;
  const transport = config.transport;
  assertStableToken(adapterId, "PROVIDER_ADAPTER_BINDING_INVALID");
  assertStableToken(adapterVersion, "PROVIDER_ADAPTER_BINDING_INVALID");
  if (
    !Array.isArray(config.egressAllowlist) ||
    config.egressAllowlist.length === 0 ||
    new Set(config.egressAllowlist).size !== config.egressAllowlist.length
  ) {
    throw new ProviderAdapterBoundaryError("PROVIDER_EGRESS_REJECTED");
  }
  config.egressAllowlist.forEach((entry) =>
    assertStableToken(entry, "PROVIDER_EGRESS_REJECTED"),
  );
  const egressAllowlist = new Set(config.egressAllowlist);
  const now = config.now ?? (() => new Date());
  const capabilityProfile = validateCapabilityProfile(config.capabilityProfile);
  if (
    capabilityProfile.supportedWorkloads.some(
      (workload) => !allowedGatewayProfile(workload, runtimeProfile),
    )
  ) {
    throw new ProviderAdapterBoundaryError("PROVIDER_PROFILE_REJECTED");
  }

  return Object.freeze({
    adapterId,
    adapterVersion,
    capabilities() {
      return capabilityProfile;
    },
    async healthProbe() {
      if (transactionState() !== "OUTSIDE_TRANSACTION") {
        return Object.freeze({
          reasonCode: "PROVIDER_UNAVAILABLE",
          status: "UNAVAILABLE",
        });
      }
      try {
        return validateHealthResult(
          await invokeHealthProbeWithDeadline(transport),
        );
      } catch {
        return Object.freeze({
          reasonCode: "PROVIDER_NETWORK_ERROR",
          status: "UNAVAILABLE",
        });
      }
    },
    async invoke(
      request: GatewayProviderRequestV1,
      context: GatewayProviderInvocationContextV1,
    ) {
      if (
        request.route.adapterId !== adapterId ||
        request.route.adapterVersion !== adapterVersion
      ) {
        throw new ProviderAdapterBoundaryError(
          "PROVIDER_ADAPTER_BINDING_INVALID",
        );
      }
      if (
        context.runtimeProfile !== runtimeProfile ||
        !allowedGatewayProfile(request.workload, runtimeProfile) ||
        !capabilityProfile.supportedWorkloads.includes(request.workload)
      ) {
        throw new ProviderAdapterBoundaryError("PROVIDER_PROFILE_REJECTED");
      }
      if (!egressAllowlist.has(request.route.egressTarget)) {
        throw new ProviderAdapterBoundaryError("PROVIDER_EGRESS_REJECTED");
      }
      if (transactionState() !== "OUTSIDE_TRANSACTION") {
        throw new ProviderAdapterBoundaryError("PROVIDER_CALL_IN_TRANSACTION");
      }
      if (
        !Number.isFinite(Date.parse(context.hardDeadlineAt)) ||
        Date.parse(context.hardDeadlineAt) <= now().getTime() ||
        context.signal?.aborted
      ) {
        if (context.signal?.aborted) {
          return Object.freeze({
            reasonCode: "PROVIDER_CANCELLED",
            status: "FAILURE",
            usage: {
              billedCostMicrounits: null,
              inputUnits: null,
              outputUnits: null,
            },
          });
        }
        throw new ProviderAdapterBoundaryError("PROVIDER_DEADLINE_EXPIRED");
      }
      try {
        assertMinimalPreparedModelInput(request.preparedModelInput);
      } catch (error) {
        if (error instanceof GatewayContractError) {
          throw new ProviderAdapterBoundaryError(
            "PROVIDER_ADAPTER_BINDING_INVALID",
          );
        }
        throw error;
      }
      const remainingMs = Math.min(
        request.route.requestDeadlineMs,
        Date.parse(context.hardDeadlineAt) - now().getTime(),
      );
      return validateProviderResult(
        await invokeTransportWithDeadline(
          transport,
          request,
          context,
          remainingMs,
        ),
      );
    },
  });
}

async function invokeHealthProbeWithDeadline(
  transport: ProviderTransportV1,
): Promise<GatewayProviderHealthResultV1> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutResult = new Promise<GatewayProviderHealthResultV1>(
    (resolve) => {
      timeout = setTimeout(() => {
        controller.abort();
        resolve({
          reasonCode: "PROVIDER_UNAVAILABLE",
          status: "UNAVAILABLE",
        });
      }, 5_000);
    },
  );
  try {
    return await Promise.race([
      Promise.resolve()
        .then(() => transport.healthProbe(controller.signal))
        .catch((): GatewayProviderHealthResultV1 => ({
          reasonCode: "PROVIDER_NETWORK_ERROR",
          status: "UNAVAILABLE",
        })),
      timeoutResult,
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function validateCapabilityProfile(
  value: GatewayProviderCapabilityProfileV1,
): GatewayProviderCapabilityProfileV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProviderAdapterBoundaryError("PROVIDER_ADAPTER_BINDING_INVALID");
  }
  assertExactKeys(value, [
    "capabilityProfileId",
    "streamingEnabled",
    "strictSchemaNative",
    "supportedWorkloads",
    "supportsCancellation",
    "toolsEnabled",
  ]);
  assertStableToken(
    value.capabilityProfileId,
    "PROVIDER_ADAPTER_BINDING_INVALID",
  );
  if (
    value.streamingEnabled !== false ||
    value.supportsCancellation !== true ||
    value.toolsEnabled !== false ||
    typeof value.strictSchemaNative !== "boolean" ||
    !Array.isArray(value.supportedWorkloads) ||
    value.supportedWorkloads.length === 0 ||
    new Set(value.supportedWorkloads).size !==
      value.supportedWorkloads.length ||
    value.supportedWorkloads.some(
      (workload) =>
        !["DAILY_EXPRESSION_V1", "WEEKLY_EXPRESSION_V1"].includes(workload),
    )
  ) {
    throw new ProviderAdapterBoundaryError("PROVIDER_ADAPTER_BINDING_INVALID");
  }
  return Object.freeze({
    ...value,
    supportedWorkloads: Object.freeze([...value.supportedWorkloads]),
  });
}

function validateHealthResult(
  value: GatewayProviderHealthResultV1,
): GatewayProviderHealthResultV1 {
  if (value.status === "AVAILABLE") {
    assertExactKeys(value, ["status"]);
    return Object.freeze({ status: "AVAILABLE" });
  }
  if (
    value.status === "UNAVAILABLE" &&
    [
      "PROVIDER_AUTH_INVALID",
      "PROVIDER_NETWORK_ERROR",
      "PROVIDER_UNAVAILABLE",
    ].includes(value.reasonCode)
  ) {
    assertExactKeys(value, ["reasonCode", "status"]);
    return Object.freeze({ ...value });
  }
  throw new ProviderAdapterBoundaryError("PROVIDER_RESULT_INVALID");
}

async function invokeTransportWithDeadline(
  transport: ProviderTransportV1,
  request: GatewayProviderRequestV1,
  context: GatewayProviderInvocationContextV1,
  timeoutMs: number,
): Promise<GatewayProviderResultV1> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const timeoutResult = new Promise<GatewayProviderResultV1>((resolve) => {
    timeout = setTimeout(() => {
      controller.abort();
      resolve({
        reasonCode: "PROVIDER_RESPONSE_TIMEOUT",
        status: "OUTCOME_UNKNOWN",
        usage: unknownUsage(),
      });
    }, timeoutMs);
  });
  const cancellationResult = new Promise<GatewayProviderResultV1>((resolve) => {
    onAbort = () => {
      controller.abort();
      resolve({
        reasonCode: "PROVIDER_CANCELLED",
        status: "FAILURE",
        usage: unknownUsage(),
      });
    };
    context.signal?.addEventListener("abort", onAbort, { once: true });
    if (context.signal?.aborted) {
      onAbort();
    }
  });
  const transportResult = Promise.resolve()
    .then(() =>
      controller.signal.aborted
        ? {
            reasonCode: "PROVIDER_CANCELLED" as const,
            status: "FAILURE" as const,
            usage: unknownUsage(),
          }
        : transport.invoke(request, {
            ...context,
            signal: controller.signal,
          }),
    )
    .catch((): GatewayProviderResultV1 => ({
      reasonCode: "PROVIDER_NETWORK_ERROR",
      status: "FAILURE",
      usage: unknownUsage(),
    }));
  try {
    return await Promise.race([
      transportResult,
      timeoutResult,
      cancellationResult,
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    if (onAbort) {
      context.signal?.removeEventListener("abort", onAbort);
    }
  }
}

function unknownUsage(): GatewayNormalizedUsageV1 {
  return {
    billedCostMicrounits: null,
    inputUnits: null,
    outputUnits: null,
  };
}

function validateProviderResult(
  result: GatewayProviderResultV1,
): GatewayProviderResultV1 {
  if (!result || typeof result !== "object") {
    throw new ProviderAdapterBoundaryError("PROVIDER_RESULT_INVALID");
  }
  let usage: GatewayNormalizedUsageV1;
  try {
    usage = validateGatewayNormalizedUsageV1(result.usage);
  } catch (error) {
    if (error instanceof GatewayContractError) {
      throw new ProviderAdapterBoundaryError("PROVIDER_RESULT_INVALID");
    }
    throw error;
  }
  if (result.providerRequestRef !== undefined) {
    assertStableToken(
      result.providerRequestRef,
      "PROVIDER_RESULT_INVALID",
      160,
    );
  }
  if (result.status === "SUCCESS") {
    assertExactKeys(result, [
      "bodyUtf8",
      "observedModelId",
      ...(result.providerRequestRef === undefined
        ? []
        : ["providerRequestRef"]),
      "status",
      "usage",
    ]);
    if (typeof result.bodyUtf8 !== "string" || result.bodyUtf8.length === 0) {
      throw new ProviderAdapterBoundaryError("PROVIDER_RESULT_INVALID");
    }
    assertStableToken(result.observedModelId, "PROVIDER_RESULT_INVALID", 128);
    return Object.freeze({ ...result, usage });
  }
  if (result.status === "OUTCOME_UNKNOWN") {
    assertExactKeys(result, [
      ...(result.providerRequestRef === undefined
        ? []
        : ["providerRequestRef"]),
      "reasonCode",
      "status",
      "usage",
    ]);
    if (!UNKNOWN_REASON_CODES.has(result.reasonCode)) {
      throw new ProviderAdapterBoundaryError("PROVIDER_RESULT_INVALID");
    }
    return Object.freeze({ ...result, usage });
  }
  if (result.status === "FAILURE") {
    assertExactKeys(result, [
      ...(result.providerRequestRef === undefined
        ? []
        : ["providerRequestRef"]),
      "reasonCode",
      ...(result.retryAfterMs === undefined ? [] : ["retryAfterMs"]),
      "status",
      "usage",
    ]);
    if (
      !FAILURE_REASON_CODES.has(result.reasonCode) ||
      (result.retryAfterMs !== undefined &&
        (!Number.isSafeInteger(result.retryAfterMs) || result.retryAfterMs < 0))
    ) {
      throw new ProviderAdapterBoundaryError("PROVIDER_RESULT_INVALID");
    }
    return Object.freeze({ ...result, usage });
  }
  throw new ProviderAdapterBoundaryError("PROVIDER_RESULT_INVALID");
}

function assertExactKeys(value: object, keys: readonly string[]): void {
  if (
    JSON.stringify(Object.keys(value).sort()) !==
    JSON.stringify([...keys].sort())
  ) {
    throw new ProviderAdapterBoundaryError("PROVIDER_RESULT_INVALID");
  }
}

function assertStableToken(
  value: unknown,
  code: ProviderAdapterBoundaryCode,
  maxLength = 128,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value) ||
    value.toLowerCase() === "latest"
  ) {
    throw new ProviderAdapterBoundaryError(code);
  }
}
