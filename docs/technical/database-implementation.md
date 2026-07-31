# E-006 database baseline

This directory contains the PostgreSQL 18 / Prisma 7 migration and verification slice.

## Fixed baseline

- Prisma CLI and Client: `7.9.1` (same exact version; supplied by the root install)
- PostgreSQL test image: `postgres:18.0-bookworm@sha256:3f55f8895c4ed50603e2fbdfc72fffeeaba3173321fee5cb825bbbeb30d9d854`
- Application schema: `daily_energy`
- Migration head: `20260731000001_security_fixes_sql007_sql013_roles`

`DATABASE_URL` is required by `prisma.config.ts`; no credential or production default is committed.

## Entrypoints

```sh
PRISMA_BIN=/absolute/path/to/prisma node tooling/database/check-static.mjs
node tooling/database/check-migrations.mjs
DATABASE_ADMIN_URL=... node tooling/database/bootstrap.mjs
DATABASE_URL=... PRISMA_BIN=/absolute/path/to/prisma node tooling/database/migrate.mjs
DATABASE_URL=... node tooling/database/seed.mjs
DATABASE_URL=... node tooling/database/check-drift.mjs
DB_CATALOG_FINGERPRINT_WRITE=1 DATABASE_URL=... node tooling/database/write-catalog-fingerprint.mjs
DATABASE_INTEGRATION=1 PRISMA_BIN=/absolute/path/to/prisma node --test tests/database/integration.test.mjs tests/database/transactions.test.mjs
DATABASE_URL=... DB_RECOVERY_STAGE=isolated DB_RESTORE_LEDGER_CHECKPOINT=... \
  DB_RESTORE_LEDGER_FINGERPRINT=... DB_DELETED_DATA_DETECTOR_HOOK=/absolute/hook \
  node tooling/database/replay-restore-ledger.mjs
DATABASE_URL=... DB_RESTORE_LEDGER_CHECKPOINT=... \
  DB_DELETED_DATA_DETECTOR_HOOK=/absolute/hook \
  node tooling/database/run-deleted-data-detector.mjs
DATABASE_URL=... DB_RESTORE_LEDGER_CHECKPOINT=... \
  node tooling/database/check-recovery-ready.mjs
```

`bootstrap.mjs` is a separate privileged, one-time boundary. It creates the `NOLOGIN`
owner/group roles and the owner-controlled application schema, but it never runs an application
migration. Environment provisioning creates LOGIN roles separately and grants each login exactly
one group role.

`migrate.mjs` is the one-shot migration entrypoint. It requires an environment LOGIN role whose
only runtime-profile membership is `daily_energy_migration`, verifies its controlled membership in
`daily_energy_owner`, then acquires an advisory lock and applies versioned history through
`prisma migrate deploy`. The actual Prisma connection receives `lock_timeout=5s`,
`statement_timeout=5min`, and `role=daily_energy_owner` through connection options and
`PGOPTIONS`. After deploy, the runner verifies that applied history exactly matches the committed
checksum manifest. Runtime startup must not call it. `seed.mjs` is repeatable only when an existing
natural key has exactly the accepted payload and fingerprint; a conflicting row aborts and rolls
back the entire seed transaction.

The initial migration has no fabricated down migration. The second migration moves one accepted
`revision >= 1` constraint onto an existing E-006 table so the harness can prove real owner-based
`ALTER TABLE`, lock timeout, failure cleanup, and roll-forward. Code rollback keeps the same
compatible schema. Destructive schema rollback is explicitly not claimed.

`prisma db push` is rejected by the static tooling and is not an accepted migration path.

## Role mapping

| Workload profile  | PostgreSQL role                         |
| ----------------- | --------------------------------------- |
| API               | `daily_energy_api`                      |
| Interactive       | `daily_energy_interactive`              |
| Background        | `daily_energy_background`               |
| API Safety pool   | `daily_energy_safety`                   |
| Restricted worker | `daily_energy_deletion`                 |
| Legacy restricted | `daily_energy_restricted` (empty shell) |
| Migration         | `daily_energy_migration`                |
| Test              | `daily_energy_test`                     |

