# DailyEnergy 隐私数据地图

- **文档状态**：Draft
- **所属任务**：S-21 — 隐私数据地图
- **最后更新**：2026-07-23
- **适用范围**：Phase 0B / P0～P1 数据收集、使用、存储、传输、访问、保存、删除与用户权利
- **上游权威**：[产品状态机](../product/state-machine.md)、[业务规则](../product/business-rules.md)、[结构化记忆](../ai/memory.md)、[内容安全](../ai/safety.md)、[AI Gateway](../ai/gateway.md)、[领域模型](../data/domain-model.md)、[ADR-0005](../decisions/ADR-0005-data-retention-and-deletion.md)、[数据库规格](../technical/database.md)、[API 契约](../technical/api.md)、[Prisma 草案](../../prisma/schema.prisma)
- **下游任务**：S-22～S-25、S-29、S-31～S-33、C-002、C-014、C-015、A-005～A-008
- **法律状态**：本文是产品与工程数据治理规格，不是最终隐私政策、用户协议或法律意见；上线前须按实际主体、地区、受托方和部署重新核验

## 1. 目的与边界

本文把已接受的产品、AI、领域、数据库、API 与保存删除规则整理成一张可审计的数据地图，逐项回答：

1. 数据从哪里来、由谁主动提供或产生；
2. 为什么处理、是否为当前功能所必需；
3. 进入哪些服务、数据库、缓存、队列、对象、日志、备份或受托方；
4. 谁可以访问，客户端和管理端能看到什么；
5. 最长保存多久，何时停止普通使用；
6. 用户怎样查看、更正、导出、撤回和删除；
7. 删除后如何阻止缓存、迟到任务、受托副本和备份恢复造成复活。

本文不新增字段、处理目的、接收方、保存期限、跨境安排或生产实现。发现上游未定义的处理活动时，必须标为阻塞项，不得为了填表自行补齐。

## 2. 不可突破的原则

- **目的最小化**：只处理实现一分钟陪伴、真实回望、安全和用户权利所需的数据。
- **权威源唯一**：记忆、分析、缓存和 AI 输入不是第二套用户事实库。
- **用途绑定**：资料、事项、真实状态、关系事实和通知授权不能互相借用用途。
- **视图隔离**：客户端只接收封闭白名单 View；DTO 不等于 Prisma model，UUID 不构成授权。
- **自由文本高约束**：称呼、事项标题、晚间 note、支持文本先经过对应 Schema 与 Safety；禁止进入普通日志和任意分析。
- **Safety 优先**：high-risk 原文不进入普通保存、普通 AI、memory、通知、分享或 analytics。
- **删除优先**：deletion guard 一旦提交，被删范围同步停止普通读取、写入、生成、通知、分享、缓存和派生使用。
- **受限证据隔离**：Safety、删除、网络安全和依法保留证据不能成为产品、记忆、分析、营销或普通支持数据源。
- **匿名不靠命名**：UUID、HMAC、opaque ref、去标识 token 仍可能属于个人信息；只有不可识别且不能复原的结果才可进入匿名聚合。
- **缺口 fail closed**：没有明确权威模型、期限、接收方条件或删除路径的数据，不得持久化或对外传输。

## 3. 分类口径

### 3.1 数据层级

| 层级 | 含义 | 普通产品可读 |
|---|---|---|
| T0 Transient | 单次请求、内存计算、未发布候选、临时对象 | 仅当前受控处理 |
| T1 Active Product | 当前产品目的所需的权威事实和有效派生 | 按 owner、purpose 与服务角色 |
| T2 Restricted Evidence | Safety、删除、运行安全、合规和依法保留最小证据 | 否 |
| T3 Isolated Backup | 与普通服务隔离的加密数据库/对象备份 | 否 |
| T4 Anonymous/System | 不可识别匿名聚合或非个人版本配置 | 不适用 |

### 3.2 敏感级别

- **高**：身份映射、自由文本、Safety、删除证据、网络安全日志或可连接多类用户事实的记录。
- **中**：结构化状态、行为、偏好、每日/周派生内容和通知设置。
- **低/非个人**：不含真实用户引用的版本目录、公开资源配置和不可识别聚合。

### 3.3 处理依据代码

下列代码仅用于工程追踪，最终法律依据由上线前法律核验确认：

| 代码 | 工程含义 |
|---|---|
| BASIS-CORE | 提供用户主动请求的核心账户、签到、结果、互动、历史和权利能力所必需 |
| BASIS-EXPLICIT | 用户明确创建、修改、点亮、保存、导出或删除所触发 |
| BASIS-GRANT | 可选记忆、提醒或通知的精确用途授权，允许撤回 |
| BASIS-SAFETY | 履行产品安全边界、阻断普通流程和提供固定现实资源所需 |
| BASIS-SECURITY | 认证、防滥用、网络安全、故障恢复和受限审计所需 |
| BASIS-LEGAL | 明确法律义务、影响评估或经批准 legal hold 的最小范围 |
| BASIS-PROCESSOR | 受托方只能按 DailyEnergy 指令处理，不获得独立产品用途 |

## 4. 数据资产总表

