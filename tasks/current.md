# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-12（E-013 获接受并完成合并验证，E-014 成为唯一 Ready）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-014 — 执行 Phase 1 工程基础 Gate
- **任务状态**：Ready
- **任务分支**：待创建；必须从状态 PR #136 合并且 merge-main 11/11 通过后的最新 `main` 创建
- **当前 Issue**：[E-014 Issue #52](https://github.com/WeiHan1996/DailyEnergy/issues/52)
- **当前 PR**：无；开工后创建一个聚焦的 Draft PR
- **最近完成 PR**：[E-013 PR #135](https://github.com/WeiHan1996/DailyEnergy/pull/135)
- **Gate 结论**：`E014_READY / E013_DONE / E013_PR_AND_MAIN_CI_11_OF_11_PASS / E013_THREAT_BOUNDARY_APPROVED / PRODUCTION_AUTHORIZATION_NOT_GRANTED / E014_EXERCISES_REQUIRED`

## 1. 当前目标

用独立、可追溯的证据证明 Phase 1 工程基础可重复、可测试、可部署、可回滚和可恢复，并给出进入 Phase 2 的 `GO / FIX / NO-GO` 结论。

```text
clean environment + immutable build/deploy evidence
  -> migration/rollback/Redis rebuild/PITR isolated restore
  -> profile access + alert delivery/outage/budget/TTL exercises
  -> secret/content/capability review
  -> Phase 1 Gate report and explicit owner decision
```

## 2. E-013 完成交接

- 项目所有者于 2026-08-12 明确审核通过 E-013 的实现、数据边界与 Requirement-to-Proof Matrix，并授权 PR #135 标记 Ready、squash 合并和关闭 Issue #51；该决定完成 E-013 的人工 `threatBoundaryReview`；
- 批准不包含真实 Production backend、vendor、region、RBAC、TTL、cross-border、on-call、notification delivery、credential 或用户流量授权；`productionAuthorizationWhenApplicable` 继续为未授予，相关能力保持 `BLOCKED`；
- PR #135 final head `a123b553e55df0fec939211af608694155e804e9` 的固定 Ubuntu CI run `31563458000` 为 11/11 SUCCESS，包含 exact-digest Collector、Prometheus、Alertmanager、Loki、Tempo runtime config Gate 与最终 aggregate Gate；
- PR #135 已 squash 合并为 `d7500333eda31d160667a0ae0e49413f600ee0e0`；merge-main CI run `31568032735` 也为 11/11 SUCCESS，本地 `main`、`origin/main` 与 GitHub main 已核对一致；Issue #51 已关闭；
- E-013 已交付 closed structured-log/OTel resource 和 attribute contract、API 与三个 Worker profile telemetry、显式 observability Compose overlay、7 个 SLO、21 条 recording rules、22 条 alerts、5 个 Dashboard、6 个 Runbook、成本预算与 telemetry health；
- `S33-OBS-001..048` 均绑定独立断言；registry 为 `736 total / 203 COVERED / 533 PLANNED / 0 NA_WITH_REASON`；`docker/observability/exercise-contract.json` 仍保持 `E014_REQUIRED / completed=false`，没有把 E-014 演练冒充完成；
- 本机 full Gate 的 deployment suite 为 `48/50`，仅两个失败源于 macOS 没有 Linux `flock`；PR 与 merge-main 的固定 Ubuntu 11/11 Gate 已补齐平台证据。npmmirror audit metadata 和 Darwin optional LGPL exception 的本机限制没有通过放宽策略规避；
- 合并前已在一次读取中核验 final head、`CLEAN/MERGEABLE` 和 11/11 SUCCESS，merge receipt 也确认实际合并该 final head；但执行 `gh pr merge` 时漏传 Accepted testing 22.2 要求的 `--match-head-commit`，这是已知命令级流程偏差，不能重写为完全合规。E-014 必须把该偏差纳入 Gate；E-014 开始或下一次合并前，必须停止临时补偿控制并恢复 platform-enforced required checks。

## 3. E-014 权威输入

开工时必须先按 `AGENTS.md` 恢复上下文，并运行：

```text
pnpm agent:prepare E-014 --remote --deep
```

至少读取并以原文为准：

- [长期路线图](../ROADMAP.md) Phase 1 退出门槛；
- [测试策略](../docs/technical/testing.md)，特别是 22.2、RC/manual evidence、restore 与 Source-ID 规则；
- [部署、配置与回滚规范](../docs/technical/deployment.md)，特别是发布、回滚、PITR/restore 与 Production Gates；
- [可观测性和成本监控](../docs/technical/observability.md)，特别是 alert delivery、backend outage、budget、TTL 与事件演练；
- [故障和安全事件响应](../docs/operations/incident-response.md)；
- `agent:prepare` 返回的全部其它 required sources、E-014 Issue #52、executable exercise contracts、manual-RC templates、tests、fixtures 和 nearby tooling。

若 required source 缺失、冲突或仍未达到任务要求的 Accepted 状态，停止并记录 blocker，不自行补写合同。

## 4. E-014 范围

- 从 clean environment 验证 frozen install、build、migration、Compose、CI 与开发部署；
- 演练 code rollback、Redis loss/rebuild、PostgreSQL backup/PITR 隔离恢复、deletion/restore-deny detector、secret/content Gate；
- 验证 Miniapp、API、Admin、Worker 可访问性与 profile capability 边界；
- 演练 alert delivery、Collector/backend outage、budget 70/85/100、retention/TTL deletion 和 S-23 incident candidate 路径；
- 核验全部 Phase 1 Issues、Accepted Source ID、digest/manifest/receipt 和 manual evidence，不允许 silent `PLANNED` 或伪造 `PASS`；
- 形成 Phase 1 Gate 报告、已知风险、blocked Production decisions 与 `GO / FIX / NO-GO` 建议，最终 `GO` 仍需项目所有者明确确认。

## 5. 当前依赖与边界

- E-012 已 Done：固定 DEV、不可变发布、rollback、reconciliation 与独立 audit 已获接受；
- E-013 已 Done：实现、人工 threat-boundary review、PR/merge-main 11/11 Gate 与 Issue 关闭均已完成；
- E-014 Issue #52 为 OPEN，前置 E-012/E-013 已满足，因此本状态只把 E-014 提升为 Ready；
- Production 云账户、独立 stateful services、域名/ICP/TLS、真实 identity、on-call、notification delivery、backup key/restore ledger 与 cross-border review 仍保持 `BLOCKED/UNVERIFIED`；
- DEV 合成状态不能证明 Production backup/PITR、真实通知投递、Production TTL/RBAC 或用户流量安全；自动化不能替代需要的人工授权和原始外部证据。

## 6. 精确下一动作

1. 核对状态 PR 合并后的 `main`、`origin/main` 与 GitHub main 一致，并确认 E-014 是唯一 Ready；
2. 运行 `pnpm agent:prepare E-014 --remote --deep`，读取全部 required sources，建立 Requirement-to-Proof Matrix；
3. 在进入 In Progress 或下一次合并前核验 GitHub plan/ruleset；Accepted testing 22.2 的临时人工补偿控制在 E-014 开始时失效，必须恢复 platform-enforced required checks，否则将 E-014 标为 Blocked 并写明解锁条件；
4. 从核验后的 `main` 创建 `agent/e014-phase1-gate`，只创建一个聚焦的 Draft PR；若演练范围无法在一个可独立验收 PR 中完成，先拆 Issue；
5. 先固定 clean-room、restore、alert delivery、TTL、manual-RC、外部授权和不可替代证据，再执行有副作用或可能产生费用的演练；未经明确授权不得启用 Production 或使用真实用户数据。

## 7. 不做

- 本状态更新不启动 E-014 演练、不创建 Production 资源、不购买 SaaS、不配置真实 on-call/notification recipient；
- 不把 LOCAL/CI/STAGING-like 成功外推为 Production readiness；
- 不把 backup checksum、文档声明、synthetic alert 或自动化测试替代真实隔离 restore、投递和人工证据；
- 不开始 Phase 2、D-001、C-001 或任何业务功能任务；只有 E-014 Gate 获得项目所有者明确 `GO` 后，才选择一个下一任务 Ready。
