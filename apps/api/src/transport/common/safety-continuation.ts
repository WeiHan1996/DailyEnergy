import type { Request } from "express";

import { API_SAFETY_CONTINUATION_ROUTE_ALLOWLIST } from "../../composition/api-capability-manifest.js";

const SAFETY_CONTINUATION_ROUTE_KEYS = new Set<string>(
  API_SAFETY_CONTINUATION_ROUTE_ALLOWLIST,
);

export function isSafetyContinuationRoute(request: Request): boolean {
  return SAFETY_CONTINUATION_ROUTE_KEYS.has(
    `${request.method.toUpperCase()} ${request.path}`,
  );
}

export function safetyContinuationFrom(request: Request): string | undefined {
  const value = request.headers["x-safety-continuation"];
  return Array.isArray(value) ? value[0] : value;
}
