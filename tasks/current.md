# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-22
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-14
- **当前任务名称**：结构化记忆决策与规范
- **任务状态**：In Review
- **优先级**：最高
- **代码工作**：不开始正式业务代码；只允许 ADR、记忆契约、用途/状态/投影伪结构和验收矩阵
- **当前分支**：`agent/structured-memory-spec`
- **关联 PR**：待创建
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)

## 1. 当前目标

创建 Proposed `docs/decisions/ADR-0004-structured-memory.md` 与 Draft `docs/ai/memory.md`，把“真实、获准、可解释、可删除的记忆”转换为领域源、用途授权、确定性选择、最小模型投影、源依赖和无记忆回退契约。

本任务决定记忆从哪里来、可以用于什么、何时有效、怎样选择、怎样进入未来 Prompt、关闭/删除后怎样失效，以及 MVP 为什么不使用向量数据库；不实现数据库、API、resolver、Prompt v2、Safety 分类或模型调用。

## 2. 必须交付

- Proposed `docs/decisions/ADR-0004-structured-memory.md`；
- Draft `docs/ai/memory.md`；
- “领域事实 + 用途授权 + 确定性投影”架构与不用 vector database 的决策；
- `PROFILE_SETTING`、`IMPORTANT_MATTER`、`RECENT_REAL_STATE`、`RELATIONSHIP_FACT` 四类允许源；
- 禁止 note、AI 文本、分析行为、外部数据和模型推断成为记忆；
- `ADDRESS_USER`、`EXPRESSION_STYLE`、`DAILY_EXPRESSION`、`WEEKLY_SUMMARY`、提醒、关系模块和用户管理用途；
- memory master switch、逐用途 grant、事项状态、有效窗口和提及频率；
- deterministic resolver 的输入、守卫、排序、slot 与字节预算；
- MemoryCandidate、MemoryFact、SegmentMemoryContract、ContextSnapshot、SourceDependency 和 PrivacyFallback 概念契约；
- 当前 Daily/Weekly v1 保持无记忆，新记忆必须升级 plan/input/Prompt/Schema；
- source/grant 修订竞态、在途调用、缓存、MATTER/DAY/RELATIONSHIP/ACCOUNT 删除传播；
- 用户管理、来源说明、最小日志、受限审计和跨账户隔离；
- 48 项 Common/Source/Resolver/Deletion 最小回归场景；
- S-13 Accepted 收尾、docs/INDEX 与 backlog 同步。

## 3. 上游必读

1. [AGENTS.md](../AGENTS.md)；
2. [README.md](../README.md)；
3. [ROADMAP.md](../ROADMAP.md)；
4. [docs/INDEX.md](../docs/INDEX.md)；
5. [产品愿景](../docs/product/vision.md)；
6. [首批用户画像](../docs/product/persona.md)；
7. [连续七天旅程](../docs/product/journey.md)；
8. [第一阶段 MVP](../docs/product/mvp.md)；
9. [数字朋友人格](../docs/ai/personality.md)；
10. [ADR-0001 产品定位](../docs/decisions/ADR-0001-product-positioning.md)；
11. [信息架构](../docs/design/information-architecture.md)；
12. [页面规格](../docs/design/screen-specs.md)；
13. [交互状态与恢复](../docs/design/interaction-states.md)；
14. [内容布局](../docs/design/content-layout.md)；
15. [产品状态机](../docs/product/state-machine.md)；
16. [业务规则](../docs/product/business-rules.md)；
17. [今日内容 Schema](../docs/ai/daily-content-schema.md)；
18. [七天总结 Schema](../docs/ai/weekly-summary-schema.md)；
19. [共享 Schema 包](../packages/shared-schemas/README.md)；
20. [ADR-0002 稳定每日结果](../docs/decisions/ADR-0002-deterministic-daily-result.md)；
21. [确定性生成引擎](../docs/ai/generation-engine.md)；
22. [评分与规则选择](../docs/ai/scoring-rules.md)；
23. [ADR-0003 AI Gateway](../docs/decisions/ADR-0003-ai-provider-abstraction.md)；
24. [AI Gateway 规范](../docs/ai/gateway.md)；
25. [Prompt 规范](../docs/ai/prompt-spec.md)。

