# DailyEnergy API

E-003 establishes a thin NestJS 11 + Express 5 composition root. It contains
transport, runtime configuration, health, error-envelope, request-context,
redacted logging, audience-boundary, and graceful-shutdown infrastructure only.
It does not implement product use cases, persistence, queues, providers, or real
identity.

## Local synthetic start

The runtime configuration is closed. Only the following `DAILYENERGY_*`
variables are accepted:

- `DAILYENERGY_ENVIRONMENT`
- `DAILYENERGY_RUNTIME_PROFILE` (`API`)
- `DAILYENERGY_RELEASE_ID`
- `DAILYENERGY_PORT`
- `DAILYENERGY_HOST`
- `DAILYENERGY_MAINTENANCE_MODE`
- `DAILYENERGY_LOG_LEVEL`
- `DAILYENERGY_SHUTDOWN_GRACE_MS`
- `DAILYENERGY_CONFIG_SCHEMA_VERSION` (`api-runtime-config-v1`)
- `DAILYENERGY_CONTRACT_BUNDLE_VERSION` (`api-contract-v1`)
- `DAILYENERGY_PRODUCT_DATE_POLICY_VERSION` (`product-date-v1`)
- optional expected deploy/capability fingerprints

Unknown project variables, invalid values, and fingerprint mismatches fail
before the HTTP listener starts. The application never prints configuration
values or secrets.

Internal probes:

- `GET /health/startup`
- `GET /health/live`
- `GET /health/ready`

The E-003 placeholder routes are:

- `POST /v1/auth/wechat/session`
- `GET /v1/bootstrap/launch`
- `GET /v1/admin/ops/overview`

They validate transport and audience boundaries, then return stable
`FEATURE_DISABLED` errors. They do not pretend that identity or business
features have been implemented.
