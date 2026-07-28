import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

import { Injectable } from "@nestjs/common";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { OperationCode } from "../../observability/ordinary-log.types.js";

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/u;

interface RequestContext {
  readonly operationCode: OperationCode;
  readonly requestId: string;
  readonly startedAt: number;
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

  public middleware(): RequestHandler {
    return (request: Request, response: Response, next: NextFunction): void => {
      const requestId = normalizedRequestId(request.headers["x-request-id"]);
      response.setHeader("X-Request-Id", requestId);
      this.storage.run(
        {
          operationCode: operationFor(request.method, request.originalUrl),
          requestId,
          startedAt: performance.now(),
        },
        next,
      );
    };
  }

  public get(): RequestContext {
    return (
      this.storage.getStore() ?? {
        operationCode: "UNKNOWN_HTTP",
        requestId: randomUUID(),
        startedAt: performance.now(),
      }
    );
  }
}
