# DailyEnergy 指标唯一口径

- **文档状态**：Draft
- **所属任务**：S-25 — 指标唯一口径
- **最后更新**：2026-07-26
- **适用范围**：Phase 0B / 内部 Alpha / 种子 Beta 的产品漏斗、激活、留存、互动、关系证据、运行质量、成本和治理 Gate
- **上游权威**：[产品愿景](../product/vision.md)、[用户旅程](../product/journey.md)、[第一阶段 MVP](../product/mvp.md)、[产品状态机](../product/state-machine.md)、[业务规则](../product/business-rules.md)、[领域模型](../data/domain-model.md)、[数据库规格](../technical/database.md)、[API 契约](../technical/api.md)、[ADR-0002](../decisions/ADR-0002-deterministic-daily-result.md)、[ADR-0005](../decisions/ADR-0005-data-retention-and-deletion.md)、[隐私数据地图](../operations/privacy-data-map.md)、[AI Gateway](../ai/gateway.md)、[内容安全](../ai/safety.md)、[埋点事件字典](./event-tracking.md)
- **下游任务**：S-26、S-27、S-29、S-31、S-33、C-015、AI-016、A-009～A-011、B-006～B-011

## 1. 目的

本文为 DailyEnergy 第一阶段建立唯一指标语言，使产品、工程、数据、运营和后续 AI Agent 不再对“开始、激活、活跃、D1、D3、D7、有帮助、完成、分享、降级和成本”使用不同分母。

核心验收句是：

> 任何百分比都必须能指出权威分子、权威分母、产品日期、成熟窗口、事件或事实版本、删除与缺失处理、样本量和误差；不能把客户端事件次数包装成用户转化，也不能为了跨日留存建立持久用户事件流。

本文回答：

1. MVP 指标的唯一名称、目的、分子、分母、窗口和初步目标；
2. D1、D3、D7 怎样从第一方权威事实临时计算并只保存匿名聚合；
3. 首次漏斗、点亮、晚间反馈、帮助度和任务怎样避免重复更新造成虚高；
4. AI 模板降级、Unknown outcome、迟到、删除和重建怎样进入口径；
5. 小样本怎样显示人数、Wilson 区间、抑制和分组限制；
6. 哪些结论只能是 best-effort 行为信号，哪些仍因缺少研究或归因合同而不可用；
7. C-015、S-29、S-31 和 S-33 实现前必须通过哪些验收 fixture 与 Production Gate。

## 2. 权威边界

### 2.1 指标不是业务事实

- 指标不能改变启动路由、每日结果、点亮、关系阶段、通知资格、Safety、删除或用户资料；
- 聚合丢失、延迟或停用不能让业务事实重放；
- `day_lit` 只证明用户主动留下了当天记录，不自动证明内容有帮助、任务完成或自然回访；
- `daily_result_read` 只证明一次 TodayView 成功返回，不证明完整阅读；
- `share_intent_created` 只证明分享意图被接受，不证明发送、送达或获客；
- `notification_deeplink_resolved` 只证明深链重新解析，不证明通知送达或自然留存；
- `helpfulness_updated` 的更新次数不能代替最终评分人数；
- 未打开不能解释为用户流失原因。

### 2.2 不建立用户级 analytics

- 不新增 raw event 表、用户事件历史、跨日 subject、持久 user hash、device、session 或 attribution cookie；
- D1/D3/D7 只在第一方受控 T0 查询中临时使用既有 `account_id` / `cycle_id` 连接权威事实；
- 聚合完成后立即释放临时 owner/cycle 集合，只写满足 `k=10` 的 T4 匿名指标单元；
- T4 不能返回用户列表、解析回业务对象或与 Safety、DataTask、支持工单联接；
- 若实现需要长期保存个体 cohort membership，本规范不授权，必须先更新隐私数据地图、ADR-0005、权限、期限、删除和导出合同。

### 2.3 Safety 与治理只作隔离 Gate

- Safety 数字不进入增长、留存、渠道、帮助度、实验或付费报表；
- DataTask 数字不进入普通产品漏斗，也不允许按用户、渠道、关系或内容切分；
- Safety fixed response 失败、raw-content detector 命中、删除 SLA breach 是发布/事件 Gate，不是用于优化转化的 KPI；
- high-risk 原文、类别组合、资源号码、删除原因和支持描述永远不进入本文指标。

## 3. S-25 决策摘要

