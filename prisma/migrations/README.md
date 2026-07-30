# Migrations

Prisma versioned migration history. The current head is
`20260730000000_initial_application_schema` and its SHA-256 is recorded in
`checksums.json`.

Rules:

- migrations are generated from the accepted model and supplemented with reviewed SQL;
- every custom mechanism carries its `SQL-001` through `SQL-020` source ID in the SQL file;
- applied migration files and checksums are immutable; append a migration instead of editing history;
- production/shared environments use the one-shot migration entrypoint and never `db push`;
- destructive changes require backup, compatibility, deletion-ledger, and restore impact review;
- down migration is not used to pretend deleted or cryptographically erased data can be restored.
