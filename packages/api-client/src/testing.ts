import type {
  ContractTransport,
  ContractTransportRequest,
  ContractTransportResponse,
} from "./transport.js";

export type ContractTransportHandler = (
  request: ContractTransportRequest,
) => ContractTransportResponse | Promise<ContractTransportResponse>;

export interface ContractTransportStub extends ContractTransport {
  readonly requests: readonly ContractTransportRequest[];
}

export function createContractTransportStub(
  handler: ContractTransportHandler,
): ContractTransportStub {
  const requests: ContractTransportRequest[] = [];
  return {
    requests,
    async request(request) {
      requests.push(request);
      return handler(request);
    },
  };
}
