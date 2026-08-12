# AI And Cost

- **Owner roles**: `AI_OWNER`, `FINANCE_OWNER`, `ENGINEERING_PRIMARY`
- **Incident candidate**: `INC-AI-PROVIDER`
- **Dashboard**: `/d/ai-cost`

## Impact

Model drift, stale pricing, unknown usage or budget exhaustion can make provider output or cost
claims unsafe. Existing result, template, Safety, deletion and deterministic facts remain available.

## Verify

1. Verify telemetry health, cost known ratio and price coverage before reading budget state.
2. Compare only approved provider code, model revision bucket, workload and generation mode.
3. Confirm current/rollback ReleaseManifest, active route manifest, price catalog, config and
   BudgetEnvelope versions.
4. Treat unknown cost/usage as `BLOCKED`; never replace missing values with zero.

## Contain

Deactivate a mismatched route, use the controlled template for stale price/unreadable budget, freeze
non-essential paid evaluation at 85%, and hard-stop new provider calls at 100%. Continue Safety,
deletion, backup and deterministic service.

## Incident And Recovery

Declare an S-23 candidate for observed-model drift or material provider impact. Recovery requires an
approved active route, price coverage and cost known ratio at least 99%, budget below the authorized
threshold and a 30-minute observation window. Validate with synthetic usage and budget fixtures.

## Forbidden

Do not log Prompt, input/output, provider body/raw error, per-user cost or invoice secret. Do not
switch to an unreviewed provider/model, rewrite historical prices, disable budget/Safety/deletion
Gates, edit Production data, or download Production provider artifacts.
