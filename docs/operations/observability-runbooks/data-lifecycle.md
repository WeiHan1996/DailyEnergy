# Data Lifecycle

- **Owner roles**: `RESTRICTED_OPERATIONS`, `PRIVACY_SECURITY_OWNER`
- **Incident candidate**: `INC-DATA-LIFECYCLE`
- **Dashboard**: `/d/async-data`

## Impact

A DataTask deadline, deletion guard, restore-deny detector, expired backup or recovery-copy age can
affect user rights and recovery safety. Detector absence never proves deletion or backup health.

## Verify

1. Verify restricted telemetry freshness and Collector health before evaluating lifecycle state.
2. Query scope/stage/outcome/count and deadline percentage only, with no task/user/source ref.
3. Confirm deletion ledger/guard, restore-deny catalog, backup manifest, config and current/rollback
   ReleaseManifest using their restricted authoritative systems; telemetry is not the
   deletion/restore proof.
4. Check 50/75/100% deadline, WAL and backup expiry thresholds separately.

## Contain

Keep deletion and restore guards enabled, block an expired backup as a recovery source, stop release
on a hard detector, and use approved maintenance/rollback controls. Isolate recovery copies and
destroy them through the accepted lifecycle procedure.

## Incident And Recovery

Declare an S-23 candidate immediately for deletion/restore detector failure or confirmed expired
data availability. Recovery requires authoritative ledger/guard proof, detector success, no expired
recovery source, telemetry freshness and the required observation window. Validate with synthetic
DataTask/delete/restore fixtures only.

## Forbidden

Do not display task/user/source refs, query user content, alter Production records directly, disable
deletion/restore/Safety/owner Gates, use an expired backup, clear queues, or copy Production data to
local fixtures.