| 稳定 ID | 数据主体 | 数据类别 | 类型 | 敏感 | 层级 | 处理目的 | 依据 |
|---|---|---|---|---|---|---|---|
| PDM-ACCOUNT-001 | 用户 | 微信外部身份映射、AccountRef、StableSubjectId | 权威身份事实 | 高 | T1 | 建立唯一账户并恢复合法会话 | BASIS-CORE |
| PDM-SESSION-001 | 用户 | session/refresh token hash、设备会话 ref、Safety/view continuation | 认证运行数据 | 高 | T1 | 会话、撤销和受限连续访问 | BASIS-CORE / SECURITY |
| PDM-CONSENT-001 | 用户 | notice version、动作、状态、时间、command ref | 同意回执 | 中 | T1/T2 | 证明当前必要告知和撤回状态 | BASIS-EXPLICIT |
| PDM-PROFILE-001 | 用户 | preferred name、expression style、profile revision | 用户提供资料 | 高/中 | T1 | 称呼与表达偏好 | BASIS-EXPLICIT |
| PDM-CHECKIN-001 | 用户 | product date、mood、energy、sleep、revision | 结构化真实状态 | 中 | T1 | 今日生成、真实趋势与历史 | BASIS-EXPLICIT |
| PDM-GEN-INTENT-001 | 用户 | generation intent、冻结输入 revision/version/fingerprint | 运行与冻结快照 | 中 | T1 | 幂等生成和发布前守卫 | BASIS-CORE |
| PDM-DAILY-RESULT-001 | 用户 | 五维事实、行动/任务、受控表达、版本与 provenance | 系统派生内容 | 中 | T1 | 展示稳定今日结果和历史 | BASIS-CORE |
| PDM-INTERACTION-001 | 用户 | 点亮、任务状态、帮助度 | 用户行为/事实 | 中 | T1 | 完成当日体验和关系节点 | BASIS-EXPLICIT |
| PDM-EVENING-001 | 用户 | overall feeling、可选 evening note、revision | 结构化反馈/自由文本 | 高 | T1 | 保存当晚真实反馈 | BASIS-EXPLICIT |
| PDM-RELATIONSHIP-001 | 用户 | relationship cycle、encounter link、node receipt | 系统派生关系事实 | 中 | T1 | 展示真实共同经历与节点 | BASIS-CORE |
| PDM-MATTER-001 | 用户 | 事项标题、日期、状态、revision | 用户主动自由文本 | 高 | T1 | 用户主动让产品记住近期事项 | BASIS-EXPLICIT |
| PDM-MEMORY-GRANT-001 | 用户 | source × purpose grant、master preference | 用途授权事实 | 中 | T1 | 控制事项/状态/关系能否用于特定目的 | BASIS-GRANT |
| PDM-MEMORY-RUNTIME-001 | 用户 | mention receipt、context snapshot、source dependency、fallback | 派生运行数据 | 中 | T1 | 可解释使用、限频和删除后无源回退 | BASIS-GRANT |
| PDM-WEEKLY-001 | 用户 | 七天窗口、源快照、聚合事实、当前 summary revision | 真实聚合/派生内容 | 中 | T1 | 七天趋势和总结 | BASIS-CORE |
| PDM-SAFETY-STATE-001 | 用户 | CLEAR/ACTIVE/RECOVERY_PENDING、revision、epoch、固定响应计划 ref | 受限安全状态 | 高 | T2 | 覆盖普通旅程并提供固定安全响应 | BASIS-SAFETY |
| PDM-SAFETY-EVENT-001 | 用户 | 最小 decision/event/resource action 元数据 | 受限安全证据 | 高 | T2 | 状态一致性、受限审计和故障排查 | BASIS-SAFETY |
| PDM-NOTIFY-PREF-001 | 用户 | 通知偏好、平台权限快照 | 用户设置/外部观察 | 中 | T1 | 用户控制通知与判断平台是否可投递 | BASIS-GRANT |
| PDM-NOTIFY-RUNTIME-001 | 用户 | semantic intent、投递 attempt、平台 opaque ref、outcome | 运行元数据 | 中 | T1/Runtime | 幂等投递、失败恢复和限频 | BASIS-GRANT / PROCESSOR |
| PDM-SHARE-001 | 用户 | 分享预览、短期草稿、图片对象、intent | 临时派生 | 中 | T0/T1 | 用户明确生成并分享隐私安全卡片 | BASIS-EXPLICIT |
| PDM-EXPORT-001 | 用户 | 导出任务、短期 artifact、下载状态 | 用户权利数据 | 高 | T0/T1/T2 | 向用户提供自身数据副本 | BASIS-EXPLICIT |
| PDM-RIGHTS-TASK-001 | 用户 | DataTask、DeletionGuard、step checkpoint、failure scope | 受限权利流程 | 高 | T2 | 同步阻断、执行和展示删除/导出状态 | BASIS-EXPLICIT |
| PDM-RIGHTS-EVIDENCE-001 | 用户 | deletion receipt、provider deletion、restore deny、backup deadline | 最小受限证据 | 高 | T2 | 证明删除、跟踪外部到期、防止备份复活 | BASIS-SECURITY / LEGAL |
| PDM-RUNTIME-001 | 用户 | command receipt、gateway attempt、outbox/inbox、trace ref、usage/cost/failure | 脱敏运行元数据 | 中 | Runtime/T2 | 幂等、可靠执行、成本和故障观察 | BASIS-SECURITY |
| PDM-SECURITY-LOG-001 | 用户 | 必需 IP/网络/认证安全事件 | 受限网络安全日志 | 高 | T2 | 安全保护和法定义务 | BASIS-SECURITY / LEGAL |
| PDM-BACKUP-001 | 用户 | 可能覆盖用户数据的隔离加密备份 | 灾备副本 | 高 | T3 | 灾难恢复 | BASIS-SECURITY |
| PDM-SUPPORT-001 | 用户 | 支持分类与可选文本 | 用户主动自由文本 | 高 | 未冻结 | 接收用户问题和反馈 | BASIS-EXPLICIT |
| PDM-EVALUATION-001 | 合成主体 | SyntheticSubjectRef、合成 response/artifact | 合成评测数据 | 低 | Evaluation/T4 | AI 质量与回归 | 非真实个人数据 |
| PDM-SYSTEM-001 | 不适用 | Schema、Prompt、route、policy、resource、retention、provider profile 版本 | 系统配置 | 低/非个人 | T4/System | 可追踪发布、回滚和数据治理 | 不适用 |

`PDM-SUPPORT-001` 在 S-19 中没有权威 model、保存期限和删除传播。S-22 或上游变更完成前，只能采用不持久化的受控提交/人工转交方案，不能自行新建长期支持文本库。

## 5. 收集入口、API、领域与 Prisma 映射