| # | 决策 | v1 唯一结论 |
|---:|---|---|
| 1 | 首要产品判断 | D1 核心回访留存是主指标；激活、D3、D7、帮助度和关系研究共同解释，不设单一“北极星分” |
| 2 | 激活事实 | 当前关系周期的首个有效 `DailyLightFact`；不是注册、打开、签到或结果返回 |
| 3 | 活跃事实 | `CoreActiveUserDay`：同 owner + 产品日期存在有效 Checkin、Light 或 EveningFeedback 任一权威事实 |
| 4 | 留存 cohort | 当前关系周期首个有效 EncounterLink 所属产品日期 D0；一个当前 cycle 一个 cohort 身份 |
| 5 | D1/D3/D7 | D0 后精确第 1/3/7 个产品日期存在有效 EncounterLink；不是“在前 N 天任意回来” |
| 6 | 时间 | 全部按 `Asia/Shanghai` 04:00、`product-date-v1`；不使用设备日期 |
| 7 | 成熟窗口 | 目标日期结束且迟到窗口 2 小时关闭后才进入 finalized 指标 |
| 8 | 首次漏斗 | 优先使用同产品日期权威事实；客户端 landing 信号只报告事件次数比，不宣称唯一用户转化 |
| 9 | 点亮率 | 正式 KPI 使用“首个可用结果 → 首次点亮”；不使用不可靠的“阅读完成”事实 |
| 10 | 帮助度 | 读取截止时最终 rating；`HELPFUL / (HELPFUL + NEUTRAL + NOT_HELPFUL)`，排除 `UNRATED` 与 `NOT_USED`，同时单独报告覆盖 |
| 11 | 任务完成 | 使用截止时最终 task 状态；更新次数不进入分子 |
| 12 | 模板降级 | 完整可用结果仍算成功；另以 `generation_mode=CONTROLLED_TEMPLATE` 报告降级比例 |
| 13 | Unknown outcome | 没有权威完成事实前不算成功；窗口未关为 pending，窗口关闭仍 unresolved 算未完成 |
| 14 | 删除与重建 | T4 前按当前有效事实重算；已匿名发布的历史 T4 不做单人反减；重建同 owner/date 最多计一次 |
| 15 | 小样本 | 默认 `k=10`；小于 10 不显示精确人数或百分比，只显示“样本不足” |
| 16 | 不确定性 | 比例同时显示分子/分母和 Wilson 95% 区间；目标只作决策门槛，不宣称统计证明 |
| 17 | 分组 | 每单元最多两个批准维度；Alpha 默认只看总体；S-27 前不发布小红书/抖音或素材级留存 |
| 18 | 关系感 | “不像鸡汤”“它记得我”是独立研究证据；当前无 Accepted 输入 Schema，不能临时塞入通用事件 |
| 19 | 分享 | 只发布分享意图率，不命名“分享成功率”或“裂变率” |
| 20 | 保存 | T4 匿名指标最长 13 个自然月；版本、fixture 可在被聚合引用期间保留且不含个人数据 |

## 4. 规范用语、产品日期与截止

### 4.1 计数单位

| 单位 | 定义 | 可否持久化个体集合 |
|---|---|---|
| owner | 一个当前合法账户生命周期内的 owner；只在 T0 权威查询存在 | 否 |
| owner-day | owner + `ProductDate` 的去重组合 | 否 |
| relationship cycle | 当前关系周期；关系数据整体删除后旧 cycle 关闭 | 否 |
| result-day | owner + 产品日期的一份有效 `PublishedDailyResult` | 否 |
| interaction-day | result-day 下当前有效 `DailyInteraction` | 否 |
| intent | 一个唯一 `GenerationIntent` / ShareIntent / NotificationIntent 业务事实 | 只在原领域期限内；不复制到 analytics |
| event count | 事件发生次数；客户端信号可能丢失或重复 | 只保存 T4 总数 |
| unique owner count | 在权威 T0 查询内去重后形成的匿名人数 | 只保存满足 k 的 T4 总数 |

### 4.2 产品日期

- 产品日期由 `product-date-v1` 使用 `Asia/Shanghai`、04:00 边界解析；
- cohort D0、D1、D3、D7 使用民用产品日期加法，不使用 24/72/168 小时时差；
- 事实按其权威 `product_date`；客户端信号按服务端接收日期；
- 环境严格分离，只允许 `PROD` 进入产品决策报表；
- TEST/STAGING/DEV 永远不与 PROD 合并。

### 4.3 截止状态

| 状态 | 条件 | 报告行为 |
|---|---|---|
| `PROVISIONAL` | 目标产品日期或 +2h 迟到窗口未关闭 | 可用于运行观察；不得做阶段决策 |
| `FINALIZED` | 窗口关闭、质量 Gate 通过、revision 固定 | 可进入正式 Alpha/Beta 报告 |
| `SUPPRESSED` | 分母或切片小于 k，或差分风险不通过 | 不显示精确值 |
| `BLOCKED` | 合同、raw-content、隔离、TTL 或来源 Gate 失败 | 不发布该指标 |
| `UNAVAILABLE` | 当前没有可信事实或 Accepted 输入合同 | 说明缺口，不用替代数据猜测 |

同一报告不得把 provisional 分子与 finalized 分母混算。

## 5. 公共人群与派生定义

### 5.1 `NewConsentOwner`

在某产品日期首次接受当前必要 notice version、此前没有有效 OnboardingCompletion 的 owner。重复接受、notice 迁移或撤回后重新接受不自动产生第二个新用户。

### 5.2 `OnboardedOwner`

存在唯一有效 `OnboardingCompletion`，其 `completed_at` 解析为目标产品日期。Profile 后续修改不重复计数。

### 5.3 `CoreActiveUserDay`

同一 owner + 产品日期至少存在以下一个当前有效权威事实：

- `MorningCheckin`；
- `DailyLightFact`；
- `EveningFeedbackRecord`。

三者并集后每 owner-day 只计一次。`app_launch_resolved`、读取请求、展开、FAQ、通知点击和分享预览不构成 Core Active。这个定义是克制、可审计的“核心活跃”，不能对外简写成行业 DAU 而不附定义。

### 5.4 `ActivationCycle`

一个当前有效 `RelationshipCycle` 的首个有效 `RelationshipEncounterLink`：

- 其 `product_date` 为 cohort D0；
- 同 cycle 后续点亮不创建新 cohort；
- 普通 DAY 删除导致首个 link 失效时，按剩余最早 link 重算 D0；
-关系数据整体删除关闭旧 cycle，旧 cohort 不再参与可变窗口；新 cycle 只有新的合法点亮才能形成新 D0；
- 已经发布且不可反查的历史 T4 不因单人后续删除重写。

