# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-02（用户接受 E-007 安全边界，批准合并）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-007 — Redis 8、BullMQ 5 与事务型 Outbox 基线
- **任务状态**：In Review
- **任务分支**：`agent/e007-redis-bullmq`
- **当前 Issue**：[E-007 Issue #45](https://github.com/WeiHan1996/DailyEnergy/issues/45)
- **当前 PR**：[Draft PR #113](https://github.com/WeiHan1996/DailyEnergy/pull/113)
- **基线提交**：`c14d8a8a8da504f708ecdf3556a1b3a9451fe058`
- **实现提交**：`1e0aa81643c24a68fb3e5e26454bd11f911353e3`
- **Gate 结论**：`AUTOMATED_PASS / USER_ACCEPTED_FOR_MERGE`（security profile）

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

E-007 已从最新 `main` 创建任务分支并进入实现。Issue #45、
`pnpm agent:prepare E-007 --remote --deep` 返回的全部 required sources，以及 Issue
列出的 Accepted architecture、testing、deployment 与 observability 原文已读取；
远端、Node、pnpm、依赖、Docker、PostgreSQL 18 与 Redis 8 开工能力核对后结论为 GO。

## 2. 状态变更影响

- E-006 PostgreSQL 与 Prisma 基线已随 PR #108 合并；安全返工 PR #110 与 post-merge
  full Gate 修复 PR #111 均已 squash 合并；
- PR #111 的 merge commit 为
  `4dd14f742b70c2d69c0b52f377b066237c51e07c`；
- E-006 最终 `pnpm run validate` 通过，真实 PostgreSQL 18
  integration/lifecycle/TX suite 为 `82/82`；
- E-006 进入 Done，E-007 是唯一 In Review；其它 Phase 1 工程任务继续保持 Planned；
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
- **安全交接**：数据库权限路径将最终 profile 提升为 `security`；Agent
  threat-boundary review 已核对最小 DB grant、严格 payload、profile/egress attestation、
  重试/终态、Redis 非权威与 telemetry 低基数边界，未发现未解决代码风险；新增
  `daily_energy_deletion` 权限仅为 `runtime_inbox_receipt` 的 INSERT/UPDATE；
- **人工证据**：changed/task/full 均为 `automated=PASS`；用户已于 2026-08-02
  明确复核并接受 threat boundary、Restricted inbox 最小权限与残余风险，批准合并；
  `productionAuthorizationWhenApplicable` 为 N/A，因为只运行本地隔离容器与合成数据，
  未访问生产凭据、数据或资源；
- **残余边界**：本任务只提供 egress manifest/fingerprint 与错误 profile 的静态/运行时
  拒绝；容器网络强制由 E-009 落地，正式指标/告警由 E-013 落地；具体业务 handler
  仍须在后续任务中同步回读 revision/guard；Redis rebuild 每次扫描有界批次，E-009
  恢复编排必须重复执行并以 PostgreSQL eligible backlog 清零为完成条件；
- **并行规则**：E-007 是唯一 In Review，不提升其它任务；
- **下一动作**：将 [PR #113](https://github.com/WeiHan1996/DailyEnergy/pull/113)
  标记为 Ready 并 squash 合并，随后验证 `main` 并完成 E-007/E-009 项目状态交接；
- **下一任务**：E-007 获接受并合并后，将 E-009 提升为唯一 Ready；当前不启动 E-009。

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
- E-007 已于 2026-08-02 从 `c14d8a8a8da504f708ecdf3556a1b3a9451fe058` 创建
  `agent/e007-redis-bullmq`；prepare deep/remote 为 READY，GO/NO-GO 结论为 GO；
- 已固定 `bullmq@5.81.3`、`ioredis@5.11.1` 与 Redis
  `8.2.1-bookworm@sha256:5fa2edb1e408fa8235e6db8fab01d1afaaae96c9403ba67b70feceb8661e8621`；
- 已实现 strict versioned envelope、三 profile capability manifest、bounded retry、
  BullMQ producer/consumer、graceful drain、PostgreSQL outbox relay/claim、同事务
  InboxReceipt、terminal receipt、relay/ACK crash hook 与 Redis-loss rebuilder；
- 新增追加型 migration `20260802000000_e007_queue_inbox_permissions`，仅向
  `daily_energy_deletion` 授予 Restricted inbox 所需的 INSERT/UPDATE；checksum、ACL
  fingerprint 与 drift probe 已更新并在 clean PostgreSQL 18 通过；
- unit queue suite `21/21`、Worker entrypoint `4/4`、scoped evidence `3/3` 和真实
  Redis 8 / BullMQ 5 / PostgreSQL 18 integration `7/7` 已通过；37 个直接覆盖的
  Accepted Source IDs 已在 `tests/queue/evidence-manifest.json` 标为 `COVERED`；
- 最终 `pnpm agent:validate --mode=changed`、`--mode=task --task=E-007` 与
  `--mode=full --profile=security` 均为 `automated=PASS`；真实 PostgreSQL 18 suite
  `82/82` 通过；策略因人工安全证据返回 `MANUAL_EVIDENCE_REQUIRED`；
- threat-boundary review 修正了 relay telemetry 的实际 queue-family 归属；最小权限、
  payload/log、profile/egress、终态、重建与合成数据边界无未解决代码发现；
- 实现提交为 `1e0aa81643c24a68fb3e5e26454bd11f911353e3`，已创建
  [Draft PR #113](https://github.com/WeiHan1996/DailyEnergy/pull/113)；用户已于
  2026-08-02 明确接受 threat boundary、Restricted inbox 最小权限与残余风险，并批准
  squash 合并；Issue #45 在合并完成前保持 Open。
