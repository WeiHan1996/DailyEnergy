# Telemetry Health

- **Owner roles**: `ENGINEERING_PRIMARY`, `PRIVACY_SECURITY_OWNER`
- **Incident candidate**: `INC-RELIABILITY` or `INC-PRIVACY-SECURITY`
- **Dashboard**: `/d/telemetry-health`

## Impact

Collector/backend loss makes SLO and cost decisions `BLOCKED`. A raw-content detector match is a
privacy/security hard trigger: stop the affected export, isolate the batch and create an S-23
candidate. Business fallbacks and fail-closed controls remain unchanged.

## Verify

1. Check independent heartbeat, Collector queue/drop/export and backend availability.
2. Compare required service/profile/release heartbeats; no data is distinct from zero.
3. Query only fixed reason, resource, profile and release attributes. Do not inspect suspected text in
   the ordinary backend; hand off the opaque evidence reference to restricted response.
4. Verify current/rollback ReleaseManifest, Collector/backend config fingerprints and 7/30/35-day
   retention settings.

## Contain

For raw-content match, stop the affected export and isolate/delete the batch. For cost pressure,
reduce normal success trace sampling and query retention first. For backend outage, preserve hard
detectors/SLO counters and let telemetry drop rather than blocking business transactions.

## Incident And Recovery

Declare an S-23 candidate for any raw-content match or telemetry loss beyond 15 minutes. Recovery
requires detector clear, export healthy, queue drained, required heartbeats fresh, canary/synthetic
success and a 30-minute observation window. E-014 must provide real delivery/TTL exercise evidence.

## Forbidden

Do not compensate with body, SQL bind, provider raw, payload or unrestricted stack logging. Do not
silence hard alerts, disable retention/Safety/deletion/owner/budget Gates, edit Production data,
download the suspect batch to a personal device, or claim alert delivery without E-014 evidence.
