# Observability Runbooks

- **Status**: Implemented
- **Version**: `observability-runbook-v1`
- **Scope**: LOCAL, CI, DEV and STAGING-like reference operations

These Runbooks receive incident candidates from E-013 alerts. Alert severity does not declare the
S-23 incident severity. Production notification identities, primary/secondary rotations, vendor
backends, region, RBAC, TTL and cross-border authorization remain `BLOCKED`.

| Alert family                            | Runbook                                   | Dashboard                  | Owner role                                       |
| --------------------------------------- | ----------------------------------------- | -------------------------- | ------------------------------------------------ |
| SLO burn and absolute API failures      | [Core API burn](./core-api-burn.md)       | `/d/executive-reliability` | `ENGINEERING_PRIMARY`                            |
| Queue/outbox/Worker lag                 | [Async and data](./async-data.md)         | `/d/async-data`            | `ENGINEERING_PRIMARY`                            |
| PostgreSQL pool, schema/grant and WAL   | [Database](./database.md)                 | `/d/async-data`            | `ENGINEERING_PRIMARY`                            |
| AI model drift and cost limits          | [AI and cost](./ai-cost.md)               | `/d/ai-cost`               | `AI_OWNER` / `FINANCE_OWNER`                     |
| raw-content, Collector and backend loss | [Telemetry health](./telemetry-health.md) | `/d/telemetry-health`      | `ENGINEERING_PRIMARY` / `PRIVACY_SECURITY_OWNER` |
| DataTask, deletion, restore and backup  | [Data lifecycle](./data-lifecycle.md)     | `/d/async-data`            | `RESTRICTED_OPERATIONS`                          |

All validation uses synthetic fixtures. Never paste production request data, user text, Prompt,
provider response, SQL, bind values, credentials or object content into an incident artifact.
