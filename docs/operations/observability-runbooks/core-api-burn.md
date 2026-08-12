# Core API Burn

- **Owner role**: `ENGINEERING_PRIMARY`
- **Incident candidate**: `INC-RELIABILITY`
- **Dashboard**: `/d/executive-reliability`, `/d/api-core-journey`

## Impact

Core requests may be unavailable or delayed. Expected validation/auth/guard rejections remain
separate and must not be counted as service failure. Safety and deletion controls remain active.

## Verify

1. Confirm both burn windows, real request count, absolute 5xx count and synthetic status.
2. Check `/d/telemetry-health`; missing telemetry means `BLOCKED`, not healthy.
3. Query by `operation_code`, `outcome_code`, `status_class`, release and coarse time bucket only.
4. Confirm current and rollback ReleaseManifest plus config/catalog fingerprints.

## Contain

Use bounded maintenance for affected ordinary routes, disable only the reviewed failing route, or
select the recorded rollback candidate. Preserve Safety, privacy, deletion and deterministic facts.
Do not infer recovery from one successful request.

## Incident And Recovery

Declare an S-23 candidate when impact is confirmed, the absolute-failure trigger fires, or a
multi-window page persists. Recovery requires telemetry health, both burn windows below threshold,
synthetic success, normal readiness and a 30-minute observation window. Validate with the CI
synthetic health fixture.

## Forbidden

Do not enable request/response body, raw URL/query, header, SQL bind or provider logging. Do not
edit Production data, clear Redis/queues, disable Safety/deletion/owner/budget Gates, switch to an
unreviewed provider, or download Production data.
