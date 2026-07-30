# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-30
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-006 — PostgreSQL 与 Prisma
- **任务状态**：Ready
- **任务分支**：尚未创建；开工时从最新 `main` 创建
- **当前 Issue**：[E-006 Issue #44](https://github.com/WeiHan1996/DailyEnergy/issues/44)
- **当前 PR**：无
- **基线提交**：`200e27de889a5cc47571e27d783aa570a381f889`
- **Gate 结论**：`READY_TO_START`

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

E-006 当前只进入 Ready，尚未创建任务分支或开始实现。开工必须先读取 Issue #44
和 `pnpm agent:prepare E-006` 返回的全部 required sources，并完成 GO/NO-GO。

## 2. 状态变更影响

- [PR #106](https://github.com/WeiHan1996/DailyEnergy/pull/106) 已 squash
  合并，E-015 进入 Done，Issue #105 已关闭；
- 最新 `main` 为 `200e27de889a5cc47571e27d783aa570a381f889`；
- E-006 恢复为唯一 Ready；其它 Phase 1 工程任务继续保持 Planned；
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
- **外部依赖**：开工时核对本地容器运行能力；不得使用真实账号、密钥或生产数据；
- **并行规则**：E-006 是唯一 Ready，尚未 In Progress；
- **下一动作**：收到开工指令后，从最新 `main` 创建 E-006 分支，运行
  `pnpm agent:prepare E-006 --remote --deep` 并完成 GO/NO-GO；
- **下一任务**：E-006 完成前不提升其它任务为 Ready。

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
- 当前控制文件将 E-015 设为 Done、E-006 设为唯一 Ready；
- 尚未创建 E-006 实现分支、运行数据库容器或修改 Prisma/migration。