| 数据 ID | 页面/来源 | API DTO / 白名单 View | 领域对象 | Prisma / 主要字段 | 客户端可见 |
|---|---|---|---|---|---|
| ACCOUNT-001 | `wx.login` | `POST /auth/wechat/session`、LaunchStateSnapshot | Account / External Identity | `UserAccount`、`ExternalIdentity(providerCode, subjectLookupToken, subjectCiphertext)` | account 状态摘要；不返回 openid/unionid/密文 |
| SESSION-001 | 登录/刷新/跨日继续 | auth session、Safety continuation、bootstrap | Session / Continuation Grant | `SessionCredential(tokenHash, deviceRef, expiresAt, revokedAt)`、`ViewContinuationGrant` | opaque token；不返回 hash/内部 scope map |
| CONSENT-001 | 必要告知页 | `/consent/current|accept|withdraw` | Necessary Consent | `NecessaryConsentRecord(noticeVersion, logicalIntent, status, acceptedAt, withdrawnAt)` | 当前版本与状态 |
| PROFILE-001 | 首次认识/资料设置 | ProfileView、onboarding/profile commands | Profile | `UserProfile`、`UserProfileRevision(preferredNameCiphertext, expressionStyle, revision)` | 解密后的自身称呼、风格与 revision |
| CHECKIN-001 | 晨间签到 | CheckinView、submit/correct/rebuild | Morning Checkin | `MorningCheckin(productDate, mood, energy, sleep, revision)`及 revision | 自身结构值与 revision |
| GEN-INTENT-001 | 启动今日生成 | Generation status view | Generation Intent / Input Snapshot | `GenerationIntent`、`GenerationInputSnapshot`、`GatewayInvocation` | intent 状态；不返回 seed、fingerprint、route、Prompt |
| DAILY-RESULT-001 | 今日/历史详情 | TodayView、ClientDailyContentView | Published Daily Result | `PublishedDailyResult`、content slot/fragment、visibility、dependency | 白名单正文与展示状态；不返回 provider attempt/内部 refs |
| INTERACTION-001 | 今日点亮/任务/帮助度 | InteractionView、interaction commands | Daily Interaction | `DailyInteraction`、`DailyLightFact`、`DailyTaskState`、`DailyHelpfulnessRecord` | 自身状态与 revision |
| EVENING-001 | 晚间反馈 | EveningView、`POST /evening/save` | Evening Feedback | `EveningFeedbackRecord/Revision(overallFeeling, noteCiphertext)` | 自身 feeling/note；note 不进入其它 View |
| RELATIONSHIP-001 | 今日关系模块 | TodayView 关系白名单 | Relationship Cycle / Encounter | `RelationshipCycle`、`RelationshipEncounterLink`、`RelationshipNodeReceipt` | 阶段/节点展示；不返回 link 图或内部 fingerprint |
| MATTER-001 | 事项管理 | MatterView、matter commands | Important Matter | `ImportantMatter`、revision title ciphertext/status/date | 自身事项与用途开关摘要 |
| MEMORY-GRANT-001 | 记忆设置 | MemoryManagementView、memory preferences | Purpose Grant | `MemoryPurposeGrant`、`MemoryMasterPreference` | 可理解的开关与来源说明；不返回内部 grant ref |
| MEMORY-RUNTIME-001 | resolver 内部 | 不提供通用客户端接口 | Context Snapshot / Dependency | `MemoryMentionReceipt`、`MemoryContextSnapshot`、`SourceDependency` | 仅经批准的可见文本与来源说明 |
| WEEKLY-001 | 七天趋势 | WeeklyView、history views | Weekly Window / Summary | `WeeklyWindow`、source snapshot、summary intent/revision、content/dependency | 真实聚合、coverage、当前有效 summary |
| SAFETY-STATE-001 | 任一可检查自由文本、Safety 页 | SafetyView、recovery commands | Safety State / Response Plan | `SafetyState`、`SafetyResponsePlan`、`RecoveryCommandReceipt` | 固定状态与资源；不返回类别、confidence、原文、rationale |
| SAFETY-EVENT-001 | Safety gate/资源操作 | 管理端脱敏 Safety event view | Safety Decision / Event | `SafetyDecision`、`SafetyEvent`、最小 resource action | 用户端不见内部事件；管理端仅脱敏 |
| NOTIFY-PREF-001 | 通知设置 | NotificationSettingsView、permission-sync | Preference / Platform Snapshot | `NotificationPreference`、`PlatformPermissionSnapshot` | 自身偏好与平台观察状态 |
| NOTIFY-RUNTIME-001 | 排期/投递 | 普通客户端只见结果性状态 | Notification Intent / Attempt | `NotificationIntent`、`NotificationDeliveryAttempt` | 不返回平台 ref、payload、内部失败细节 |
| SHARE-001 | 分享预览/点击分享 | `/share/preview`、`/share/intent` | Share Draft / Intent | 当前无独立 Prisma 权威 model；短期对象/运行记录 | 默认隐藏称呼、原始状态、自由文本和记忆 |
| EXPORT-001 | 数据管理页 | DataTaskView、export command | Export DataTask | `DataTask(kind=EXPORT)` + 24h 对象 artifact | 下载链接和真实到期时间 |
| RIGHTS-TASK-001 | 删除确认/任务页 | DataTaskView、prepare/confirm/task queries | Data Task / Guard | `DataTask`、`DeletionGuard`、`DeletionStepCheckpoint` | scope、阶段、online erased、backup deadline；无被删正文 |
| RIGHTS-EVIDENCE-001 | 删除 worker/恢复演练 | 普通用户仅通过 DataTaskView 间接获知 | Receipt / Provider / Restore Deny | `DeletionReceipt`、`ProviderDeletionRequest`、`RestoreDenyRecord`、`DayErasureGuard` | 不返回 blinded token、epoch、provider 内部 ref |
| RUNTIME-001 | 所有可重试命令与后台执行 | CommandReceiptView 的封闭子集 | Command / Gateway / Event Delivery | `CommandReceipt`、`GatewayAttempt`、`OutboxEvent`、`InboxReceipt` | command outcome/ref；不返回请求正文、模型名、成本链 |
| SUPPORT-001 | FAQ/支持反馈 | `POST /support/feedback` | 尚未冻结 | 尚无 Prisma 权威模型 | 仅提交结果；不得回显或扩散文本 |

