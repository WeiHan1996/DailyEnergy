# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-12（E-013 实现与本地验证已收口，等待 Draft PR 固定 Ubuntu CI）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-013 — 实现脱敏日志、指标、Trace、SLO 与成本监控基线
- **任务状态**：In Progress
- **任务分支**：`agent/e013-observability`，基于 PR #134 squash merge `dd201713a90b9f49e27cf66f6967210db8dc7f36`
- **当前 Issue**：[E-013 Issue #51](https://github.com/WeiHan1996/DailyEnergy/issues/51)
- **当前 PR**：[Draft PR #135](https://github.com/WeiHan1996/DailyEnergy/pull/135)，实现 commit `c1a557505b67bdfb5d7dee7e0340da6b5967fec4`
- **最近完成 PR**：[E-012 final evidence PR #134](https://github.com/WeiHan1996/DailyEnergy/pull/134)
- **Gate 结论**：`E013_IMPLEMENTED_LOCAL / SECURITY_MANUAL_EVIDENCE_PENDING / UBUNTU_CI_PENDING / E014_REQUIRED / PRODUCTION_OBSERVABILITY_BLOCKED`

## 1. 当前目标

在 LOCAL、CI 与 STAGING-like 环境落地 vendor-neutral telemetry、低基数 SLI/SLO、告警、Dashboard、Runbook 与成本预算状态，同时保持内容、身份、权限和运行 profile 隔离。

```text
allowlisted structured logs + OTel traces/metrics
  -> collector/OpenMetrics contracts
  -> low-cardinality SLI/SLO recording rules and alerts
  -> dashboard/runbook evidence
  -> CostEntry/BudgetEnvelope and telemetry health
```

## 2. E-012 完成交接

- 项目所有者于 2026-08-12 明确接受首次引入 `reconcile-current` 的 bootstrap 澄清与 E-012 全部最终证据，并授权 PR #134 在精确 final-head Gate 通过后标记 Ready、squash 合并、关闭 Issue #50；
- bootstrap 合同固定为：旧 N bundle 不含新 controller 命令时必须在任何状态变更前 fail closed；先通过标准 18 阶段发布 capability-bearing N+1，N+1 成为 current 后，才从同一 immutable bundle 执行 clean restart reconciliation；禁止 newer controller 跨 bundle 控制 older release；
- [PR #133](https://github.com/WeiHan1996/DailyEnergy/pull/133) final head `248a47fdabd3b0e2b6785cebbf8d5717a2dcafcc` 已 squash 合并为 `0717c9c7a20aa7e999125c0fa82c88e5397e1795`；PR 与 merge-main CI 均为 11/11 SUCCESS；
- publication run `31515278549`、artifact `9110953066` 与 candidate `devr-0717c9c7a20a-6b552b3b08f28a19d3256195` 通过 source-free bundle、runtime/supply binding 和五个精确 `linux/amd64` image digest 验证；
- 真实 DEV 已完成 N+1 deploy 18/18、reconcile-current 17/17、rollback N 18/18、redeploy N+1 18/18 与最终无代理 reconcile-current 17/17；operation ID 与 receipt 唯一；
- 最终 Accepted state SHA-256 为 `56433f48fbf743f2ef38dab437647e188d01a40b90e4a3f62f37e9bb9e3d08d6`；current/catalog 为 N+1、rollback target 为 N、无 dirty operation；
- 独立 audit 通过 DB drift、API/Admin loopback TLS、COS write/read/hash/delete、Safety、owner 与 deletion；资源闭集为 9 个 healthy containers、13 个 networks、2 个 volumes；临时 proxy、SSH forwarding、registry credential、transfer tags、archives 与 snapshots 已清理；
- PR #134 接受前 head `b90992a3988aff8d3c216526c17d0d779f3a9b6c` 的固定 Ubuntu CI run `31522387113` 为 11/11 SUCCESS。本机 deployment suite 为 48/50，两个未通过项仅因 macOS 不提供 Linux `flock`，没有冒充 PASS；合并必须另以 PR #134 精确 final head 的 11/11 CI 和 merge receipt 为准；
- `docs/operations/development-deployment-runbook.md` 已获接受。公网 ICP/DNS/TLS 与 STAGING/PRODUCTION 独立 PostgreSQL、Redis 和对象服务 Gate 保持 pending/blocked，不属于 E-012 完成声明。

## 3. E-013 权威输入

开工时必须先按 `AGENTS.md` 恢复上下文，并运行：

```text
pnpm agent:prepare E-013 --remote --deep
```

至少读取并以原文为准：

- [可观测性和成本监控](../docs/technical/observability.md)；
- [指标口径](../docs/analytics/metrics.md)；
- [故障和安全事件响应](../docs/operations/incident-response.md)；
- [部署、配置与回滚规范](../docs/technical/deployment.md)；
- [测试策略](../docs/technical/testing.md)；
- `agent:prepare` 返回的全部其它 required sources、现有 telemetry 代码、测试 registry 和 nearby tests。

若 required source 缺失、冲突或仍未达到任务要求的 Accepted 状态，停止并记录 blocker，不自行补写合同。

## 4. E-013 范围

- 实现 structured JSON log、OpenTelemetry Trace/Metrics、OTLP Collector 与 Prometheus/OpenMetrics 合同；
- 接入 API、PostgreSQL、Redis、outbox、BullMQ、Worker、Gateway、DataTask、backup 与 release 指标；
- 创建 S33 SLO recording rules、14.4x/6x burn-rate、低流量 synthetic 与 hard-trigger 告警；
- 创建最小 Dashboard、Runbook、alert contract、`CostEntry`、`BudgetEnvelope` 与 telemetry health；
- 把本任务覆盖的 Accepted `S33-OBS-001..048` Source ID 从 `PLANNED` 更新为有断言的 `COVERED`；无法自动覆盖时只能使用获批准的 `NA_WITH_REASON`。

## 5. 不做

- 不购买或开通 SaaS，不创建真实 on-call 联系人、公开状态页或公开 SLA；
- 不启用真实 Production backend、通知接收人、值班身份、Production credential 或用户流量；
- 不记录用户原文、Prompt、SQL bind、secret、token、cookie、对象内容或可联接的普通/restricted/product analytics 数据；
- 不让监控故障放宽 Safety、删除、权限、breaker、预算或发布 Gate；
- 不启动 E-014、D-001 或任何业务功能任务；其它任务继续 Planned。

## 6. 验收要求

- 字段/label allowlist、cardinality budget、secret/raw-content detector 零命中；
- ordinary、restricted 与 product analytics 平面不可联接，运行 profile 与 credential 边界保持最小权限；
- `S33-OBS-001..048` contract/fault tests、alert known-fail、Collector/backend 丢失、低流量、预算阈值和 cardinality 负向测试有稳定 proof；
- full task Gate 与固定 Ubuntu CI 通过；外部或人工证据不能由自动化冒充；
- PR 只覆盖 E-013；若范围无法保持一个可独立验收 PR，先拆 Issue，不扩大当前任务。

## 7. 精确下一动作

1. 等待 Draft PR #135 最终 head 的固定 Ubuntu 11-check CI，重点核验 `unit-contract` 中的锁定 Collector/Prometheus/Alertmanager/Loki/Tempo runtime config Gate、Linux `flock`、audit 与 supply-chain；
2. CI 若失败，只修复 E-013 范围内的根因并重新运行完整 Gate；不得放宽 license、字段、Production 或 manual evidence policy；
3. 只有固定 Ubuntu CI 全绿后才把任务改为 `In Review`；Production 授权、人工 threat-boundary review 与 E-014 演练继续保持 pending。

## 8. Requirement-to-Proof Matrix

| Requirement                                                            | Accepted authority                                                                  | Automated proof                                                                                                | External/manual boundary                                               |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| structured JSON、OTel Trace/Metrics、OTLP/OpenMetrics 与字段平面隔离   | `docs/technical/observability.md` 5～10、24～26 节                                  | logger/span/metric contract tests、Collector config lint、raw-content/secret/cardinality known-fail            | Production backend region/RBAC/cross-border 仍 BLOCKED                 |
| API/PG/Redis/outbox/BullMQ/Worker/Gateway/DataTask/backup/release 指标 | `docs/technical/observability.md` 15～21 节                                         | metric registry completeness、runtime adapter、OpenMetrics exposition 与 component fault tests                 | 不用 telemetry 代替 PostgreSQL 业务事实或真实 restore proof            |
| 28 天 SLO、14.4x/6x burn、低流量与 hard-trigger 告警                   | `docs/technical/observability.md` 11～14 节                                         | Prometheus rule tests、alert contract/known-fail、release policy unit tests                                    | alert 只产生 S-23 incident candidate，不替代人工分级                   |
| Dashboard、Runbook、telemetry health 与 retention                      | `docs/technical/observability.md` 22～26 节；`docs/operations/incident-response.md` | provisioning/config lint、Dashboard query reference lint、runbook/alert link coverage、backend-loss fault test | 真实通知接收人、on-call、状态页和 Production delivery 演练保持 BLOCKED |
| `CostEntryV1`、`BudgetEnvelopeV1`、70/85/100%、UNKNOWN                 | `docs/technical/observability.md` 18～19 节；`docs/analytics/metrics.md` M20～M23   | closed Schema/state tests、budget threshold and per-user-query rejection fixtures                              | 绝对 Production infrastructure budget 等待 owner/vendor 决定           |
| `S33-OBS-001..048` 从 PLANNED 到有断言 COVERED                         | `docs/technical/observability.md` 28 节；`docs/technical/testing.md` 9、21、24 节   | E-013 evidence manifest + source registry Gate + full CI lanes                                                 | E-014 的 RC delivery/restore exercise 不在本任务冒充完成               |

## 9. 开工核验

- `pnpm agent:prepare E-013 --remote --deep`：READY，变更路径将 profile 提升为 `security`，remote/dependencies PASS；自动化要求 full Gate，人工边界为 `productionAuthorizationWhenApplicable` 与 `threatBoundaryReview`；
- PR #134：head `5c598132787ba14a62de793827e4fb86a6dfb59c`，11/11 exact-head checks SUCCESS，squash merge `dd201713a90b9f49e27cf66f6967210db8dc7f36`；
- Issue #50：CLOSED；本地 `main`、`origin/main` 与 GitHub `main` 均为上述 merge commit；
- required/explicit Accepted sources 已读取；Production stateful services、public TLS/ICP、backend vendor/on-call/notification authorization 未解除。

## 10. 已完成实现

- 在现有 `server-adapters` profile subpath 内实现 closed telemetry resource/attribute、低基数 metric catalog、active-series budget、OTel NodeSDK、OTLP HTTP Trace 与 OpenMetrics；未新增 workspace、业务 service 或 unrestricted capability；
- API 已接入 request span、request/in-flight/latency metric、expected 4xx 与 readiness failure 口径、trace correlation 和 exporter fail-open startup；Worker 三 profile 已接入 queue/outbox/lifecycle telemetry 与有界 shutdown；
- `CostEntryV1`、`BudgetEnvelopeV1`、UNKNOWN=`null`、70/85/100 控制、SLO classification、error-budget 与 Gateway fail-closed policy 已落地并有单元证明；
- 显式 `--observability` Compose overlay 提供 Collector、Prometheus、Loki、Tempo、Alertmanager 与 Grafana；六个镜像使用 exact digest，端口仅 loopback，网络 internal，容器为 read-only、drop-all-capabilities 与有界资源；默认 E-012 11-service Compose 不变；
- Collector 对 log/span resource 与 signal attributes 使用闭集 allowlist，raw-content detector、tail sampling、batch/retry 和 telemetry self metric 已配置；应用 heartbeat 每分钟发出，缺失 heartbeat/synthetic 使用 `absent(...)` 告警；
- 7 个 SLO、21 条 recording rules、22 条 alerts、5 个 Dashboard、6 个 Runbook 与 alert payload contract 已实现；alert 只产生 S-23 incident candidate；
- `S33-OBS-001..048` 全部绑定独立 assertion 与现有 Ubuntu `unit-contract` lane；registry 为 `736 total / 203 COVERED / 533 PLANNED / 0 NA_WITH_REASON`；E-014 exercise 保持 `E014_REQUIRED / completed=false`。

## 11. 验证与未完成证据

- PASS：format、ESLint/architecture/codegen/contracts、typecheck、全仓 build、API 45、Worker 10、server-adapters 40、Admin unit 14 + Chromium E2E 6、Miniapp 10、shared-schemas 38、api-client 4；
- PASS：PostgreSQL 18 integration 82、Redis/BullMQ/PostgreSQL resilience 7、Compose static/evidence 9、observability static 7、CI policy 24、registry 5；
- PASS：真实 loopback OpenMetrics probe 已验证 telemetry heartbeat、HTTP `0.5s/0.75s` bucket 和仅保留 environment/service/profile 的 Prometheus resource constant labels；
- PASS：exact-digest Collector `validate`、Prometheus `promtool check config`、Alertmanager `amtool check-config`、Loki `-verify-config` 与 Tempo `-config.verify=true`；该五项已固化为 `pnpm observability:runtime` 并加入现有 Ubuntu `unit-contract` lane；
- LOCAL LIMITATION：deployment suite `48/50`，仅 `T-E012-IMAGE-001` 与 `T-E012-LOCK-001` 因 macOS 缺少 Linux `flock`；必须由固定 Ubuntu CI 提供最终证据；
- LOCAL LIMITATION：`pnpm ci:audit` 因配置的 npmmirror audit response 缺少所需 metadata 而 fail closed；`pnpm ci:supply-chain:evidence` 因本机 Darwin optional package `@img/sharp-libvips-darwin-arm64@1.3.2` 未获 LGPL 例外而 fail closed；不为本机放宽 Ubuntu policy；
- PENDING：`productionAuthorizationWhenApplicable`、人工 `threatBoundaryReview`、Production backend vendor/region/RBAC/TTL/cross-border/on-call/delivery，以及 E-014 alert delivery、backend outage、TTL deletion、restore/RC 演练；这些均未声明 PASS。
