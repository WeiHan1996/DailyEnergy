# ADR-0005：数据保存、删除与受限证据

- **状态**：Proposed
- **日期**：2026-07-22
- **接受日期**：待用户确认
- **所属任务**：S-18 — 数据保存和删除决策
- **决策范围**：保存期限、自动到期、删除任务、同日重建 guard、派生失效、备份、受托方、审计与依法保留
- **决策所有者**：DailyEnergy 项目
- **法规核验基线**：中国大陆，核验日期 2026-07-22；本文是产品与工程决策，不替代上线前法律意见
- **上游规范**：[产品状态机](../product/state-machine.md)、[业务规则](../product/business-rules.md)、[ADR-0002](./ADR-0002-deterministic-daily-result.md)、[ADR-0003](./ADR-0003-ai-provider-abstraction.md)、[ADR-0004](./ADR-0004-structured-memory.md)、[AI Gateway](../ai/gateway.md)、[结构化记忆](../ai/memory.md)、[内容安全](../ai/safety.md)、[AI 评价](../ai/evaluation.md)、[领域模型](../data/domain-model.md)
- **下游任务**：S-19～S-25、S-29、S-31～S-33、C-014、A-007

## 1. 背景

DailyEnergy 会处理账户身份、资料、晨间签到、每日结果、晚间反馈、重要事项、关系事实、Safety 最小事件、生成运行和用户数据任务。S-17 已经决定每项事实由谁拥有、怎样修订、怎样失效，以及 DAY、MATTER、RELATIONSHIP_DATA、ACCOUNT 四种删除范围，但把以下问题留给本 ADR：

1. 每类数据为实现目的最多保存多久；
2. 用户确认删除后，何时停止产品使用，何时清理在线副本，备份怎样处置；
3. 删除任务失败、服务恢复、队列迟到或备份回放时，怎样防止旧数据复活；
4. DAY 删除后若用户仍在当前写入窗口，怎样允许明确重新记录而不变成“删除重抽”；
5. 哪些最小运行、安全和合规证据可以受限保留，保留多久，为什么不能成为产品数据源；
6. AI provider、微信平台、对象存储和其它受托方如何继承删除要求；
7. S-19 数据库设计需要哪些可执行的 TTL、guard、唯一性和删除作业语义。

如果只使用通用 soft delete 或“账户注销后后台慢慢清”，会产生四类风险：

- 已删除内容仍能被普通查询、缓存、resolver、模型或运营后台读取；
- 不可变备份恢复后重新出现旧记录；
- 为了稳定结果长期保留 seed、用户内容或隐藏身份映射；
- 为排障无限期保存自由文本、Safety 原文、Prompt 或 provider raw response。

## 2. 法规与产品基线

本 ADR 以以下现行官方规则为最低约束，并选择比最低规则更具体的产品期限：

