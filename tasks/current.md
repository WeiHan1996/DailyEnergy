# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-31（安全缺陷修复中断 E-007）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-006 — PostgreSQL 与 Prisma（PR #108 安全返工）
- **任务状态**：In Review
- **任务分支**：`agent/pr108-security-fixes`
- **当前 Issue**：基于 Issue #44 修复
- **当前 PR**：Draft（待创建）
- **基线提交**：`e9f02436ff36e9acaf1d34acb353c678453d985e`
- **Gate 结论**：`MANUAL_EVIDENCE_REQUIRED`（`automated=PASS`）

## 1. 当前目标

修复 PR #108（E-006 PostgreSQL 基线）复审发现的三个 P1 安全缺陷：

1. SQL-013 可通过 visibility 状态切换和 weekly current 指向绕过；
2. SQL-007 允许跨账户的 MorningCheckin 注入发布结果；
3. Restricted 角色授权过宽，factory 身份校验无法检测直接越权 grant。

属于对 E-006 合并后发现的安全缺陷紧急修复，完成后回到 E-007。

修复范围仅限 PostgreSQL migration、DB factory、相关测试和证据清单，不涉及
业务逻辑或下游任务。

## 2. 状态变更影响

- PR #108 合并后的安全复审发现三个 P1 缺陷，全部在真实 PostgreSQL 18 上复现；
- 按 AGENTS.md §2 紧急缺陷规则，E-006 曾在合并后重新进入 In Progress，现已完成修复并进入 In Review；
- 修复通过后立即回到 E-007，不扩大范围；
- E-006 相关的测试注册表 COVERED 声明需要校准补充。

## 3. 范围

- 新增一条 versioned migration，修复 SQL-007、SQL-013 触发器覆盖缺口；
- 拆分 `daily_energy_restricted` 为 `daily_energy_safety` 与 `daily_energy_deletion`
  两个角色，各自最小授权；
- 强化 `createClosedDatabaseFactory` 的 capability 探针：不只检查 profile 角色
  成员，还要断言无额外 DML、无额外角色成员；
- 补充对应负向 PostgreSQL 集成测试，全部在真实 PG 18 上通过；
- 更新 evidence-manifest 的 COVERED 登记。

## 4. 不做

- 不改业务逻辑、不引入新功能、不碰 Redis/BullMQ 或 E-007 范围；
- 不连接或修改生产数据库，不使用真实账号、密钥或用户数据；
- 不创建新的 Accepted ADR 或修改已有 Accepted 规格；
- 不放宽 Accepted Schema、API、隐私、Safety、删除、幂等、事务、profile 或
  可观测性边界。

## 5. 验收与证据

- SQL-013 的 visibility 激活路径与 weekly current 切换路径均被拒绝；
- SQL-007 的跨主 checkin snapshot 路径被拒绝；
- safety 与 deletion 角色能力分离，factory 能检测直接越权 grant；
- 全部数据库集成、生命周期和事务测试共 74 个继续通过；
- 真实 PostgreSQL 18 上验证通过；
- evidence-manifest 中 SQL-007、SQL-013 保持/更新为 `COVERED`；
- 运行安全 Gate。

## 6. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **安全 Gate 阻塞**：自动化已通过；按 security profile 仍需人工
  `threatBoundaryReview`，并确认 `productionAuthorizationWhenApplicable`（本地合成环境、未访问生产，预期为 N/A）；
- **前置依赖**：PR #108 已合并为基线 `e9f0243`；
- **外部依赖**：本地 Docker 运行 PostgreSQL 18；
- **并行规则**：唯一当前审核任务是 E-006 安全返工；E-007 保持 Planned；
- **验证结果**：`pnpm run validate` 通过；真实 PostgreSQL 18 集成/生命周期/TX-01..09 共 74/74 通过；
  `pnpm agent:validate --mode=full --task=E-006` 返回
  `MANUAL_EVIDENCE_REQUIRED`（`automated=PASS`）；
- **下一动作**：创建并提交聚焦 Draft PR，附上人工 threat-boundary 复核结论；
- **下一任务**：修复合并后回到 E-007。

## 7. 最近交接

- E-006 已随 [PR #108](https://github.com/WeiHan1996/DailyEnergy/pull/108)
  squash 合并，merge commit 为
  `e9f02436ff36e9acaf1d34acb353c678453d985e`，Issue #44 已关闭；
- 用户于 2026-07-31 要求对已合并的 PR #108 再次复审，复审发现三条 P1 安全缺陷；
- 用户要求立即修复；按 AGENTS.md §2 紧急缺陷规则中断 E-007 并创建本任务；
- 修复分支 `agent/pr108-security-fixes` 基于 `e9f0243`。
