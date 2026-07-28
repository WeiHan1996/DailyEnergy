import type { Request } from "express";

const SAFETY_CONTINUATION_ROUTE_KEYS = new Set([
  "GET /v1/bootstrap/launch",
  "GET /v1/safety/current",
  "POST /v1/safety/recovery/start",
  "POST /v1/safety/recovery/confirm",
]);

export function isSafetyContinuationRoute(request: Request): boolean {
  return SAFETY_CONTINUATION_ROUTE_KEYS.has(
    `${request.method.toUpperCase()} ${request.path}`,
  );
}

export function safetyContinuationFrom(request: Request): string | undefined {
  const value = request.headers["x-safety-continuation"];
  return Array.isArray(value) ? value[0] : value;
}
