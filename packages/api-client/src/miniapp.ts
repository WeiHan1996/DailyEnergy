import {
  MINIAPP_CONTRACT_SOURCE_FINGERPRINT,
  MINIAPP_OPERATIONS,
  type components,
  type operations,
  type paths,
} from "./generated/miniapp.js";
import {
  createContractClient,
  type ContractClient,
  type ContractTransport,
} from "./transport.js";

export {
  mapDailyContentView,
  mapDailyInteractionView,
  mapEveningSaveRequestToSubmission,
  mapEveningView,
  mapWeeklyView,
} from "./mappers.js";
export type { components, operations, paths };
export type {
  ContractOperationInput,
  ContractOperationResponse,
  ContractTransport,
  ContractTransportRequest,
  ContractTransportResponse,
} from "./transport.js";

export type MiniappOperationId = Extract<keyof operations, string>;
export type MiniappApiClient = ContractClient<
  operations,
  typeof MINIAPP_OPERATIONS
>;
export type MiniappTransport = ContractTransport<operations>;

export const miniappContractSourceFingerprint =
  MINIAPP_CONTRACT_SOURCE_FINGERPRINT;
export const miniappOperations = MINIAPP_OPERATIONS;

export function createMiniappApiClient(
  transport: MiniappTransport,
): MiniappApiClient {
  return createContractClient<operations, typeof MINIAPP_OPERATIONS>(
    transport,
    MINIAPP_OPERATIONS,
    MINIAPP_CONTRACT_SOURCE_FINGERPRINT,
  );
}
