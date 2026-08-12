# Async And Data

- **Owner role**: `ENGINEERING_PRIMARY`
- **Incident candidate**: `INC-RELIABILITY`
- **Dashboard**: `/d/async-data`

## Impact

An eligible intent, notification or DataTask may be delayed. Queue completion is not business
success; PostgreSQL facts, attempt and receipt state remain authoritative. Background lag must not
automatically mark the API unready.

## Verify

1. Verify telemetry freshness and Collector export before trusting queue/outbox graphs.
2. Compare outbox age, queue eligible age, retry, terminal, duplicate and Worker profile signals.
3. Query only queue family, stable operation/reason, profile, outcome and release.
4. Confirm the current/rollback ReleaseManifest and queue contract/config/capability fingerprint.

## Contain

Pause only the affected consumer family, stop blind retry for terminal contract failures, drain the
profile, or roll back the recorded release. For Redis loss, keep PostgreSQL facts and run bounded
rebuild; never restore stale Redis state.

## Incident And Recovery

Declare an S-23 candidate for sustained eligible age, terminal retry storm, profile rejection or
fact/effect mismatch. Recovery requires backlog drain, duplicate effect zero, successful synthetic
enqueue/commit/ACK fixture, telemetry freshness and a 30-minute observation window.

## Forbidden

Do not log queue payloads or job refs, clear Redis/queues, modify PostgreSQL facts directly, disable
guards, relax profile allowlists, open external egress, or copy Production payloads to test systems.