字段映射原则：API DTO 只能提交 OpenAPI 明确允许的字段；owner、账户 ID、Safety/deletion epoch、seed、ciphertext、provider、内部 fingerprint 和任意 Prisma 字段均由服务端解析或生成。

## 6. 处理目的、必要性与禁止用途

| 数据组 | 允许目的 | 必要性/可选性 | 明确禁止 |
|---|---|---|---|
| Account / Session | 登录、会话恢复、owner 授权、注销 | 核心必要 | 广告画像、联系人匹配、跨产品身份拼接 |
| Consent | 显示和证明必要告知状态 | 核心必要 | 把平台通知权限当作业务同意 |
| Profile | 称呼与表达风格 | 称呼可选、风格为产品设置 | 推断真实姓名、性别、职业、关系或社会身份 |
| Checkin | 今日内容输入、真实趋势、历史回看 | 核心用户行为 | 医疗/心理诊断、风险定价、人格标签、对外比较 |
| Daily Result | 展示当天和历史内容 | 核心派生 | 当成未来承诺、医疗/投资/法律结论或重新推断事实 |
| Interaction / Relationship | 记录完成行为与真实共同经历 | 互动可选 | 断签惩罚、焦虑召回、虚拟恋爱或排他性依赖 |
| Evening | 保存用户真实回顾 | 可选 | note 进入 Weekly、普通 AI、memory、通知、分享或 analytics |
| Matter / Memory | 用户主动事项和精确用途引用 | 完全可选且可撤回 | 自动抽取日记、外部抓取、通用长期画像、跨用途借权 |
| Weekly | 聚合真实七日结构事实 | 核心回望 | 引用 raw note、每日 AI 文本、未批准事项或虚构原因 |
| Safety | 阻断普通流程、固定响应、受控恢复 | 安全必要 | 诊断、危机档案、营销、普通客服浏览、模型生成固定响应 |
| Notification | 用户选择的中性提醒 | 默认关闭 | 恐惧、低分、断签压力、敏感原文或擅自新增权限 |
| Share | 用户主动生成隐私安全卡片 | 可选 | 默认包含称呼、签到、note、事项、Safety 或隐藏记忆 |
| Runtime / Logs | 幂等、可靠执行、安全、故障与成本 | 技术必要 | 保存请求/响应 body、自由文本或高基数用户画像标签 |
| Rights / Evidence | 完成访问、导出、删除和防复活 | 权利与安全必要 | 恢复被删内容、用删除回执做产品行为分析 |
| Support | 响应用户主动问题 | 可选 | 自动进入普通 AI、记忆或长期内容库；未冻结前不得持久化 |

## 7. 存储位置与数据流

| 位置 | 允许内容 | 禁止内容 | 清理/失效要求 |
|---|---|---|---|
| 小程序内存 | 当前白名单 View、短期 command ref、展示状态 | openid、密文、seed、Prompt、Safety 原文、依赖图 | 退出/账号切换/Safety/Deleting/删除后立即清空相关 projection |
| 小程序本地缓存 | 仅经规格批准的非敏感短期 View | 自由文本、事项、note、Safety、token 明文长期保存 | 读取必须受 server guard；旧 epoch 不得离线恢复普通页 |
| PostgreSQL `app_*` | T1 权威账户、日事实、互动、关系、事项、周数据 | raw provider response、普通日志、generic memory text | retention 元数据、scope guard、硬删除 |
| PostgreSQL `restricted_*` | Safety、DataTask、guard、回执、restore deny、legal hold、受限审计 | 普通产品查询和运营浏览 | 专用角色、最小字段、独立 TTL |
| PostgreSQL `runtime_*` | command/attempt/outbox/inbox 脱敏元数据 | 请求正文、自由文本、Prompt、密文副本 | 7/30/35 天等明确 TTL |
| PostgreSQL `system_*` | 版本、策略、provider profile、backup catalog、资源配置 | 用户内容和身份映射 | 发布角色只读/受控写 |
| PostgreSQL `evaluation_*` | SyntheticSubjectRef 与合成评测 | 真实 AccountRef 或生产样本 | 与生产用户域隔离 |
| Redis / BullMQ | opaque ref、版本、deadline、guard snapshot、最小任务 payload | 用户自由文本、raw provider body、长期事实副本 | guard 读取 fail closed；删除后 15 分钟物理清理目标 |
| 对象存储 / CDN | 短期分享图、导出 artifact、加密备份 | 默认长期用户内容仓库 | 分享 7 天、导出 24h、在线删除 72h、备份 35 天 |
| 应用日志 / Trace | request id、opaque refs、稳定 reason、版本、时间、usage | 称呼、签到值、事项、note、Prompt、provider body、Safety 原文 | ordinary trace 30 天；严格 allowlist 和脱敏 |
| 网络安全日志 | 必要 IP、网络与认证安全事件 | 产品画像、普通分析、内容恢复 | 独立安全域，六个自然月 |
| AI Provider | 单次批准 prepared input 与 strict Schema | 身份、seed、raw score、note、未授权事项、完整历史 | body 不在本方落库；training off；服务端最长 30 天 |
| 微信平台 | 登录 code 交换、订阅权限/投递所需平台字段 | 业务事实、记忆、Safety 原文 | 按平台规则和合同核验；平台观察不等于用户偏好 |
| 管理后台 | 聚合运行指标、脱敏 Safety/DataTask 状态 | 任意用户全文、密文、Prompt、provider body | 独立企业身份、二次验证占位、访问审计 |
| 隔离备份 | 加密数据库/对象恢复副本 | 普通服务直接挂载和查询 | 最长 35 天；恢复前应用 deletion ledger/restore deny |

### 7.1 正常数据流

