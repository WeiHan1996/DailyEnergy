export interface ContractEndpoint {
  readonly method:
    "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";
  readonly path: string;
}

export interface ContractTransportRequest {
  readonly body?: unknown;
  readonly method: ContractEndpoint["method"];
  readonly operationId: string;
  readonly parameters?: unknown;
  readonly path: string;
}

export interface ContractTransportResponse<Body = unknown> {
  readonly body: Body;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly status: number;
}

export interface ContractTransport {
  request(
    request: ContractTransportRequest,
  ): Promise<ContractTransportResponse>;
}

type JsonContent<Value> = Value extends {
  content: { "application/json": infer Body };
}
  ? Body
  : never;

type OperationBody<Operation> = Operation extends {
  requestBody: infer RequestBody;
}
  ? JsonContent<RequestBody>
  : never;

type OperationParameters<Operation> = Operation extends {
  parameters: infer Parameters;
}
  ? Parameters
  : never;

type OperationResponses<Operation> = Operation extends {
  responses: infer Responses;
}
  ? {
      [Status in keyof Responses]: JsonContent<Responses[Status]>;
    }[keyof Responses]
  : never;

export type ContractOperationInput<Operation> = {
  readonly body?: OperationBody<Operation>;
  readonly parameters?: OperationParameters<Operation>;
};

export type ContractOperationResponse<Operation> = ContractTransportResponse<
  OperationResponses<Operation>
>;

export interface ContractClient<
  Operations,
  Manifest extends Readonly<
    Record<Extract<keyof Operations, string>, ContractEndpoint>
  >,
> {
  request<OperationId extends Extract<keyof Operations, string>>(
    operationId: OperationId,
    input?: ContractOperationInput<Operations[OperationId]>,
  ): Promise<ContractOperationResponse<Operations[OperationId]>>;
  readonly sourceFingerprint: string;
  readonly operations: Manifest;
}

export function createContractClient<
  Operations,
  Manifest extends Readonly<
    Record<Extract<keyof Operations, string>, ContractEndpoint>
  >,
>(
  transport: ContractTransport,
  manifest: Manifest,
  sourceFingerprint: string,
): ContractClient<Operations, Manifest> {
  return {
    operations: manifest,
    sourceFingerprint,
    async request(operationId, input = {}) {
      const endpoint = manifest[operationId];
      return (await transport.request({
        ...(input.body === undefined ? {} : { body: input.body }),
        method: endpoint.method,
        operationId,
        ...(input.parameters === undefined
          ? {}
          : { parameters: input.parameters }),
        path: endpoint.path,
      })) as ContractOperationResponse<Operations[typeof operationId]>;
    },
  };
}
