# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-22
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-17
- **当前任务名称**：领域模型
- **任务状态**：In Review
- **优先级**：最高
- **代码工作**：不开始数据库、Prisma、API 或正式业务代码；只定义领域语言、聚合、实体、关系、唯一性、修订、幂等、发布栅栏和删除失效概念契约
- **当前分支**：`agent/domain-model`
- **关联 PR**：[#20](https://github.com/WeiHan1996/DailyEnergy/pull/20)
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)

## 1. 当前目标

创建 Draft [docs/data/domain-model.md](../docs/data/domain-model.md)，把 S-05～S-16 已接受的状态、Schema、稳定生成、Gateway、Prompt、结构化记忆、Safety 与评价交接转换为可直接指导 S-18～S-20 的领域模型。

本任务确定“谁拥有哪项事实、哪些对象必须原子、哪些对象不可变、哪些引用必须随源删除失效”。它不决定 PostgreSQL 表、Prisma model、保存期限、软删/硬删、API DTO 或生产实现。

## 2. 必须交付

- Draft `docs/data/domain-model.md`；
- 账户、同意、资料、产品时间、Daily、Generation、Publication、Interaction、Relationship、Matter/Memory、Weekly、Safety、Notification、Data Rights/Evidence 上下文地图；
- UserAccount、Profile、Checkin、GenerationIntent、PublishedDailyResult、DailyInteraction、RelationshipCycle、ImportantMatter、WeeklyWindow、SafetyState、NotificationIntent、DataTask 等聚合边界；
- OwnerRef、StableSubjectId、ProductDate、Revision、Fingerprint、Epoch、Intent、Attempt、Snapshot、SourceDependency 的统一语义；
- owner + product date 的 intent/result 唯一性与 Gateway attempt、notification intent、DataTask 等语义唯一性；
- DailyInteraction 的反馈/帮助度/任务协调原子边界；
- RelationshipCycle + EncounterLink 的删除后不复活边界；
- Safety revision/epoch 与 deletion guard 的 PublishGuard；
- DAY / MATTER / RELATIONSHIP_DATA / ACCOUNT 删除失效矩阵；
- 48 项最小验收场景；
- S-16 evaluation 与 corpus Accepted 收尾；
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
20. [AI 评价与回归](../docs/ai/evaluation.md)。

## 4. 已接受且不得重开的边界

- 产品日期固定 `Asia/Shanghai`、04:00，命令接受时冻结日期和 policy version；
- 同一用户同一产品日期只有一个生成意图和一个 AVAILABLE 结果，唯一性不包含 result version；
- Checkin 可修订但不会重写生成快照或已发布结果；
- 规则写事实，AI 只表达；主、备、模板使用同一冻结输入且只返回完整对象；
- 每日结果和周总结修订不可原地重写；
- 点亮、任务、帮助度、晚间反馈和关系不能合成一个可写 daily status；
- 关系来自有效点亮源日，不是连续签到、积分或亲密度；
- 记忆来自领域源 + 精确用途授权 + 确定性投影，不使用 generic memory text、embedding 或向量库；
- Daily/Weekly v1 memory 仍为空；
- high-risk 先于普通领域写入，ordinary primary/backup/template call = 0；
- Safety 独立于日期且不保存原文、诊断、confidence 或 classifier rationale；
- 晚间 note 不进入普通 AI、周总结、记忆、通知、分享或 analytics；
- 删除任务与对象状态分开；源删除后派生、缓存、队列和迟到候选不得复活；
- ADR-0005 接受前 DAY 删除后同日重新开始保持禁用；
- EvaluationRun 和 synthetic evidence 不得关联真实 AccountRef 或用户数据。

## 5. 本任务决定

1. 13 个领域上下文和单向依赖；
2. 业务实体、值对象、派生投影和不可变目录的分类；
3. UserAccount、Consent、Profile 与 Onboarding Completion 的分离；
4. ProductDate、continuation grant 与命令接受身份；
5. MorningCheckin 的唯一性、revision 和结果冻结关系；
6. GenerationIntent / Invocation / Attempt / Candidate / PublishedResult 的分离；
7. DailyInteraction 是否为晚间协调保存的一致性边界；
8. RelationshipCycle、EncounterLink 和 NodeReceipt 如何阻止删除后旧关系复活；
9. Matter、Grant、MentionReceipt、ContextSnapshot、Dependency/Fallback 的分离；
10. WeeklyWindow 的 source fingerprint 和不可变 summary revision；
11. SafetyDecision/State/Event/ResponsePlan/ResourceEntry 的分离；
12. NotificationPreference/PermissionSnapshot/Intent/DeliveryAttempt 的分离；
13. DataTask 与业务删除状态怎样配合；
14. Revision、Fingerprint、Epoch 各自解决什么问题；
15. PublishGuard 需要冻结/比较哪些权威版本；
16. 跨聚合哪些操作必须原子或使用等价 fence；
17. SourceDependency 和 source invalidation 的传播；
18. 内部数据分类与客户端/provider/日志边界；
19. 48 项领域模型验收场景；
20. S-18/S-19/S-20 以及隐私、架构、测试与观测交接。

## 6. v1 决策摘要