```text
用户输入/平台 code
  → 服务端 Schema + owner + Safety/consent/deletion guards
  → 领域权威事实（T1）
  → 确定性 plan / purpose-bound projection
  → 可选 AI Provider 最小输入或本地模板
  → 完整候选校验 + publish guard
  → 白名单 Client View
```

### 7.2 删除数据流

```text
用户确认删除
  → DataTask + DeletionGuard 原子提交
  → 同步 semantic blocked
  → session/cache/queue/in-flight/share/export URL 失效
  → 权威库、派生、对象/CDN、受托在线副本清理
  → provider expiry + backup purge deadline 登记
  → DeletionReceipt + RestoreDenyRecord
```

## 8. 访问角色矩阵

符号：`R` 读取必要明文/结构值，`M` 仅脱敏元数据，`W` 受控写，`—` 无访问。

| 角色 | 身份/会话 | 产品事实 | 自由文本 | AI 输入/输出 | Safety | 删除证据 | 日志/指标 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 当前用户小程序 | R 自身 View | R/W 自身白名单 | R/W 自身允许字段 | 仅发布 View | R 固定 View | R DataTaskView | — |
| Auth 服务角色 | R/W | M 账户状态 | — | — | M 状态守卫 | M account guard | M |
| Profile/Daily 服务角色 | M owner | R/W 对应聚合 | R/W 仅当前字段并加解密 | — | M guard | M scope guard | M |
| Memory Resolver | M owner/source ref | R 已授权 source | R 仅安全投影 | W context snapshot | M guard | M invalidation | M 无值 |
| AI Gateway/Adapter | — | 仅 prepared input | 仅允许 preferred name 安全投影 | R/W 单次调用 | 只收 admission/validator 结果 | — | W usage/reason |
| Safety 专用角色 | M owner | 仅当前 checkable input envelope | T0 检查；不建普通内容库 | 不调用普通 AI | R/W restricted | M guard | W 最小事件 |
| Privacy/DataTask worker | M owner/scope | 仅待清理 refs | 解密仅为销毁，不展示 | 取消/清理 refs | M | R/W restricted | W step code |
| 普通运营后台 | — | 聚合/M | — | 聚合 route 成功率 | — | 聚合/M | 聚合 |
| 受限 Safety 管理 | — | — | — | — | M 脱敏事件 | — | 受限审计 |
| 受限数据权利管理 | M task owner token | — | — | — | M guard | R/W task step，不读正文 | 受限审计 |
| Support | 用户主动提供的最小联系上下文 | 用户提交的必要摘要 | 仅本次/工单若 S-22 批准 | — | 不可浏览危机原文 | M 用户可见任务状态 | 工单审计待 S-22 |
| Security/DB 运维 | M/密文 | 密文或受控 break-glass | 默认不可解密 | — | restricted 需审批 | restricted 需审批 | R 安全域 |
| 微信/AI/云受托方 | 平台所需最小字段 | 仅合同允许投影 | 仅明确批准的单次输入 | 受托处理 | 不获得普通 Safety 原文 | 按删除指令 | 自有受限运行记录 |

任何人工或 break-glass 访问必须具有工单/审批、目的、时间、对象的受限审计；完整 RBAC 和支持流程由 S-22/S-29/A-005 固化。

## 9. AI、记忆与 Safety 的特殊边界

### 9.1 Daily / Weekly Provider 允许输入

- Prompt/Schema/contract version；
- Daily 的 ControlledExpressionPlan 安全语义槽、known/uncertain、allowed basis、style/constraints；
- 可选且通过安全投影的 preferred name；
- Weekly 的 approved fact IDs 对应安全显示值与表述边界；
- strict structured-output declaration。

### 9.2 Provider 禁止输入

- openid/unionid、手机号、设备/广告/渠道 ID；
- AccountRef、StableSubjectId、owner token、source ref/revision/fingerprint；
- root seed、raw score、完整候选、choice trace；
- evening note、支持文本、Safety 原文或风险类别；
- 未授权事项、完整历史、其它用户数据；
- provider key、内部拓扑、删除原因或 route budget。

### 9.3 原始内容策略

- provider request body 仅存在于受控内存和网络传输，本方不落库；
- invalid raw response、non-winning candidate 和迟到 body 不落库、不进日志、不进 analytics；
- attempt 只保存稳定 outcome、opaque request ref、usage、cost、版本和 fingerprint；
- provider 必须 training off、online retention `<= 30` 天，并具有区域、子处理者、删除能力和合同证据；未知即不得 ACTIVE；
- 临时 debug capture 默认禁止；未来若提出，必须新增明确 ADR/隐私评估、短 TTL、脱敏和访问审计。

### 9.4 记忆

- v1 Daily/Weekly 仍不接收事项、近期状态或关系记忆；
- source、purpose、grant、revision、有效窗口和 dependency 必须同时有效；
- grant 撤回、source 修改/暂停/过期/删除或 master switch 关闭后，新 invocation 立即不得使用；
- 已发布 memory-backed 片段必须切换同候选内无源 fallback，不能调用模型重写历史；
- mention receipt 和 dependency 不复制事项标题或自由文本。

### 9.5 Safety

- checkable input 只在单次受控 Safety gate 中处理；high-risk 时 ordinary provider/template calls = 0；
- SafetyState/Event 不保存原文、诊断、confidence 或 rationale；
- 固定响应来自版本化资源，不使用生成式 AI；
- Safety 原文不进入普通数据库、memory、通知、分享、支持、日志或 analytics；
- 用户受控 CLEAR 只解除产品覆盖，不表示临床安全或问题已经解决。

## 10. 第三方、受托方与跨境核验

