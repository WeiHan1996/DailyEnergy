import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

import { Injectable } from "@nestjs/common";
import type { TelemetrySpan } from "@daily-energy/server-adapters/api";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { ApiTelemetry } from "../../observability/api-telemetry.js";
import type { OperationCode } from "../../observability/ordinary-log.types.js";

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/u;
const NOOP_TELEMETRY_SPAN: TelemetrySpan = Object.freeze({ end() {} });

interface RequestContext {
  readonly operationCode: OperationCode;
  readonly requestId: string;
  readonly startedAt: number;
  readonly httpMethod:
    "GET" | "POST" | "PATCH" | "DELETE" | "OPTIONS" | "OTHER";
  readonly telemetrySpan: TelemetrySpan;
}

function operationFor(method: string, url: string): OperationCode {
  const path = url.split("?", 1)[0];
  const key = `${method.toUpperCase()} ${path}`;
  const operations: Readonly<Record<string, OperationCode>> = {
    "GET /health/live": "HEALTH_LIVE",
    "GET /health/ready": "HEALTH_READY",
    "GET /health/startup": "HEALTH_STARTUP",
    "GET /v1/admin/ops/overview": "ADMIN_OPS_PLACEHOLDER",
    "GET /v1/bootstrap/launch": "PUBLIC_BOOTSTRAP_PLACEHOLDER",
    "POST /v1/auth/wechat/session": "PUBLIC_WECHAT_SESSION_PLACEHOLDER",
  };
  return operations[key] ?? "UNKNOWN_HTTP";
}

function normalizedRequestId(header: string | string[] | undefined): string {
  const candidate = Array.isArray(header) ? header[0] : header;
  return candidate !== undefined && SAFE_REQUEST_ID.test(candidate)
    ? candidate
    : randomUUID();
}

@Injectable()
export class RequestContextStore {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  public constructor(private readonly telemetry: ApiTelemetry) {}

  public middleware(): RequestHandler {
    return (request: Request, response: Response, next: NextFunction): void => {
      const requestId = normalizedRequestId(request.headers["x-request-id"]);
      const operationCode = operationFor(request.method, request.originalUrl);
      const httpMethod = normalizedHttpMethod(request.method);
      response.setHeader("X-Request-Id", requestId);
      this.storage.run(
        {
          httpMethod,
          operationCode,
          requestId,
          startedAt: performance.now(),
          telemetrySpan: this.telemetry.beginRequest(operationCode, httpMethod),
        },
        next,
      );
    };
  }

  public get(): RequestContext {
    return (
      this.storage.getStore() ?? {
        operationCode: "UNKNOWN_HTTP",
        httpMethod: "OTHER",
        requestId: randomUUID(),
        startedAt: performance.now(),
        telemetrySpan: NOOP_TELEMETRY_SPAN,
      }
    );
  }
}

function normalizedHttpMethod(value: string): RequestContext["httpMethod"] {
  const upper = value.toUpperCase();
  return ["GET", "POST", "PATCH", "DELETE", "OPTIONS"].includes(upper)
    ? (upper as RequestContext["httpMethod"])
    : "OTHER";
}
