import {
  ADMIN_CONTRACT_SOURCE_FINGERPRINT,
  ADMIN_OPERATIONS,
  type components,
  type operations,
  type paths,
} from "./generated/admin.js";
import {
  createContractClient,
  type ContractClient,
  type ContractTransport,
} from "./transport.js";

export type { components, operations, paths };
export type {
  ContractOperationInput,
  ContractOperationResponse,
  ContractTransport,
  ContractTransportRequest,
  ContractTransportResponse,
} from "./transport.js";

export type AdminOperationId = Extract<keyof operations, string>;
export type AdminApiClient = ContractClient<
  operations,
  typeof ADMIN_OPERATIONS
>;

export const adminContractSourceFingerprint = ADMIN_CONTRACT_SOURCE_FINGERPRINT;
export const adminOperations = ADMIN_OPERATIONS;

export function createAdminApiClient(
  transport: ContractTransport,
): AdminApiClient {
  return createContractClient<operations, typeof ADMIN_OPERATIONS>(
    transport,
    ADMIN_OPERATIONS,
    ADMIN_CONTRACT_SOURCE_FINGERPRINT,
  );
}
