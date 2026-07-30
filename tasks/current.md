# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-31
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-007 — Redis 与 BullMQ
- **任务状态**：Ready
- **任务分支**：尚未创建；开工时从最新 `main` 创建
- **当前 Issue**：[E-007 Issue #45](https://github.com/WeiHan1996/DailyEnergy/issues/45)
- **当前 PR**：无
- **基线提交**：`e9f02436ff36e9acaf1d34acb353c678453d985e`
- **Gate 结论**：`READY_TO_START`

## 1. 当前目标

建立 Redis 8 / BullMQ 5 缓存与队列适配基线，使 Worker profiles、PostgreSQL
outbox/inbox 至少一次投递和 Redis 丢失重建具备可执行、可验证的边界。

```text
PostgreSQL durable facts
  → outbox relay / lease / claim
  → versioned BullMQ queues
  → profile-scoped Worker handlers
  → InboxReceipt / unique / revision convergence
  → Redis-loss rebuild from PostgreSQL
```

E-007 当前只进入 Ready，尚未创建实现分支或开始编码。开工必须先读取 Issue #45
和 `pnpm agent:prepare E-007 --remote --deep` 返回的全部 required sources，并完成
GO/NO-GO。

## 2. 状态变更影响

- [PR #108](https://github.com/WeiHan1996/DailyEnergy/pull/108) 已 squash
  合并，E-006 进入 Done，Issue #44 已关闭；
- 最新远端 `main` 为 `e9f02436ff36e9acaf1d34acb353c678453d985e`；
- E-007 的 E-001、E-002、E-006、E-008 前置均已完成，因此成为唯一 Ready；
- E-009～E-014 及其它 Phase 1 工程任务继续保持 Planned；
- D-001～D-005 继续保持 Planned，不创建 Figma、Design Tokens 或业务页面。

## 3. 范围

- 创建 interactive、background、restricted Worker 入口及静态
  handler/capability manifest；
- 实现 Redis/BullMQ 连接、队列命名与版本、bounded retry、dead-letter
  最小元数据和 graceful drain；
- 实现 PostgreSQL outbox relay、InboxReceipt 幂等骨架、lease/claim 与可重复
  crash hooks；
- Redis 全丢后从 PostgreSQL outbox、due rows 和 DataTask 重建待处理事实；
- 用真实 Redis/BullMQ 与 PostgreSQL 验证重复、迟到、崩溃、profile 和重建路径。

## 4. 不做

- 不实现具体 Daily、Weekly、通知或删除业务 handler；
- 不引入队列 UI，不把 Redis 作为业务事实或恢复来源；
- 不连接或修改生产 Redis/PostgreSQL，不使用真实账号、密钥或用户数据；
- 不启动 E-009、E-010、E-011、D-001 或其它下游任务；
- 不放宽 Accepted Schema、API、隐私、Safety、删除、幂等、事务、profile 或
  可观测性边界。

## 5. 验收与证据

- API 不注册 processor；每个 Worker profile 只能消费 allowlist queue、handler、
  DB role 与 egress；
- 重复、迟到和崩溃窗口由 inbox、唯一键、revision 或 PublishGuard 收敛；
- Redis flush 后能从 PostgreSQL 恢复待处理事实，且不恢复已删除或 restore-deny 数据；
- 日志、queue payload 与失败元数据不含正文、Prompt、用户标识或高基数 ref；
- 真实 Redis/BullMQ + PostgreSQL 集成、profile capability、graceful shutdown、
  禁用 egress 和 Redis-loss suite 通过；
- 所覆盖 Accepted Source ID 更新为 `COVERED`；不能覆盖时只允许有批准理由的
  `NA_WITH_REASON`；
- 完成实现后运行当前策略要求的 Gate，并提交一个聚焦 Draft PR。

## 6. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **前置依赖**：E-001、E-002、E-006、E-008 已完成；
- **外部依赖**：开工时核对 Redis 8、BullMQ 5、PostgreSQL 18 与本地容器运行能力；
  不得使用真实账号、密钥或生产数据；
- **并行规则**：E-007 是唯一 Ready，尚未 In Progress；
- **下一动作**：本控制 PR 合并后同步最新 `main`，创建 E-007 实现分支，运行
  `pnpm agent:prepare E-007 --remote --deep` 并完成 GO/NO-GO；
- **下一任务**：E-007 完成前不提升其它任务为 Ready。

## 7. 最近交接

- E-005 已随 PR #98 合并，Issue #43 已关闭；
- D-001～D-005 已随 PR #103 纳入 Phase 2，当前全部 Planned；
- E-015 已随 [PR #106](https://github.com/WeiHan1996/DailyEnergy/pull/106)
  squash 合并，merge commit 为
  `200e27de889a5cc47571e27d783aa570a381f889`，Issue #105 已关闭；
- E-006 已随 [PR #108](https://github.com/WeiHan1996/DailyEnergy/pull/108)
  squash 合并，merge commit 为
  `e9f02436ff36e9acaf1d34acb353c678453d985e`，Issue #44 已关闭；
- E-006 最终 head `bc7b5c94dc3602129fa3e9d1f373f2ac8be76e47` 已完成
  PostgreSQL 18 / Prisma 7、owner/bootstrap、单一 runtime profile、实际 DDL timeout、
  语义 catalog drift、SQL-013 fragment 删除保护与 PostgreSQL URL 脱敏；
- 审核修订后的 PostgreSQL 18 suite 为 69 passed / 0 failed；
  `pnpm agent:validate --mode=full --task=E-006` 返回 `automated=PASS`，security
  profile 的自动化不可替代项由人工合并决定承接；
- 用户于 2026-07-31 明确授权合并 PR #108，作为 E-006 `threatBoundaryReview`
  的人工接受；`productionAuthorizationWhenApplicable` 为 N/A；
- E-006 未连接生产数据库，未使用真实用户数据、真实密钥或生产备份；
- 当前控制变更只将 E-006 设为 Done、E-007 设为唯一 Ready，尚未开始 E-007 实现。
