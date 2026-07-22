# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-22
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-19
- **当前任务名称**：数据库规格与 Prisma 草案
- **任务状态**：In Review
- **优先级**：最高
- **代码工作**：只定义 PostgreSQL/Prisma 结构、约束、事务、保存、删除、迁移与测试契约；不创建 migration、数据库、API、worker 或生产业务代码
- **当前分支**：`agent/database-spec`
- **关联 PR**：待创建
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)

## 1. 当前目标

创建 Draft [数据库规格](../docs/technical/database.md) 与 [Prisma 草案](../prisma/schema.prisma)，把 Accepted [领域模型](../docs/data/domain-model.md) 和 [ADR-0005](../docs/decisions/ADR-0005-data-retention-and-deletion.md) 转换为可直接指导 E-006 的 PostgreSQL 表、索引、约束、事务、保存与删除契约。

本任务决定“数据落在哪、数据库保护什么、Prisma 表达什么、SQL migration 还要补什么、关键命令怎样原子、TTL/删除怎样不复活”。它不创建或运行数据库，不开始 API、NestJS repository、worker、migration 或真实数据处理。

## 2. 必须交付

- Draft `docs/technical/database.md`；
- 可被 Prisma 7 format/validate 的 `prisma/schema.prisma` 草案；
- Active Product、Restricted、Runtime、System、Evaluation 五个逻辑数据区；
- 账户、身份、同意、资料、签到、生成、发布、互动、关系、事项、记忆、Weekly、Safety、通知、DataTask、版本与评测的表映射；
- UUID、ProductDate、timestamptz、revision、epoch、fingerprint、JSONB 与密文规则；
- owner/date、attempt、relationship、notification、DataTask 等唯一性；
- nullable active slot 与 SQL-001～020 PostgreSQL 补强清单；
- TX-01～TX-09 原子事务与 PublishGuard；
- outbox/inbox 可靠事件与旧 epoch 拒绝；
- retention metadata、TTL scan、DAY/MATTER/RELATIONSHIP_DATA/ACCOUNT 硬删除、provider、backup 与 restore deny；
- 数据库角色、应用层加密、日志和导出边界；
- migration、回滚、合成 fixture 与 drift 规则；
- 64 项 S-19 数据库验收场景；
- ADR-0005 Accepted 收尾；
- docs/INDEX、backlog 和任务交接同步。

## 3. 上游必读

1. [AGENTS.md](../AGENTS.md)；
2. [README.md](../README.md)；
3. [ROADMAP.md](../ROADMAP.md)；
4. [docs/INDEX.md](../docs/INDEX.md)；
5. [产品状态机](../docs/product/state-machine.md)；
6. [业务规则](../docs/product/business-rules.md)；
7. [今日内容 Schema](../docs/ai/daily-content-schema.md)；
8. [晚间反馈 Schema](../docs/ai/evening-feedback-schema.md)；
9. [七天总结 Schema](../docs/ai/weekly-summary-schema.md)；
10. [共享 Schema 包](../packages/shared-schemas/README.md)；
11. [ADR-0002 稳定每日结果](../docs/decisions/ADR-0002-deterministic-daily-result.md)；
12. [确定性生成引擎](../docs/ai/generation-engine.md)；
13. [评分与规则选择](../docs/ai/scoring-rules.md)；
14. [ADR-0003 AI Gateway](../docs/decisions/ADR-0003-ai-provider-abstraction.md)；
15. [AI Gateway](../docs/ai/gateway.md)；
16. [Prompt 规范](../docs/ai/prompt-spec.md)；
17. [ADR-0004 结构化记忆](../docs/decisions/ADR-0004-structured-memory.md)；
18. [结构化记忆](../docs/ai/memory.md)；
19. [内容安全](../docs/ai/safety.md)；
20. [AI 评价与回归](../docs/ai/evaluation.md)；
21. [领域模型](../docs/data/domain-model.md)；
22. [ADR-0005 数据保存与删除](../docs/decisions/ADR-0005-data-retention-and-deletion.md)。

## 4. 已接受且不得重开的边界

