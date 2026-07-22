# DailyEnergy 数据库规格

- **文档状态**：Draft
- **接受日期**：待用户确认
- **所属任务**：S-19 — 数据库规格与 Prisma 草案
- **最后更新**：2026-07-22
- **适用范围**：Phase 0B / P0 账户、每日事实、生成、互动、关系、事项、结构化记忆、七天回望、Safety、通知、数据任务、保存与删除
- **目标数据库**：PostgreSQL；具体主版本由 S-28 / E-006 固定
- **ORM 草案**：Prisma ORM 7 语法；具体包版本由 S-28 / E-006 固定
- **可执行草案**：[prisma/schema.prisma](../../prisma/schema.prisma)
- **上游权威**：[领域模型](../data/domain-model.md)、[ADR-0005](../decisions/ADR-0005-data-retention-and-deletion.md)、[共享 Schema](../../packages/shared-schemas/README.md)
- **下游任务**：S-20、S-21、S-24、S-28～S-33、E-006、C-001～C-016、AI-001～AI-016、A-007

## 1. 目的

本文把已接受的领域模型、唯一性、修订、发布栅栏、保存期限和删除语义转换为可实施的 PostgreSQL 数据规格。它回答：

1. 哪些表拥有权威事实，哪些只是运行记录、派生投影或受限证据；
2. 哪些不变量由 Prisma Schema、PostgreSQL 约束、事务、服务校验或运维流程保护；
3. 同日唯一、幂等、修订、Safety/deletion epoch、发布与通知如何在并发下成立；
4. 个人数据怎样加密、到期、硬删除、阻断恢复并生成最小证明；
5. Prisma 能表达什么，必须在 SQL migration 中补什么；
6. E-006 实现、迁移和测试必须遵守哪些门禁。

本文不是生产 migration、API 契约或服务实现。`schema.prisma` 是结构草案，只有在 S-19 Accepted、S-28 固定版本、E-006 生成并审核 SQL migration 后才可部署。

## 2. 不重开的已接受边界

- 技术栈仍为 PostgreSQL + Prisma；不切换数据库或 ORM；
- 产品日期是 `Asia/Shanghai`、04:00 边界，数据库使用 `date` 保存已解析的 ProductDate；
- 同一 owner + ProductDate 只有一个 MorningCheckin、GenerationIntent、PublishedDailyResult 和 DailyInteraction；
- GenerationIntent 唯一性不含 result version 或 deletion epoch；
- PublishedDailyResult 与 PublishedWeeklySummaryRevision 是不可变发布对象；
- Checkin 更正不改已冻结 snapshot 或已发布 Daily result；
- EVE-001 必须原子更新 feedback、helpfulness 与可选 task patch；
- 关系使用 `RelationshipCycle + EncounterLink`，旧点亮不得在关系删除后重放；
- 记忆只来自领域 source + purpose grant + 确定性 snapshot；无 generic memory text、embedding 或向量库；
- Safety 与删除 guard 优先于生成、通知、缓存和后台工作；
- provider raw invalid response、普通 Prompt、自由文本日志和真实 evaluation 用户样本不落库；
- generic `deleted_at` 不能代替 ADR-0005 的同步阻断、范围清理和硬删除；
- DAY 同日重记只在原任务成功后显式开放，并复用原 result version；
- 备份最长 35 天、provider 最长 30 天、DayErasureGuard 最长 45 天、在线删除 72 小时；
- EvaluationRun 只使用 SyntheticSubjectRef，不关联真实账户。

## 3. 范围与不做事项

### 3.1 本文负责

- PostgreSQL 数据类型、表职责、主键、外键、唯一性、索引和检查约束；
- 权威 source、不可变 snapshot、运行记录、投影和受限证据的分区；
- revision、fingerprint、epoch、幂等与 outbox/inbox；
- 关键命令事务边界；
- 保存元数据、TTL scan、删除顺序、guard、回执、provider 与备份目录；
- 字段级敏感性、加密与数据库访问边界；
- Prisma 草案与 SQL migration 补强清单；
- 迁移、回滚、测试数据与验证门禁；
- 64 项 S-19 最小验收场景。

### 3.2 本文不负责

- 创建真实数据库、migration、角色、密钥、备份、队列或定时任务；
- 固定 PostgreSQL / Prisma / Node 的精确版本；
- 定义 API、OpenAPI、DTO、HTTP code 或客户端缓存格式；
- 编写 NestJS repository、worker、删除器、TTL worker 或 outbox publisher；
- 选择云数据库、对象存储、KMS、监控或 AI provider；
- 修改已接受产品 Schema、Prompt、Safety、记忆或生成规则；
- 保存或迁移任何真实用户数据。

## 4. 总体设计

### 4.1 单一权威数据库，五个数据区

Phase 1～3 使用一个 PostgreSQL 权威数据库，不提前拆微服务数据库。表名使用前缀表达逻辑区：

| 区 | 表前缀 | 内容 | 普通产品服务访问 |
| --- | --- | --- | --- |
| Active Product | `app_` | 账户、日事实、结果、互动、关系、事项、周数据 | 按模块和 owner 允许 |
| Restricted | `restricted_` | Safety、删除任务/guard/回执、legal hold、受限审计 | 默认禁止，只给专用服务角色 |
| Runtime | `runtime_` | command receipt、attempt、candidate、通知尝试、outbox/inbox | 限时、脱敏、最小权限 |
| System | `system_` | 不可变版本、retention、provider profile、资源与 backup catalog | 只读或发布角色 |
| Evaluation | `evaluation_` | 合成评测 run/sample | 与真实用户域隔离 |

前缀不是安全控制。E-006 必须创建不同数据库角色和 table grants；S-29 决定是否进一步使用 PostgreSQL schema。普通 API 角色不得直接读取 `restricted_*`、密文字段或 evaluation artifact。

### 4.2 数据库、服务和运行时各自负责什么