- [《中华人民共和国个人信息保护法》](https://www.cac.gov.cn/2021-08/20/c_1631050028355286.htm)要求目的明确、范围最小、保存期限为实现目的所必要的最短时间；期限届满、目的不再必要、撤回同意或账户注销等情形应删除。法律保存期未届满或技术上难以立即删除时，只能继续存储和采取必要安全保护措施，不得继续普通使用。
- [《网络数据安全管理条例》](https://www.mee.gov.cn/zcwj/gwywj/202410/t20241003_1087417.shtml)要求个人信息处理规则明确保存期限、到期处理方式和权利入口，并及时受理删除、注销和撤回请求。
- [现行《中华人民共和国网络安全法》](https://www.cac.gov.cn/2025-12/29/c_1768735112911946.htm)要求按规定保存相关网络日志不少于六个月。本 ADR 将这类日志与产品行为、记忆、分析和营销彻底隔离。
- [《个人信息保护合规审计管理办法》及指引](https://www.cac.gov.cn/2025-02/14/c_1741233507681519.htm)要求审查保存期限是否最短必要、是否明确到期处理方式，以及受托处理和自动化决策等活动是否有相应评估与控制。

法规要求变化、产品进入新地区、处理未成年人或敏感信息范围发生实质变化时，必须重新做合规评估并更新隐私规则；不得只延长数据库 TTL。

## 3. 决策

DailyEnergy 采用“**用途绑定保存 + 同步语义删除 + 分层物理清理 + 最小受限证据**”。

核心决定：

1. 用户确认删除并成功创建 DataTask 时，先同步递增 deletion guard；被删范围立即停止普通读取、写入、生成、通知、分享、缓存命中和派生使用。
2. 在线权威库、活动副本、搜索/投影、队列、缓存、对象存储和 CDN 在明确 SLA 内物理删除或不可逆加密销毁；generic soft delete 不能作为最终完成状态。
3. 不逐份改写不可变备份；备份与普通服务隔离，最长 35 个自然日自动过期，任何恢复必须先应用删除账本和 guard，才能对外提供服务。
4. 受限证据只保存证明操作所需的最小字段，不保存被删内容，不得被 resolver、生成、关系、分析、营销或普通支持读取。
5. 当前账户连续 24 个月没有主动认证使用时，自动进入 ACCOUNT 删除；通知投递、后台任务和静默刷新不能延长期限。
6. 当前产品日期的 DAY 删除完成后，可以在写入窗口仍 OPEN 时由用户显式重新记录；必须复用删除前冻结的 result_version，不能使用当前新版本“重抽”，且不能恢复任何被删内容。
7. 为防止迟到写入、备份回放和同日换版本，DAY 只保留最多 45 天的最小 DayErasureGuard；它不含签到、分数、文本、结果、root seed 或可导出的用户内容。
8. provider request body 与无效 raw response 默认零持久化；生产 provider 必须关闭训练，并承诺服务端保留不超过 30 天，未知或超限的 data-handling profile 不得 ACTIVE。
9. 法律要求的网络安全日志保存六个自然月，个人信息保护影响评估记录至少三年；两者都位于受限证据域，不成为产品事实。

## 4. 规范用语与时间

### 4.1 强度

- 必须：实现和下游规范不得违反；
- 应：除非有记录充分理由，否则必须采用；
- 可以：允许但不构成默认；
- 禁止：没有新 ADR 不得实现。

### 4.2 时间锚点

- 产品日期继续使用 ADR-0002 的 Asia/Shanghai 与 04:00 边界。
- 物理保存期限使用 UTC instant 计算，数据库保存 retention_policy_version、retention_anchor_at 和 expires_at。
- “自然日”指从锚点开始的连续 24 小时，仅用于保存 TTL；“自然月”按日历月计算。
- 读取、导出、备份、管理员查看、缓存命中和后台重算不能刷新 TTL。
- 只有用户明确新建、编辑、恢复 ACTIVE 或完成一项新业务行为，才可以为对应新修订建立新的合法锚点。

### 4.3 删除完成的三层语义

| 层 | 完成条件 | 用户数据是否可用于产品 |
| --- | --- | --- |
| Semantic blocked | deletion guard 已提交，普通路径全部 fail closed | 否 |
| Online erased | 权威库、活动副本、投影、缓存、队列、对象/CDN 已清理；受托方剩余副本已删除，或进入合同约束的 restricted retention | 否 |
| External/backup expired | provider 固定期限和所有可能包含目标的隔离备份已过期，或范围密钥已不可逆销毁 | 否 |

DataTask 的 SUCCEEDED 表示前两层已经完成，且第三层已经登记不可撤销的 provider_expiry_at / backup_purge_deadline；固定期限内的受托副本必须禁止产品访问、训练和其它使用。用户界面必须如实展示最迟日期，不能声称已经逐字节擦除所有外部或离线介质。

## 5. 数据层级

| 层级 | 含义 | 例子 | 普通产品可读 |
| --- | --- | --- | --- |
| T0 Transient | 单次请求或受控计算内存 | provider request body、未发布 candidate | 仅当前处理 |
| T1 Active Product | 当前目的仍需要的权威事实 | Profile、Checkin、Result、Matter | 是，按 owner 与 purpose |
| T2 Restricted Evidence | 安全、删除、运行和合规最小证据 | Safety event、删除回执、安全日志 | 否 |
| T3 Isolated Backup | 灾备副本和对象版本 | 加密数据库/对象备份 | 否 |
| T4 Anonymous/System | 无法识别个人的聚合或非个人配置 | 版本目录、匿名聚合指标 | 不适用 |

去标识化、HMAC、opaque ref 和 pseudonym 仍可能是个人信息，不能自动升级为 T4。只有无法识别且不能复原的结果才可视为匿名数据。

## 6. v1 保存期限总表

以下是最长默认期限。用户删除、目的终止、授权撤回或法律要求更短时提前结束。

### 6.1 账户、资料与真实记录

| 数据 | 活跃期限 | 终止或替换后的期限 | 删除范围 |
| --- | --- | --- | --- |
| 外部身份映射、AccountRef、StableSubjectId | 账户 ACTIVE；24 个月无主动使用自动删除 | ACCOUNT guard 提交后立即不可用，在线 72 小时内清除 | ACCOUNT |
| 会话、refresh token、设备会话 ref | 最长 30 天且可主动撤销 | 登出、Restricted、Deleting 或 scope delete 时立即吊销 | ACCOUNT |
| 当前必要同意回执 | 账户 ACTIVE | 被替代回执最多 6 个自然月；只含版本、动作、时间和受限 subject token | ACCOUNT / consent withdrawal |
| UserProfile、称呼、表达偏好 | 当前修订且账户 ACTIVE | 被替换结构值最多 30 天；旧自由文本 72 小时内清除 | ACCOUNT / source clear |
| MorningCheckin、PublishedDailyResult、DailyInteraction、evening note | 账户 ACTIVE，用户可逐日删除 | DAY 删除在线 72 小时；账户无使用 24 个月触发 ACCOUNT 删除 | DAY / ACCOUNT |
| RelationshipCycle、EncounterLink、NodeReceipt | 账户 ACTIVE | RELATIONSHIP_DATA 删除在线 72 小时 | RELATIONSHIP_DATA / DAY / ACCOUNT |
| WeeklyWindow 与 current summary | 所有源仍有效且账户 ACTIVE | 普通新 revision 使旧 revision 30 天后清除；源删除导致含源版本 72 小时内清除 | DAY / RELATIONSHIP_DATA / ACCOUNT |

核心日记录不按滚动月份自动丢弃，因为“长期真实回望与关系连续性”是当前明确目的；但账户无主动使用满 24 个月会整体删除。S-21 隐私数据地图可以缩短期限，不能在没有新目的、告知和评估时延长。

### 6.2 重要事项与记忆依赖

| 数据 | 活跃期限 | 终止后的期限 | 备注 |
| --- | --- | --- | --- |
| ACTIVE / PAUSED ImportantMatter | 账户 ACTIVE 或用户删除 | 删除在线 72 小时 | PAUSED 不授权新使用 |
| COMPLETED / EXPIRED ImportantMatter | 进入终态后最多 90 天 | 到期自动按 MATTER 删除 | 到期前可由用户明确重新激活 |
| MemoryPurposeGrant | 不晚于 source、purpose 或账户 | revoke 后 30 天只保留最小变更证据，正文 0 | 不得借其它用途续期 |
| MentionReceipt | 不晚于 source + 30 天 | source 删除时在线 72 小时清除 | 不复制标题或表达 |
| MemoryContextSnapshot / SourceDependency | invocation/result 所需期间 | source delete/revoke 后立即失效，在线 72 小时清除 | fallback 不含已删源 |

事项 TERMINAL 期限到期必须像用户删除一样触发 resolver、提醒、候选、历史个性化片段与缓存清理，不能只把状态改成 EXPIRED。

### 6.3 生成、通知、分享与导出

| 数据 | 最长期限 | 到期处理 |
| --- | --- | --- |
| provider request body、prepared input | T0；不落库 | 请求结束即释放 |
| invalid raw response、non-winning candidate | 0 | 校验/竞态结束即丢弃 |
| GenerationIntent 与冻结 snapshot | 不晚于对应 DAY 事实 | DAY/ACCOUNT 删除时清除 |
| GatewayAttempt 元数据、provider request ref、token/cost/failure | terminal 后 30 天 | 物理删除；保留匿名聚合 |
| 普通 command/idempotency receipt | terminal 后 7 天 | 删除 payload fingerprint 以外内容；之后整体清除 |
| NotificationIntent / DeliveryAttempt | terminal 后 35 天 | 物理删除；偏好仍由独立聚合拥有 |
| 服务端分享草稿 | 24 小时 | 物理删除 |
| 可访问分享图片/对象 | 最长 7 天 | URL 先失效，对象 72 小时内清除 |
| Export artifact | READY 后 24 小时 | 下载链接先失效，对象物理删除 |
| Export DataTask 元数据 | terminal 后 30 天 | 清除；不进入删除审计 |

导出、分享、通知和 provider 的期限不能因为下载、打开、发送失败或重试自动延长。重新创建是新的显式用户意图。

### 6.4 Safety、运行与合规证据

| 数据 | 最长期限 | 边界 |
| --- | --- | --- |
| 当前 SafetyState | 状态所需期间且账户存在 | 不含原文、诊断、confidence 或 rationale |
| SafetyEvent 最小字段 | CLEAR 后 30 天；ACTIVE 较久时保留到 CLEAR + 30 天 | Restricted Safety；ACCOUNT 删除时清除，除窄范围 legal hold |
| 用户关联资源操作 | 7 天 | 只记录通用 action type，不记录接通/通话 |
| ordinary trace / application telemetry | 30 天 | 严格 allowlist，无用户文本 |
| 网络运行与网络安全日志 | 6 个自然月 | 仅安全与法定义务；不做产品分析 |
| DataTask 活跃记录 | 直到完成或失败解决 | 不含被删内容 |
| 删除最小回执 | terminal 后 6 个自然月 | scope、opaque task/ref、policy、时间、结果、失败范围码 |
| 个人信息保护影响评估报告与处理记录 | 至少 3 年 | 文档级证据，不嵌入真实用户样本 |
| 明确 legal hold | 法律依据要求期间；每 90 天复核 | 只保留被要求的最小范围 |

ACCOUNT 删除后的回执禁止保留 AccountRef、StableSubjectId、openid、手机号或内容。若需要阻止备份复活，可以保存独立随机 case ref 与受限 keyed subject token；密钥和 token 在六个月期满后一起销毁。

网络安全日志如果为履行安全保护义务确需包含 IP、设备网络信息或认证事件，只能保存在独立安全域并按六个自然月到期；ACCOUNT 删除后在法定期限内继续 frozen storage，不得用于产品画像、留存、营销、普通排障或用户内容恢复。

### 6.5 Evaluation 与系统配置

| 数据 | 最长期限 | 边界 |
| --- | --- | --- |
| 合成 evaluation response / artifact | run 结束后 90 天 | 加密、受限，不得含真实 AccountRef |
| EvaluationRun manifest、case 状态、聚合评分 | 365 天 | 不含真实用户数据 |
| corpus、Schema、Prompt、route、policy、catalog 版本 | 版本仍被历史引用期间或仓库历史 | 非个人配置；不可用于恢复用户内容 |
| 匿名聚合指标 | 指标规范决定 | 必须证明不可识别且不能复原 |

## 7. 账户无使用自动删除

### 7.1 主动使用定义

last_user_activity_at 只在以下事件成功时更新：

- 用户完成认证后主动打开产品并建立合法会话；
- 用户明确保存资料、签到、互动、事项、偏好或数据权利操作；
- 用户主动读取自己的历史、周回望或数据管理页。

以下事件不能更新：

- 通知排期、投递或失败；
- 后台生成、缓存刷新、总结重算、备份、监控和迁移；
- provider callback、微信平台 webhook 或管理员操作；
- 未通过身份验证的请求、机器人流量或健康检查。

### 7.2 流程

1. 连续 23 个月无主动使用时，若存在合法且已授权的通道，可以发送一次通用提醒；提醒不得包含记录内容，也不能为了发提醒新增权限。
2. 连续 24 个月无主动使用时，创建唯一 ACCOUNT DELETE DataTask，先进入 DELETING。
3. 没有可用提醒通道不阻止到期删除；期限必须事先在隐私规则中清楚告知。
4. 用户在删除任务创建前重新主动使用，重新锚定期限；任务创建后不能用普通登录取消。
5. 需要取消尚未开始的自动删除时，必须在最终确认前提供明确入口；一旦 deletion guard 生效，只能完成删除并新建账户。

## 8. 删除任务统一协议

### 8.1 确认与幂等

- DAY / MATTER 使用一次明确确认；RELATIONSHIP_DATA / ACCOUNT 使用两阶段确认与必要身份复核。
- 确认页必须列出：范围、立即不可用的内容、派生影响、在线清理目标、备份最长 35 天、受限例外和能否同日重新记录。
- 同 owner + kind + scope + target 同时最多一个活跃任务。
- 同一 confirmation_version、scope 和 target 的重复提交读取原任务；不同 scope 复用 command ref 必须拒绝。
- deletion guard 与 DataTask 创建必须在同一事务或等价串行化边界完成。

### 8.2 执行顺序

1. 校验身份、scope、target、expected revision 与确认版本；
2. 原子创建/读取 DataTask，并递增 account/day/matter/relationship deletion epoch；
3. 立即撤销会话/continuation、停止普通读写、取消 invocation/notification/export/share；
4. 删除 T1 权威源与活动副本；
5. 失效 SourceDependency、fallback pointer、relationship、weekly、read model、cache、queue 和 client projection；
6. 清理对象存储、CDN、搜索索引和受托在线副本；
7. 登记 backup purge deadline 和 restore deny record；
8. 写最小删除回执并完成 DataTask。

任何步骤失败，guard 仍保持生效。禁止为了重试将被删对象恢复 ACTIVE。

### 8.3 SLA

| 阶段 | 目标 |
| --- | --- |
| guard 提交与普通路径阻断 | 确认请求成功接受时同步完成 |
| session、cache、queue、in-flight、share/export URL 失效 | 15 分钟内；读取时必须立即拒绝旧 epoch |
| 在线权威库、活动副本、对象/CDN 和普通受托副本 | 72 小时内 |
| 用户可见 DataTask 最终结果 | 最迟 7 个自然日；未完成必须 FAILED，不得伪装成功 |
| provider 删除/到期请求发出 | 24 小时内；合同最长保留 30 天 |
| 隔离备份过期 | 最迟 35 个自然日 |
| legal hold 到期后的清理 | 72 小时内 |

“15 分钟内清缓存”不是读取宽限。服务器收到旧缓存/令牌时必须从 guard 同步拒绝；15 分钟只是后台物理清理目标。

### 8.4 FAILED 与重试

- failure_scope_summary 只能使用稳定子系统码和数量，不包含用户内容、SQL、对象 key 或供应商 raw error。
- 同一任务按 step checkpoint 重试；不能创建第二个任务绕开唯一性。
- ACCOUNT 失败时账户保持 DELETING；其它 scope 保持 semantic blocked。
- 24 小时未前进触发内部告警；7 天未完成转 FAILED 并给用户中性说明与支持入口。
- 修复后用原 task ref 重试；完成时间和 backup deadline 以最后成功清理为准。
- 无法立即删除但符合法律/技术例外时，数据进入 restricted frozen，除存储和安全保护外不得处理，并向用户说明范围与依据。

## 9. 四种删除范围

### 9.1 DAY

DAY 删除包括：

- 当日 Checkin 及修订、GenerationIntent、snapshot、结果、RuleFacts/plan 受限记录；
- 当日点亮、任务、帮助度、晚间反馈和 evening note；
- 引用该日的 encounter link、周窗口样本、summary、memory snapshot/dependency；
- 通知、分享、导出临时副本、缓存、队列、CDN 和客户端 projection。

不包括其它日期、账户资料或独立事项。趋势必须显示真实缺失，不用模板填补。

### 9.2 MATTER

MATTER 删除包括：

- title/date/status 等源、所有用途 grant、mention receipt、reminder intent；
- provider/context snapshot、候选缓存、queue ref 与 source dependency；
- 已发布内容中可识别事项片段。

已发布结果必须立即切换同候选预校验的无源 fallback；没有安全 fallback 时整份结果不再展示。原个性化片段在线 72 小时内清除，不能因“历史不可变”继续存一份事项标题。未来启用记忆时，个性化片段与 fallback 必须分离存储或具备等价可删除结构。

### 9.3 RELATIONSHIP_DATA

RELATIONSHIP_DATA 默认只删除关系层：

- 关闭并删除旧 RelationshipCycle；
- 清除 EncounterLink、NodeReceipt、关系用途 grant、snapshot、dependency 和关系表达；
- 失效 relationship stage、节点、关系问候与关系总结措辞；
- 新周期只能由未来新发生的合法点亮建立，旧 lights 不重放。

真实 DAY 记录默认保留，因为它们是用户的状态和历史，而不是关系数据的副本。确认页必须提供“同时删除哪些真实日期”的独立选择；每个被选择日期创建或关联明确的 DAY 子任务，RELATIONSHIP_DATA 不能静默扩大范围。

### 9.4 ACCOUNT

ACCOUNT 删除包括全部 owner-scoped T1 数据、session、identity mapping、StableSubjectId、secrets reference、exports、shares、notifications、Safety state/event、关系、事项、日记录、结果、派生、缓存和活动受托副本。

补充规则：

- 删除开始后不创建新 export；已经存在的 export URL 立即失效，artifact 纳入任务。
- 删除完成后外部身份再次登录必须建立新的 UserAccount、AccountRef、StableSubjectId 和同意周期。
- 旧删除回执不得被用来关联新账户、恢复关系或稳定 seed。
- 用户下载到本地、主动发送给第三方或截屏形成的外部副本不在服务端控制内；产品必须在确认页说明边界。

## 10. DAY 删除后显式重新记录

### 10.1 允许条件

仅同时满足以下条件时开放“重新记录今天”：

1. target_product_date 等于当前权威产品日期；
2. 当前写入窗口为 OPEN，不使用 continuation grant；
3. 原 DAY DataTask 已 SUCCEEDED；
4. Safety、Account、Consent、Maintenance 均允许普通写入；
5. 用户再次明确确认这是新记录，不是撤销删除；
6. DayErasureGuard 能解析出删除前冻结的 result_version；删除前从未创建 intent 时可以在首次新 intent 选择当前 result_version。

历史日期、任务仍 RUNNING/FAILED、guard 不可验证或版本目录缺失时保持禁用。

### 10.2 DayErasureGuardV1

允许字段：

| 字段 | 用途 |
| --- | --- |
| guard_ref | 不透明内部引用 |
| owner_scope_token | 仅当前账户删除域使用，不向客户端/provider/analytics 暴露 |
| product_date | 阻止目标日期复活 |
| deletion_epoch | 拒绝旧 intent、candidate、cache 和事件 |
| original_result_version? | 复用确定性 manifest；原日从未生成时省略 |
| deletion_task_ref | 追踪同一删除任务 |
| created_at / expires_at | 强制最多 45 天 |

禁止字段：

- StableSubjectId、root seed、choice digest、签到或反馈；
- 分数、RuleFacts、行动、任务、仪式、表达、模型输出；
- preferred name、matter、note、Safety 类别或删除原因；
- provider request body、完整 source refs 或可恢复内容。

### 10.3 重新生成规则

- 旧 intent/result 已清除后，新的唯一 intent 仍使用 owner + product_date 唯一性，不把 deletion epoch 加入业务唯一键。
- 根种子继续由当前账户 StableSubjectId、同一 product_date 和 original_result_version 派生；guard 不保存 seed。
- 新 Checkin 是新的真实事实，可以改变明确依赖签到的规则事实，但不能改变同一 manifest 的随机选择身份。
- 同日重新记录的表达默认使用原 manifest 兼容的 CONTROLLED_TEMPLATE，不调用 ordinary provider，避免删除成为“换一种 AI 说法”的入口。
- 如果原 manifest/template 已不可安全执行，重新记录保持禁用，不回退 current latest。
- 新发布事务必须比较最新 deletion epoch；任何旧 epoch candidate 一律丢弃。
- 再次删除永远允许；再次重新记录继续遵守同一 original_result_version，不获得换版本机会。

### 10.4 期限与用户说明

DayErasureGuard 在以下较晚时点后删除，但总期限不得超过 45 天：

- 当前写入窗口关闭且所有 continuation/invocation/queue 最大生命周期结束；
- 所有可能包含该 DAY 的备份 generation 已过期；
- 删除任务和 provider 清理已完成。

确认页使用中性说明：

> 为防止旧请求恢复记录，并保证今天不会因为删除而换一份结果，系统最多保留 45 天的日期、结果版本和删除轮次；不会保留你删除的签到、分数、文字或结果。

## 11. 派生、缓存、设备与分享

- source delete/revoke 必须主动发 invalidation event；TTL 只能兜底，不能证明删除。
- cache key 包含 owner scope、source revision、policy/fingerprint 与 deletion epoch；旧 epoch 读时拒绝。
- 个人投影缓存 TTL 最长 24 小时；高风险/删除相关视图不得离线证明 CLEAR 或 SUCCEEDED。
- 小程序本地不长期保存 provider context、Safety data、matter title 或 evening note；必要历史视图使用最小加密缓存，并在 scope delete、登出或账户状态变化时清理。
- 设备离线时服务器不能远程擦除，但所有访问 token 与 projection epoch 立即失效；设备下次启动必须先清旧缓存再读服务端状态。
- CDN/对象 URL 必须不可猜、短期签名并能通过 guard 撤销；仅删除数据库引用不算完成。
- 已下载图片、截图或已经投递的微信消息不能由服务端收回，因此通知保持通用、分享由用户主动，并在隐私说明中明确。

## 12. 备份与灾难恢复

### 12.1 备份规则

- 个人数据备份最长保留 35 个自然日；数据库快照、WAL/PITR、对象版本和跨区副本都计入。
- 备份必须加密、访问隔离，只供灾难恢复，不用于查询、分析、评测、模型训练或支持。
- 备份目录保存 generation、created_at、expires_at、encryption key version 和覆盖的数据域，不保存用户内容索引。
- 删除任务记录每个相关 backup generation 的 purge deadline。
- 可以使用范围化加密销毁缩短期限，但不能用“已经加密”替代访问控制、删除账本和恢复演练。

### 12.2 恢复顺序

任何备份恢复必须：

1. 在隔离环境恢复；
2. 先加载不可变 retention policy 和删除账本；
3. 重放 guard、DataTask、source invalidation 和账户终态；
4. 清理已过期数据和已删 scope；
5. 运行 deleted-data detector 与抽样验证；
6. 通过审批后才允许对外读写。

禁止先恢复对外服务、再异步“补删”。恢复演练必须证明 DAY、MATTER、RELATIONSHIP_DATA、ACCOUNT 四种 scope 都不会复活。

## 13. 受托方与 AI provider

所有 provider、云数据库、对象存储、日志、监控、消息队列、CDN 和微信平台集成必须登记 data-handling profile：

- 处理目的、数据类型、地区、子处理者、训练使用、在线期限、备份期限、删除能力、合同终止处理；
- 是否支持单请求删除、账户级删除或只依赖固定 TTL；
- 是否会把输入用于训练、人工审核、滥用监测或产品改进；
- 删除请求的证据 ref 与最大完成时限。

生产 ordinary AI route 的硬条件：

- 训练和产品改进使用关闭；
- request/response 最大 provider retention 不超过 30 天，zero retention 优先；
- 不发送 StableSubjectId、openid、手机号、note、未授权 matter 或删除原因；
- provider retention 未知、合同不一致或 region/disclosure 未通过评估时 route 不能 ACTIVE；
- primary、backup 与临时调试 route 适用同一底线。

ACCOUNT、DAY 或 MATTER 删除影响已披露 provider 数据时，24 小时内发出供应商删除请求；若供应商只支持 TTL，任务登记 provider_expiry_at，产品数据保持 blocked。供应商回执不证明产品主库已删除，产品任务仍要逐层完成。

## 14. 受限审计与 legal hold

### 14.1 审计 allowlist

受限审计可以记录：

- actor type / service / privileged role；
- action、scope、purpose、policy/version；
- opaque task/event/source token；
- requested/started/finished time；
- outcome、stable reason、failure subsystem；
- access approval、ticket ref、hold ref 和 expiry。

禁止记录：

- preferred name、matter title、note、签到值、表达或 Prompt；
- Safety raw input、摘录、关键词、confidence、诊断；
- root seed、StableSubjectId、openid、手机号或完整 IP 作为普通审计 label；
- provider raw response、数据库行快照或对象正文。

### 14.2 legal hold

legal hold 不是通用“审计需要”开关。建立时必须有：

- 明确法定依据或有效监管/司法要求；
- 最小 scope、数据类别、开始/结束时间、审批者和复核日；
- 与产品库物理隔离的 restricted frozen 状态；
- 每 90 天复核一次；到期 72 小时内清除；
- 向用户披露或限制披露的法律依据。

被 hold 的数据除存储与安全保护外不得处理，不能进入 resolver、AI、关系、通知、分享、分析、营销或普通客服。若只需证明删除发生，优先保留最小回执，禁止保留源内容。

### 14.3 影响评估

个人信息保护影响评估报告和处理情况记录至少保存三年，但报告使用数据类别、流程、版本、风险和控制证据，不嵌入真实用户文本、账号或生产请求样本。需要案例时使用合成 fixture 或不可识别统计。

## 15. 导出与用户说明

- Export 只复制当前仍可读、属于用户、在批准 scope 内的数据；不导出 secret、其它用户、普通安全日志、内部 Prompt/seed、受限 classifier rationale 或 provider key。
- Safety 最小事件、删除回执和受限审计是否属于可查阅/复制范围由 S-21 逐项映射；不能因为“内部”自动排除，也不能直接暴露危害系统安全的字段。
- 导出包使用结构化、可读格式，包含生成时间、数据范围、字段说明和缺失原因；具体 JSON/CSV/ZIP 由 S-20/S-21 决定。
- artifact 加密、一次性/短期下载，24 小时到期；下载后服务端副本清理。
- ACCOUNT 删除确认页提醒用户先完成所需导出；删除开始后不创建新 export，已有 artifact 纳入删除。
- 隐私规则必须列明主要数据类型、期限或确定方法、到期处理、provider 类别、备份最长时间、删除入口与受限例外。

## 16. 加密、权限与运维

- Personal Free Text、Restricted Safety、Restricted Generation 和 export/evaluation artifact 必须加密存储；密钥与数据分离、按环境隔离、可轮换并审计访问。
- S-19 可以选择列级/应用层 envelope encryption 或范围化 DEK，但必须支持 DAY、MATTER、ACCOUNT 删除，不得只有一把无法局部销毁的全局业务密钥。
- ordinary admin 默认不能查看用户正文、Safety category、provider payload 或删除对象。
- break-glass 只在明确 incident/support scope 下启用，时限、审批和访问全审计；访问结束自动撤销。
- 生产数据禁止复制到开发、测试、Prompt 调试或评测；全部使用合成 fixtures。
- database dump、trace、exception、dead-letter queue 和 support attachment 视为数据副本，必须进入相同清单和期限。

## 17. RetentionPolicy 与删除证明

### 17.1 不可变策略

每个可保存对象必须能解析到不可变 RetentionPolicyEntry，至少包含：

| 字段 | 含义 |
| --- | --- |
| policy_version | 不可原地编辑的版本 |
| data_class | T0～T4 与领域类别 |
| purpose | 为什么保存 |
| anchor | 期限从何时起算 |
| max_duration | 最长时间 |
| terminal_action | DELETE / ANONYMIZE / RESTRICTED_FREEZE |
| scope_behavior | 四种 delete scope 的行为 |
| backup_duration | 备份最长时间 |
| legal_basis_ref? | 依法例外来源 |

缩短期限可以应用于既有数据；延长期限必须有新目的、必要性评估、影响评估和需要时的新告知/同意。不能只修改 expires_at 绕过版本。

### 17.2 完成证明

DeletionReceiptV1 只证明任务执行，不证明被删内容：

- task ref、kind、scope、target type；
- confirmation/policy version；
- requested、guarded、online_erased、finished；
- backup purge deadline；
- provider expiry deadline 列表；
- outcome 与 failure scope codes；
- receipt expires_at。

目标为 ACCOUNT 时，target 不保存 AccountRef 或外部身份；使用受限随机 case ref/短期 blinded token。回执期满自动删除。

## 18. 可观测性

允许的无内容指标：

- retention scan due/expired/deleted/error count；
- DataTask queue age、stage latency、retry、FAILED count；
- scope 与 stable failure subsystem；
- cache/queue/CDN/provider invalidation outcome；
- backup generation age、purge deadline breach；
- restore replay deleted-data detector result；
- legal hold count/age/review overdue；
- ordinary log raw-content detector；
- provider data-handling profile drift。

禁止 label：

- 用户 ID、日期+用户可链接组合、preferred name、matter、note；
- Safety category、资源号码选择、签到值、分数或表达；
- provider request/response、seed、source ref 或删除原因正文。

期限或删除 SLA 超限是 P0 发布阻断/告警，不是普通报表备注。

## 19. 最小验收矩阵（48 项）

### 19.1 期限与到期（6）

| ID | 场景 | 期望 |
| --- | --- | --- |
| S18-R01 | 读取旧记录。 | 不刷新 expires_at。 |
| S18-R02 | 通知投递或后台 summary。 | 不刷新 last_user_activity_at。 |
| S18-R03 | 23 个月无使用且可通知。 | 最多一条通用预告，不新增权限。 |
| S18-R04 | 24 个月无主动使用。 | 唯一 ACCOUNT delete task，guard 先提交。 |
| S18-R05 | COMPLETED matter 满 90 天。 | 自动 MATTER 删除与完整派生失效。 |
| S18-R06 | RetentionPolicy 延长但无新评估。 | 发布/迁移 Gate 拒绝。 |

### 19.2 DAY 与同日重记（6）

| ID | 场景 | 期望 |
| --- | --- | --- |
| S18-D01 | DAY delete 时 provider in-flight。 | epoch 先变，迟到 candidate 永不发布。 |
| S18-D02 | 当前日 task SUCCEEDED 且窗口 OPEN。 | 用户可显式重新记录。 |
| S18-D03 | 历史日或窗口 CLOSED。 | 不开放重记。 |
| S18-D04 | 原日有 daily-v1，当前已发布 daily-v2。 | 重记仍使用原 daily-v1，不回退 latest。 |
| S18-D05 | DayErasureGuard 缺失/篡改。 | fail closed，不猜 result_version。 |
| S18-D06 | guard 检查。 | 无签到、分数、文本、结果、seed；45 天内删除。 |

### 19.3 MATTER 与关系（6）

| ID | 场景 | 期望 |
| --- | --- | --- |
| S18-M01 | MATTER delete 有在途 memory call。 | 取消/丢弃，fallback 生效。 |
| S18-M02 | 已发布事项片段无安全 fallback。 | 整份结果不展示，原片段 72 小时清除。 |
| S18-M03 | Relationship-only delete。 | 保留真实 DAY，删除 cycle/links/receipts/wording。 |
| S18-M04 | 用户同时选择三个真实日期。 | 三个明确 DAY 子任务，不静默扩大 scope。 |
| S18-M05 | 新关系周期建立。 | 只使用删除后的新点亮，不重放旧 lights。 |
| S18-M06 | mention receipt 仍存在。 | 不能恢复 title 或生成上下文。 |

### 19.4 ACCOUNT 与导出（6）

| ID | 场景 | 期望 |
| --- | --- | --- |
| S18-A01 | ACCOUNT delete 开始时有 READY export。 | URL 立即失效，artifact 纳入删除。 |
| S18-A02 | DELETING 请求新 export。 | 拒绝。 |
| S18-A03 | 删除完成后相同微信身份回来。 | 新 AccountRef/StableSubjectId/Consent，不恢复旧数据。 |
| S18-A04 | 删除回执被业务 resolver 查询。 | 权限/契约拒绝。 |
| S18-A05 | 账户删除任务部分失败。 | 账户保持 DELETING，原任务重试。 |
| S18-A06 | 用户已下载分享图。 | 服务端说明不可回收外部副本，在线 URL/对象仍清理。 |

### 19.5 缓存、队列与恢复（6）

| ID | 场景 | 期望 |
| --- | --- | --- |
| S18-C01 | 删除后 CDN 返回旧对象。 | token/epoch 拒绝并排队物理清理。 |
| S18-C02 | 设备离线持有旧 cache。 | 服务端立即拒绝；下次启动先清理。 |
| S18-C03 | dead-letter queue 保存 payload。 | 测试失败；队列只允许 opaque ref/最小 envelope。 |
| S18-C04 | 从 20 天前备份恢复。 | 对外前先重放删除账本并通过 detector。 |
| S18-C05 | 35 天备份仍可访问。 | 发布/运维 Gate 失败并告警。 |
| S18-C06 | cache TTL 尚未到但 source delete。 | 主动失效；TTL 不构成宽限。 |

### 19.6 Safety、日志与 legal hold（6）

| ID | 场景 | 期望 |
| --- | --- | --- |
| S18-S01 | Safety raw text 出现在日志。 | 零容忍失败并进入 incident 流程。 |
| S18-S02 | Safety CLEAR 30 天后无 hold。 | 最小 event 删除。 |
| S18-S03 | 网络安全日志六个月内。 | 受限保存，不进入产品/分析。 |
| S18-S04 | legal hold 只有“方便排障”。 | 拒绝创建。 |
| S18-S05 | 有效 hold 到期。 | 72 小时清除，每 90 天复核证据存在。 |
| S18-S06 | 影响评估报告含真实 matter 样本。 | 合规检查失败，改用合成/不可识别证据。 |

### 19.7 Provider、分享与对象（6）

| ID | 场景 | 期望 |
| --- | --- | --- |
| S18-P01 | provider retention 未知。 | route 不得 ACTIVE。 |
| S18-P02 | provider 用输入训练。 | 生产个人 workload 不合格。 |
| S18-P03 | provider TTL 45 天。 | 超过 30 天，不合格。 |
| S18-P04 | delete 影响 provider 请求。 | 24 小时内发请求/登记 expiry，普通使用保持 blocked。 |
| S18-P05 | 分享对象第 8 天仍可下载。 | Gate 失败；URL 先失效，对象清理。 |
| S18-P06 | 已投递微信通知。 | 不承诺远程撤回；因通用文案不暴露内容，深链重校验。 |

### 19.8 幂等、失败与证明（6）

| ID | 场景 | 期望 |
| --- | --- | --- |
| S18-X01 | 两端重复确认相同 DAY delete。 | 同一 DataTask。 |
| S18-X02 | 同 command ref 改 scope。 | 冲突拒绝。 |
| S18-X03 | 清理失败后尝试恢复 ACTIVE。 | 禁止；guard 保持。 |
| S18-X04 | 7 天仍未完成。 | FAILED + 中性说明 + 支持入口。 |
| S18-X05 | ACCOUNT receipt 含 openid/StableSubjectId。 | Schema/审计检查失败。 |
| S18-X06 | receipt 六个月到期。 | 自动删除；不得为统计续期。 |

S-31 必须把以上 48 项转为自动、集成、恢复演练和日志扫描；A-007 必须用真实备份流程做端到端删除演练。

## 20. 备选方案

### 20.1 所有数据随账户无限保留

实现简单，也有利于长期回看，但不满足最短必要和无使用到期原则。拒绝；使用 24 个月无主动使用自动删除，并对短期运行数据设置更短 TTL。

### 20.2 所有对象统一 soft delete

便于恢复，却会让 resolver、后台和备份持续读取内容，也无法证明最终清理。拒绝；soft state 只可作为任务中的短暂状态，最终必须 hard delete、匿名化或不可逆加密销毁。

### 20.3 删除即逐份改写所有备份

表面最彻底，但会破坏备份完整性、增加恢复风险和运维复杂度。拒绝作为默认；使用最长 35 天隔离过期、删除账本先重放和可选范围化 crypto erasure。

### 20.4 DAY 删除后永远不允许同日记录

最简单，也无需 result version guard，但会让用户为了纠错而失去当天体验。拒绝作为最终策略；在最小透明 guard 下允许显式重新记录。

### 20.5 DAY 删除后用当前 latest manifest 重新生成

无需保存原 result_version，但会把删除变成换结果入口，违反 ADR-0002。拒绝。

### 20.6 为审计保存完整用户内容

排障方便，但扩大泄漏面并可能成为幽灵恢复源。拒绝；审计只保存动作、版本、opaque ref、时间和 outcome。

### 20.7 provider 期限由供应商默认值决定

接入快，但不可解释、不可对用户承诺且可能训练或长期保存。拒绝；data-handling profile 是 ACTIVE 硬门。

## 21. 影响

### 21.1 正向

- 用户确认删除后，产品层立即停止使用，不被后台物理任务进度绑架；
- S-19 可以直接设计 TTL、guard、删除任务、恢复顺序和索引；
- DAY 同日重记与稳定不重抽同时成立，不保留被删内容或 seed；
- 备份、provider、缓存、队列、设备和对象存储都进入同一删除边界；
- 受限审计可证明操作，却不能恢复记忆、Safety 或个性化内容；
- 运行数据和合成评测有明确上限，不再以“以后排障”无限期保存。

### 21.2 代价

- 删除需要跨数据库、Redis/BullMQ、对象/CDN、provider 和备份编排；
- 恢复流程必须先重放删除账本，灾备演练更严格；
- 个性化表达需要可删除片段和预校验 fallback，存储模型更复杂；
- 24 个月无使用自动删除需要调度、通知和用户说明；
- provider 候选减少，可能提高成本或限制模型选择；
- legal hold、break-glass 与受限证据需要独立权限和审计。

### 21.3 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 删除任务跨系统部分成功 | guard 先行、checkpoint、原任务重试、FAILED 不解封 |
| 备份恢复复活数据 | 35 天上限、恢复前重放账本、detector、演练 |
| guard 被当成隐藏历史 | closed schema、45 天 TTL、禁止内容字段、权限隔离 |
| provider 无法单请求删除 | 30 天硬上限、TTL 登记、未知 profile 禁止 ACTIVE |
| 用户误解备份尚在 | confirmation 与 success view 显示 backup deadline |
| 自动删除误触 | 主动使用定义、23 个月预告、唯一任务和审计 |
| 法规变化 | versioned policy、定期审计、上线前法律复核 |

## 22. 下游实施要求

### 22.1 S-19 数据库

- 为所有 personal/restricted 对象保存 policy version、anchor、expires_at 和 scope；
- 落实 owner/date、active DataTask、attempt、notification 的唯一性；
- 分离业务 source、最小 guard、删除回执和 legal hold；
- generic soft delete 不能作为最终实现；
- 支持 hard delete、范围化加密和不可恢复 key deletion 的选择；
- 实现 outbox/inbox、epoch fence、TTL scan、backup catalog 和 restore deny record；
- 个性化片段与 fallback 具备独立删除能力；
- 所有 48 项场景可由数据库约束或服务测试验证。

### 22.2 S-20 API

- 定义确认版本、scope、target、expected revision、幂等和 unknown outcome；
- 返回 DataTask 状态、未完成范围、online completion、backup deadline 和可恢复说明；
- 同日重记使用显式命令，不复用普通签到按钮的隐式行为；
- 导出链接短期、一次性/受控，账户删除后 fail closed；
- 客户端不接收 guard、seed、StableSubjectId、audit 或 provider ref。

### 22.3 S-21 隐私数据地图

- 逐字段列出目的、来源、位置、权限、provider、期限、删除 scope、导出和 legal basis；
- 把网络安全日志、影响评估、provider、微信平台、备份和设备副本单列；
- 公示期限或确定方法、到期处理、权利入口和受限例外；
- 任何期限延长必须回到本 ADR 的变更流程。

### 22.4 S-22～S-25

- 管理/支持不能看到普通无权限正文，break-glass 有时限和审批；
- incident 处理 raw-content leak、删除 SLA breach、provider drift 和 restore resurrection；
- analytics 只接收 allowlist；匿名化证明前仍按个人数据期限处理；
- 实验不能改变保存期或把删除用户重新纳入样本。

### 22.5 S-29 / S-31 / S-33

- 系统架构把 deletion orchestration 和 restricted evidence 与普通业务单向隔离；
- 测试覆盖属性、并发、故障注入、备份恢复、provider expiry、设备缓存和日志扫描；
- 可观测性监控 deadline，不使用敏感 label；
- A-007 上线前演练必须完成四种 scope、FAILED 重试和 35 天备份链验证。

## 23. 明确不做

- 不在本任务创建 PostgreSQL 表、Prisma Schema、迁移、API 或生产 worker；
- 不选定生产 provider、云厂商、对象存储或密钥服务；
- 不定义 S-21 的最终隐私政策文案、用户请求身份验证材料或客服角色；
- 不把 Safety 原文、provider raw response、Prompt、note 或 matter 放入审计；
- 不使用 embedding、向量库或日志恢复已删记忆；
- 不承诺服务端能够收回用户截图、已下载文件或平台已经投递的消息；
- 不将本 ADR 视为法律意见；Alpha/Beta 上线前仍需结合主体、部署、provider 地区和真实数据流复核。

## 24. 验收标准

- 每类 P0 数据都有明确 purpose、anchor、最长保存期和 terminal action；
- 24 个月无主动使用、matter 90 天、attempt 30 天、notification 35 天、backup 35 天、guard 45 天、删除回执/安全日志六个月、影响评估三年的期限不冲突；
- DAY/MATTER/RELATIONSHIP_DATA/ACCOUNT 的在线清理、派生失效、provider 和 backup 行为完整；
- deletion guard 同步生效，FAILED 不恢复普通使用；
- 同日显式重记复用 original_result_version，不保存被删内容或 root seed；
- provider training 关闭且最大 retention 不超过 30 天；
- legal hold 和受限审计不成为 active source；
- 48 个场景 ID 唯一且覆盖期限、删除、重建、恢复、provider、失败和证明；
- S-17 domain model 已转 Accepted，docs/INDEX、backlog 和 current 同步；
- PR 不包含数据库、Prisma、API、生产代码、真实用户数据或真实 provider 调用。

## 25. 审核记录

- Proposed PR：[#21](https://github.com/WeiHan1996/DailyEnergy/pull/21)；
- 接受状态：未接受；
- 接受日期：待用户确认；
- 需要审核：期限表、24 个月无使用、DAY guard 与同日重记、关系删除默认范围、72 小时在线清理、35 天备份、provider 30 天硬门和受限证据；
- 接受后下一任务：S-19 数据库规格。