### 5.5 `MatureCohort`

对 Dx：

- D0 + x 的产品日期及 +2h 迟到窗口均已关闭；
- cohort 通过来源、环境、revision、删除和质量 Gate；
- 未成熟 cohort 不进入分母，不作为“未留存”。

### 5.6 `EvaluableResultDay`

存在当前有效 PublishedDailyResult 与可用 DailyInteraction，且没有被 Safety、DAY/ACCOUNT deletion 或 source invalidation 使其不可读。模板降级结果仍是可评结果。

## 6. 指标分层

| 层级 | 用途 | 指标 |
|---|---|---|
| 主决策 | 判断用户是否愿意第二天回来完成核心价值 | S25-M07 D1 核心回访留存 |
| 核心结果 | 判断首次价值与一周关系是否成立 | M02～M06、M08～M13、M15 |
| 解释指标 | 解释价值来自哪里、哪里流失 | M01、M14、M16～M19 |
| 运行与成本 | 判断体验是否可稳定、可负担地提供 | M20～M23 |
| 硬 Gate | 隐私、安全、删除和隔离不可用转化抵消 | G01～G04 |
| 研究证据 | 回答“不是鸡汤”“它记得我” | Q01～Q02，当前 UNAVAILABLE |

不得把多个指标加权成一个“用户价值分”或“关系分”。一个指标达到目标不能抵消 Safety、隐私或删除 Gate 失败。

## 7. 指标注册表

### 7.1 首次漏斗与激活

| ID | 唯一名称 | 分子 | 分母 | 窗口/来源 | 初步目标 |
|---|---|---|---|---|---:|
| S25-M01 | 承接页主操作事件比 | `landing_primary_action_clicked.event_count` | `landing_viewed.event_count` | 同产品日期、同批准 surface/scene；客户端 best-effort | ≥55%（方向性） |
| S25-M02 | 同日首次认识完成率 | D0 有 OnboardingCompletion 的 NewConsentOwner | D0 NewConsentOwner | 同产品日期权威事实 | ≥75% |
| S25-M03 | 同日首次签到完成率 | D0 有 MorningCheckin 的 OnboardedOwner | D0 OnboardedOwner | 同产品日期权威事实 | ≥85% |
| S25-M04 | 今日结果成功到达率 | 截止时有 PublishedDailyResult 的有效 checkin owner-day | 有效 MorningCheckin owner-day | 产品日期结束 +2h；含 AI/模板 | ≥99% |
| S25-M05 | 首次结果到点亮率 | D0 有有效 LightFact 的首次 result owner | D0 首次获得 PublishedDailyResult 的 owner | 当前 ActivationCycle 的 D0 | ≥70% |
| S25-M06 | 首次端到端价值完成率 | D0 完成有效 LightFact 的 NewConsentOwner | D0 NewConsentOwner | consent → onboarding → checkin → result → light | 观察值 |

M01 可以超过 100%，不得截断或命名“用户开始率”；刷新、多端和丢失都会影响它。M02～M06 使用 T0 权威 owner 集合去重，不从客户端事件拼漏斗。

### 7.2 留存与关系深度

| ID | 唯一名称 | 分子 | 分母 | 窗口 | 初步目标 |
|---|---|---|---|---|---:|
| S25-M07 | D1 核心回访留存 | D1 存在有效 EncounterLink 的 ActivationCycle | D1 MatureCohort | 精确 D0+1 | ≥35% |
| S25-M08 | D3 核心回访留存 | D3 存在有效 EncounterLink 的 ActivationCycle | D3 MatureCohort | 精确 D0+3 | ≥22% |
| S25-M09 | D7 核心回访留存 | D7 存在有效 EncounterLink 的 ActivationCycle | D7 MatureCohort | 精确 D0+7 | ≥15% |
| S25-M10 | D0～D2 三日完整点亮率 | D0、D1、D2 均有有效 EncounterLink 的 cycle | D2 MatureCohort | 三个精确日期全满足 | 观察值 |
| S25-M11 | D0～D6 七日完整点亮率 | D0～D6 七日均有有效 EncounterLink 的 cycle | D6 MatureCohort | 七个精确日期全满足 | 观察值 |
| S25-M12 | 首周三次相遇率 | D0～D6 至少 3 个去重有效 EncounterLink 的 cycle | D6 MatureCohort | 7 个连续产品日期 | 观察值 |
| S25-M13 | 首周晚间反馈覆盖率 | D0～D6 至少 1 个有效 EveningFeedbackRecord 的 cycle | D6 MatureCohort | 7 个连续产品日期 | ≥25% |

M10/M11 只用于观察使用节奏，不进入断签、惩罚、关系降级或通知压力。M12 更符合“不要求完美连续”的关系价值解释。

### 7.3 帮助度、任务、周回望与分享

