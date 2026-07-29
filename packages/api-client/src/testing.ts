import type {
  ContractOperationResponse,
  ContractTransport,
  ContractTransportRequest,
} from "./transport.js";

export type ContractTransportHandler<
  Operations extends object,
  OperationId extends Extract<keyof Operations, string>,
> = (
  request: ContractTransportRequest<OperationId>,
) =>
  | ContractOperationResponse<Operations[OperationId]>
  | Promise<ContractOperationResponse<Operations[OperationId]>>;

export type ContractTransportHandlers<Operations extends object> = {
  readonly [
    OperationId in Extract<keyof Operations, string>
  ]?: ContractTransportHandler<Operations, OperationId>;
};

export interface ContractTransportStub<
  Operations extends object,
> extends ContractTransport<Operations> {
  readonly requests: readonly ContractTransportRequest<
    Extract<keyof Operations, string>
  >[];
}

export function createContractTransportStub<Operations extends object>(
  handlers: ContractTransportHandlers<Operations>,
): ContractTransportStub<Operations> {
  const requests: ContractTransportRequest<
    Extract<keyof Operations, string>
  >[] = [];
  return {
    requests,
    async request<OperationId extends Extract<keyof Operations, string>>(
      request: ContractTransportRequest<OperationId>,
    ): Promise<ContractOperationResponse<Operations[OperationId]>> {
      requests.push(request);
      const handler = handlers[request.operationId] as
        ContractTransportHandler<Operations, OperationId> | undefined;
      if (!handler) {
        throw new Error(
          `CONTRACT_TRANSPORT_STUB_HANDLER_MISSING: ${request.operationId}`,
        );
      }
      return handler(request);
    },
  };
}
