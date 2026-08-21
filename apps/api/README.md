# DailyEnergy API

E-003 established the NestJS 11 + Express 5 composition root. C-001 through
C-004 now add WeChat session persistence, consent/profile/onboarding and the
daily check-in command/query surface. Check-in ownership and ProductDate are
server-derived; command receipts, owner/date uniqueness, revision CAS and the
restricted Safety/deletion guard are persisted in PostgreSQL. Generation,
rules, AI and daily result publication remain separate downstream capabilities.

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
- `DAILYENERGY_DATABASE_URL_FILE`（可选且只能位于 `/run/secrets/`；release
  environment 必填）
- expected deploy/capability fingerprints (required in `STAGING`,
  `PRODUCTION`, and `RECOVERY`)

Unknown project variables, invalid values, and fingerprint mismatches fail
before the HTTP listener starts. The application never prints configuration
values or secrets.

When `DAILYENERGY_DATABASE_URL_FILE` is present, startup reads the credential
only from that file and verifies PostgreSQL connectivity and the expected API
database role before listening. The same probe participates in readiness; a
database outage makes readiness fail without exposing the connection string.

Release tooling must use the exported `calculateRuntimeFingerprints` function
so expected deploy and capability fingerprints come from the same validation
and hashing authority as API startup. The capability fingerprint binds both the
named API capabilities and the exact privileged Safety continuation route
allowlist.

The API accepts only the Accepted environment subset `LOCAL`, `CI`, `DEV`,
`STAGING`, `PRODUCTION`, and `RECOVERY`. Tests use `CI`; aliases such as `TEST`
and `DEVELOPMENT` are rejected.

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

`GET /v1/bootstrap/launch` accepts either the ordinary public audience or an
independently verified `X-Safety-Continuation`. A valid Safety continuation can
bypass blocking maintenance only for the Accepted launch/Safety/recovery
allowlist; it grants no Admin or ordinary route access.

Shutdown is bounded by `DAILYENERGY_SHUTDOWN_GRACE_MS`: readiness changes to
not-ready before intake closes, registered drain hooks run within the same
deadline, and expiry terminates with the fixed
`SHUTDOWN_DEADLINE_EXCEEDED` reason code.

## Compose runtime

E-009 runs this API through the common Compose topology. Use the repository
commands instead of assembling environment variables by hand:

```bash
pnpm run compose:up -- --mode=local
pnpm run compose:smoke -- --mode=local
pnpm run compose:clean -- --mode=local
```

The API is not attached to a host bridge and does not publish a port directly;
the secret-free ingress binds the documented loopback port. See
[`docker/README.md`](../../docker/README.md) for test, staging-like, and fault
variants.