| ID | 唯一名称 | 分子 | 分母 | 计算 | 初步目标 |
|---|---|---|---|---|---:|
| S25-M14 | 帮助度评价覆盖率 | 截止时存在最终 HelpfulnessRecord 的 EvaluableResultDay | EvaluableResultDay | `HELPFUL/NEUTRAL/NOT_HELPFUL/NOT_USED` 都算已回应 | 观察值 |
| S25-M15 | 建议有帮助比例 | 最终 `HELPFUL` result-day | 最终为 `HELPFUL/NEUTRAL/NOT_HELPFUL` 的 result-day | 排除 UNRATED、缺记录、NOT_USED；显示样本量 | ≥60% |
| S25-M16 | 任务参与率 | 最终 `INTERESTED` 或 `COMPLETED` 的 result-day | 有合法 task 的 EvaluableResultDay | 每日最终状态，不数 update 事件 | 观察值 |
| S25-M17 | 任务参与后完成率 | 最终 `COMPLETED` 的 result-day | 最终 `INTERESTED` 或 `COMPLETED` 的 result-day | 同一截止快照 | 观察值 |
| S25-M18 | 七天回望打开信号 | `weekly_summary_read.event_count` | D7 MatureCohort 数 | 每 100 个成熟 cycle 的事件次数；客户端 best-effort | 观察值 |
| S25-M19 | 分享意图 owner-day 率 | 至少 1 个有效 ShareIntent 的 CoreActiveUserDay | CoreActiveUserDay | 同日权威意图去重；不表示实际分享 | 观察值 |

M15 必须与 M14 同屏；只显示“60% 有帮助”而隐藏低覆盖率属于错误报告。M17 可同时附“全部可评结果中的完成比例”，但不能取代注册口径。

### 7.4 运行质量与成本

| ID | 唯一名称 | 分子 | 分母 | 计算 | 初步目标 |
|---|---|---|---|---|---:|
| S25-M20 | AI 生成 8 秒内达标率 | DAILY、AI、AVAILABLE 且 latency bucket <8s | latency 已知的 DAILY、AI、AVAILABLE | `<250ms`～`3_7.99s` 累加；等价检验 P95 是否落在 8s 内 | ≥95% |
| S25-M21 | 模板降级比例 | `daily_result_available` 且 mode=CONTROLLED_TEMPLATE | 全部 `daily_result_available` | 同产品日期唯一结果事实 | ≤5% |
| S25-M22 | 单核心活跃用户日 AI 成本 | DAILY Gateway `cost_micros` 日总和 | CoreActiveUserDay | 人民币元；usage completeness Gate 通过后发布 | ≤¥0.10 |
| S25-M23 | AI 成本记录完整率 | usage_outcome=KNOWN 的 terminal DAILY invocation | 全部 terminal DAILY invocation | 不以 0 代替 UNKNOWN | ≥99% |

M20 不保存精确逐次耗时；若累计到 `<8s` 的比例低于 95%，只能得出 P95 大于或等于 8 秒桶边界。provider/model 深度诊断属于 S-33，不进入普通产品分组。

## 8. 硬 Gate

| ID | Gate | 通过条件 | 失败动作 |
|---|---|---|---|
| S25-G01 | Analytics 合同 | 未登记事件、属性、版本、第三维、raw event 持久行均为 0 | 阻止发布指标，按 S-23/S-33 处理 |
| S25-G02 | 敏感内容 | `raw_content_detector_outcome` 的 MATCH/BLOCKED 对普通 analytics 输出为 0；任何真实命中有受限事件流程 | 停止受影响投影和导出，不展示 KPI |
| S25-G03 | 小样本与隔离 | 所有发布单元 k≥10；无 Safety/Governance → PRODUCT join path；差分测试通过 | 抑制/撤回报表，禁止降低 k |
| S25-G04 | 删除与期限 | DataTask SLA breach=0；过期 T4=0；恢复复活被 guard 阻断 | 停止发布并进入事件响应 |

Safety fixed response、resource registry 或 recovery 的受限运行失败由 Safety/运行 owner 查看；普通指标页只显示 Gate `PASS/BLOCKED`，不显示类别、用户数或资源行为。

## 9. 研究指标

### 9.1 S25-Q01 “不像鸡汤”正向比例

- 建议固定陈述：“今天的内容不是泛泛的鸡汤，而是和我真实提供的状态有关。”
- 建议 5 点量表；4/5 为正向；
- 分母为有效答卷，必须同时显示人数与 Wilson 95% 区间；
- 初步目标 ≥60%；
- 不从帮助度、停留、点亮、任务或文本情感自动推断。

### 9.2 S25-Q02 “它记得我”有证据正向比例

- 建议先问：“它提到的内容是否来自你确实告诉过它或系统确实记录过的事情？”
- 只有正向量表且能选择一个批准来源类别时计正向；
- 来源类别只能是称呼/表达偏好/明确日记录/主动保存事项/其它批准领域源，不保存回答原文到通用 analytics；
- 初步目标 ≥45%；
- v1 Daily/Weekly memory facts 仍为空时，不得虚构达到该指标。

### 9.3 当前状态

Q01/Q02 当前均为 `UNAVAILABLE`，原因是仓库没有 Accepted 的研究输入 Schema、收集页面、用途、位置、保存期限、删除与导出规则。进入 Alpha 前必须：

1. 单独定义版本化研究问卷/访谈协议；
2. 更新隐私数据地图和用户说明；
3. 规定匿名聚合、小样本与原始答卷期限；
4. 与 PRODUCT 事件保持逻辑隔离；
5. 禁止把自由文本回答或访谈原文放入通用事件。

S-25 只冻结指标语义，不创建临时 `survey_answer` 事件或数据库字段。

## 10. 维度与分组

### 10.1 批准维度