| 类别 | 当前状态 | 上线前必备证据 | 未满足时行为 |
|---|---|---|---|
| 微信平台 | 具体账号/合同/字段待配置 | 平台协议、登录/订阅字段清单、删除与账号注销说明 | 不启用对应生产能力 |
| Primary AI Provider | 未选择生产 winner | 服务区域、subprocessors、training off、在线/备份保留、删除能力、合同/DPA、披露版本 | route 不得 ACTIVE，使用本地模板 |
| Backup AI Provider | 未选择生产 winner | 与 primary 相同，且确认故障域和数据处理独立性 | route 不得 ACTIVE |
| PostgreSQL/Redis/Queue 托管 | 部署商未冻结 | 区域、加密、访问角色、备份、日志、删除和迁移退出条款 | 不部署真实数据 |
| 对象存储/CDN | 厂商未冻结 | 区域、对象版本、CDN purge、密钥销毁、访问日志和最长 35 天备份 | 分享/导出生产能力关闭 |
| 日志/监控平台 | 厂商未冻结 | allowlist、采样、区域、TTL、访问、导出、删除和禁止正文 | 只使用本地脱敏最小日志 |
| 企业身份/管理后台 | 厂商未冻结 | SSO/MFA、角色、离职撤权、审计和区域 | 不开放生产后台 |
| 用户支持/工单 | S-22 未冻结 | 工单字段、自由文本边界、人员、TTL、删除、Safety 路由 | 不持久化支持文本 |

跨境状态不是“默认无”或“默认有”。在所有实际 provider、云资源、subprocessor、远程支持和日志平台确认前，状态为 **UNVERIFIED / 阻塞生产**。若存在境外处理或访问，必须在上线前完成适用的法律评估、告知、合同和技术措施，不能仅修改本表状态。

## 11. 保存期限与删除传播

以下均为最长默认期限；用户删除、目的终止、grant 撤回或适用规则要求更短时提前结束。

| 数据 ID | 活跃/最长期限 | 终止后 | 删除范围与传播 |
|---|---|---|---|
| ACCOUNT-001 | 账户 ACTIVE；24 个月无主动认证使用自动触发删除 | guard 后立即不可用，在线 72h 清除 | ACCOUNT；身份、profile、日数据、关系、事项、周数据、会话、对象和派生 |
| SESSION-001 | session 最长 30 天，可主动撤销 | 登出/Restricted/Deleting/删除时立即吊销 | ACCOUNT；缓存和 continuation 同步失效 |
| CONSENT-001 | 当前必要回执随账户 ACTIVE | 被替代最小回执最多 6 个自然月 | ACCOUNT/withdrawal；正文不存在 |
| PROFILE-001 | 当前 revision 随账户 ACTIVE | 被替换结构值最多 30 天；旧自由文本 72h | ACCOUNT/source clear；context/candidate 失效 |
| CHECKIN/RESULT/INTERACTION/EVENING | 账户 ACTIVE，允许逐日删除 | DAY 在线 72h；24 月无使用触发 ACCOUNT | DAY/ACCOUNT；生成、周、关系、memory、通知、分享、导出、缓存、队列 |
| RELATIONSHIP-001 | 账户 ACTIVE | RELATIONSHIP_DATA 在线 72h | 关闭 cycle、删除 links/receipts；默认不删真实 DAY，显式日期生成 DAY 子任务 |
| WEEKLY-001 | 所有 source 有效且账户 ACTIVE | 普通旧 revision 30 天；source 删除版本 72h | DAY/RELATIONSHIP/ACCOUNT；旧 summary 不再可见 |
| MATTER-001 | ACTIVE/PAUSED 至用户删除；COMPLETED/EXPIRED 最多 90 天 | 到期或删除在线 72h | MATTER/ACCOUNT；grant、snapshot、dependency、提醒、缓存和个性化片段 |
| MEMORY-GRANT-001 | 不晚于 source/purpose/account | revoke 后 30 天仅最小变更证据，正文 0 | 对应 source/purpose；新使用立即停止 |
| MEMORY-RUNTIME-001 | invocation/result 所需期间；mention 不晚于 source+30 天 | source/revoke 后立即失效，72h 清除 | 删除 dependency；切换无源 fallback |
| GEN-INTENT-001 | 不晚于对应 DAY 事实 | DAY/ACCOUNT 清除 | invocation、candidate、queue、cache 取消 |
| Gateway attempt metadata | terminal 后 30 天 | 物理删除；仅匿名聚合可留 | DAY/ACCOUNT/Runtime |
| Command receipt | terminal 后 7 天 | 整体清除 | 对应 scope；不保存请求正文 |
| NOTIFY runtime | terminal 后 35 天 | 物理删除 | DAY/MATTER/ACCOUNT；平台 ref 和队列清理 |
| SHARE draft/object | 草稿 24h；对象最长 7 天 | URL 先失效，对象 72h | DAY/ACCOUNT/显式对象删除 |
| EXPORT artifact | READY 后 24h | 链接先失效，对象删除 | EXPORT/ACCOUNT；task 元数据 terminal 后 30 天 |
| SAFETY state | 状态所需期间且账户存在 | CLEAR 后 event 最长 30 天 | ACCOUNT；窄 legal hold 例外 |
| Safety resource action | 7 天 | 物理删除 | ACCOUNT/Safety；不记录接通或通话内容 |
| Ordinary trace | 30 天 | 物理删除 | Runtime/ACCOUNT；仅 allowlist |
| SECURITY-LOG-001 | 六个自然月 | 到期删除 | Restricted frozen；不得用于产品分析 |
| DataTask active | 直到完成或失败解决 | task/export 元数据按策略清理 | guard 失败时仍保持生效 |
| Deletion receipt | terminal 后 6 个自然月 | token/key 一并销毁 | T2；ACCOUNT receipt 不留 AccountRef/openid/内容 |
| Provider body | 本方 T0；provider 合同最长 30 天 | 到期/删除指令 | provider request 24h 内发出，restricted retention 不得普通使用 |
| BACKUP-001 | 最长 35 个自然日 | 自动过期/密钥销毁 | restore 前应用 ledger、guard、deny record |
| DayErasureGuard | 最长 45 天 | 到期硬删 | 只含最小 version/epoch/task ref，不含被删内容/seed |
| 影响评估和处理记录 | 至少 3 年 | 按适用要求 | 文档级证据，不嵌入真实用户样本 |
| Legal hold | 明确依据要求期间，每 90 天复核 | release/expiry 后 72h 清理 | 只限获批最小范围 |
| Evaluation artifact | response 90 天；run manifest 365 天 | 到期删除 | 只用 SyntheticSubjectRef |

