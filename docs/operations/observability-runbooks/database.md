# Database

- **Owner role**: `ENGINEERING_PRIMARY`
- **Incident candidate**: `INC-RELIABILITY` or `INC-RELEASE-CONFIG`
- **Dashboard**: `/d/async-data`

## Impact

Pool saturation, wait, schema/grant drift or WAL gap may affect core availability, rollback or
recovery. A confirmed schema/grant drift makes the affected profile not ready and blocks release.

## Verify

1. Verify telemetry health, readiness and collector freshness independently.
2. Inspect pool saturation, aggregate wait histogram, WAL age and fixed drift reason codes.
3. Use approved query fingerprint and duration/row buckets only; never retrieve SQL or bind values.
4. Compare current ReleaseManifest, migration head, grant fingerprint and rollback manifest.

## Contain

Stop new release work, reduce reviewed concurrency, enter bounded maintenance, isolate the affected
profile or roll back through the release controller. Escalate WAL gaps at 10 minutes and treat 15
minutes as a Release Gate plus S-23 `INC-DATA-LIFECYCLE` candidate.

## Incident And Recovery

Recovery requires readiness, accepted schema/grants, pool below 80%, wait P95 below one second,
WAL gap below five minutes and a 30-minute observation window. Validate with synthetic DB readiness
and migration drift fixtures.

## Forbidden

Do not enable SQL/bind/row logging, edit Production rows or grants ad hoc, skip migrations, destroy
volumes, disable backup/deletion/Safety Gates, clear Redis as a DB remedy, or export Production data.