| 维度 | 允许范围 | 限制 |
|---|---|---|
| `cohort_product_date` | M07～M13 | 日期是窗口键，不与稀有细分组合 |
| `generation_mode` | M04、M05、M20～M23 | AI / CONTROLLED_TEMPLATE；NO_GENERATION 仅运行解释 |
| `scene_code` | M01～M03 的同日粗入口 | DIRECT/CHANNEL_LANDING/SHARE/NOTIFICATION/OTHER；不做素材留存 |
| `app_version_bucket` | 质量诊断 | major.minor/OTHER；活动版本最多 8 |
| `lifecycle_day_bucket` | 产品日指标 | D0/D1/D2/D3/D4_6/D7/D8_14/D15_PLUS；在 T0 按当前 cycle 首个 link 计算 |
| `environment` | 所有 | 正式产品报告固定 PROD，不跨环境 |

每个 T4 单元除 metric/date/environment 外最多两个批准维度。

### 10.2 `lifecycle_day_bucket`

- `D0`：当前 ActivationCycle 首个有效 EncounterLink 的产品日期；
- `D1/D2/D3/D7`：与 D0 的民用产品日期差精确为 1/2/3/7；
- `D4_6`、`D8_14`、`D15_PLUS`：只用于粗生命周期描述，不代替精确留存；
- 关系 cycle 删除后旧 bucket 不进入新的可变计算；
- 该值只在 T0 权威事实查询中产生，不作为客户端属性或持久用户标签。

### 10.3 当前禁止分组

- 小红书、抖音、素材、活动、创作者、承接文案：等 S-27；
- expression style、称呼是否填写、情绪/精力/睡眠、事项、关系状态、帮助度与 Safety 的交叉；
- provider、model、route、Prompt、精确版本和精确耗时：等 S-33 受限 observability；
- 用户、设备、session、IP、地区、手机号或任何高基数 ref；
- Q01/Q02 与个体留存、渠道或付费的 join。

## 11. 小样本、区间与报告格式

### 11.1 发布规则

1. 分母 `n < 10`：不展示精确分子、分母或百分比，显示“样本不足（<10）”；
2. `n ≥ 10`：显示 `x / n`、百分比和 Wilson 95% 区间；
3. 不用小数点后多位制造精确感；默认百分比 1 位小数，成本到 ¥0.01；
4. 不显示只有一个成员变化即可被反推出的重叠切片；
5. 移除第二维、合并父桶后仍小于 k 时省略；
6. Alpha 10～20 人默认只显示总体和原始研究摘要，不按渠道/版本切片；
7. 50～100 人 Beta 也不能因“内部使用”降低 k。

### 11.2 Wilson 95% 区间

比例 `p=x/n`，`z=1.96`。实现必须使用同一版本函数，不能由不同报表各自选择 Wald、Agresti 或贝叶斯区间。目标判断展示：

- `达到`：点估计达到目标；
- `接近`：点估计未达到但目标落在 95% 区间内；
- `未达到`：点估计和区间上界均低于下限目标，或下限类指标的区间下界高于上限目标；
- `样本不足`：n<10；
- `不可用`：来源或 Gate 不成立。

这不是正式显著性检验，也不支持“p<0.05 即上线”的自动决策。

### 11.3 固定报告列

```text
metric_id
metric_version
period_or_cohort
status
numerator
denominator
value
wilson_low?
wilson_high?
target
target_readout
dimension_1?
dimension_2?
source_contract_version
aggregation_revision
generated_at
expires_at
notes_code[]
```

`notes_code` 只能使用封闭枚举，例如 `PROVISIONAL`、`TEMPLATE_INCLUDED`、`BEST_EFFORT_SIGNAL`、`POST_AGGREGATION_DELETION_NOT_RESTATED`、`CHANNEL_UNAVAILABLE`，不能保存自由文本。

## 12. 缺失、Unknown、降级、删除与重建

### 12.1 缺失与 Unknown

- 未产生权威完成事实不进入成功分子；
- 观察窗口未关闭时是 pending，不进入 finalized 分母；
- 窗口关闭后仍无结果，M04 记为未成功；
- 客户端事件缺失不等于用户没有浏览或点击；
- latency/cost UNKNOWN 不填 0；M20/M22 在完整率 Gate 未通过时标 BLOCKED；
- 当日没有晚间反馈是合法缺失，不推断用户状态。

### 12.2 模板降级

- Controlled Template 发布的完整结果进入 M04、M05、M07～M19 的正常产品分子/分母；
- M21 单独暴露降级占比；
- 报告 M05、M15 时可按 `generation_mode` 做一个批准维度，但不得用小样本差异评价个人或 provider；
- 模板失败且没有 AVAILABLE result 不算成功。

### 12.3 删除

- T4 生成前，DAY/RELATIONSHIP_DATA/ACCOUNT 删除按当前有效权威事实重算；
- DAY 删除移除对应 checkin/result/interaction/link 后，不保留幽灵活跃或留存；
- relationship 删除关闭旧 cycle；旧 link 不能重放到新 cohort；
- ACCOUNT 删除后不进入新的计算；
- 已通过匿名化证明并发布的历史 T4 无 resolver，不能对单人做反减或导出；
- 正式报告必须用 `POST_AGGREGATION_DELETION_NOT_RESTATED` 说明这种历史性质；
- 若业务或法律要求历史可按个体更正，则该数据不能继续声称 T4，须先重做隐私与存储设计。

### 12.4 同日重建与修订

- 同 owner + product date 当前有效 Checkin、Result、Light 各最多计一次；
- `checkin_corrected` 不增加 M03 人数，也不改已发布 result；
- DAY 删除后的受控重建若合法，只以新当前事实计一次，不叠加旧事实；
- 日批重跑覆盖同一 metric key/revision，不累加；
- 迟到 revision 在允许窗口生成新 aggregation revision；旧 revision 不并存相加。

## 13. 计算合同

### 13.1 T0 权威 source views

