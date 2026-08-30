# E-006 database baseline

This directory contains the PostgreSQL 18 / Prisma 7 migration and verification slice.

## Fixed baseline

- Prisma CLI and Client: `7.9.1` (same exact version; supplied by the root install)
- PostgreSQL test image: `postgres:18.0-bookworm@sha256:3f55f8895c4ed50603e2fbdfc72fffeeaba3173321fee5cb825bbbeb30d9d854`
- Application schema: `daily_energy`
- Migration head: `20260830000000_c015_core_analytics` (15 committed migrations)

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
DATABASE_INTEGRATION=1 PRISMA_BIN=/absolute/path/to/prisma node --test --test-concurrency=1 tests/database/integration.test.mjs tests/database/transactions.test.mjs tests/database/auth-identity.test.mjs tests/database/c002-consent-profile.test.mjs tests/database/c004-checkin.test.mjs tests/database/c005-product-time-seed.test.mjs tests/database/c008-daily-generation.test.mjs tests/database/c013-weekly-reflection.test.mjs tests/database/c014-data-rights.test.mjs tests/database/c015-core-analytics.test.mjs
DATABASE_URL=... DB_RECOVERY_STAGE=isolated DB_RESTORE_LEDGER_CHECKPOINT=... \
  DB_RESTORE_LEDGER_FINGERPRINT=... DB_DELETED_DATA_DETECTOR_HOOK=/absolute/hook \
  node tooling/database/replay-restore-ledger.mjs
DATABASE_URL=... DB_RESTORE_LEDGER_CHECKPOINT=... \
  DB_DELETED_DATA_DETECTOR_HOOK=/absolute/hook \
  node tooling/database/run-deleted-data-detector.mjs
DATABASE_URL=... DB_RESTORE_LEDGER_CHECKPOINT=... \
  node tooling/database/check-recovery-ready.mjs
