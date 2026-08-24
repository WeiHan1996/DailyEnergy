export const API_SAFETY_CONTINUATION_ROUTE_ALLOWLIST = [
  "GET /v1/bootstrap/launch",
  "GET /v1/safety/current",
  "POST /v1/safety/recovery/start",
  "POST /v1/safety/recovery/confirm",
] as const;

export const API_CAPABILITY_MANIFEST = {
  capabilities: [
    "ADMIN_TRANSPORT",
    "CONSENT_PROFILE_TRANSPORT",
    "DAILY_CHECKIN_TRANSPORT",
    "DAILY_GENERATION_TRANSPORT",
    "DAILY_INTERACTION_TRANSPORT",
    "EVENING_FEEDBACK_TRANSPORT",
    "DATABASE_ROLE_DAILY_ENERGY_API",
    "HEALTH_PROBES",
    "PUBLIC_TRANSPORT",
    "REDIS_DAILY_CONTENT_CACHE",
    "SAFETY_CONTINUATION_MAINTENANCE_ALLOWLIST",
  ],
  privileged_route_allowlists: {
    safety_continuation_maintenance: API_SAFETY_CONTINUATION_ROUTE_ALLOWLIST,
  },
  runtime_profile: "API",
} as const;