S-29/C-015 必须实现只读、短生命周期、第一方 source views 或等价受控查询：

```text
metric_source.new_consent_owner
metric_source.onboarding_completion
metric_source.morning_checkin
metric_source.published_daily_result
metric_source.daily_light_fact
metric_source.relationship_encounter
metric_source.daily_interaction_final
metric_source.generation_runtime
metric_source.gateway_daily_usage
metric_source.share_intent
```

这些不是新业务真相，也不长期保存 owner 列表。每个 view 必须：

- 只返回当前有效事实；
- 处理 account/Safety/deletion/source validity；
- 带 `product_date_policy_version`、source revision/fingerprint 和环境；
- 用白名单列，禁止原文、分数、Prompt、事项和内部 refs进入 T4；
- 查询结束立即释放 owner/cycle 粒度结果。

### 13.2 留存参考查询

以下是验收语义，不是当前已存在的生产 SQL：

```sql
WITH cohort AS (
  SELECT cycle_id, MIN(product_date) AS d0
  FROM metric_source.relationship_encounter
  WHERE source_valid = TRUE AND environment = 'PROD'
  GROUP BY cycle_id
),
mature AS (
  SELECT cycle_id, d0
  FROM cohort
  WHERE d0 + :day_offset < :finalized_product_date
),
retained AS (
  SELECT DISTINCT m.cycle_id
  FROM mature m
  JOIN metric_source.relationship_encounter e
    ON e.cycle_id = m.cycle_id
   AND e.product_date = m.d0 + :day_offset
   AND e.source_valid = TRUE
)
SELECT COUNT(retained.cycle_id) AS numerator,
       COUNT(mature.cycle_id) AS denominator
FROM mature
LEFT JOIN retained USING (cycle_id);
```

实现必须在同一受控计算内完成、立即释放 `cycle_id`，只把匿名 numerator/denominator 写入 T4。`:day_offset` 只允许 1、3、7 等注册值。

### 13.3 最终状态参考查询

帮助度与任务必须读取截止时当前实体：

```sql
SELECT
  COUNT(*) FILTER (WHERE helpfulness = 'HELPFUL') AS helpful,
  COUNT(*) FILTER (
    WHERE helpfulness IN ('HELPFUL', 'NEUTRAL', 'NOT_HELPFUL')
  ) AS substantive_ratings,
  COUNT(*) FILTER (
    WHERE task_status IN ('INTERESTED', 'COMPLETED')
  ) AS task_engaged,
  COUNT(*) FILTER (WHERE task_status = 'COMPLETED') AS task_completed
FROM metric_source.daily_interaction_final
WHERE product_date BETWEEN :start_date AND :end_date
  AND evaluable = TRUE;
```

禁止用 `helpfulness_updated` 或 `task_status_updated` 的事件条数代替上述当前状态。

## 14. 验收 Fixtures

### 14.1 固定样例

| Fixture | 输入 | 预期 |
|---|---|---|
| S25-FX-01 | 20 NewConsentOwner；15 同日 onboarding | M02 = 15/20 = 75.0% |
| S25-FX-02 | 15 OnboardedOwner；13 同日 checkin | M03 = 13/15 = 86.7% |
| S25-FX-03 | 13 checkin；13 AVAILABLE，其中 1 template | M04 = 100%；M21 = 1/13 = 7.7%，降级目标未达到 |
| S25-FX-04 | 20 D0 cycles；D1=7、D3=4、D7=3 | M07=35.0%；M08=20.0%；M09=15.0% |
| S25-FX-05 | 20 mature cycles；8 在首周至少一次 feedback | M13 = 40.0% |
| S25-FX-06 | ratings：6 HELPFUL、2 NEUTRAL、2 NOT_HELPFUL、4 NOT_USED、6 UNRATED | M14=14/20=70%；M15=6/10=60% |
| S25-FX-07 | task：4 COMPLETED、6 INTERESTED、5 SKIPPED、5 UNMARKED | M16=10/20=50%；M17=4/10=40% |
| S25-FX-08 | 100 AI AVAILABLE；94 在 <8s bucket | M20=94%，等价 P95≤8s Gate 未通过 |
| S25-FX-09 | ¥6.00 DAILY AI cost；80 CoreActiveUserDay | M22=¥0.075，显示 ¥0.08 |
| S25-FX-10 | 分母 9 | 指标 SUPPRESSED，不显示精确比例 |

### 14.2 必须自动化

- 每个 fixture 固定 source contract version、product-date policy、metric version 和 aggregation revision；
- SQL/应用实现对同 fixture 结果必须一致；
- 重跑必须覆盖同 key/revision，不得加倍；
- Wilson 区间使用同一测试向量；
- 任何新增指标先加入 registry、source、fixture、owner、target/readout 和删除规则。

## 15. 指标 Owner、刷新与版本

| 范围 | Owner | 刷新 | 正式截止 |
|---|---|---|---|
| M01～M06 | Product Analytics owner | 每日 | 产品日期结束 +2h |
| M07～M13 | Product Analytics owner | 每日 cohort revision | 对应 Dx 日期结束 +2h |
| M14～M19 | Product owner + Analytics owner | 每日 | 报告截止日结束 +2h |
| M20～M23 | Engineering/AI owner | 每日；运行告警由 S-33 | 产品日期结束 +2h |
| G01～G04 | Privacy/Safety/Engineering 对应 owner | 发布前 + 每日 | Gate 通过才发布 |
| Q01～Q02 | Research owner + Privacy owner | 每轮研究 | 协议版本锁定后 |

