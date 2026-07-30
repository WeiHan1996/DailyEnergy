# Migrations

Prisma versioned migration history. The current head is
`20260731000000_owner_upgrade_probe` and every migration SHA-256 is recorded in
`checksums.json`.

Rules:

- migrations are generated from the accepted model and supplemented with reviewed SQL;
- every custom mechanism carries its relevant `SQL-001` through `SQL-020` source ID;
- applied migration files and checksums are immutable; append a migration instead of editing history;
- `catalog-fingerprint.json` fixes normalized PostgreSQL catalog semantics, object owners, ACL, and
  default privileges in addition to object names;
- schema and roles are created by the separate bootstrap entrypoint before migrations run;
- production/shared environments use the one-shot migration entrypoint and never `db push`;
- destructive changes require backup, compatibility, deletion-ledger, and restore impact review;
- down migration is not used to pretend deleted or cryptographically erased data can be restored.