删除 SLA：guard 同步；旧 session/cache/queue/in-flight/URL 在读取时立即拒绝且后台 15 分钟内清理；在线权威库、活动副本、对象/CDN 和普通受托副本 72 小时内；用户可见最终结果最迟 7 天；provider 删除/到期请求 24 小时内发出；provider 最长 30 天；备份最长 35 天。

## 12. 用户权利入口

| 权利 | 用户入口/API | 边界 |
|---|---|---|
| 知情/查看 | consent/current、profile、today/history、weekly、matters、memory、notifications、data task views | 只返回自身白名单 View，不返回内部依赖、密文、seed 或 provider 字段 |
| 更正 | profile update、checkin correct、matter patch、notification/memory preferences | expected revision/CAS；不静默改写已发布历史事实 |
| 撤回必要同意 | `POST /consent/withdraw` | 撤回状态立即影响普通旅程；不等于自动伪造删除结果 |
| 撤回可选用途 | memory/notification preference commands | 新使用立即停止；source 是否删除由用户另行决定 |
| 导出 | `POST /data-rights/export` + DataTaskView | artifact 24h；不包含 secret、Prompt、Safety 受限原文或其它用户数据 |
| 删除 DAY | 一次明确确认 | 删除当日权威事实和派生；同日重记仅符合 ADR 条件并复用原 result version |
| 删除 MATTER | 一次明确确认 | 删除事项及 grants/dependencies/reminders/fragments，不扩大到其它事项 |
| 删除 RELATIONSHIP_DATA | prepare → confirm，可显式选 DAY 子任务 | 默认不删除真实 DAY；两个 included day 数组默认空 |
| 删除 ACCOUNT | prepare → reauth → confirm | guard 后普通登录不能取消；在线/外部/备份期限如实展示 |
| 取消任务 | `/data-rights/tasks/{ref}/cancel` | 仅领域规定的 guard 前可取消阶段；不能解除已生效 guard |
| 申诉/支持 | FAQ + support feedback | S-22 前不建立未冻结的长期支持文本库 |

用户界面不得声称外部或离线介质已即时逐字节擦除；DataTaskView 必须展示 online erased、provider expiry 和 backup deadline 的真实阶段。

## 13. Analytics 允许候选与禁止内容

S-24 只能从本节候选中选择并进一步定义事件、属性、基数、TTL 和匿名化；本节不是埋点字典。

### 13.1 可进入 S-24 评审的最小候选

- 非文本的事件名和成功/失败/降级状态；
- product date、app version、locale、有限 scene 枚举；
- onboarding/checkin/result/light/evening/weekly 等步骤是否完成；
- generation mode 的受审粗粒度枚举（AI/template），不含 provider/model；
- retryable/terminal 的稳定错误类别，不含内部堆栈和用户输入；
- 延迟桶、队列桶、token/cost 聚合、缓存命中等运行指标；
- 通知设置是否开启、intent outcome 的有限枚举，不含平台 opaque ref；
- DAY/ACCOUNT DataTask 的阶段与 SLA 是否达标的聚合；
- 已证明不可识别且不可复原的按日/版本聚合计数。

### 13.2 永久禁止进入普通 analytics

- openid/unionid、手机号、AccountRef、StableSubjectId、token、IP、设备 ref；
- preferred name、事项标题、evening note、支持文本、Safety 原文；
- mood/energy/sleep 的用户级长期序列或可反查组合画像；
- Prompt、prepared input、provider request/response、AI 完整正文；
- source ref、grant ref、dependency、epoch、seed、raw score、choice trace；
- 分享图内容、导出 artifact、通知 payload；
- 删除原因、legal hold 内容、受限日志；
- 将高基数 opaque refs 用作通用指标 label。

Safety、网络安全、删除和受限审计可以有独立的合规/运行计数，但不得与普通增长漏斗或营销画像连接。

## 14. 日志、脱敏和错误输出

- 所有普通日志使用字段 allowlist；默认记录 request id、operation、稳定错误码、版本、时间、耗时和匿名运行维度。
- 禁止日志：请求/响应 body、query 中的用户文本、authorization、cookie、openid、称呼、签到值、事项、note、Prompt、provider body、Safety 原文、密文和密钥。
- 错误响应不得出现 stack、SQL、Prisma、模型名、Prompt、Token、provider、内部策略、openid、手机号或对象 key。
- `failureScopeCodes`、provider error 和 deletion checkpoint 只使用稳定子系统码/原因码和数量。
- 受限访问日志必须记录 actor、service、privileged role、purpose、policy、opaque object token、ticket/hold ref、outcome 和时间，但不得复制目标内容。
- 指标 label 禁止真实用户值和高基数 refs；需要单次追踪时仅进入受限 trace。
- 日志平台不可用时，服务不得退化为打印完整 body；应减少日志并保留稳定错误码。

## 15. 最小验证场景（32）

### 15.1 收集与映射（8）

| ID | 场景 | 期望 |
|---|---|---|
| PDM-C01 | 微信 code 换会话 | 建立身份映射；客户端无 openid/密文 |
| PDM-C02 | Profile 不填称呼 | 核心旅程可继续；不造昵称 |
| PDM-C03 | Checkin 提交未知字段 | 拒绝，未知字段不落库 |
| PDM-C04 | Evening note 提交 | 先 Safety；通过后只写 evening 权威源 |
| PDM-C05 | Matter 创建且 grant 默认关闭 | source 存在但不进入未授权用途 |
| PDM-C06 | 支持反馈在权威模型未冻结时 | 不建立长期持久化；返回中性受控结果 |
| PDM-C07 | 分享预览 | 默认不含称呼、状态、事项、note、Safety |
| PDM-C08 | 管理端查询用户 ref | 无任意全文浏览接口，非 owner/ref 猜测不能获得数据 |