```

`bootstrap.mjs` is a separate privileged, idempotent provisioning boundary. It creates the
`NOLOGIN` owner/group roles and the owner-controlled application schema, but it never runs an
application migration. Run it during initial provisioning and again before deployment whenever
the versioned group-role set expands. The migration preflight fails with
`DB_MIGRATION_ROLE_BOOTSTRAP_REQUIRED` when that provisioning step is missing. Environment
provisioning creates LOGIN roles separately and grants each login exactly one group role.

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

The E-007 forward migration is additive and grant-only. It gives `daily_energy_deletion` the
minimum `INSERT`/`UPDATE` access to `runtime_inbox_receipt` required to commit a Restricted domain
effect and its InboxReceipt in one transaction; it adds no sequence, DDL, Safety, evaluation, or
ordinary application-table capability. The checksum, normalized ACL fingerprint, drift probe and
real Restricted consumer test cover this grant.

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
attributes, profile capability probes, immutable-table protection, and exact effective
schema/relation/column/sequence/function/database privileges, including `WITH GRANT OPTION`, against
the expected group role. PostgreSQL 18 relation comparison includes `MAINTAIN` and
`MAINTAIN WITH GRANT OPTION`. The expected membership edge must have `ADMIN OPTION = false`,
`INHERIT OPTION = true`, and `SET OPTION = true`; extra inherited roles, LOGIN `REPLICATION`, and
capability drift all fail startup. Relation capability probes use catalog OIDs rather than
permission-dependent qualified-name resolution, so losing inherited schema usage still produces a
stable role mismatch instead of aborting the identity query. The API Safety role can write the
allowlisted Safety facts and TX-05 outbox event; the deletion role can write deletion-task evidence
and the TX-09 outbox event, read only the indexed C-014 manifest/status-grant deadlines needed for
due reconstruction, and delete allowlisted user facts; it cannot read export bodies (none exist),
write Safety state, or access evaluation data.

Deferred SQL-007/012/013/014 constraint functions remain `SECURITY INVOKER`. Their helper
functions are closed to `PUBLIC` and grant `EXECUTE` only to the writer/test roles that can reach
those constraint paths, so runtime failures retain stable SQL IDs without widening data access.
SQL-007 separately proves immutable snapshot lineage and the TX-02 current-revision boundary:
publication and upgrade validation require the referenced historical check-in revision to exist,
while a newly inserted snapshot must additionally equal the current check-in revision. SQL-013
validates both sides of a visibility rebind and visibility deletion, so a `BLOCKED` row cannot be
moved or removed while it still protects an incomplete result; full deletion cleanup remains valid
once the protected slots are gone.

## Coordinated security cutover

Migration `20260731000001_security_fixes_sql007_sql013_roles` has never been applied to a shared or
production environment, so its SQL and committed checksum are updated in place before first use.
It is a coordinated security contract cutover rather than an N/N-1-compatible expand migration:

1. provision the new `daily_energy_safety` and `daily_energy_deletion` group/login roles through the
   privileged bootstrap boundary;
2. pause ordinary producer/consumer intake while preserving Safety and deletion guards;
3. apply the migration, which removes all table/sequence privileges from the legacy
   `daily_energy_restricted` shell;
4. start only the new runtime build and verify the Safety, deletion, outbox, role-identity, SQL and
   drift probes before resuming intake.

After this cutover, rollback to code that still depends on the legacy restricted role is unsupported
because it would reintroduce the reviewed security defect. Recovery uses a roll-forward build with
the split-role contract; it must not restore the legacy grants. Any future environment that has
already applied this migration must treat its migration file and checksum as immutable and use a new
versioned forward migration.

## Recovery hook boundary

The recovery scripts are synthetic orchestration hooks, not a production backup service. They require an explicitly isolated stage, a current external checkpoint/fingerprint, and an absolute deleted-data detector hook. Ledger replay must finish before the detector can run, and readiness remains closed until that detector succeeds. The checkpoint table lives in the separate `daily_energy_recovery` schema so application-schema drift remains exact. Production ledger authority, backup keys, PITR, approvals, and real detector implementations remain blocked by the accepted deployment boundary.

## Evidence boundary

The PostgreSQL 18 harness proves the actual checksum gate stops before schema creation, clean
install, repeated migration and seed idempotence, seed conflict rollback, compatible old-code
rollback/roll-forward, owner-based upgrade, real Prisma lock timeout, semantic catalog drift,
recovery ledger ordering, detector failure, and readiness closure. It also executes must-pass and
must-fail fixtures for SQL-001 through SQL-020 and the transaction suite:

- clean migration deployment, idempotent re-application, deterministic synthetic seed, and
  exact current 80 application tables / 36 enum types / 81 functions / SQL-ID drift checks;
- normalized catalog fingerprints for columns/type/default/nullability, direct column ACLs,
  ordered enum labels, constraint/index/trigger/function definitions, object owners,
  schema/relation/function ACLs, default privileges, group-role attributes, and owner membership;
- active constraint/index/function/table-grant/column-grant mutations that must fail the drift gate
  before exact restoration;
- positive and negative database behavior for SQL-001 through SQL-019, including daily/weekly
  fragment deletion failure, visibility activation/rebind/current-summary publication failure,
  BLOCKED visibility delete/rebind failure, cross-account, wrong-date, and
  wrong-checkin-revision snapshot rejection at the TX-02 boundary, a valid API-role snapshot commit,
  frozen snapshot publication after check-in correction, weekly source fingerprint advancement,
  and same-transaction BLOCKED/unpublish/deletion-cleanup success;
- SQL-020 environment-login membership, role attributes, ownership, DDL, truncate, split
  Safety/Deletion grants including TX-05/TX-09 outbox insertion, legacy restricted-shell closure,
  ciphertext boundaries, real factory startup, and direct column grant, table `MAINTAIN`, table,
  schema, function, database and sequence `WITH GRANT OPTION`, membership `ADMIN OPTION`,
  `INHERIT FALSE`, `SET FALSE`, extra membership, and LOGIN `REPLICATION` rejection;
- an N-1 role-set upgrade that fails with a stable bootstrap-required code, reruns privileged
  idempotent provisioning, and then migrates successfully;
- a conflicting table lock that makes the real second Prisma migration fail near five seconds with
  a stable redacted error, followed by successful roll-forward;
- TX-01 through TX-09 atomic commit, rollback, replay, compare-and-swap, lock-claim, and concurrent-winner behavior using multiple PostgreSQL connections and deterministic barriers;
- C-014 summary revision discovery, four-scope cleanup, zero-body READY export manifest, repeated deterministic source reads, correction invalidation, exact 24-hour expiry, PostgreSQL retention due reconstruction, hash-only deletion status grant, legal-hold FAILED retry and de-identified ACCOUNT completion;
- C-015 four-plane T4 physical isolation, sub-k rejection, identity-free client count, 23 metric/four Gate rebuild, exact D1/D3/D7, revision replacement, count-free suppression/query and 13-month physical retention;
- migration checksum mutation and the repository-level rejection of `prisma db push`.

The harness uses only synthetic identities and data. It does not connect to production, use
production credentials, or exercise a production restore. The initial lock-timeout migration is
additive and compatible; the security-fix migration is the explicitly coordinated split-role
cutover described above; the E-007 inbox grant is an additive forward migration. A future
destructive or contract migration still requires its own isolated recovery rehearsal and
authorization.

`tests/database/evidence-manifest.json` is the scoped, machine-readable pre-E-010 handoff. Its 101 entries map every SQL and TX contract to exact tests and classify each `S19-DB-001..064` and `S31-TEST-017..024` item individually as either `COVERED` or `NA_WITH_REASON`. Every NA entry names the missing layer and follow-up owner; it is not counted as coverage. The security-fix migration adds explicit SQL-007, SQL-013 and split-role assertions to the covered evidence.

`pnpm database:check` validates migration checksums, static gates, and this manifest without starting a container. The broader cross-project registry, queue resilience, application/E2E, production backup, and provider-call layers remain owned by the follow-up tasks named in the manifest.