版本规则：

- 改分子、分母、cohort、窗口、产品日期、排除、单位或来源语义必须增加 `metric_version`；
- 只修文案不改变口径可保持版本；
- 旧/新版本分开报告，最多 14 天桥接；
- 不允许把不同版本直接相加；
- 指标版本必须引用事件 Schema version、source contract version 和 product-date policy；
- 目标调整需记录依据，不静默重写历史“是否达标”。

## 16. 标准报告

### 16.1 Alpha

- 10～20 人；
- 重点验证流程可用、严重缺陷、安全/删除演练和指标来源正确；
- 默认只看总体人数、M02～M06、初步 D1、运行质量和研究原始证据；
- 不因小样本追求渠道、版本或 cohort 百分比；
- Alpha 不作为 D7 产品市场匹配结论。

### 16.2 种子 Beta

- 50～100 名目标用户、完整 14 天窗口；
- 主报告按顺序展示：样本与 Gate → M02～M06 → M07/M08/M09 → M12/M13/M15 → M20～M23 → Q01/Q02；
- 每个百分比显示 x/n 与区间；
- 渠道分组仅在 S-27 Accepted 且单元 k≥10 后展示；
- 访谈结论必须区分“用户原话证据”和团队解释，不能从行为指标猜原因。

### 16.3 决策读法

| 证据组合 | 解释 | 下一步候选 |
|---|---|---|
| 激活高、D1 低 | 第一次能完成，但没有第二天期待 | R-002 |
| D1 尚可、D7 低 | 内容重复或关系成长不足 | R-003/R-005 |
| 点亮高、M13 低 | 晚间反馈时机或成本有问题 | R-007 或反馈流程调整 |
| M15 高、Q02 低 | 工具价值存在，关系记忆尚未成立 | 先修真实记忆，不扩功能 |
| Q02 高、M17 低 | 表达有关系感，但行动不够实用 | R-004 |
| 某渠道入口高、激活/留存低 | 渠道承诺或人群不匹配 | S-27/Beta 渠道复盘 |
| M21/M20/M22 失败 | 工程/供应商/内容预算影响体验 | AI-002/AI-006/AI-016 |
| 任一 G01～G04 失败 | 当前数据或发布不可信 | 停止报表/发布，先修 Gate |

## 17. 验证场景

| ID | 场景 | 预期 |
|---|---|---|
| S25-MET-001 | landing viewed 丢失、click 正常 | M01 可异常或 >100%，标 BEST_EFFORT，不推断用户转化 |
| S25-MET-002 | 同 owner 重复接受同 notice | NewConsentOwner 只计一次 |
| S25-MET-003 | onboarding 跨到下一产品日期完成 | 不进入 D0 同日 M02 分子；下一日另作延迟诊断，不改口径 |
| S25-MET-004 | Profile 多次修改 | 不增加 onboarding 完成人数 |
| S25-MET-005 | Checkin command 幂等重试 | M03/M04 分母各只计一个 owner-day |
| S25-MET-006 | Checkin 更正 revision 增加 | 不增加首次签到人数，不重算已发布结果 |
| S25-MET-007 | AI 失败后 template AVAILABLE | M04 成功，M21 计 template |
| S25-MET-008 | 生成 intent Unknown，窗口未关闭 | provisional pending，不进入 finalized |
| S25-MET-009 | 生成 intent 窗口关闭仍无 result | M04 分母保留、分子不增加 |
| S25-MET-010 | TodayView 重复读取 | 不增加 M05 分母；读取次数只作诊断 |
| S25-MET-011 | 多端同时点亮 | 一个 LightFact、一个 ActivationCycle D0 |
| S25-MET-012 | 点亮但任务未完成 | M05/M07 可成功，M17 不成功；互不替代 |
| S25-MET-013 | D0 后第 2 天回来但 D1 未回来 | D1=未留存；不能用“3 日内回来”替代 |
| S25-MET-014 | D3 cohort 尚未成熟 | 不进入 M08 分母 |
| S25-MET-015 | D0/D2/D4 各点亮 | M12=3 次相遇；M10/M11 均不满足 |
| S25-MET-016 | 中断一天后回来 | 不惩罚关系；精确 Dx 按事实，M12 可继续累计 |
| S25-MET-017 | DAY 删除 D0 link，D1 成为最早有效 link | 可变窗口重算 cycle D0；不保留幽灵 cohort |
| S25-MET-018 | relationship data 删除后旧 light 仍保留 | 旧 link 不重放进新 cycle；新 cohort 只由新合法点亮形成 |
| S25-MET-019 | T4 发布后用户账户删除 | 历史匿名单元不反减，报告固定 notes code |
| S25-MET-020 | 删除后同日合法重建并再次点亮 | 当前 owner/date 只计一个有效事实，不叠加旧记录 |
| S25-MET-021 | Helpfulness 从 HELPFUL 改为 NOT_HELPFUL | 截止快照只计 NOT_HELPFUL；update 次数不进分母 |
| S25-MET-022 | rating=NOT_USED | 进入 M14 覆盖，不进入 M15 实质评价分母 |
| S25-MET-023 | task 从 INTERESTED 改 COMPLETED | M16/M17 最终各计一次，不计两次更新 |
| S25-MET-024 | weekly summary client 信号重复 | M18 只作 event frequency，不宣称唯一打开用户 |
| S25-MET-025 | 分享预览创建、用户取消 | M19 不增加；不推断分享成功 |
| S25-MET-026 | ShareIntent 多次创建同 owner-day | M19 分子 owner-day 去重一次；intent count 可另作诊断 |
| S25-MET-027 | notification deep link VALID 后点亮 | 留存由 EncounterLink 事实决定；不命名自然回访 |
| S25-MET-028 | 100 个 AI 结果中 95 个 <8s | M20=95%，P95 桶 Gate 通过 |
| S25-MET-029 | latency UNKNOWN 占比过高 | M20 BLOCKED，不把 UNKNOWN 当快或慢 |
| S25-MET-030 | cost UNKNOWN 被写为 0 | Contract Gate 失败；M22 不发布 |
| S25-MET-031 | 9 人渠道切片 | SUPPRESSED，不降低 k、不展示 7/9 |
| S25-MET-032 | 两个重叠切片可差分出一人 | 查询/导出阻断，即使各自 n≥10 |
| S25-MET-033 | Alpha 请求按小红书/抖音看 D7 | S-27 前 UNAVAILABLE；Alpha 也不因内部使用例外 |
| S25-MET-034 | 将 expression style 加入留存分组 | 拒绝；未在批准维度且有画像/小样本风险 |
| S25-MET-035 | high-risk resource action 想关联 D7 | 拒绝跨平面 join；普通报表只见 Gate |
| S25-MET-036 | “不像鸡汤”用 helpfulness 代替 | 拒绝；Q01 保持 UNAVAILABLE 直到研究合同接受 |
| S25-MET-037 | 日批同 revision 重跑 | 覆盖同 T4 key，不重复累加 |
| S25-MET-038 | PROD 与 STAGING 混合 | 环境 Gate 失败，不发布 |
| S25-MET-039 | metric 定义改分母但版本不变 | Contract Gate 失败，必须增加 metric_version |
| S25-MET-040 | G01～G04 任一失败但留存达标 | 不得宣称阶段成功，先处理 Gate |