- PostgreSQL + Prisma 技术栈不变，精确版本在 S-28/E-006 固定；
- ProductDate 由 Asia/Shanghai 04:00 policy 解析，数据库不信客户端时间；
- owner + date 只有一个 Checkin、GenerationIntent、PublishedDailyResult 和 DailyInteraction；
- intent 唯一性不包含 result version 或 deletion epoch；
- published Daily/Weekly 与 frozen snapshot 不原地改写；
- DailyInteraction 只协调 light/task/helpfulness/feedback，EVE 三组件原子保存；
- RelationshipCycle + EncounterLink 防止关系删除后旧 light 重放；
- source/grant/snapshot/dependency/fallback 分开，不创建 generic memory text 或向量库；
- v1 Daily/Weekly memory facts 仍为空；
- Safety/deletion epoch 胜过生成、通知、缓存、队列和迟到 candidate；
- provider request body、invalid raw response、Prompt、Safety 原文和普通自由文本日志不落库；
- ADR-0005 的 24 个月无使用、72 小时在线清理、30 天 provider、35 天备份、45 天 DAY guard 与最小回执保持不变；
- generic soft delete 不是完成状态；
- EvaluationRun 只使用 SyntheticSubjectRef。

## 5. 本任务决定

1. 单 PostgreSQL 权威库与五个逻辑数据区；
2. 每个领域聚合、运行对象、投影和受限证据的表职责；
3. UUID、date、timestamptz(3)、bytea、JSONB 和密文字段约定；
4. Prisma Schema 直接表达的 relation/unique/index；
5. SQL-001～020 的 CHECK、trigger、immutability、grants 与跨表约束；
6. nullable active slot 如何避免依赖 partial-index preview；
7. revision/CAS、CommandReceipt 与 Unknown outcome；
8. PublishGuard 在发布事务中重查哪些权威值；
9. TX-01～TX-09 原子边界；
10. Outbox/Inbox 的事务、去重、allowlist 与旧 epoch 处理；
11. 每行 retention metadata、TTL worker 与硬删除拓扑；
12. DAY/MATTER/RELATIONSHIP_DATA/ACCOUNT 的数据库清理；
13. DayErasureGuard、DeletionReceipt、ProviderDeletionRequest、BackupCatalog 和 RestoreDeny；
14. envelope encryption、HMAC lookup、数据库角色与日志边界；
15. migration、回滚、合成数据与 drift；
16. 64 项数据库验收矩阵；
17. S-20/E-006/S-21/S-29～S-33 交接。

## 6. v1 设计摘要

- Prisma 7 draft 使用 PostgreSQL datasource、foreign keys 和显式 model/index/unique；
- 表按 `app_`、`restricted_`、`runtime_`、`system_`、`evaluation_` 前缀分区；
- 普通产品 child 默认 `ON DELETE RESTRICT`，ACCOUNT worker 显式按拓扑硬删除；
- personal/restricted 行保存 policy version、scope、anchor 和 expires；
- 密文与 key version 成对，身份 lookup 使用 HMAC token；
- JSONB 只保存版本化、Zod 验证、大小受限对象，不隐藏 owner/date/state/revision；
- owner/date、attempt、semantic notification、source dependency 与 active task 由数据库唯一/索引保护；
- active cycle/task 使用 true/null active slot，SQL CHECK 保证状态耦合；
- snapshot/result/catalog 不允许语义 UPDATE；
- PublishGuard 在发布事务重查 account、Safety、deletion、intent 与 source/grant；
- outbox 与领域写同事务，inbox 负责消费者去重；
- TTL worker 使用 expires index、小批 claim 和 hard delete，legal hold 只进入 restricted frozen；
- DayErasureGuard 无 Account FK，字段严格 allowlist，最多 45 天；
- Prisma preview feature 不承担核心正确性；复杂约束由 reviewed SQL migration 补强；
- 本任务不生成 migration 或 Prisma Client。

## 7. 必须覆盖的验收场景

