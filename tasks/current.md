# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-31
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-006 — PostgreSQL 与 Prisma
- **任务状态**：In Review
- **任务分支**：`agent/e-006-postgres-prisma`
- **当前 Issue**：[E-006 Issue #44](https://github.com/WeiHan1996/DailyEnergy/issues/44)
- **当前 PR**：[Draft PR #108](https://github.com/WeiHan1996/DailyEnergy/pull/108)
- **基线提交**：`d3a86b1705a8574a58787f96b20518ea9b4fdccf`
- **Gate 结论**：`READY_FOR_REVIEW`

## 1. 当前目标

把已接受的领域模型和数据库草案落成可迁移、可测试且按运行 profile 最小授权的
PostgreSQL 18 / Prisma 7 基线。

```text
Accepted 领域与数据库合同
  → versioned migration
  → PostgreSQL 约束与最小权限角色
  → server-adapters DB factory
  → clean / upgrade / drift / transaction 真实数据库证据
```

E-006 已完成文档范围内的实现与自动验证，现进入 Draft PR 人工审核阶段。

## 2. 状态变更影响

- [PR #106](https://github.com/WeiHan1996/DailyEnergy/pull/106) 已 squash
  合并，E-015 进入 Done，Issue #105 已关闭；
- 最新 `main` 为 `d3a86b1705a8574a58787f96b20518ea9b4fdccf`；
- E-006 是唯一 In Review；其它 Phase 1 工程任务继续保持 Planned；
- D-001～D-005 继续保持 Planned，不创建 Figma、Design Tokens 或业务页面。

## 3. 范围

- 完成单一 application schema、Prisma Schema 与首个 versioned migration；
- 实现 S-19 表、枚举、索引、唯一约束、revision/epoch/owner/delete guards
  和受审 SQL；
- 创建 api、interactive、background、restricted、migration、test 的最小
  数据库角色与 grants；
- 提供 server-adapters DB factory、合成 seed、migration checksum/drift 与
  Testcontainers harness；
- 用真实 PostgreSQL 18 验证 SQL-001～020、TX-01～09、权限和迁移路径。

## 4. 不做

- 不连接或修改生产数据库；
- 不创建真实备份服务或生产部署；
- 不实现全部业务 use case；
- 不启动 E-007、E-009、E-010、D-001 或其它下游任务；
- 不放宽 Accepted Schema、API、隐私、Safety、删除、幂等、事务或 profile
  capability 边界。

## 5. 验收与证据

- SQL-001～020、TX-01～09 与关键唯一/外键/check/grant 场景在真实
  PostgreSQL 18 通过；
- production 禁止 `db push` 和应用启动自动 migration；migration 只有一次性入口；
- Prisma row 不穿透 public contract，普通 profile 无 restricted/migration 能力；
- migration 支持 clean install、upgrade、drift 检测与 rollback/roll-forward 证据；
- 删除、恢复 ledger hook 与 migration checksum 负向测试通过；
- 完成实现后运行当前策略要求的 full validation，并提交聚焦 Draft PR。

## 6. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **前置依赖**：E-001、E-002、E-008 已完成；
- **外部依赖**：Docker 29.4.0 可用，已固定 PostgreSQL 18.0 bookworm 镜像 digest；
  不得使用真实账号、密钥或生产数据；
- **并行规则**：E-006 是唯一 In Review；
- **自动验证**：`pnpm run database:validate`、`pnpm run validate` 已通过；changed、task、
  full 三种 Agent Gate 均为 `automated=PASS`，security profile 按策略保留
  `MANUAL_EVIDENCE_REQUIRED`；
- **人工证据**：`threatBoundaryReview` 交由 PR 审核；
  `productionAuthorizationWhenApplicable` 为 N/A（无生产访问、凭据、数据、资源、部署或破坏性操作）；
- **下一动作**：审核 Draft PR，并决定是否需要修改；
- **下一任务**：不提升其它任务为 Ready。

## 7. 最近交接

- E-005 已随 PR #98 合并，Issue #43 已关闭；
- D-001～D-005 已随 PR #103 纳入 Phase 2，当前全部 Planned；
- E-015 已随 [PR #106](https://github.com/WeiHan1996/DailyEnergy/pull/106)
  squash 合并，merge commit 为
  `200e27de889a5cc47571e27d783aa570a381f889`，Issue #105 已关闭；
- E-015 最终 head `8806726e4b981275bd8500f966210e49725be51d` 已通过
  `pnpm agent:validate --mode=full --task=E-015`；
- 最终验证覆盖 format、lint、typecheck、41 条 Agent workflow cases、5 条
  workflow CLI cases、3 条敏感字段直接 canary、1 条最终入口 CLI canary、
  Playwright、bundle/contract/architecture Gate 与 build；
- PR #106 已补齐最外层诊断脱敏，覆盖 API/access key、连接串、Prompt、用户正文、
  provider/request/response body、带凭据 URL、Bearer 与私钥；
- 当前控制文件将 E-015 设为 Done、E-006 设为唯一 In Review；
- E-006 已完成 PostgreSQL 18 / Prisma 7 基线、versioned migration、最小权限角色、
  closed server-adapters、合成 seed、checksum/drift、SQL-001～020、TX-01～09 与恢复顺序证据；
- Source-ID manifest 共 101 项：52 项 `COVERED`、49 项 `NA_WITH_REASON`；
- `pnpm run validate` 与 `pnpm run database:validate` 已通过；Agent changed/task/full
  自动验证均通过，人工安全审核由 Draft PR 承接；
- 未连接生产数据库，未使用真实用户数据、真实密钥或生产备份。
