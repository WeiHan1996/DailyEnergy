# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-02（E-006 收尾并提升 E-007）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-007 — Redis 8、BullMQ 5 与事务型 Outbox 基线
- **任务状态**：Ready
- **任务分支**：尚未创建；开工时从最新 `main` 创建
- **当前 Issue**：[E-007 Issue #45](https://github.com/WeiHan1996/DailyEnergy/issues/45)
- **当前 PR**：无
- **基线提交**：`4dd14f742b70c2d69c0b52f377b066237c51e07c`
- **Gate 结论**：`READY_TO_START`

## 1. 当前目标

建立 Redis 8 / BullMQ 5 缓存与队列适配层、Worker profiles、事务型 outbox/inbox
至少一次投递和 Redis 全丢后的 PostgreSQL 权威事实重建能力。

```text
PostgreSQL outbox / due rows / active DataTask
  → bounded relay / claim
  → versioned BullMQ job
  → profile allowlist consumer
  → InboxReceipt / revision / guard 收敛重复与迟到
  → Redis 丢失后从 PostgreSQL 重建
```

E-007 当前只进入 Ready，尚未创建任务分支或开始实现。开工必须先读取 Issue #45、
`pnpm agent:prepare E-007 --remote --deep` 返回的全部 required sources，以及 Issue
列出的 Accepted architecture、testing、deployment 与 observability 原文，并完成 GO/NO-GO。

## 2. 状态变更影响

- E-006 PostgreSQL 与 Prisma 基线已随 PR #108 合并；安全返工 PR #110 与 post-merge
  full Gate 修复 PR #111 均已 squash 合并；
- PR #111 的 merge commit 为
  `4dd14f742b70c2d69c0b52f377b066237c51e07c`；
- E-006 最终 `pnpm run validate` 通过，真实 PostgreSQL 18
  integration/lifecycle/TX suite 为 `82/82`；
- E-006 进入 Done，E-007 成为唯一 Ready；其它 Phase 1 工程任务继续保持 Planned；
- D-001～D-005 继续保持 Planned，不创建 Figma、Design Tokens 或业务页面。

## 3. 范围

- 创建 interactive、background、restricted Worker 入口及静态 handler/capability manifest；
- 实现 Redis/BullMQ 连接、队列命名/version、bounded retry、dead-letter 元数据和 graceful drain；
- 实现 PostgreSQL outbox relay、InboxReceipt 幂等骨架、lease/claim 与 crash hooks；
- 实现 Redis 全丢后从 PostgreSQL outbox、due rows 和 DataTask 重建，不把 Redis 当业务事实；
- 用真实 Redis 8、BullMQ 5 与 PostgreSQL 18 验证重复、崩溃、迟到、profile 和重建语义。

## 4. 不做

- 不实现具体 Daily、Weekly、通知或删除业务 handler；
- 不引入队列管理 UI；
- 不连接生产 Redis/PostgreSQL，不使用真实账号、密钥或用户数据；
- 不启动 E-009、E-010、D-001 或其它下游任务；
- 不放宽 Accepted 隐私、Safety、删除、幂等、事务、profile 或可观测性边界。

## 5. 验收与证据

- API 不注册 processor；每个 Worker profile 只能消费 allowlist queue、handler、DB role 与 egress；
- 重复、迟到与 crash window 由 InboxReceipt、唯一键、revision、guard 和 PublishGuard 收敛；
- Redis flush 后可恢复待处理事实，不恢复已删除、restore-deny 或过期数据；
- 日志、job 和 dead-letter 元数据不含正文、Prompt、用户标识或高基数 ref；
- 真实 Redis/BullMQ + PostgreSQL 集成、重复/崩溃/延迟/重建 suite 通过；
- profile capability、graceful shutdown 和禁用 egress 负向测试通过；
- 对应 Accepted Source ID 更新为 `COVERED`，或使用带批准理由的 `NA_WITH_REASON`；
- 完成实现后运行策略要求的 full validation 并提交聚焦 Draft PR。

## 6. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **前置依赖**：E-001、E-002、E-006、E-008 已完成；
- **外部依赖**：开工时核对 Docker、Redis 8 与 PostgreSQL 18 本地容器能力；只使用合成数据；
- **安全交接**：E-006 自动化 full Gate 已补齐；`productionAuthorizationWhenApplicable`
  为 N/A，原安全返工的人工 threat-boundary 风险由用户在获知证据边界后明确接受合并；
- **并行规则**：E-007 是唯一 Ready，尚未 In Progress；
- **下一动作**：收到 E-007 开工指令后，从最新 `main` 创建 `agent/e007-redis-bullmq`，运行
  `pnpm agent:prepare E-007 --remote --deep` 并完成 GO/NO-GO；
- **下一任务**：E-007 完成前不提升其它任务为 Ready。

## 7. 最近交接

- E-006 基线已随 [PR #108](https://github.com/WeiHan1996/DailyEnergy/pull/108)
  squash 合并，Issue #44 已关闭；
- E-006 安全返工已随 [PR #110](https://github.com/WeiHan1996/DailyEnergy/pull/110)
  squash 合并，merge commit 为
  `aa78bdd6af5936fddb56bae957a9dd881ef635f9`；
- PR #110 合并后，在完全访问环境运行 full Gate，发现 stale catalog fingerprint、
  S19-DB-011 保留字别名和 `INHERIT FALSE` 下 role probe 未返回稳定 mismatch；
- [PR #111](https://github.com/WeiHan1996/DailyEnergy/pull/111) 使用 clean PG18 重生成
  fingerprint，将 privilege probe 改为 catalog OID，并修复测试 SQL；已 squash 合并为
  `4dd14f742b70c2d69c0b52f377b066237c51e07c`；
- 最终验证：`pnpm run validate` 通过；真实 PostgreSQL 18 数据库测试 `82/82`，API
  `36/36`，Admin Chromium `6/6`，response leak negative fixtures `2/2`；
- E-007 Issue #45 保持 Open，本次仅提升为 Ready，尚未创建实现分支或修改 Redis/BullMQ 代码。