`daily_energy_owner` and every group role are `NOLOGIN`, `NOINHERIT`, and non-superuser. An
environment-specific LOGIN role inherits exactly one group role. Only the migration group may
`SET ROLE daily_energy_owner`; runtime profiles are never object owners. The API Safety pool and
Restricted worker use separate group roles. The legacy `daily_energy_restricted` role is retained
as an empty compatibility shell and receives no application table privileges.

Adapter factories query `session_user`, `current_user`, recursive profile memberships, role
attributes, profile capability probes, immutable-table protection, and a complete application
schema ACL comparison against the expected group role. A direct grant or extra inherited role
therefore fails startup instead of being hidden by a matching profile name. The API Safety role
can write only Safety-owned facts; the deletion role can write deletion-task evidence and delete
allowlisted user facts, but cannot write Safety state or evaluation data.

## Recovery hook boundary

The recovery scripts are synthetic orchestration hooks, not a production backup service. They require an explicitly isolated stage, a current external checkpoint/fingerprint, and an absolute deleted-data detector hook. Ledger replay must finish before the detector can run, and readiness remains closed until that detector succeeds. The checkpoint table lives in the separate `daily_energy_recovery` schema so application-schema drift remains exact. Production ledger authority, backup keys, PITR, approvals, and real detector implementations remain blocked by the accepted deployment boundary.

## Evidence boundary

The PostgreSQL 18 harness proves the actual checksum gate stops before schema creation, clean
install, repeated migration and seed idempotence, seed conflict rollback, compatible old-code
rollback/roll-forward, owner-based upgrade, real Prisma lock timeout, semantic catalog drift,
recovery ledger ordering, detector failure, and readiness closure. It also executes must-pass and
must-fail fixtures for SQL-001 through SQL-020 and the transaction suite:

- clean migration deployment, idempotent re-application, deterministic synthetic seed, and
  70-table / 35-enum / SQL-ID drift checks;
- normalized catalog fingerprints for columns/type/default/nullability, ordered enum labels,
  constraint/index/trigger/function definitions, object owners, complete schema/table/function ACL,
  default privileges, group-role attributes, and owner membership;
- active constraint/index/function/grant mutations that must fail the drift gate before exact
  restoration;
- positive and negative database behavior for SQL-001 through SQL-019, including daily/weekly
  fragment deletion failure, visibility activation/current-summary publication failure, the
  cross-account and wrong-date snapshot paths, and same-transaction BLOCKED/unpublish success;
- SQL-020 environment-login membership, role attributes, ownership, DDL, truncate, split
  Safety/Deletion grants, legacy restricted-shell closure, and ciphertext boundaries;
- a conflicting table lock that makes the real second Prisma migration fail near five seconds with
  a stable redacted error, followed by successful roll-forward;
- TX-01 through TX-09 atomic commit, rollback, replay, compare-and-swap, lock-claim, and concurrent-winner behavior using multiple PostgreSQL connections and deterministic barriers;
- migration checksum mutation and the repository-level rejection of `prisma db push`.

The harness uses only synthetic identities and data. It does not connect to production, use
production credentials, or exercise a production restore. The second migration is additive and
compatible; a future destructive or contract migration still requires its own isolated recovery
rehearsal and authorization.

`tests/database/evidence-manifest.json` is the scoped, machine-readable pre-E-010 handoff. Its 101 entries map every SQL and TX contract to exact tests and classify each `S19-DB-001..064` and `S31-TEST-017..024` item individually as either `COVERED` or `NA_WITH_REASON`. Every NA entry names the missing layer and follow-up owner; it is not counted as coverage. The security-fix migration adds explicit SQL-007, SQL-013 and split-role assertions to the covered evidence.

`pnpm database:check` validates migration checksums, static gates, and this manifest without starting a container. The broader cross-project registry, queue resilience, application/E2E, production backup, and provider-call layers remain owned by the follow-up tasks named in the manifest.
