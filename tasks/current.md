# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-12（E-012 最终证据获接受，E-013 成为唯一 Ready）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-013 — 实现脱敏日志、指标、Trace、SLO 与成本监控基线
- **任务状态**：Ready
- **任务分支**：待创建；必须从 PR #134 squash merge 后核验一致的 `main` 创建
- **当前 Issue**：[E-013 Issue #51](https://github.com/WeiHan1996/DailyEnergy/issues/51)
- **当前 PR**：无；开工后创建一个聚焦的 Draft PR
- **最近完成 PR**：[E-012 final evidence PR #134](https://github.com/WeiHan1996/DailyEnergy/pull/134)
- **Gate 结论**：`E013_READY / E012_DONE / E012_FINAL_EVIDENCE_ACCEPTED / DEV_ACCEPTED_RELEASE_HEALTHY / PUBLIC_TLS_ICP_PENDING / PRODUCTION_STATEFUL_SERVICES_BLOCKED`

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

1. 开工前确认 PR #134 的 exact-head CI、merge receipt、squash merge、merged-main 核验与 E-012 Issue #50 关闭均已完成；任一不满足即停止；
2. 核对 `main`、`origin/main` 与 GitHub main 一致；
3. 运行 `pnpm agent:prepare E-013 --remote --deep` 并读取全部 required sources；
4. 从核验后的 `main` 创建 `agent/e013-observability`；
5. 建立 requirement-to-proof matrix，确认 bounded deliverables 后再开始实现并创建 Draft PR。

本状态只把 E-013 提升为 Ready，不表示已创建分支、开始实现或解除任何 Production Gate。
