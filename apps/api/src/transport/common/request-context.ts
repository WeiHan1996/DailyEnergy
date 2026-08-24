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
  if (
    method.toUpperCase() === "GET" &&
    /^\/v1\/daily\/generation\/[^/]+$/u.test(path ?? "")
  ) {
    return "GENERATION_STATUS";
  }
  if (
    method.toUpperCase() === "GET" &&
    /^\/v1\/daily\/by-date\/[^/]+$/u.test(path ?? "")
  ) {
    return "DAILY_HISTORY_READ";
  }
  const operations: Readonly<Record<string, OperationCode>> = {
    "GET /health/live": "HEALTH_LIVE",
    "GET /health/ready": "HEALTH_READY",
    "GET /health/startup": "HEALTH_STARTUP",
    "GET /v1/admin/ops/overview": "ADMIN_OPS_PLACEHOLDER",
    "GET /v1/bootstrap/launch": "PUBLIC_BOOTSTRAP_PLACEHOLDER",
    "POST /v1/auth/wechat/session": "PUBLIC_WECHAT_SESSION_PLACEHOLDER",
    "POST /v1/auth/session/refresh": "AUTH_SESSION_REFRESH",
    "POST /v1/auth/session/logout": "AUTH_SESSION_LOGOUT",
    "GET /v1/daily/today/checkin": "CHECKIN_READ",
    "POST /v1/daily/checkin/submit": "CHECKIN_SUBMIT",
    "POST /v1/daily/checkin/correct": "CHECKIN_CORRECT",
    "POST /v1/daily/generation/start": "GENERATION_START",
    "GET /v1/daily/today": "DAILY_TODAY_READ",
    "GET /v1/consent/current": "CONSENT_CURRENT",
    "POST /v1/consent/accept": "CONSENT_ACCEPT",
    "POST /v1/consent/withdraw": "CONSENT_WITHDRAW",
    "GET /v1/profile": "PROFILE_READ",
    "POST /v1/onboarding/complete": "ONBOARDING_COMPLETE",
    "POST /v1/profile/update": "PROFILE_UPDATE",
    "POST /v1/profile/style-calibration": "PROFILE_STYLE_CALIBRATION",
    "GET /v1/memory/preferences": "MEMORY_PREFERENCES_READ",
    "POST /v1/memory/preferences": "MEMORY_PREFERENCES_UPDATE",
    "GET /v1/notifications/settings": "NOTIFICATION_SETTINGS_READ",
    "POST /v1/notifications/settings": "NOTIFICATION_SETTINGS_UPDATE",
    "POST /v1/notifications/permission-sync": "NOTIFICATION_PERMISSION_SYNC",
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
