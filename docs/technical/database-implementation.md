# E-006 database baseline

This directory contains the PostgreSQL 18 / Prisma 7 migration and verification slice.

## Fixed baseline

- Prisma CLI and Client: `7.9.1` (same exact version; supplied by the root install)
- PostgreSQL test image: `postgres:18.0-bookworm@sha256:3f55f8895c4ed50603e2fbdfc72fffeeaba3173321fee5cb825bbbeb30d9d854`
- Application schema: `daily_energy`
- Migration head: `20260730000000_initial_application_schema`

`DATABASE_URL` is required by `prisma.config.ts`; no credential or production default is committed.

## Entrypoints

```sh
PRISMA_BIN=/absolute/path/to/prisma node tooling/database/check-static.mjs
node tooling/database/check-migrations.mjs
DATABASE_URL=... PRISMA_BIN=/absolute/path/to/prisma node tooling/database/migrate.mjs
DATABASE_URL=... node tooling/database/seed.mjs
DATABASE_URL=... node tooling/database/check-drift.mjs
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

`migrate.mjs` is the one-shot migration entrypoint. Before connecting it verifies the committed checksum manifest, then acquires an advisory lock, applies versioned history through `prisma migrate deploy`, and verifies that the applied history contains exactly the accepted migration set. Runtime startup must not call it. `seed.mjs` is repeatable only when an existing natural key has exactly the accepted payload and fingerprint; a conflicting row aborts and rolls back the entire seed transaction.

The single accepted initial migration has no fabricated down migration. Upgrade evidence is clean application plus repeat deploy over synthetic old-code facts. Code rollback keeps the same compatible schema, and roll-forward re-runs the same accepted head and drift gate. Destructive schema rollback is explicitly not claimed.

`prisma db push` is rejected by the static tooling and is not an accepted migration path.

## Role mapping

| Workload profile | PostgreSQL role            |
| ---------------- | -------------------------- |
| API              | `daily_energy_api`         |
| Interactive      | `daily_energy_interactive` |
| Background       | `daily_energy_background`  |
| Restricted       | `daily_energy_restricted`  |
| Migration        | `daily_energy_migration`   |
| Test             | `daily_energy_test`        |

All roles are `NOLOGIN` by default. Environment-specific login roles should inherit exactly one group role. The migration owner is one-shot only; ordinary profiles receive no role creation, schema ownership, DDL, trigger, reference, or truncate capability.

## Recovery hook boundary

The recovery scripts are synthetic orchestration hooks, not a production backup service. They require an explicitly isolated stage, a current external checkpoint/fingerprint, and an absolute deleted-data detector hook. Ledger replay must finish before the detector can run, and readiness remains closed until that detector succeeds. The checkpoint table lives in the separate `daily_energy_recovery` schema so application-schema drift remains exact. Production ledger authority, backup keys, PITR, approvals, and real detector implementations remain blocked by the accepted deployment boundary.

## Evidence boundary

The PostgreSQL 18 harness proves the actual checksum gate stops before schema creation, clean install, repeated migration and seed idempotence, seed conflict rollback, compatible old-code rollback/roll-forward on the one accepted initial migration, exact table/enum/index/constraint/trigger/function drift, role/grant drift, recovery ledger ordering, detector failure, and readiness closure. It also executes must-pass/must-fail fixtures for SQL-001 through SQL-020 and the transaction suite:

- clean migration deployment, idempotent re-application as the initial upgrade path, deterministic synthetic seed, and 70-table / 35-enum / SQL-ID drift checks;
- positive and negative database behavior for SQL-001 through SQL-019, plus SQL-015 terminal-state regression and SQL-017 45-day day-erasure guard limits;
- SQL-020 role attributes, ownership, DDL, truncate, restricted-data, and ciphertext access boundaries, including the one-shot migration role;
- TX-01 through TX-09 atomic commit, rollback, replay, compare-and-swap, lock-claim, and concurrent-winner behavior using multiple PostgreSQL connections and deterministic barriers;
- migration checksum mutation and the repository-level rejection of `prisma db push`.

The harness uses only synthetic identities and data. It does not connect to production, use production credentials, or exercise a production restore. Rollback and roll-forward evidence is limited to transactional failure rollback plus repeatable migration deployment because E-006 contains one initial migration; a future destructive or contract migration requires its own isolated recovery rehearsal and authorization.

`tests/database/evidence-manifest.json` is the scoped, machine-readable pre-E-010 handoff. Its 101 entries map every SQL and TX contract to exact tests and classify each `S19-DB-001..064` and `S31-TEST-017..024` item individually as either `COVERED` or `NA_WITH_REASON`. Every NA entry names the missing layer and follow-up owner; it is not counted as coverage.

`pnpm database:check` validates migration checksums, static gates, and this manifest without starting a container. The broader cross-project registry, queue resilience, application/E2E, production backup, and provider-call layers remain owned by the follow-up tasks named in the manifest.
