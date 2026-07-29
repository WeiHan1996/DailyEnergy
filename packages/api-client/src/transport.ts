export interface ContractEndpoint {
  readonly method:
    "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";
  readonly path: string;
}

export interface ContractTransportRequest<OperationId extends string = string> {
  readonly body?: unknown;
  readonly method: ContractEndpoint["method"];
  readonly operationId: OperationId;
  readonly parameters?: unknown;
  readonly path: string;
}

export interface ContractTransportResponse<
  Body = unknown,
  Status extends number = number,
> {
  readonly body: Body;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly status: Status;
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
  : Operation extends {
        requestBody?: infer RequestBody;
      }
    ? JsonContent<RequestBody>
    : never;

type RequiredOperationBody<Operation> = Operation extends {
  requestBody: infer RequestBody;
}
  ? {
      readonly body: JsonContent<RequestBody>;
    }
  : Operation extends {
        requestBody?: infer RequestBody;
      }
    ? {
        readonly body?: JsonContent<RequestBody>;
      }
    : {
        readonly body?: never;
      };

type OperationParameters<Operation> = Operation extends {
  parameters: infer Parameters;
}
  ? Parameters
  : Operation extends {
        parameters?: infer Parameters;
      }
    ? Parameters
    : never;

type RequiredOperationParameters<Operation> = Operation extends {
  parameters: infer Parameters;
}
  ? {
      readonly parameters: Parameters;
    }
  : Operation extends {
        parameters?: infer Parameters;
      }
    ? {
        readonly parameters?: Parameters;
      }
    : {
        readonly parameters?: never;
      };

type OperationResponseMap<Operation> = Operation extends {
  responses: infer Responses;
}
  ? Responses
  : never;

type HttpStatusCode<Status> = Status extends number
  ? Status
  : Status extends `${infer Code extends number}`
    ? Code
    : number;

export type ContractOperationInput<Operation> =
  RequiredOperationBody<Operation> & RequiredOperationParameters<Operation>;

export type ContractOperationResponse<Operation> =
  OperationResponseMap<Operation> extends infer Responses
    ? {
        [Status in keyof Responses]: ContractTransportResponse<
          JsonContent<Responses[Status]>,
          HttpStatusCode<Status>
        >;
      }[keyof Responses]
    : never;

export type ContractOperationArguments<Operation> =
  Record<never, never> extends ContractOperationInput<Operation>
    ? [input?: ContractOperationInput<Operation>]
    : [input: ContractOperationInput<Operation>];

export interface ContractTransport<Operations extends object> {
  request<OperationId extends Extract<keyof Operations, string>>(
    request: ContractTransportRequest<OperationId>,
  ): Promise<ContractOperationResponse<Operations[OperationId]>>;
}

export interface ContractClient<
  Operations extends object,
  Manifest extends Readonly<
    Record<Extract<keyof Operations, string>, ContractEndpoint>
  >,
> {
  request<OperationId extends Extract<keyof Operations, string>>(
    operationId: OperationId,
    ...args: ContractOperationArguments<Operations[OperationId]>
  ): Promise<ContractOperationResponse<Operations[OperationId]>>;
  readonly sourceFingerprint: string;
  readonly operations: Manifest;
}

export function createContractClient<
  Operations extends object,
  Manifest extends Readonly<
    Record<Extract<keyof Operations, string>, ContractEndpoint>
  >,
>(
  transport: ContractTransport<Operations>,
  manifest: Manifest,
  sourceFingerprint: string,
): ContractClient<Operations, Manifest> {
  async function request<OperationId extends Extract<keyof Operations, string>>(
    operationId: OperationId,
    ...args: ContractOperationArguments<Operations[OperationId]>
  ): Promise<ContractOperationResponse<Operations[OperationId]>> {
    const input = (args[0] ?? {}) as {
      readonly body?: OperationBody<Operations[OperationId]>;
      readonly parameters?: OperationParameters<Operations[OperationId]>;
    };
    const endpoint = manifest[operationId];
    return transport.request({
      ...(input.body === undefined ? {} : { body: input.body }),
      method: endpoint.method,
      operationId,
      ...(input.parameters === undefined
        ? {}
        : { parameters: input.parameters }),
      path: endpoint.path,
    });
  }

  return {
    operations: manifest,
    request,
    sourceFingerprint,
  };
}
