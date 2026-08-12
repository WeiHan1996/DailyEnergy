import { z } from "zod";

export const AlertContractV1Schema = z.strictObject({
  alert_id: z.string().regex(/^S33-[A-Z0-9-]{3,64}$/u),
  condition: z.enum([
    "SLO_BURN",
    "ABSOLUTE_FAILURES",
    "SYNTHETIC_FAILURE",
    "HARD_GATE",
    "TELEMETRY_OUTAGE",
    "COST_THRESHOLD",
  ]),
  config_catalog_version: z.string().min(1).max(64),
  current_value: z.number(),
  dashboard_url: z.string().regex(/^\/d\/[a-z0-9-]+$/u),
  dedupe_key: z.string().regex(/^[A-Z0-9:_-]{3,128}$/u),
  environment: z.enum([
    "LOCAL",
    "CI",
    "DEV",
    "STAGING",
    "PRODUCTION",
    "RECOVERY",
  ]),
  hard_gate_id: z
    .string()
    .regex(/^S33-[A-Z0-9-]+$/u)
    .optional(),
  incident_category_candidate: z.enum([
    "INC-RELIABILITY",
    "INC-SAFETY-CONTROL",
    "INC-PRIVACY-SECURITY",
    "INC-DATA-LIFECYCLE",
    "INC-AI-PROVIDER",
    "INC-RELEASE-CONFIG",
  ]),
  owner_role: z.enum([
    "ENGINEERING_PRIMARY",
    "AI_OWNER",
    "PRIVACY_SECURITY_OWNER",
    "RESTRICTED_OPERATIONS",
    "FINANCE_OWNER",
  ]),
  release_id: z.string().min(1).max(64),
  runbook_url: z.string().regex(/^\/runbooks\/[a-z0-9-]+$/u),
  runtime_profile: z.enum([
    "API",
    "ADMIN",
    "INTERACTIVE",
    "BACKGROUND",
    "RESTRICTED",
    "MIGRATION",
    "EVALUATION",
  ]),
  service: z.enum([
    "api",
    "admin",
    "interactive",
    "background",
    "restricted",
    "collector",
    "database",
    "redis",
  ]),
  severity: z.enum(["PAGE_CRITICAL", "PAGE_HIGH", "TICKET", "INFO"]),
  slo_id: z
    .enum([
      "S33-SLO-01",
      "S33-SLO-02",
      "S33-SLO-03",
      "S33-SLO-04",
      "S33-SLO-05",
      "S33-SLO-06",
      "S33-SLO-07",
    ])
    .optional(),
  started_at: z.iso.datetime({ offset: true }),
  window: z.enum([
    "5m",
    "10m",
    "15m",
    "30m",
    "1h",
    "6h",
    "24h",
    "28d",
    "30d",
    "1h+5m",
    "6h+30m",
    "24h+2h",
    "3d+6h",
  ]),
});

export type AlertContractV1 = z.infer<typeof AlertContractV1Schema>;

export function validateAlert(value: AlertContractV1): AlertContractV1 {
  return AlertContractV1Schema.parse(value);
}
