# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-26
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-29
- **当前任务名称**：系统架构
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/system-architecture`
- **上游 PR**：[S-28 PR #33](https://github.com/WeiHan1996/DailyEnergy/pull/33)
- **当前 PR**：[Draft PR #34](https://github.com/WeiHan1996/DailyEnergy/pull/34)
- **交付文件**：`docs/technical/architecture.md`

## 1. 当前目标

把 Accepted 的 AI Gateway、领域/数据库/API、隐私和 Monorepo 决策转换为可实施且不过度工程化的系统架构，明确：

- 微信小程序、NestJS API、Next.js Admin、Worker、PostgreSQL、Redis/BullMQ 与外部平台边界；
- 模块化单体、无内部 RPC、单数据库与单应用 schema；
- API、Interactive Generation、Background、Restricted Data Worker profile；
- 同步命令、TX-01～09、事务型 outbox/inbox 与 BullMQ 至少一次投递；
- AI Gateway 运行位置、Daily/Weekly 容量、provider/template 与发布边界；
- Redis/cache/breaker/queue 的非权威职责与故障恢复；
- Safety、删除、Admin、数据库角色、受限 egress 和演进门槛。

## 2. 必须交付

### 2.1 系统与运行时

- 系统上下文、信任边界和外部适配器；
- API/Admin/Worker 长期运行时和一次性 migration/evaluation job；
- 一个 Worker artifact，以 Interactive、Background、Restricted 三类 profile 运行；
- 模块化单体，不创建内部 HTTP/RPC、微服务或独立数据库。

### 2.2 一致性与异步

- 用户可观察事实先在 PostgreSQL 短事务成立；
- TX-01～09 映射到同步事务与提交后异步副作用；
- outbox relay → BullMQ → InboxReceipt 的至少一次传递与 crash recovery；
- CommandReceipt、unique、revision、epoch、PublishGuard 与 unknown outcome；
- Redis/queue/cache 丢失可由 outbox、due rows、DataTask 和权威源重建。

### 2.3 安全与下游

- Safety input gate、TX-05、固定响应和 ordinary Gateway 零调用；
- 删除 guard 同步、Restricted Worker 异步、失败不解封；
- 单 PostgreSQL database/application schema、S-19 前缀和最小角色/grants；
- Admin 独立鉴权且只调用 NestJS Admin API；
- 48 个唯一 `S29-ARCH-*` 场景；
- S-30～S-33 与 E-003/E-006/E-007 的清楚交接。

## 3. 上游读取顺序

1. `AGENTS.md`、`README.md`、`ROADMAP.md`、`docs/INDEX.md`、本文；
2. `docs/decisions/ADR-0002`、`ADR-0003`、`ADR-0005`、`ADR-0006`；
3. `docs/ai/gateway.md`；
4. `docs/data/domain-model.md`；
5. `docs/technical/database.md`、`api.md`、`error-codes.md`；
6. `docs/operations/privacy-data-map.md`、`incident-response.md`；
7. `docs/analytics/event-tracking.md`、`metrics.md`；
8. `packages/shared-schemas`、`prisma/schema.prisma`、`openapi/openapi.yaml`；
9. `docs/technical/architecture.md`。

## 4. 已冻结边界

- 微信原生小程序、NestJS 11/Express 5、Next.js 16、PostgreSQL 18/Prisma 7、Redis 8/BullMQ 5 和 Zod 4 不重新选型；
- PostgreSQL 是业务事实，Redis/BullMQ/cache/analytics 不是；
- 同用户同日唯一、历史不可变、Safety/deletion guard、DAY 重记与 API 契约不变；
- Gateway primary → backup → template 顺序、8/20 秒 deadline、完整候选、最小披露和固定高风险旁路不变；
- outbox/inbox 是可靠传递机制，不是永久审计；
- Admin 不直连数据/provider；
- Phase 1～3 不拆微服务、多数据库、读副本或多 region；
- 当前没有应用/Worker runtime、migration、Redis queue 或生产配置。

## 5. 不做

- 不创建或修改 root workspace、apps、packages、tsconfig、Docker、CI；
- 不创建 NestJS/Next.js/Worker 代码、Prisma migration、Redis key 或 BullMQ queue；
- 不决定目录/public exports（S-30）、测试矩阵（S-31）、部署厂商/网络（S-32）或 SLO/告警（S-33）；
- 不选择具体 AI provider/model、SSO、对象存储或微信模板；
- 不提前开始 E-001 或业务实现。

## 6. 验收标准

- `architecture.md` 为 Draft，包含上下文、运行时、模块、事务、outbox/inbox、Gateway、Redis/cache、角色、故障与演进；
- 48 个 `S29-ARCH-*` 场景完整且唯一；
- 所有相对链接可解析；
- ADR-0006 根据用户确认转为 Accepted，S-28 backlog 为 Done；
- README、INDEX、tasks/current 和 backlog 一致标记 S-29 In Review；
- PR 仅包含 6 个 Markdown 文件，无代码、workspace、Schema、API、数据库或配置变更；
- 用户确认前 `architecture.md` 保持 Draft，S-29 保持 In Review。

## 7. 最近交接

- [PR #33](https://github.com/WeiHan1996/DailyEnergy/pull/33) 已于 2026-07-26 合并，ADR-0006 / S-28 已获用户明确确认；
- ADR-0006 在本分支补记 Accepted/接受日期，不改变 Monorepo 与技术栈结论；
- S-29 Draft 冻结模块化单体、运行时/Worker profiles、单数据库/schema、事务/outbox/inbox 与 Gateway 边界；
- Redis/cache/queue 仅承担可恢复运行能力，guard、命令和发布事实仍在 PostgreSQL；
- 已定义 48 个架构验证场景，S-30 是下一任务；
- 当前动作：等待用户审核 [Draft PR #34](https://github.com/WeiHan1996/DailyEnergy/pull/34)；不自动接受、合并或开始 S-30。