- 一个 UserAccount 生命周期使用一个不可变高熵 StableSubjectId；删除后新账户不复用；
- Profile 是可修订资料，Onboarding Completion 是独立一次完成事实；
- 每个按日命令保存 target ProductDate、policy version、accepted_at、command ref 和 payload fingerprint；
- MorningCheckin 同用户同日一份，revision 更正不修改 PublishedDailyResult；
- GenerationIntent 同用户同日一个，冻结 manifest/snapshot/seed identity；
- GatewayAttempt 唯一键为 invocation + role + ordinal，无效 raw output 默认不持久化；
- PublishedDailyResult 独立不可变并一次性发布；
- DailyInteraction 只包含 light/task/helpfulness/evening feedback，支持组件 revision 与原子 evening save；
- RelationshipCycle 只计算当前 cycle 的有效 EncounterLinks；关系删除关闭旧 cycle，旧 lights 不导入新 cycle；
- ImportantMatter 与 MemoryPurposeGrant 分开；提及回执不复制文本；
- WeeklyWindow 恰好七个连续日期，source fingerprint 改变先失效旧 summary；
- SafetyState 每用户一份，revision + epoch 对所有普通发布形成硬 fence；
- Notification SENT 只表示提交平台，不表示送达/接通；
- DataTask 创建时先让 deletion guard 生效，物理 retention 延期给 S-18；
- EvaluationRun 只使用 SyntheticSubjectRef；
- read model、cache、event analytics 均不拥有业务真相。

## 7. 必须覆盖的验收场景

- 外部身份恢复、账户删除后新身份周期、同意撤回与 Profile 修订；
- 04:00 日期边界、continuation 失效、命令接受和未知结果；
- 同日签到并发、同键同载荷、同键不同载荷和签到更正；
- manifest 冻结、partial JSON、完整模板、并发发布和 Safety epoch race；
- 多端点亮、任务不惩罚、晚间原子冲突和 high-risk note；
- DAY 删除关系重算、relationship cycle 删除后旧事件重放；
- purpose grant 隔离、matter revision race、提及频率、fallback 和周 fingerprint；
- low state 与 Safety 分离、资源 fallback、recovery 与通知发送前校验；
- DAY/MATTER/RELATIONSHIP/ACCOUNT 删除和旧缓存/迟到 candidate 复活；
- version/fingerprint drift、客户端白名单、日志扫描、synthetic evaluation 隔离和旧客户端 major。

## 8. 明确不做

- 写 PostgreSQL/Prisma、索引、迁移、SQL 或生产代码；
- 决定 soft delete/hard delete、retention、backup、audit 或删除 SLA；
- 定义 API、OpenAPI、HTTP code、鉴权或客户端 DTO；
- 修改共享 Schema、Prompt、Gateway、Safety、memory 或生成规则；
- 运行真实 provider、评测、classifier 或产生费用；
- 选择生产主备模型、ACTIVE route 或模型 winner；
- 开放同日删除后重新开始；
- 创建 generic user data、daily status、memory text、诊断或风险分数；
- 保存真实用户内容、Safety 原文或 provider raw response；
- 建立运营、客服、专业审核、事故响应、指标或实验流程。

## 9. 验收标准

- `domain-model.md` 保持 Draft，用户确认前不得 Accepted；
- 所有 P0 权威事实有唯一 owner/context/aggregate；
- 主要聚合、关系、唯一性、revision/fingerprint/epoch 和 state ownership 清晰；
- DailyInteraction、RelationshipCycle、WeeklyWindow、SafetyState 和 DataTask 边界可由下游实现；
- intent/result/attempt/notification/task 等关键唯一性明确；
- 发布、晚间保存、Safety trigger、deletion guard 和 dispatch 原子不变量闭合；
- DAY/MATTER/RELATIONSHIP_DATA/ACCOUNT 的失效链不允许旧源复活；
- 48 个场景 ID 唯一；
- S-16 evaluation/corpus 已转 Accepted，项目控制文件一致；
- Draft PR 只含本任务文档与任务状态，不含数据库、API 或业务代码。

## 10. 完成后的下一任务

S-17 被接受后，下一任务为：

- 当前任务 ID：S-18；
- 当前任务名称：数据保存和删除决策；
- 主要交付：`docs/decisions/ADR-0005-data-retention-and-deletion.md`；
- 依据：本领域模型的源、派生、受限证据、DataTask、guard 与删除失效链；
- 不开始数据库、Prisma 或 API 实现。

## 11. 最近一次交接

- 日期：2026-07-22；
- PR #19 已由用户确认并 squash 合并，main commit 为 `736e1d1d1c742a5b311baf9aa00e5d8964e41e3a`；
- S-16 evaluation 规范与 269-case corpus 已由用户接受，Accepted 状态收尾包含在本分支；
- S-17 分支 `agent/domain-model` 已从该 main commit 创建，首个 domain model 提交为 `3cfb524`；
- Draft PR [#20](https://github.com/WeiHan1996/DailyEnergy/pull/20) 已创建；
- 最终范围为 6 个目标文件：domain model、evaluation、corpus、INDEX、backlog、current；
- 领域模型覆盖 13 个上下文、主要聚合、48 个唯一验收场景和 S-18～S-33 下游交接；
- 6 份远端文件与预期内容逐字一致，分支基于 `736e1d1` 且未落后 main；
- 91 个相对引用落到 36 个唯一仓库文件且全部可读，Markdown fence 闭合；
- S-16 corpus 仍含 269 个唯一 case，来源计数 37/52/48/60/72，manifest SHA-256 重算一致；
- backlog 中只有 S-17 为 In Review；当前没有数据库、Prisma、API、生产代码、模型调用或真实用户数据改动；
- 下一操作：用户审核 PR #20 并决定是否接受 S-17；确认前不合并、不开始 S-18。

## 12. 状态更新规则

任务完成待审核时：

- 状态保持 In Review；
- 写入 PR、交付物和最终验证；
- domain model 保持 Draft；
- S-18 不得开始。

用户确认并合并后：

- S-17 改为 Done；
- domain model 变为 Accepted，并记录接受日期；
- 更新 docs/INDEX.md 与 backlog；
- S-18 成为唯一 Ready 任务；
- 新会话再开始 S-18。
