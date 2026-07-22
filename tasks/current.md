# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-22
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-18
- **当前任务名称**：数据保存和删除决策
- **任务状态**：In Review
- **优先级**：最高
- **代码工作**：不开始数据库、Prisma、API 或生产删除 worker；只固定保存期限、删除语义、备份、provider、审计和同日重记边界
- **当前分支**：agent/data-retention-deletion
- **关联 PR**：[#21](https://github.com/WeiHan1996/DailyEnergy/pull/21)
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)

## 1. 当前目标

创建 Proposed [ADR-0005](../docs/decisions/ADR-0005-data-retention-and-deletion.md)，把已接受领域模型中的 source、revision、DataTask、deletion guard 和失效链转换为可直接指导 S-19 数据库规格的保存与删除决策。

本任务决定“保存多久、删除何时生效、在线与备份何时清理、失败如何重试、最小证据可留什么、同日怎样重新记录”。它不创建数据库表、Prisma model、API DTO、生产作业或隐私政策最终文本。

## 2. 必须交付

- Proposed ADR-0005；
- 中国大陆现行官方法规基线与上线前复核边界；
- T0～T4 数据层级；
- 账户、日记录、事项、关系、生成、通知、分享、导出、Safety、日志、评测和配置保存期；
- 24 个月无主动使用自动 ACCOUNT 删除；
- deletion guard、在线清理、provider、备份和用户可见完成语义；
- DAY / MATTER / RELATIONSHIP_DATA / ACCOUNT 精确范围；
- DayErasureGuardV1 与当前日显式重新记录；
- 72 小时在线清理、7 天任务结果、35 天备份、30 天 provider 等硬期限；
- legal hold、影响评估、受限审计和删除回执；
- 48 项最小验收场景；
- S-17 domain model Accepted 收尾；
- docs/INDEX、backlog 和任务交接同步。

## 3. 上游必读

1. [AGENTS.md](../AGENTS.md)；
2. [README.md](../README.md)；
3. [ROADMAP.md](../ROADMAP.md)；
4. [docs/INDEX.md](../docs/INDEX.md)；
5. [产品状态机](../docs/product/state-machine.md)；
6. [业务规则](../docs/product/business-rules.md)；
7. [ADR-0002 稳定每日结果](../docs/decisions/ADR-0002-deterministic-daily-result.md)；
8. [ADR-0003 AI Gateway](../docs/decisions/ADR-0003-ai-provider-abstraction.md)；
9. [AI Gateway](../docs/ai/gateway.md)；
10. [ADR-0004 结构化记忆](../docs/decisions/ADR-0004-structured-memory.md)；
11. [结构化记忆](../docs/ai/memory.md)；
12. [内容安全](../docs/ai/safety.md)；
13. [AI 评价与回归](../docs/ai/evaluation.md)；
14. [领域模型](../docs/data/domain-model.md)。

## 4. 已接受且不得重开的边界

- 产品日期是 Asia/Shanghai、04:00，稳定根种子使用 StableSubjectId + product date + result version；
- 同一用户同一产品日期只有一个生成意图和一个 AVAILABLE 结果；
- DAY 删除不自动重建；显式重记必须复用原 product date 与 result version；
- 删除任务与业务对象状态分开，任务创建时 guard 先于后台清理；
- source 删除后派生、缓存、队列、迟到候选和备份恢复不得复活；
- ACCOUNT 删除后不为保持 seed 单独保存 StableSubjectId 或外部身份映射；
- 关系数据来自当前 cycle 的有效 EncounterLink，旧 lights 不导入新 cycle；
- 事项、grant、snapshot 与 dependency 分开，模型和日志不是记忆源；
- Safety 不保存原文、诊断、confidence 或 classifier rationale；
- provider request body 与 invalid raw response 默认不持久化；
- synthetic evaluation 不能引用真实 AccountRef；
- read model、cache、analytics、audit 和 deletion receipt 都不是业务真相。

## 5. 本任务决定

1. 个人数据保存期限的默认层级、锚点和到期动作；
2. 用户主动使用与 24 个月无使用的定义；
3. T0 transient、T1 active、T2 restricted、T3 backup、T4 anonymous/system 边界；
4. 账户、资料、日记录、事项、关系和周总结的最长保存期；
5. generation attempt、notification、share、export 和 evaluation artifact 的短期 TTL；
6. Safety、网络安全日志、删除回执、影响评估和 legal hold 的受限期限；
7. 删除的 semantic blocked、online erased、backup expired 三层语义；
8. guard、清理顺序、SLA、FAILED 和同任务重试；
9. DAY / MATTER / RELATIONSHIP_DATA / ACCOUNT 精确范围；
10. relationship-only delete 默认保留真实 DAY，额外日期用 DAY 子任务；
11. DayErasureGuardV1 的字段、45 天上限和透明说明；
12. 当前日显式重记的资格与 CONTROLLED_TEMPLATE 路径；
13. 35 天备份与恢复前删除账本重放；
14. provider training/retention/data-handling profile 硬门；
15. 导出、客户端缓存、对象/CDN 和外部副本边界；
16. RetentionPolicyEntry、DeletionReceiptV1 与下游验证；
17. 48 项验收矩阵；
18. S-19～S-33 与工程任务交接。

## 6. v1 决策摘要