## 4. 已接受且不得重开的边界

- 产品是每天约一分钟的日常陪伴，不是开放聊天、专业建议或虚拟恋爱；
- 记忆只能来自用户真实提供或系统真实记录的信息，不能伪造、扩展或自动推断；
- 用户能查看、修改、关闭和删除主要资料及记忆，删除后不再进入 AI 上下文；
- 晨间、晚间、娱乐结果、行为和关系事实保持独立；
- RuleFacts、行动、任务、仪式和 Weekly aggregate 不能被记忆改变；
- 重要事项由用户主动添加，各用途分开授权，不从自由文本推断敏感结论；
- SourceDependency 与发布时无源回退是记忆表达的硬要求；
- primary、backup、template 使用相同冻结计划，不修补或跨 attempt 拼段；
- Daily/Weekly v1 明确禁止事项、近期状态和关系记忆输入；
- high-risk 退出普通流程，普通 Prompt 不是风险分类器；
- 日志、分享、通知和客户端默认最小化；
- MVP 不使用向量数据库、不抓取外部个人数据、不自动保存所有文本。

## 5. 本任务决定

1. 领域对象、grant、resolver、Prompt、Gateway、validator 和 publish 各自职责；
2. 哪四类源可以成为记忆候选，哪些源永久禁止；
3. 记忆是否复制成通用文本库，模型能否写入；
4. 各用途怎样授权、撤销与被 master switch 覆盖；
5. dated / undated matter 的有效窗口和状态；
6. recent real state 的日期窗口与最小字段；
7. relationship fact 怎样派生且不变成亲密度；
8. resolver 如何守卫、排序、限量和产生 fingerprint；
9. provider-facing fact 与 server-only dependency 怎样分离；
10. memory-backed segment 如何 exact refs 且保留无源回退；
11. 当前 v1 为什么不变，未来怎样升级版本；
12. resolver/授权/Safety 故障时怎样走完整无记忆路径；
13. 关闭、暂停、完成、过期、撤销和删除的不同语义；
14. 修订竞态、在途 provider、缓存与历史怎样失效；
15. 用户怎样管理和理解来源，日志/审计保存什么；
16. 为什么 MVP 不使用 embedding/vector，以及何时才可重评。

## 6. v1 决策摘要

- 不建立通用 memory text 表，不让模型自动写记忆；
- 四类源：PROFILE_SETTING、IMPORTANT_MATTER、RECENT_REAL_STATE、RELATIONSHIP_FACT；
- purpose 和 grant 显式隔离，Daily、Weekly、Reminder 不互相借权；
- 确定性关系查询替代 embedding/semantic search；
- Daily future context 最多 3 slots / 1 KiB，正文最多主动提及一个非 profile 事实；
- Weekly 默认不依赖记忆，未来最多 1 slot / 1 KiB 且需独立 consent；
- 当前两个 Prompt v1 的 memory slots 精确为空；
- 每个引用带 exact fact refs、source dependency 与同候选 privacy fallback；
- 无候选、关闭或 resolver 失败都使用完整一般化内容；
- 删除/撤销优先于在途生成，发布前重查 revision 和 grant；
- ordinary telemetry 只保存版本、类型、计数和 reason，不保存值；
- 48 项硬场景进入 S-16 基线。

## 7. 必须覆盖的验收场景