- 外部身份并发、密文/lookup、删除后新账户与同意周期；
- Profile CAS、命令同载荷/异载荷、ProductDate 伪造；
- 同日 Checkin/Intent/Result 并发、snapshot 冻结、attempt 去重与 epoch race；
- EVE 原子冲突、HIGH_RISK 普通写 0、UNRATED 缺行；
- 点亮 outbox/inbox、active cycle 与旧 DayLit 重放；
- matter 密文、purpose grant 隔离、fragment fallback/blocked；
- Weekly fingerprint、note-only 不变与 current pointer CAS；
- Safety epoch、固定响应、recovery 与通知 dispatch；
- active DataTask、FAILED 不解封、DAY 重记、45/35/30 天上限；
- backup restore deny、ACCOUNT 最小 receipt；
- outbox crash、TTL 并发、legal hold 与 Unknown outcome；
- 数据库 grants、日志脱敏、provider profile、synthetic evaluation、migration/drift。

## 8. 明确不做

- 创建 `prisma.config.ts`、migration、数据库、角色、密钥或备份；
- 运行 `prisma migrate`、`db push`、seed 或任何真实数据写入；
- 编写 NestJS repository、API、worker、队列、cache 或业务代码；
- 固定 PostgreSQL/Prisma/Node/adapter 精确版本；
- 选择云数据库、KMS、对象存储、provider 或 RLS 方案；
- 修改共享 Schema、生成事实、Prompt、Memory、Safety 或 retention 决策；
- 创建 generic `user_data`、`daily_status`、`memory_text`、raw provider output 或通用 soft delete；
- 保存真实用户、微信身份、Safety 原文、Prompt 或生产 dump；
- 提前开始 S-20 API 契约。

## 9. 验收标准

- database.md 与 schema.prisma 状态保持 Draft，用户确认前不得 Accepted；
- Prisma 7 format 与 validate 通过；
- Prisma 草案中的 model、enum、relation、index、unique 完整且无悬空；
- SQL-001～020 清楚区分 Prisma、SQL、服务和运维责任；
- 关键领域唯一性、TX-01～09、outbox/inbox、PublishGuard 和删除 guard 可实施；
- personal/restricted 数据有保存元数据、closed allowlist 例外或明确的 T4 例外；
- 没有 forbidden text/raw/seed/AccountRef-to-evaluation 字段；
- 64 个 S19-DB ID 唯一；
- S-17/S-18 各 48 项场景可映射到数据库或服务测试；
- ADR-0005 转 Accepted 并记录 PR #21/merge commit；
- docs/INDEX、backlog、current 只有 S-19 为 In Review；
- Draft PR 只含 6 个目标文件，不含 migration、API 或生产代码。

## 10. 下一步

S-19 被接受后，下一任务为：

- 当前任务 ID：S-20；
- 当前任务名称：API 契约；
- 主要交付：`docs/technical/api.md`、`docs/technical/error-codes.md` 与 OpenAPI 草案；
- 依据：Accepted shared schemas + domain model + ADR-0005 + database spec；
- 不提前创建 NestJS controller、数据库 migration 或生产实现。

## 11. 最近一次交接

- 日期：2026-07-22；
- PR #21 已由用户确认并 squash 合并，main commit 为 `31eb8cc1c4fe90bef6f73471779d255bdb34c012`；
- S-18 ADR-0005 已由用户接受，当前分支负责将其收尾为 Accepted；
- S-19 分支 `agent/database-spec` 从该 main commit 创建；
- 目标范围为 6 个文件：database spec、Prisma draft、ADR-0005、INDEX、backlog、current；
- database spec、Prisma schema、SQL-001～020 与 64 项验收场景已完成本地初稿；
- Prisma format/validate、链接、字段扫描、状态和远端逐文件回读待最终执行；
- Draft PR 待创建；
- 当前没有 migration、数据库、API、worker、生产代码、provider 调用或真实数据改动。

## 12. 状态更新规则

PR 创建前：

- database.md 与 schema.prisma 保持 Draft；
- ADR-0005 转 Accepted；
- backlog 中 S-18 为 Done、S-19 为 In Review；
- 关联 PR 为待创建；
- S-20 不得开始。

PR 创建后：

- 写入实际 PR、提交范围和最终验证；
- 两份 S-19 交付仍保持 Draft；
- S-20 不得开始。

用户确认并合并后：

- database.md 与 schema.prisma 变为 Accepted 并记录日期；
- S-19 改为 Done；
- 更新 docs/INDEX 与 backlog；
- S-20 成为下一任务；
- 新分支再开始 S-20。