| 层 | 必须负责 | 不得假装负责 |
| --- | --- | --- |
| PostgreSQL | 主外键、普通/复合唯一性、revision/epoch 基础约束、事务原子性、活动槽唯一、TTL 索引 | Unicode grapheme、完整 JSON 业务语义、Safety 分类、provider 删除 |
| Prisma | 类型化 model、relation、稳定 enum、普通 index/unique、事务入口 | 所有 PostgreSQL 功能、跨表状态机、备份与 RLS |
| 共享 Zod Schema | JSON payload、枚举组合、字符预算、跨字段等式、未知字段拒绝 | owner 授权、并发唯一、物理保存期 |
| 领域服务 | 权限、状态机、CAS、PublishGuard、加解密、fingerprint、事务编排 | 绕开数据库唯一性、最后写入者覆盖 |
| Worker / 运维 | TTL、硬删除、provider、对象/CDN、备份、恢复演练 | 解封失败删除、恢复已删 source |

### 4.3 ORM 不是数据库规范的上限

当前 Prisma 文档可表达普通 index、unique、native PostgreSQL types 和部分 PostgreSQL index 能力；部分索引仍依赖 preview feature，`CHECK` 等能力需要自定义 SQL migration。S-19 不启用 preview feature，避免在版本未固定前把生产正确性绑定到实验能力。

参考基线：

