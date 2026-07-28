import { MiniappPlatformError } from "../errors.js";
import type { NetworkPort, NetworkRequest, NetworkResponse } from "../ports.js";
import type { WechatRuntime } from "./runtime.js";

const minimumTimeoutMs = 1_000;
const maximumTimeoutMs = 15_000;
const defaultTimeoutMs = 10_000;
const publicPathPattern = /^\/v1(?:\/|$)[a-z0-9/_-]*(?:\?[a-z0-9%&=_-]+)?$/iu;

function requestTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) {
    return defaultTimeoutMs;
  }
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < minimumTimeoutMs ||
    timeoutMs > maximumTimeoutMs
  ) {
    throw new MiniappPlatformError("NETWORK_PATH_INVALID");
  }
  return timeoutMs;
}

function requestUrl(apiOrigin: string, path: string): string {
  if (
    !publicPathPattern.test(path) ||
    path.includes("..") ||
    path.includes("://")
  ) {
    throw new MiniappPlatformError("NETWORK_PATH_INVALID");
  }
  return `${apiOrigin}${path}`;
}

export function createWechatNetworkPort(
  runtime: WechatRuntime,
  apiOrigin: string,
): NetworkPort {
  return Object.freeze({
    request<T = unknown>(request: NetworkRequest): Promise<NetworkResponse<T>> {
      const url = requestUrl(apiOrigin, request.path);
      const timeout = requestTimeout(request.timeoutMs);
      return new Promise((resolve, reject) => {
        runtime.request({
          ...(request.body === undefined ? {} : { data: request.body }),
          fail: () => {
            reject(new MiniappPlatformError("NETWORK_FAILED"));
          },
          ...(request.headers === undefined ? {} : { header: request.headers }),
          method: request.method,
          success: ({ data, header, statusCode }) => {
            resolve(
              Object.freeze({
                data: data as T,
                headers: Object.freeze({ ...(header ?? {}) }),
                statusCode,
              }),
            );
          },
          timeout,
          url,
        });
      });
    },
  });
}