### 15.2 使用、访问与 AI（8）

| ID | 场景 | 期望 |
|---|---|---|
| PDM-U01 | Daily v1 生成 | provider 不收到事项、近期状态或关系记忆 |
| PDM-U02 | Weekly 生成 | 不发送 raw note、每日 AI 文本、娱乐分数或源 refs |
| PDM-U03 | preferred name 不合格 | 省略，不修复并发送原值 |
| PDM-U04 | high-risk 输入 | ordinary provider/template=0；原文不进普通存储/日志 |
| PDM-U05 | provider raw response invalid | 整份丢弃，不落库、不进日志/analytics |
| PDM-U06 | 普通运营查看 Safety | 只能看到聚合告警，无事件原文或类别详情 |
| PDM-U07 | Privacy worker 删除密文 | 仅按 refs 清理，不向人员或日志展示正文 |
| PDM-U08 | analytics 扫描字段 | 自由文本、身份、Safety、Prompt、provider body 全部拒绝 |

### 15.3 撤回、删除与用户权利（8）

| ID | 场景 | 期望 |
|---|---|---|
| PDM-D01 | memory grant 撤回 | 新 context 立即不使用；snapshot/dependency 失效 |
| PDM-D02 | Matter 暂停 | 不进入新普通表达或 reminder；source 未被误删 |
| PDM-D03 | DAY 删除确认成功 | guard 同步；普通读取/生成/缓存立即拒绝 |
| PDM-D04 | DAY 删除后同日重记 | 仅任务成功、窗口 OPEN、明确确认且复用原 result version |
| PDM-D05 | RELATIONSHIP_DATA 删除未选日期 | 不删除任何真实 DAY |
| PDM-D06 | ACCOUNT 删除任务失败 | 账户保持 DELETING/blocked，不恢复 ACTIVE |
| PDM-D07 | Export READY | 链接 24h 到期，DataTask 不暴露受限内部字段 |
| PDM-D08 | 用户撤回必要同意 | 普通写按 guard 拦截；不伪造已完成账户删除 |

### 15.4 受托方、备份、日志与故障（8）

| ID | 场景 | 期望 |
|---|---|---|
| PDM-O01 | provider profile training=true 或 retention>30 | route 不得 ACTIVE，使用 template |
| PDM-O02 | provider 删除请求失败 | 数据保持 restricted，原任务重试，不解除 guard |
| PDM-O03 | 迟到 provider success | body 隔离，不发布、不恢复已删数据 |
| PDM-O04 | 从 20 天备份恢复 | 先应用 deletion ledger/restore deny，再开放服务 |
| PDM-O05 | 36 天备份仍 AVAILABLE | Gate 失败并告警，不得作为合格备份策略 |
| PDM-O06 | 日志平台故障 | 不打印请求/响应 body，只保留本地稳定最小错误 |
| PDM-O07 | ordinary trace 扫描 | 无称呼、签到值、事项、note、Prompt、Safety 原文 |
| PDM-O08 | 发现实际跨境 provider | 保持 UNVERIFIED/阻塞生产，完成评估告知合同后再启用 |

## 16. 上线前核验清单

- 实际个人信息处理主体、服务地区和适用规则已确认；
- 最终隐私政策/同意页面与本地图、API、产品页面一致；
- 每个生产受托方具有字段、目的、区域、subprocessor、training、retention、删除和退出证据；
- 跨境状态不是未知，相关评估与措施完成；
- 数据库角色、KMS、日志 allowlist、Redis/Queue TTL、对象/CDN purge、备份 35 天已验证；
- ProviderDataHandlingProfile 的 ACTIVE gate 已实现并测试；
- 用户访问、更正、导出、撤回、四类删除和任务状态端到端可用；
- DAY/RELATIONSHIP/ACCOUNT 删除演练证明缓存、队列、对象、provider 和备份不复活；
- 管理后台无任意全文浏览，break-glass 有审批和审计；
- S-24 事件字典只使用本节允许候选；
- S-22 已解决 support feedback 的权威模型、期限、人员和删除流程；
- 专业 Safety 评审、资源核验和固定响应 Gate 已完成。

## 17. 已识别缺口与下游约束

1. **支持反馈**：API 已有入口，但 S-19 尚无权威 model/期限/删除路径；S-22 必须解决，之前不得长期持久化。
2. **分享运行记录**：API/ADR 定义短期对象和 intent，但没有独立长期事实模型；实现只能使用必要短期记录，不能建立分享画像。
3. **实际受托方和跨境**：尚未选择生产厂商；所有状态均为 UNVERIFIED，不能据此宣称无跨境或已合规。
4. **完整运营 RBAC**：由 S-22/S-29/A-005 冻结；当前默认普通后台无用户全文能力。
5. **Analytics**：S-24 只能从第 13 节选择最小候选，不能通过 SDK 自动采集页面文本或请求体。
6. **最终法律文本**：必须在实际主体、部署和受托方确定后生成，并与本文一致；不得用本文直接替代。

## 18. S-21 验收标准

- 数据资产使用稳定且唯一的 `PDM-*` ID；
- 每项个人数据均有来源、目的、依据、入口、权威对象、位置、访问、期限和删除范围；
- 页面/API/View、领域对象与 Prisma/运行位置能够交叉追踪；
- AI、memory、Safety、通知、分享、导出、日志、备份和受托方边界完整；
- 用户访问、更正、撤回、导出、DAY/MATTER/RELATIONSHIP_DATA/ACCOUNT 删除入口完整；
- Analytics 明确允许候选和永久禁止内容，但未提前创建事件字典；
- 32 个验证场景 ID 唯一，覆盖正常、缺失、撤回、删除、provider、备份、Safety 和日志；
- 缺口被标记为阻塞项，没有发明新表、字段、目的、期限、接收方或跨境安排；
- 无数据库、Prisma、migration、API、NestJS、worker、云配置、真实账号、secret 或生产数据变更；
- 用户确认前本文保持 Draft。