- [Prisma Schema API](https://www.prisma.io/docs/orm/reference/prisma-schema-reference)；
- [Prisma indexes](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes)；
- [Prisma CHECK constraints](https://www.prisma.io/docs/orm/more/troubleshooting/check-constraints)；
- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)；
- [PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html)。

## 5. 类型、命名与时间

### 5.1 身份

- 领域实体主键使用随机 UUID，不从微信 ID、手机号、日期、seed、标题或文本派生；
- `AccountRef` 对应 `UserAccount.id`，但 ID 从不构成授权；
- 外部身份使用 `providerCode + subjectLookupToken` 唯一查找，明文标识只以应用层密文保存；
- `StableSubjectId` 以密文保存，密钥版本单列；不建立可枚举索引；
- `ownerScopeToken` 是受限高熵 token，仅连接当前账户与最小删除 guard；
- 通用 polymorphic source ref 只保存 UUID + source type，必须由服务 allowlist 解析，不能动态拼 SQL 表名。

### 5.2 时间与日期

- instant 使用 `timestamptz(3)`，应用与数据库会话统一 UTC；
- ProductDate 使用 PostgreSQL `date`；服务端依据冻结的 policy version 计算；
- 数据库 `now()` 不决定 ProductDate，不读取客户端时区；
- TTL 使用 `retentionAnchorAt + expiresAt`；自然月由服务/worker 按政策计算后写入绝对 instant；
- 读取、下载、通知投递、后台任务、缓存命中不得刷新 retention anchor。

### 5.3 revision、epoch 与 fingerprint

- revision 是从 1 开始的正整数；不存在时 expected revision = 0；
- epoch 使用非负 `bigint`，只增不减；
- fingerprint/lookup token/idempotency key 使用 `bytea`，记录算法版本的对象同时保存 version；
- fingerprint 不保存密钥，也不用于授权；
- 任意 canonicalization 变化必须升级版本，禁止相同 version 解析为不同 bytes。

### 5.4 文本与 JSON

- `preferredName`、matter title、evening note、个性化片段、受限 evaluation response 使用应用层 envelope encryption，数据库只保存 ciphertext + key version；
- 普通日志、outbox、audit、notification attempt、provider attempt 不保存这些文本；
- JSONB 只用于已由 Zod 验证、带 schema/version/fingerprint、大小有上限的不可变文档或 allowlist 元数据；
- JSONB 不得成为可写 `daily_status`、generic user data、memory text、raw provider response 或无版本属性袋；
- 高频筛选、唯一性、状态、owner、日期、revision、expiry 必须是类型化列，不藏在 JSON。

## 6. 表目录

### 6.1 账户与命令

| Prisma model | 物理表 | 权威职责 | 关键边界 |
| --- | --- | --- | --- |
| UserAccount | `app_user_account` | 账户生命周期、revision、主动使用到期 | Stable subject 密文；DELETED 终态 |
| ExternalIdentity | `app_external_identity` | 微信等外部身份映射 | HMAC lookup + ciphertext |
| SessionCredential | `app_session_credential` | refresh/session hash 与撤销 | 最长 30 天，不存明文 token |
| NecessaryConsentRecord | `app_necessary_consent_record` | 必要同意 append/revoke 事实 | 通知权限不能替代 |
| UserProfile / Revision | `app_user_profile*` | 当前资料与短期旧 revision | 只允许称呼和表达风格 |
| OnboardingCompletion | `app_onboarding_completion` | 一次完成事实 | Profile 修改不重开 |
| ViewContinuationGrant | `app_view_continuation_grant` | 跨 04:00 短期授权 | server/session/surface/date scoped |
| CommandReceipt | `runtime_command_receipt` | 同 key 同 payload 幂等 | 7 天 TTL；不保存请求正文 |

### 6.2 日事实、生成与发布

| Prisma model | 权威职责 | 关键唯一/期限 |
| --- | --- | --- |
| MorningCheckin / Revision | 同日真实签到与更正 | account + productDate；DAY/ACCOUNT 删除 |
| GenerationIntent | 唯一每日生成生命周期 | account + targetProductDate；不含 version |
| GenerationInputSnapshot | 冻结 Checkin revision 与输入 | intent 一份；不可变 |
| GatewayInvocation | 冻结 route/Prompt/Schema/Safety/deadline/guard | Daily 或 Weekly 恰好一个 parent |
| GatewayAttempt | 脱敏 provider/template 尝试 | invocation + role + ordinal；terminal + 30 天 |
| GatewayCandidate | 完整、已验证、未发布短期候选密文 | attempt 一份；竞态/发布后尽快清除 |
| PublishedDailyResult | 不可变事实与核心表达 | account + productDate；intent/snapshot 一对一 |
| ResultContentSlot / PersonalizedContentFragment | 可独立清除的个性化片段与同候选 fallback | source 删除时硬删密文片段 |
| SourceDependency | source/grant revision 与 fallback 路径 | 不复制源文本；按 source ref 查失效 |
| PublishedResultVisibility | 当前展示/fallback/blocked 投影 | 与不可变 result 分离 |

### 6.3 互动、关系、事项与记忆

| Prisma model | 权威职责 | 关键唯一/期限 |
| --- | --- | --- |
| DailyInteraction | EVE-001 窄事务根 | account + date、result 一对一 |
| DailyLightFact | 一次点亮事实 | interaction 一份；普通不可撤销 |
| DailyTaskState | 任务当前事实 | interaction 一份、独立 revision |
| DailyHelpfulnessRecord | 已提交帮助度 | 缺行 = UNRATED；不存 UNRATED enum |
| EveningFeedbackRecord / Revision | overall + 可选 note 与最小修订证据 | note 密文；Safety 先于写入 |
| RelationshipCycle | 当前关系周期 | `activeSlot=true` 每 owner 一个 |
| RelationshipEncounterLink | 当前周期有效点亮源 | cycle + light/date 唯一 |
| RelationshipNodeReceipt | 节点展示幂等 | cycle + node + fingerprint |
| ImportantMatter / Revision | 用户主动事项 source | title 密文；terminal 最多 90 天 |
| MemoryPurposeGrant | source × purpose 授权 | Daily/Weekly/Reminder 不借权 |
| MemoryMasterPreference | 跨日用途总开关 | account 一份；不删除 source |
| MemoryMentionReceipt | 提及频次事实 | 不复制 title |
| MemoryContextSnapshot | invocation 级封闭投影 | v1 facts 为空；source 失效 72 小时清除 |

### 6.4 Weekly、Safety 与通知

| Prisma model | 权威职责 | 关键边界 |
| --- | --- | --- |
| WeeklyWindow / SourceSnapshot | 固定七天窗口、当前 source fingerprint | 不用早日补缺失 |
| WeeklySummaryIntent / PublishedRevision | source scoped intent 与不可变修订 | current pointer 必须匹配 fingerprint |
| WeeklyContentSlot / Fragment / Dependency | 可删个性化与 fallback | 关系/事项删除不留原片段 |
| SafetyState | 当前 CLEAR/ACTIVE/RECOVERY_PENDING + epoch | account 一份，普通路径硬 fence |
| SafetyDecision / Event / ResponsePlan | 决策、最小事件、固定响应分离 | 不含原文、confidence、诊断 |
| SafetyResourceEntry | 版本化地区资源 | 系统配置，不属于用户 |
| RecoveryCommandReceipt | 两步显式恢复证据 | 资源点击不是恢复 |
| NotificationPreference | 用户权威偏好 | 每类型一份、默认关闭 |
| PlatformPermissionSnapshot | 平台外部观测 | 不等于用户偏好 |
| NotificationIntent | 语义通知生命周期 | account + semanticKey 唯一 |
| NotificationDeliveryAttempt | 平台尝试元数据 | 不保存敏感 payload；terminal + 35 天 |

### 6.5 删除、保存、事件与评测

| Prisma model | 数据区 | 职责 |
| --- | --- | --- |
| DataTask / DeletionStepCheckpoint | Restricted | DELETE/EXPORT 状态与可重试步骤 |
| DeletionGuard | Restricted | 同步 scope epoch 与 semantic block |
| DayErasureGuard | Restricted | 45 天防复活/防换版本最小字段 |
| DeletionReceipt | Restricted | 6 个月最小完成证明；ACCOUNT 不留 AccountRef |
| ProviderDeletionRequest | Restricted | 24 小时发出、最长 30 天到期 |
| RestoreDenyRecord | Restricted | 恢复前 deletion ledger |
| BackupCatalogEntry | System | generation、期限、key version、覆盖域 |
| RetentionPolicyEntry | System | 不可变保存策略目录 |
| ProviderDataHandlingProfile | System | training/region/期限/删除能力门禁 |
| LegalHold / RestrictedAuditEvent | Restricted | 明确依据、最小字段、到期复核 |
| OutboxEvent / InboxReceipt | Runtime | 可靠事件与消费幂等 |
| VersionCatalogEntry | System | 不可变版本与 activation pointer |
| EvaluationRun / Sample | Evaluation | 合成身份评测证据；无真实 AccountRef |

## 7. 数据库不变量

### 7.1 Prisma Schema 已直接表达

- UUID 主键和 PostgreSQL native `date` / `timestamptz(3)` / JSONB；
- 账户、父子对象的普通外键，默认 `onDelete: Restrict`；
- external provider + lookup token 唯一；
- account + ProductDate 的 Checkin、GenerationIntent、Result、Interaction 唯一；
- invocation + route role + ordinal 唯一；
- result/intent/snapshot、interaction/result、component/interaction 一对一；
- cycle + light/date、node + source fingerprint 唯一；
- source × purpose grant、mention receipt、weekly identity/source fingerprint 唯一；
- SafetyState 每账户一个；Notification semanticKey 唯一；
- DataTask 活动槽唯一；
- TTL 查询所需 `expiresAt` 索引；
- outbox idempotency key、inbox consumer + event 唯一；
- Evaluation sample 的 run + case + ordinal 唯一。

### 7.2 必须由首批 SQL migration 补强

以下编号是 E-006 migration review checklist，不得因 Prisma validate 通过而省略：

| ID | PostgreSQL 约束/机制 |
| --- | --- |
| SQL-001 | 所有 revision `>= 1`、epoch `>= 0`、ordinal `>= 0`、attempt count `>= 0` |
| SQL-002 | 所有 retention row 满足 `retentionAnchorAt <= expiresAt`；固定上限由 policy fixture 验证 |
| SQL-003 | ciphertext 与 key version 同为空或同存在；禁止空 bytea/空 key version |
| SQL-004 | Consent ACCEPTED/WITHDRAWN 与 acceptedAt/withdrawnAt 的互斥/必需关系 |
| SQL-005 | GatewayInvocation 的 Daily parent 与 Weekly parent 恰好一个，并与 workload 一致 |
| SQL-006 | GenerationIntent SUCCEEDED 必须有 publishedResultRef；非 SUCCEEDED 不得伪造成功引用 |
| SQL-007 | Published result、intent、snapshot 的 owner/date/version 一致；DailyInteraction 与 result owner/date 一致 |
| SQL-008 | PublishedDailyResult、PublishedWeeklySummaryRevision、snapshot、catalog entry 禁止语义 UPDATE；只有专用投影可变 |
| SQL-009 | RelationshipCycle `activeSlot=true` 当且仅当 ACTIVE；CLOSED 时必须为 null |
| SQL-010 | DataTask `activeSlot=true` 用于 QUEUED/RUNNING/FAILED，SUCCEEDED 必须为 null；FAILED 不解封 |
| SQL-011 | DataTask guarded/started/erased/finished 时间单调，SUCCEEDED 必须具备 onlineErasedAt 与 backup deadline |
| SQL-012 | WeeklyWindow.currentSummaryRef 指向同 window、同 current source fingerprint 的完整 summary revision |
| SQL-013 | Published content slot 必须有可用 personalized fragment 或预校验 fallback；两者都无时 visibility=BLOCKED |
| SQL-014 | SafetyState revision/epoch 单调；event/response plan revision 不能超过或跨 owner |
| SQL-015 | Notification SENT 必须拥有唯一 dispatch claim；终态不得回到 SCHEDULED |
| SQL-016 | ACTIVE provider profile 必须 training=false、online retention `<=30`、证据与 disclosure 完整 |
| SQL-017 | Backup expiry `<= createdAt + 35 days`；DayErasureGuard expiry `<= createdAt + 45 days` |
| SQL-018 | Legal hold reviewDueAt `<= startedAt + 90 days`，release/expiry 后 72 小时清理任务可发现 |
| SQL-019 | ACCOUNT DeletionReceipt 禁止可识别 target、AccountRef、StableSubjectId 或外部身份列 |
| SQL-020 | 权限：普通 API role 无 `restricted_*`/ciphertext 直读，无 immutable table UPDATE，无任意 `TRUNCATE` |

复杂跨表约束可以用 deferred constraint trigger 或同事务 service assertion + integration test 实现。任何选择都要在 migration 注释中引用 SQL-ID；不能只在 PR 描述里说明。

### 7.3 为什么使用 nullable active slot

`RelationshipCycle.activeSlot` 与 `DataTask.activeSlot` 使用 `true/null`：PostgreSQL unique constraint 允许多行 null，但只允许一行相同的 true，从而不依赖 Prisma `partialIndexes` preview feature 实现“一个 current/active”。SQL-009/010 再保证状态与槽一致。

禁止把 false 当作历史槽；历史/终态必须写 null，否则每 owner 只能保留一条 false 记录。

## 8. Revision、幂等与并发

### 8.1 乐观并发

- 写可修订聚合必须携带 expected revision；
- SQL 更新条件包含 `id + owner + revision + allowed state`；
- 成功语义变化执行 `revision = revision + 1`；
- 影响行数为 0 时读取最新事实并返回冲突或幂等结果；
- `updatedAt`、客户端 timestamp、请求先后顺序不能替代 revision；
- 相同值 no-op 不增加 revision，也不追加无意义 history。

### 8.2 命令幂等

`CommandReceipt(accountId, commandRef)` 与领域写入在同一事务：

1. 首次命令插入 operation、target、payload fingerprint、acceptedAt；
2. unique 冲突时锁定已有 receipt；
3. fingerprint/operation/target 相同则恢复原 aggregate/result；
4. 任一不同返回幂等冲突；
5. Unknown outcome 只能重查同 receipt，不能换 key 创建第二 intent；
6. receipt terminal 后 7 天硬删除，届时业务唯一对象仍阻止重复事实。

### 8.3 PublishGuard

GatewayInvocation 保存冻结的 `publishGuardSnapshot`，但 JSON 不是最终 fence。发布事务必须重新锁定/读取：

- Account state + revision；
- Safety state revision + guard epoch；
- 对应 DeletionGuard revision + epoch；
- Generation/Weekly intent revision；
- source/grant revision vector 或 fingerprint；
- accepted ProductDate 与 continuation/completion grant（如适用）。

任一变化整份 candidate 失败。禁止只在调用 provider 前校验一次，也禁止从旧 candidate 拆句发布。

## 9. 关键事务

### TX-01 Profile 首次提交与 Onboarding

同一事务登记 command receipt、写/更新 profile（CAS）、追加 profile revision、确认必要 consent 存在，并只创建一次 OnboardingCompletion。任一步失败全部回滚。

### TX-02 Checkin 与 GenerationIntent

同一事务冻结 ProductDate/policy/acceptedAt，创建或读取 owner/date Checkin 与唯一 GenerationIntent，写 input snapshot 和 outbox。并发输家读取 existing；不得创建第二 result version。

### TX-03 Daily result 发布

在同一事务：

1. 锁定 intent 与高优先级 guard；
2. 比较 PublishGuard；
3. 插入唯一 PublishedDailyResult、content slots、personalized fragments/dependencies；
4. 创建 visibility；
5. 可选创建 MemoryMentionReceipt；
6. 将 intent 置 SUCCEEDED 并写 published result ref；
7. 写 allowlisted outbox。

unique loser 回读 existing；不得覆盖、比较文案后选胜者或局部发布。

### TX-04 EVE-001 保存今天

Safety input gate 在事务前决定 CLEAR/HIGH_RISK。CLEAR 时锁定 DailyInteraction，并在一个事务中比较 feedback、helpfulness、task 三个 expected revision；按显式 patch 更新对应行和 aggregate revision，写最小 revisions/outbox。任一冲突全部回滚。HIGH_RISK 进入 TX-05，本事务写入数必须为 0。

### TX-05 HIGH_RISK

同一事务递增 SafetyState revision/epoch、写最小 SafetyDecision/Event/ResponsePlan、使旧 publish guard 失败、登记取消/抑制 outbox。不得写 feedback、matter、memory、notification 或普通生成对象。

### TX-06 点亮与关系

LightFact 创建与 DayLit outbox 同事务。Relationship consumer 使用 InboxReceipt 去重，检查 current cycle、source cutoff epoch、source validity 与 deletion guard，再插入唯一 EncounterLink。即使 worker crash，事件可重放但不会重计。

### TX-07 Weekly current pointer

新的 source fingerprint 先写 snapshot，使旧 current summary 立即不匹配；发布时插入不可变 revision，校验 source 仍一致，再 CAS 更新 currentSummaryRef。旧 revision 不原地改写。

### TX-08 Notification dispatch claim

发送 worker 锁定 intent，重新读取 Account/Safety/deletion/preference/permission/source/quiet window；符合时原子写唯一 claim 并转移状态。平台调用发生在 claim 后，结果写 attempt；Unknown outcome 不创建第二 semantic intent。

### TX-09 删除任务与 guard

同一事务校验确认/expected revision，创建或读取 active DataTask，递增 scope DeletionGuard，并写 guardedAt/outbox。事务提交即 semantic blocked；后续 worker 失败也不释放 guard。

## 10. Outbox、Inbox 与投影

- 权威事务与 OutboxEvent 同库同事务提交；
- payload 只含领域事件第 17 节 allowlist，不含称呼、签到值、matter title、note、表达、Prompt、Safety 原文或 provider raw response；
- publisher 使用 `FOR UPDATE SKIP LOCKED` 或等价 claim，成功后标记 PUBLISHED；
- consumer 先插入 `(consumerCode,eventId)` InboxReceipt，再做幂等写；
- event 携带 aggregate revision 与必要 guard epochs；旧 epoch/revision 即使未消费也必须被拒绝；
- outbox/inbox 是可靠传递机制，不是永久审计或 analytics；terminal 后按 retention policy 清理；
- read model/cache 丢失可从权威 source 重建，但关系 cycle cutoff、删除 ledger 和 source invalidation 必须先应用。

## 11. 保存、TTL 与删除

### 11.1 每行保存元数据

所有 personal/restricted/ephemeral 行至少保存：

- `retentionPolicyVersion`；
- `retentionScope`；
- `retentionAnchorAt`；
- `expiresAt`（账户有效期内无固定到期可为空）；
- 必要 owner/scope/target 引用。

两个 closed allowlist 例外不增加字段：DayErasureGuard 由表级 V1 policy + `createdAt/expiresAt` 解析，DeletionReceipt 复用自身 `policyVersion/finishedAt/expiresAt`。系统目录的版本与 fingerprint 本身是 policy；T4 系统配置不伪造个人 `expiresAt`。

### 11.2 TTL worker

- PostgreSQL 不依赖行 TTL 扩展；worker 按 `(expiresAt)` 索引小批量 claim；
- 使用固定上限、`FOR UPDATE SKIP LOCKED`、每批事务和可重试 checkpoint；
- 删除前重新解析 immutable RetentionPolicyEntry 与 legal hold；
- 到期数据硬删除或按 policy 匿名化/冻结；不只写 `deletedAt`；
- 删除 source 与其依赖按拓扑执行，失败保持 guard；
- worker lag、最老过期行、失败 subsystem 与清理量进入无内容指标。

### 11.3 四种范围

- DAY：删除当日 checkin/revisions、intent/snapshot/result/segments、interaction、通知/分享/导出副本，并失效 relationship link、weekly source、memory dependency、cache/outbox；
- MATTER：删除 matter/revisions/grants/mentions/reminder/context 个性化 fragment；slot 只切预校验 fallback，否则 BLOCKED；
- RELATIONSHIP_DATA：关闭/删除旧 cycle/link/receipt/grant/fragment；保留真实 DAY，用户另选日期创建 DAY 子任务；
- ACCOUNT：阻断全部普通读写和新 export，清 owner-scoped T1/T2/session/identity/stable subject，最后删除 UserAccount；回执与 restore deny 使用独立 case/blinded token，不保留 AccountRef。

### 11.4 删除顺序与外键

账户关系默认 `onDelete: Restrict`，目的是让漏删变成显式失败，不用一次 CASCADE 静默抹掉仍需清理 provider/对象/依赖的证据。ACCOUNT worker 依据注册表按 child → source → identity → account 删除，并逐步记录稳定 subsystem checkpoint。

局部 aggregate 内可以在正式 migration 审核后选择窄 `ON DELETE CASCADE`，前提是：

- 不跨删除 scope；
- 不删除回执、guard、legal hold、provider/backup 任务；
- 有集成测试证明 source invalidation 和 fallback 已先完成；
- migration 明确列出级联影响。

### 11.5 DayErasureGuard

`restricted_day_erasure_guard` 只包含 ADR-0005 allowlist。它没有 UserAccount 外键，不含 StableSubjectId、seed、签到、分数、文本、结果或 source refs；使用 ownerScopeToken + productDate 唯一。SQL-017 和字段 allowlist test 保证最长 45 天。

同日重记前必须：原 DAY task SUCCEEDED、当前 ProductDate/OPEN、guard 可验证、原 version 可执行。新 intent 仍占 owner + date 唯一，使用同 original result version 和最新 deletion epoch；默认 CONTROLLED_TEMPLATE。

### 11.6 备份与恢复

- `system_backup_catalog_entry` 只登记 generation、created/expires、key version 和覆盖域，不建立用户内容索引；
- 删除任务把 backup purge deadline 写入 DataTask/Receipt；
- 恢复在隔离环境先加载 RetentionPolicy、DeletionReceipt/RestoreDeny/guard、账户终态和 source invalidation；
- 清理过期/已删 scope、运行 detector 和抽样验证后才开放；
- 不允许先对外恢复后补删；
- PITR/WAL、对象版本、跨区副本都计入 35 天。

### 11.7 Provider 与对象存储

数据库只记录 opaque request/evidence ref，不保存 raw provider body/response。ACTIVE ProviderDataHandlingProfile 的 SQL/发布门禁强制 training off、online retention ≤30 天。受影响 DAY/MATTER/ACCOUNT 删除在 24 小时内登记并发送 ProviderDeletionRequest。

对象 key 不写 audit/failure summary；对象服务使用 opaque ref 与 scope token。分享/导出 URL 先失效，对象按 72 小时清理；用户本地副本不在服务端删除范围。

## 12. 索引与查询模式

### 12.1 必需索引

Prisma 草案已经覆盖：

- owner + ProductDate 唯一/倒序历史；
- state + due/scheduled/updated 时间的 worker claim；
- sourceType + sourceRef、grantRef 的依赖失效；
- account + purpose/state 的 memory resolver；
- account + notification type/date 与 semantic key；
- active DataTask、删除 task/checkpoint、provider deadline；
- 所有固定 TTL 的 expiresAt；
- outbox pending + availableAt、aggregate revision；
- restricted/evaluation expiry。

### 12.2 不提前添加

- 不为 JSONB 默认创建 GIN；只有被批准的真实查询模式、字段最小化和 `EXPLAIN` 证据后才增加；
- 不为低基数 enum 单列建立 index，优先和时间/owner 组合；
- 不预建 full-text/vector index；产品禁止 generic memory search；
- 不因“可能分析”索引 personal text、ciphertext、HMAC token 或 Safety category；
- BRIN、partition、covering/expression index 由 S-33/E-006 在真实规模和查询计划下决定。

### 12.3 分页

历史列表使用稳定 keyset `(productDate DESC, id DESC)` 或 `(createdAt DESC, id DESC)`；不使用大 offset。所有 owner 查询必须把 `accountId` 写进 WHERE，不能查出后在内存过滤。

## 13. Prisma 与 SQL migration 分工

| 能力 | `schema.prisma` | SQL migration | 服务/运维 |
| --- | --- | --- | --- |
| model、enum、native type、FK | 是 | 审核生成 SQL | — |
| 普通/复合 unique、index | 是 | 审核名称与锁影响 | — |
| nullable active slot unique | 是 | CHECK 状态耦合 | CAS |
| CHECK / cross-column invariant | 否 | 必须 | 友好错误映射 |
| 跨表 owner/date/fingerprint | 部分 | deferred trigger/FK 可选 | 事务 assertion 必须 |
| immutable row | 否 | revoke UPDATE / trigger | repository 不暴露 update |
| partial/expression/deferrable index | 本任务不启 preview | 需要时手写 | query test |
| 加密/HMAC/canonical fingerprint | ciphertext 列 | key/version 基础约束 | 应用/KMS |
| Zod/grapheme/cross-JSON | JSONB | 大小/类型基础约束可选 | 共享 Schema 权威 |
| TTL/hard delete/provider/backup | expiry 列 | 索引/权限 | worker/运维权威 |
| table grants / restricted access | 否 | 必须 | 身份与审计 |

`prisma db push` 禁止用于共享/生产环境。所有环境只接受版本化 migration history；手写 SQL 不能在 `prisma db pull` 后被无意删除。

## 14. 安全与访问

### 14.1 加密

- 应用层 envelope encryption；data key 不与 ciphertext 同库保存；
- 每个密文字段保存 key version；轮换不改变业务 revision，除非明文语义同时变化；
- lookup 使用有版本的 HMAC/token，不使用可逆确定性加密；
- ACCOUNT 删除先销毁/撤销 scope key 或密文，再删除 identity/stable subject；
- 备份 key 与在线 key 分离，可通过范围化 key destruction 提前不可恢复。

### 14.2 数据库角色

至少规划：migration owner、API read/write、worker、restricted-safety、deletion、evaluation、read-only operations。禁止应用使用 owner/superuser。Restricted 访问必须工单/目的/时限化；普通客服和 analytics 无权读取密文或 Safety 表。

### 14.3 日志与导出

- SQL 参数、Prisma query logging、slow query、error context 必须脱敏；生产不记录 bind values；
- 导出按白名单投影解密；不导出 internal seed/ref、provider attempt、Safety 受限对象、audit、guard 或删除回执 token；
- dump、snapshot、fixture、support bundle 禁止携带真实用户行；
- 数据库错误返回稳定服务码，不把 constraint 名、SQL、row 或 object key发给客户端。

### 14.4 RLS

S-19 不把 PostgreSQL RLS 当作唯一 owner 边界。若 S-29 采用连接池/RLS，必须证明每事务身份注入、连接复用清理、worker/bypass role 和集成测试正确；在此之前使用数据库 grants + repository owner predicate +服务授权三层保护。

## 15. Migration、回滚与测试数据

### 15.1 版本固定

S-28/E-006 在首次 migration 前固定 PostgreSQL、Prisma CLI/Client、Node 和 adapter 版本。CLI 与 Client 必须同版本；Schema 使用 Prisma 7 的 `prisma-client` generator，连接 URL 放入未来 `prisma.config.ts`，不写入仓库。

### 15.2 迁移流程

1. 修改 Schema 与必要自定义 SQL；
2. `prisma format`、`prisma validate`；
3. 在空库生成/应用 migration；
4. 在带合成旧版本 fixture 的升级库应用；
5. 校验 SQL-001～020、FK、index、grants、query plan；
6. 运行 64 项场景、上游 S-17/S-18 场景和 shared-schema 契约；
7. 生成 migration checksum 和 schema drift 报告；
8. 备份恢复演练通过后才发布 destructive contract step。

在线迁移采用 expand → dual-read/write（仅必要时）→ backfill → validate → switch → contract。大表添加约束优先 `NOT VALID` + `VALIDATE CONSTRAINT` 等低锁策略；实际策略由目标 PostgreSQL 版本验证。

### 15.3 回滚

- 可逆 DDL 提供 down/forward-fix 说明；
- 已删除列/数据、加密销毁、retention 清理不可假装可回滚；
- destructive migration 必须先确认旧应用不再读取、备份期限和隐私删除不被恢复；
- 业务发布回滚不得把旧 migration 恢复的已删数据重新开放；
- migration 失败停止写入或保持兼容状态，不手工跳过 checksum。

### 15.4 测试数据

- 只使用合成 AccountRef、openid 替代 token、文本和 Safety case；
- fixture 明确 factory version、ProductDate policy、retention policy 和 seed；
- 不从生产 dump 采样，不在 snapshot 中保留真实密文；
- evaluation fixture 使用 SyntheticSubjectRef，字段扫描拒绝 AccountRef/StableSubjectId；
- 测试覆盖 UTC/Asia-Shanghai 04:00、闰日、月末、并发、失败、删除和恢复。

## 16. 验收矩阵（64 项）

### 16.1 身份、同意、资料与类型（8）

| ID | 场景 | 必须结果 |
| --- | --- | --- |
| S19-DB-001 | 相同 provider + lookup token 并发建账户 | external identity unique；只有一个账户映射 |
| S19-DB-002 | 相同明文身份产生不同 ciphertext | lookup token 仍稳定命中；日志无明文 |
| S19-DB-003 | Account DELETED 后原身份再次开始 | 新 AccountRef/StableSubject/consent；旧 seed 不复用 |
| S19-DB-004 | Profile expected revision 过期 | CAS 0 行、整体冲突；不覆盖新值 |
| S19-DB-005 | Profile 保存 nickname ciphertext 但无 key version | SQL-003 拒绝 |
| S19-DB-006 | 同命令相同 payload 重试 onboarding | 返回原 completion；不新增 profile revision |
| S19-DB-007 | 同命令不同 payload | CommandReceipt 冲突；领域表不写 |
| S19-DB-008 | 客户端伪造 ProductDate | 服务端冻结 date/policy；DB 只接收已解析 date |

### 16.2 Checkin、生成与发布（8）

| ID | 场景 | 必须结果 |
| --- | --- | --- |
| S19-DB-009 | 同 owner/date 两个 Checkin 并发 | unique winner；输家读取 existing |
| S19-DB-010 | 同 owner/date 两个 GenerationIntent 不同 version | 只有一个 intent；version 不参与唯一键 |
| S19-DB-011 | Checkin revision 更正后旧 snapshot | snapshot 不变；Weekly source fingerprint 可变化 |
| S19-DB-012 | GatewayInvocation 同时绑定 Daily 与 Weekly | SQL-005 拒绝 |
| S19-DB-013 | 同 invocation/role/ordinal 重试 | 单 attempt；不重复计 cost |
| S19-DB-014 | invalid raw provider response | 不创建 candidate、不落 raw；仅脱敏 outcome |
| S19-DB-015 | 两个合格 candidate 并发发布 | owner/date result unique；输家读取 existing |
| S19-DB-016 | Safety/deletion epoch 在 provider 返回前变化 | 发布事务拒绝，candidate 清除 |

### 16.3 互动与关系（8）

| ID | 场景 | 必须结果 |
| --- | --- | --- |
| S19-DB-017 | EVE 三组件 revisions 都匹配 | feedback/helpfulness/task + aggregate 同事务提交 |
| S19-DB-018 | EVE 任一 revision 冲突 | 三组件全部不写 |
| S19-DB-019 | HIGH_RISK note 与普通 patch 同请求 | 只写 Safety 最小对象；普通 interaction 写入 0 |
| S19-DB-020 | 未评分帮助度 | 无行 = UNRATED；不得插入伪负面值 |
| S19-DB-021 | 同日多端点亮 | 一个 LightFact；DayLit outbox 一个逻辑事件 |
| S19-DB-022 | DayLit 重投 | Inbox + link unique；relationship count 不重复 |
| S19-DB-023 | 同 owner 并发建 active cycle | nullable active slot unique；只有一个 ACTIVE |
| S19-DB-024 | 关系删除后旧 DayLit 重放 | cutoff/guard 拒绝；新 cycle 不导入旧 light |

### 16.4 事项、记忆与 Weekly（8）

| ID | 场景 | 必须结果 |
| --- | --- | --- |
| S19-DB-025 | Matter title 保存 | 只有 ciphertext/key version；audit/outbox 无 title |
| S19-DB-026 | 同 source 的 Daily grant 存在、Weekly grant 缺失 | Weekly resolver 无权使用 |
| S19-DB-027 | grant revoke 与候选发布竞态 | revision/PublishGuard 使整候选失败 |
| S19-DB-028 | matter 删除且 slot 有 fallback | 硬删 personalized fragment；视图切 fallback |
| S19-DB-029 | matter 删除且无安全 fallback | visibility/summary BLOCKED，不删句展示 |
| S19-DB-030 | Weekly 七天中删除一个 DAY | source fingerprint 变化；旧 current summary 隐藏 |
| S19-DB-031 | 只修改 evening note | Weekly fingerprint 不变 |
| S19-DB-032 | 两个 summary revision 并发争 current | CAS + SQL-012 只指向当前 fingerprint 完整修订 |

### 16.5 Safety 与通知（8）

| ID | 场景 | 必须结果 |
| --- | --- | --- |
| S19-DB-033 | 首次 HIGH_RISK | state revision/epoch、event、plan、outbox 原子提交 |
| S19-DB-034 | Safety event 写 raw text/confidence | model 无字段，allowlist/测试拒绝 |
| S19-DB-035 | 资源点击 | 不能改变 SafetyState 或创建 recovery receipt |
| S19-DB-036 | 两步恢复 expected revision 过期 | CAS 拒绝，不自动 CLEAR |
| S19-DB-037 | 默认通知设置 | enabled=false；平台 GRANTED 不改偏好 |
| S19-DB-038 | 同 semantic notification 并发计划 | account + semanticKey 只一条 |
| S19-DB-039 | dispatch 前 Safety 变 ACTIVE | SUPPRESSED；不调用平台 |
| S19-DB-040 | 平台 timeout 后重试 | 原 intent/claim/attempt 恢复；不新建语义 intent |

### 16.6 删除、保存与恢复（8）

| ID | 场景 | 必须结果 |
| --- | --- | --- |
| S19-DB-041 | 同 scope/target 重复删除 | 一个 active DataTask；重复读取原任务 |
| S19-DB-042 | 删除 worker 第三步失败 | guard 保持；原 task checkpoint 重试 |
| S19-DB-043 | FAILED ACCOUNT delete | account 保持 DELETING；普通路径仍阻断 |
| S19-DB-044 | DAY 删除成功后当前日重记 | guard 解析 original version；新 intent 比较最新 epoch |
| S19-DB-045 | DayErasureGuard 超过 45 天 | SQL-017/retention fixture 拒绝 |
| S19-DB-046 | 20 天备份恢复含已删 DAY | 先重放 restore deny/guard，再开放；DAY 不复活 |
| S19-DB-047 | 备份 expiry 超过 35 天 | SQL-017/发布门禁失败 |
| S19-DB-048 | ACCOUNT receipt 创建 | 无 AccountRef/StableSubject/external identity；6 个月到期 |

### 16.7 Outbox、并发与失败恢复（8）

| ID | 场景 | 必须结果 |
| --- | --- | --- |
| S19-DB-049 | 事务回滚 | 领域写与 outbox 都不存在 |
| S19-DB-050 | publisher 发送成功但标记前 crash | 事件可重发；consumer inbox 去重 |
| S19-DB-051 | consumer 写成功但 ack 前 crash | 原 event receipt 使第二次 no-op |
| S19-DB-052 | 旧 epoch cache/outbox 晚到 | 读取/consumer 同步拒绝，不等待清理 |
| S19-DB-053 | TTL workers 并发扫描 | SKIP LOCKED/claim 不重复处理同一 row |
| S19-DB-054 | TTL 删除遇到 active legal hold | 移入/保持 restricted frozen，不回 active source |
| S19-DB-055 | DataTask 7 天未完成 | FAILED + stable scope codes；无 SQL/raw error |
| S19-DB-056 | Unknown command outcome | 按 receipt/aggregate 恢复；不换 key/date/intent |

### 16.8 安全、迁移与评测（8）

| ID | 场景 | 必须结果 |
| --- | --- | --- |
| S19-DB-057 | 普通 API 查询 restricted table | DB grant 拒绝 |
| S19-DB-058 | Prisma query logging 含 bind values | 生产配置/测试失败；日志无个人值 |
| S19-DB-059 | ACTIVE provider profile training=true 或 retention 31 天 | SQL-016/发布门禁拒绝 |
| S19-DB-060 | EvaluationSample 关联 AccountRef | Schema/fixture scanner 拒绝，只用 SyntheticSubjectRef |
| S19-DB-061 | 空库应用全部 migrations | Schema、SQL-001～020、grants 全通过 |
| S19-DB-062 | 旧合成 fixture 升级 | 数据/版本/fingerprint 保持，读写兼容 |
| S19-DB-063 | migration 回滚应用版本但备份含已删数据 | restore deny 仍先执行，不重新开放数据 |
| S19-DB-064 | Prisma introspection/format 后 | 自定义 CHECK/trigger/grants 未丢，drift report 为零 |

### 16.9 上游场景覆盖索引

此表是测试规划索引，不表示一个 S-19 case 只能覆盖一个上游 case。S-31 必须保留上游原 ID，并在测试 metadata 中记录具体对应关系。

| 上游组 | 主要 S-19 落点 |
| --- | --- |
| D17-I01～I06 身份/同意/日期 | DB-001～008、037、044、048 |
| D17-D01～D06 日记录/幂等 | DB-009～011、017～020、056 |
| D17-G01～G06 生成/发布 | DB-012～016、049、052 |
| D17-R01～R06 互动/关系 | DB-017～024、030 |
| D17-M01～M06 事项/记忆/周 | DB-025～032 |
| D17-S01～S06 Safety/通知 | DB-033～040 |
| D17-X01～X06 删除/失效 | DB-041～048、052、055 |
| D17-V01～V06 版本/隐私/评测 | DB-057～064 |
| S18-R01～R06 期限/到期 | DB-041～048、053～055 |
| S18-D01～D06 DAY/重记 | DB-014、016、041～045、052 |
| S18-M01～M06 MATTER/关系 | DB-024～029、041 |
| S18-A01～A06 ACCOUNT/导出 | DB-001～003、043、048、057 |
| S18-C01～C06 缓存/队列/恢复 | DB-046～047、049～054、063 |
| S18-S01～S06 Safety/log/hold | DB-033～036、054、057～058 |
| S18-P01～P06 provider/对象 | DB-038～040、047～048、059 |
| S18-X01～X06 幂等/证明 | DB-041～045、048、055～056 |

## 17. 验证门禁

S-19 文档审核要求：

- `prisma/schema.prisma` 可被当前 Prisma 7 `format` 与 `validate`；
- model、enum、relation、index 名无重复或悬空；
- 所有 owner/date、attempt、notification、active task 等已接受唯一性有落点；
- SQL-001～020 每项有明确 migration/test owner；
- 所有 personal/restricted/ephemeral model 具备 policy/anchor/scope/expiry，或属于已记录的 closed allowlist 例外；
- 没有 `deletedAt`、generic memory text、raw provider response、Prompt、Safety raw input、真实 evaluation AccountRef；
- ciphertext 字段与 key version 成对；
- 64 个 S19-DB ID 唯一；
- 上游 S-17 48 项与 S-18 48 项可映射到 DB constraint 或 service/integration test；
- docs/INDEX、backlog、current 与 ADR-0005 Accepted 状态一致；
- PR 不包含 migration、生产代码、配置 secret 或真实数据。

## 18. E-006 / S-20 交接

### 18.1 E-006 PostgreSQL 与 Prisma

- 固定 PostgreSQL/Prisma/Node/adapter 版本；
- 创建 `prisma.config.ts`、开发/测试数据库、migration history；
- 实现并测试 SQL-001～020；
- 创建角色/grants、加密接口 stub、outbox/inbox、TTL/deletion fixture；
- 生成合成 seed，不接生产 provider 或真实微信身份；
- 通过 64 项 S-19、S-17/S-18 回归与备份恢复演练。

### 18.2 S-20 API 契约

- API DTO 不直接暴露 Prisma model；
- 所有 ref 再做 owner/状态/日期权限；
- expected revision、command ref、idempotency conflict 与 Unknown outcome 有稳定错误语义；
- DataTask 展示 guarded/online erased/backup deadline 的真实层次；
- 客户端只得到白名单 Schema view，不得到 ciphertext、fingerprint、epoch、seed、attempt、guard 或受限证据。

### 18.3 S-21 / S-24 / S-29～S-33

- S-21 将 model/field 映射到目的、敏感性、处理方、地区、期限和用户权利；
- S-24 analytics 只从批准事件投影，不直接扫产品表或文本；
- S-29 决定模块/进程/数据库角色、事务边界和 Redis/BullMQ 协作；
- S-31 把 SQL-ID、64 项矩阵、shared Schema、并发与恢复纳入测试金字塔；
- S-33 监控 unique conflict、CAS、outbox lag、TTL lag、删除 SLA、backup/provider deadline 和成本，不记录内容。

## 19. 明确禁止

- `prisma db push` 直接修改共享或生产数据库；
- 用一个 JSONB `user_data` / `daily_status` / `memory` 承载全部事实；
- 用 `deletedAt` 或 scope-less CASCADE 声称删除完成；
- 在日志、audit、outbox、notification、analytics 保存标题、note、签到、表达、Prompt、Safety 原文或 raw provider output；
- 把 Redis/cache/search index 当权威；
- 由客户端提交 owner、Safety/deletion epoch、retention policy 或 ProductDate 真值；
- 把数据库 UUID 当授权；
- 为排障复制生产行到开发/评测；
- 在版本未固定前启用 Prisma preview feature 保护核心唯一性；
- migration/restore 绕过 deletion ledger 或 legal hold；
- 在 S-19 PR 中创建真实 migration、数据库、用户、密钥、provider 调用或生产代码。

## 20. 审核记录

- Draft PR：待创建；
- 接受状态：未接受；
- 接受日期：待用户确认；
- 本次需审核：表边界、Prisma 结构、SQL-001～020、事务、加密、TTL/删除、outbox/inbox、迁移与 64 项场景；
- 接受后下一任务：S-20 API 契约。