## 18. Production Gates 与下游交接

| Gate | Owner / 下游 | 解除条件 |
|---|---|---|
| 可执行 source views | S-29、C-015 | 当前有效事实、删除/Safety guard、白名单列和临时 owner 集合实现 |
| Metric Schema 与 registry | packages/shared-schemas、C-015 | 23 个指标、4 个 Gate、版本、notes code、维度和未知字段拒绝实现 |
| D1/D3/D7 聚合器 | C-015 | T0 临时跨日 join、无持久 subject、mature cohort、revision 和 fixture 通过 |
| 最终状态聚合 | C-015 | helpfulness/task 读取最终事实，不按 update event 计数 |
| T4 store / RBAC / TTL | S-29、E-006、A-005 | 第一方隔离位置、只读角色、13 个月物理删除 |
| 小样本与差分测试 | S-31、Privacy owner | k=10、父桶、重叠切片、导出和不可反查测试通过 |
| 运行桶与成本完整性 | S-33、AI-016 | latency/cost contract、UNKNOWN、告警和受限诊断实现 |
| 研究指标 | Research + Privacy | 问卷/访谈 Schema、告知、位置、期限、删除和聚合 Accepted |
| 渠道分组 | S-27 | 平台/素材 registry、归因窗口、隐私和 falsification Accepted |
| 指标 Dashboard | A-005 | 只读 T4、固定定义、样本/区间/Gate/版本展示，无用户下钻 |

上述 Gate 未完成前：

- 不得发布 D1/D3/D7、帮助度、渠道、成本或关系感结论；
- 不得用日志、通知、支持、Safety、删除回执或客户端缓存补造用户轨迹；
- 不得保存 cohort membership 或从 T4 下钻用户；
- 不得把本文件理解为已经有 analytics API、数据库表、定时任务或 Dashboard；
- 不得开始 S-26 的个体实验分配或 S-27 的渠道归因实现。

## 19. S-25 验收标准

- 23 个指标、4 个硬 Gate、2 个研究指标均有唯一 ID、分子、分母、窗口、来源、状态和目标/读法；
- D1/D3/D7 使用 ActivationCycle + EncounterLink，在 T0 临时计算后只写 T4；
- 激活、CoreActiveUserDay、成熟 cohort、可评结果日和 lifecycle bucket 定义唯一；
- 客户端信号明确不能提供唯一用户漏斗；
- 帮助度和任务读取最终状态，不按更新事件计数；
- 模板降级进入成功并单独披露，Unknown 不伪装为 0 或失败前成功；
- 删除、关系周期重置、同日重建、迟到和重跑规则完整；
- 默认 k=10、最多两个维度、Wilson 95% 区间、13 个月期限和差分防护完整；
- Q01/Q02 因缺少 Accepted 研究合同保持 UNAVAILABLE；
- 10 个固定 fixtures 和 40 个验证场景 ID 唯一；
- 与 MVP、状态机、领域模型、数据库、API、ADR-0005、Privacy Data Map 和 S-24 无冲突；
- PR 只包含文档与项目控制更新，不包含 SDK、Schema、API、Prisma、migration、查询任务、Dashboard、生产配置或真实数据；
- 本文只有在用户确认后转为 Accepted。

## 20. 审核记录

- 状态：Draft；
- 接受日期：待用户确认；
- 内容 PR：[Draft PR #30](https://github.com/WeiHan1996/DailyEnergy/pull/30)；
- 待确认范围：主指标、激活/活跃/cohort、23 个指标、D1/D3/D7、帮助度、任务、降级、成本、小样本、研究缺口、40 个验证场景和 Production Gates；
- 下一任务：S-26 实验规范；S-25 被接受前不提前开始。