- 核心用户数据在账户 ACTIVE 期间保存；连续 24 个月无主动使用自动进入 ACCOUNT 删除；
- COMPLETED / EXPIRED matter 最多 90 天；
- provider body/raw invalid output 为零持久化，attempt metadata 30 天；
- notification terminal 35 天，share draft 24 小时，share object 7 天，export artifact 24 小时；
- Safety event 到 CLEAR + 30 天，普通 trace 30 天；
- 网络安全日志 6 个自然月，删除回执 6 个自然月，影响评估记录至少 3 年；
- synthetic evaluation artifact 90 天，manifest/聚合 365 天；
- guard 同步生效；session/cache/queue URL 15 分钟清理、在线数据 72 小时、任务最迟 7 天给出真实结果；
- provider retention 最长 30 天、training off；备份最长 35 天；
- DataTask SUCCEEDED 表示产品和在线副本已不可用，并登记 backup purge deadline；
- generic soft delete 不能作为最终完成；
- DAY 同日显式重记复用 original result version，默认走确定性 CONTROLLED_TEMPLATE；
- DayErasureGuard 最多 45 天且不含被删内容、分数、结果、seed 或外部身份；
- relationship-only delete 保留真实日记录；用户另选日期时创建 DAY 子任务；
- legal hold 只允许明确法律依据、最小范围、90 天复核，绝不成为 active source。

## 7. 必须覆盖的验收场景

- retention 读取不续期、后台事件不更新主动使用、23/24 个月边界；
- terminal matter 自动删除与 policy 非法延长；
- DAY in-flight、当前日重记、历史日禁用、旧 result version、guard 丢失和字段扫描；
- MATTER fallback、relationship-only、DAY 子任务和旧 cycle 不重放；
- ACCOUNT 删除中的 export、新账户、新 subject、失败不解封和外部副本说明；
- cache、offline device、dead-letter、20 天备份恢复、35 天越界和主动失效；
- Safety/raw log、六个月安全日志、legal hold、三年影响评估；
- provider training/30 天、删除请求、分享对象和微信通知；
- DataTask 幂等、scope 冲突、7 天 FAILED、receipt 字段与自动到期。

## 8. 明确不做

- 编写 PostgreSQL、Prisma、迁移、API、队列 worker 或生产代码；
- 选择云数据库、对象存储、密钥服务、provider 或生产路由；
- 定义隐私政策最终法律文本、用户身份核验材料或客服权限；
- 运行真实删除、provider 调用、备份恢复或产生费用；
- 保存真实用户数据、Safety 原文、provider raw response 或 Prompt；
- 修改现有 Schema、生成事实、安全响应或记忆来源；
- 以 generic soft delete、无限期日志或 provider 默认值代替正式决策。

## 9. 验收标准

- ADR 包含目的、期限总表、scope、失败、备份、受托方、审计、替代方案和影响；
- 期限与上游状态、Gateway、Memory、Safety、Evaluation、Domain Model 一致；
- 同日显式重记不保留被删内容或 seed，且不使用 latest manifest；
- 四种删除范围的在线、派生、provider、备份和客户端行为闭合；
- 48 个 S18 场景 ID 唯一；
- S-17 domain model 转 Accepted 并记录 PR #20；
- docs/INDEX、backlog、current 只有 S-18 为 In Review；
- 所有相对链接可读，外部法规链接已核验；
- Draft PR 只含文档，不含数据库、API、生产代码或真实用户数据。

## 10. 下一步

S-18 被接受后，下一任务为：

- 当前任务 ID：S-19；
- 当前任务名称：数据库规格；
- 主要交付：docs/technical/database.md 与 Prisma 草案；
- 依据：Accepted domain model + ADR-0005 的唯一性、TTL、guard、删除任务、备份和证据边界；
- 不提前开始 API 或生产业务实现。

## 11. 最近一次交接

- PR #20 已以 squash 方式合并到 main；
- 合并提交：452170864caafd3b634bcce96e8c29848a712a46；
- S-17 domain model 已由用户确认，当前分支负责将其收尾为 Accepted；
- S-18 分支 agent/data-retention-deletion 从该 main commit 创建；
- Proposed ADR-0005 已完成，覆盖保存期限、四种删除范围、DayErasureGuard、provider、备份、受限证据和 48 项验收场景；
- Draft PR [#21](https://github.com/WeiHan1996/DailyEnergy/pull/21) 已创建；
- 最终范围为 5 个 Markdown 文件，分支未落后 main；
- 86 个相对引用落到 37 个唯一仓库文件且全部可读，4 个官方法规页面已核验；
- Markdown fence、文档状态与任务生命周期一致，backlog 中只有 S-18 为 In Review；
- 当前仓库没有配置 GitHub commit status checks；
- 当前没有数据库、Prisma、API、生产代码、provider 调用或真实用户数据改动；
- 下一操作：用户审核 PR #21 并决定是否接受 S-18；确认前不合并、不开始 S-19。

## 12. 状态更新规则

PR 创建前：

- ADR 保持 Proposed；
- S-17 domain model 转 Accepted；
- backlog 中 S-17 为 Done、S-18 为 In Review；
- 关联 PR 为待创建。

PR 创建后：

- 写入实际 PR 链接、提交范围和最终验证；
- ADR 仍保持 Proposed；
- S-19 不得开始。

用户确认并合并后：

- ADR-0005 变为 Accepted 并记录接受日期；
- 更新 docs/INDEX 与 backlog；
- S-19 成为唯一 Ready/当前任务；
- 新分支再开始数据库规格。