- 无源、master off、无 grant、用途不匹配和跨用户隔离；
- deterministic replay、稳定排序、slot/byte budget 和无 vector call；
- 安全/注入式称呼、风格修改和 profile 历史冻结；
- Daily/Weekly/Reminder grant 不互相授权；
- dated D-4/D-3/D0/D+1、undated day 1/7/8、事项五种状态；
- recent state D-1/D-2/D-3、note 排除和关系 token 派生；
- 当前 v1 空 memory、future exact refs、禁止新数字/日期/因果；
- 事项注入、长期状态推断、专业/关系越界；
- resolver 故障、主备复用 snapshot、template/no-memory fallback；
- dispatch/publish 期间撤销、修订、删除和 late response；
- MATTER/DAY/RELATIONSHIP/ACCOUNT 级联；
- 两设备编辑冲突、旧客户端/cache 不复活；
- 用户来源说明和 ordinary logs 不泄漏。

## 8. 明确不做

- 编写 memory service、resolver、PostgreSQL/Prisma、Redis、队列、API 或前端；
- 物理 retention、审计 TTL、备份清除、依法例外与删除 SLA；
- 修改 Daily/Weekly v1 Prompt、Schema 或生产 route；
- 写 S-15 风险分类和固定响应；
- 选择模型、参数、评测阈值或人工抽检比例；
- 将晚间 note、支持文本、AI 输出或分析行为升级为记忆；
- embedding、vector database、semantic search、knowledge graph；
- 开放聊天、自动人物画像、跨用户或外部数据检索；
- 为了个性化放宽 RuleFacts、Safety、删除、幂等或历史冻结。

## 9. 验收标准

- ADR 保持 Proposed、memory.md 保持 Draft，用户确认前不得标记 Accepted；
- 允许/禁止源、purpose、grant、status 和有效窗口无歧义；
- resolver、snapshot、fact refs、dependency 与 fallback 可转为实现；
- 当前 v1 无记忆与未来版本 Gate 明确；
- 删除、撤销、修订和失败不会产生幽灵引用；
- 无记忆路径完整且不是错误；
- 48 个场景 ID 唯一，覆盖 Common/Source/Resolver/Deletion；
- MVP 不创建 embedding 或 vector database；
- 文档链接、状态、版本、下游职责和 Acceptance 一致；
- docs/INDEX、tasks/current 与 backlog 同步；
- 通过独立 Draft PR 提交；
- 用户确认前不进入 S-15，也不开始记忆实现。

## 10. 完成后的下一任务

S-14 被接受后，下一任务为：

- 当前任务 ID：S-15；
- 当前任务名称：内容安全规范；
- 主要交付：`docs/ai/safety.md`；
- 依据：Accepted personality、Daily/Weekly Schema、Gateway、Prompt 与 structured-memory boundaries；
- 不开始生产 Safety classifier、地区资源服务或模型接入实现。

## 11. 最近一次交接

- 日期：2026-07-22；
- PR #16 已由用户确认并 squash 合并，main commit 为 `d8ec2a4`；
- S-13 `prompt-spec.md` 已由用户接受，Accepted 状态收尾包含在本分支；
- S-14 分支 `agent/structured-memory-spec` 从合并后的 main 创建；
- 新增 Proposed ADR-0004 与 Draft `memory.md`，覆盖四类源、用途、授权、确定性 resolver、无 vector、依赖、回退和删除；
- 记忆规范包含 48 个唯一场景：12 Common、12 Source/Grant、12 Resolver/Expression、12 Deletion/Lifecycle；
- 当前没有生产记忆、数据库、API、Prompt v2 或 Safety 实现；
- 当前没有阻塞项；
- Draft PR 尚未创建；创建后写回编号、远端范围和最终验证；
- 下一操作：完成文档校验、创建 Draft PR 并等待用户审核；确认前不合并、不开始 S-15。

## 12. 状态更新规则

任务完成待审核时：

- 状态改为 In Review；
- 写入 PR、交付物和验证；
- ADR-0004 保持 Proposed、memory.md 保持 Draft；
- S-15 不得开始。

用户确认并合并后：

- S-14 改为 Done；
- ADR-0004 与 memory.md 变为 Accepted，并记录接受日期；
- 更新 docs/INDEX.md 与 backlog；
- S-15 成为唯一 Ready 任务；
- 新会话再开始 S-15。
