import type {
  AdminTransport,
  ContractTransportRequest,
} from "@daily-energy/api-client/admin";

interface AdminFetchTransportOptions {
  readonly apiOrigin: string;
  readonly fetcher?: typeof fetch;
  readonly sessionToken?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertAdminEnvelope(value: unknown): void {
  if (
    !isRecord(value) ||
    typeof value.ok !== "boolean" ||
    typeof value.request_id !== "string" ||
    typeof value.server_now !== "string"
  ) {
    throw new Error("ADMIN_API_RESPONSE_ENVELOPE_INVALID");
  }

  if (value.ok === true && !Object.hasOwn(value, "data")) {
    throw new Error("ADMIN_API_SUCCESS_DATA_MISSING");
  }

  if (value.ok === false) {
    const error = value.error;
    if (
      !isRecord(error) ||
      typeof error.category !== "string" ||
      typeof error.code !== "string" ||
      typeof error.message !== "string" ||
      typeof error.message_key !== "string" ||
      typeof error.retryable !== "boolean"
    ) {
      throw new Error("ADMIN_API_ERROR_ENVELOPE_INVALID");
    }
  }
}

function pathForRequest(request: ContractTransportRequest): string {
  const parameters = isRecord(request.parameters)
    ? request.parameters
    : undefined;
  const pathParameters =
    parameters !== undefined && isRecord(parameters.path)
      ? parameters.path
      : {};

  return request.path.replaceAll(/\{([^}]+)\}/gu, (_match, key: string) => {
    const value = pathParameters[key];
    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error("ADMIN_API_PATH_PARAMETER_MISSING");
    }
    return encodeURIComponent(String(value));
  });
}

function queryForRequest(request: ContractTransportRequest): URLSearchParams {
  const result = new URLSearchParams();
  const parameters = isRecord(request.parameters)
    ? request.parameters
    : undefined;
  const query =
    parameters !== undefined && isRecord(parameters.query)
      ? parameters.query
      : {};

  for (const [key, value] of Object.entries(query)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      result.set(key, String(value));
    }
  }
  return result;
}

function requestHeaders(
  request: ContractTransportRequest,
  sessionToken: string | undefined,
): Headers {
  const result = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
  });
  const parameters = isRecord(request.parameters)
    ? request.parameters
    : undefined;
  const headers =
    parameters !== undefined && isRecord(parameters.header)
      ? parameters.header
      : {};

  for (const name of ["Accept-Language", "X-Request-Id"] as const) {
    const value = headers[name];
    if (typeof value === "string") {
      result.set(name, value);
    }
  }
  if (sessionToken !== undefined) {
    result.set("Authorization", `Bearer ${sessionToken}`);
  }
  return result;
}

export function createAdminFetchTransport(
  options: AdminFetchTransportOptions,
): AdminTransport {
  const fetcher = options.fetcher ?? fetch;

  return {
    async request(request) {
      if (
        request.operationId !== "adminLogin" &&
        options.sessionToken === undefined
      ) {
        throw new Error("ADMIN_SESSION_REQUIRED");
      }

      const url = new URL(pathForRequest(request), options.apiOrigin);
      url.search = queryForRequest(request).toString();
      const response = await fetcher(url, {
        ...(request.body === undefined
          ? {}
          : { body: JSON.stringify(request.body) }),
        cache: "no-store",
        headers: requestHeaders(request, options.sessionToken),
        method: request.method,
        redirect: "error",
      });

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error("ADMIN_API_RESPONSE_JSON_INVALID");
      }
      assertAdminEnvelope(body);

      return {
        body,
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status,
      } as never;
    },
  };
}
