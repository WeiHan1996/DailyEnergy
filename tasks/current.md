# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-26
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-24
- **当前任务名称**：埋点事件字典
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/event-tracking`
- **上游 PR**：[S-23 PR #28](https://github.com/WeiHan1996/DailyEnergy/pull/28)
- **当前 PR**：[Draft PR #29](https://github.com/WeiHan1996/DailyEnergy/pull/29)
- **交付文件**：`docs/analytics/event-tracking.md`

## 1. 当前目标

把 Accepted 的页面、状态机、业务规则、API、隐私、保存删除、Gateway 和 Safety 边界转换为可实现的最小事件合同，明确：

- 哪些核心完成事实从权威业务对象派生；
- 哪些页面行为只能作为 best-effort 客户端信号；
- 事件名称、版本、平面、触发、属性与基数；
- PRODUCT、RUNTIME、GOVERNANCE、SAFETY_CONTROL 怎样隔离；
- T0 临时投影怎样形成不可识别、不可复原的 T4 日聚合；
- 小样本、维度、保存、访问、删除和第三方 Gate；
- S-25 指标、S-26 实验、S-27 归因与 S-29/S-33 实现如何接续。

## 2. 必须交付

### 2.1 事件合同

- 58 个唯一逻辑事件；
- 每个事件有唯一 ID、`event_name`、平面、权威触发、生产者和属性 allowlist；
- 区分权威事实、服务端投影和客户端信号；
- 重复、Unknown outcome、revision、离线、迟到和重放规则；
- 事件名称与版本变更协议。

### 2.2 隐私与存储

- 不建立 user/device/session/cross-day subject；
- 不建立 raw event 表、队列、日志、对象或第三方 SDK；
- T0 只在当前请求/聚合计算期间存在；
- T4 默认 `k=10`，最多两个批准维度；
- 第一方匿名日聚合最长 13 个自然月；
- 普通 analytics 永远不接收自由文本、Safety 原文、Prompt、provider body、内部 refs、签到值或用户级状态序列。

### 2.3 质量与下游

- 48 个唯一验证场景；
- 每日数据质量与 contract Gate；
- Safety / DataTask 与普通增长漏斗无 join path；
- S-25 负责指标唯一口径，不把事件自动等同指标；
- S-27 前不使用素材或渠道级留存；
- S-29/S-31/S-33/C-015 完成 Schema、入口、聚合、RBAC、TTL、匿名化与可观测性后才可生产启用。

## 3. 上游读取顺序

1. `AGENTS.md`、`README.md`、`ROADMAP.md`、`docs/INDEX.md`、本文；
2. `docs/design/information-architecture.md`、`screen-specs.md`；
3. `docs/product/state-machine.md`、`business-rules.md`；
4. `docs/decisions/ADR-0002-deterministic-daily-result.md`；
5. `docs/technical/api.md`、`error-codes.md`、`openapi/openapi.yaml`；
6. `docs/operations/privacy-data-map.md`；
7. `docs/decisions/ADR-0005-data-retention-and-deletion.md`；
8. `docs/ai/gateway.md`、`docs/ai/safety.md`；
9. `docs/operations/incident-response.md`。

## 4. 已接受边界

- Analytics 不是业务事实来源，丢失或错误不能改变路由、关系、通知、删除或 Safety；
- 产品日期由 `Asia/Shanghai` 04:00 的 `product-date-v1` 服务端解析；
- high-risk 输入只进入固定 Safety 路径，不进入普通 analytics；
- UUID、HMAC、opaque ref 和去标识 token 仍可能是个人信息，不能冒充匿名；
- mood、energy、sleep、evening note、事项、支持文本和 AI 正文不能进入普通分析；
- command 成功、资源最终完成、分享 intent、通知 SENT、Safety recovery 含义必须区分；
- 删除或撤回造成的数据缺口可以保留，不能为补指标恢复已删事实；
- 当前没有用户级 analytics API、SDK、model、event table 或合法第三方处理合同。

## 5. 不做

- 不创建 analytics API、SDK、Prisma、migration、queue、worker、Dashboard 或生产配置；
- 不接入第三方 analytics、广告、归因、实验、录屏或 session replay；
- 不定义 D1/D3/D7、活跃、漏斗、成本和帮助度的最终公式；
- 不定义个体实验 assignment；
- 不定义小红书/抖音素材、活动与归因窗口；
- 不采集用户、设备、session、IP、精确时间线或页面坐标；
- 不把 Safety、删除、支持、incident 记录接到普通增长分析；
- 不提前开始 S-25。

## 6. 验收标准

- `event-tracking.md` 为 Draft，包含 4 个平面、58 个事件与 48 个验证场景；
- 58 个事件 ID、名称唯一，48 个验证场景 ID 唯一；
- 所有相对链接可解析；
- 事件属性全部为封闭低基数 allowlist；
- 权威事实、服务端投影、客户端信号可靠性和去重语义明确；
- T0/T4、k=10、两维上限、13 个月与第一方位置一致；
- 用户级 event stream、raw 持久化、第三方 SDK 与自动采集明确关闭；
- S-23 根据用户确认转为 Accepted，backlog 为 Done；
- README、INDEX、tasks/current 和 backlog 一致标记 S-24 In Review；
- PR 仅包含 6 个文档文件，无业务代码、Schema、API、数据库或真实配置；
- 用户确认前 `event-tracking.md` 保持 Draft，S-24 保持 In Review。

## 7. 最近交接

- [PR #28](https://github.com/WeiHan1996/DailyEnergy/pull/28) 已于 2026-07-26 合并，S-23 已获用户明确确认；
- `incident-response.md` 在本分支补记 Accepted/接受日期，不改事件响应内容结论；
- S-24 Draft 已冻结“无用户级 event stream、无第三方 SDK、事实优先、客户端信号受限”的分析架构；
- 已定义 PRODUCT、RUNTIME、GOVERNANCE、SAFETY_CONTROL 四个隔离平面；
- 已定义 58 个逻辑事件、T0/T4 合同、k=10、最多两个维度、13 个月上限和 48 个验证场景；
- D1/D3/D7、实验、渠道归因与具体实现仍分别由 S-25～S-27、S-29/S-31～S-33/C-015 负责；
- 当前动作：等待用户审核 [Draft PR #29](https://github.com/WeiHan1996/DailyEnergy/pull/29)；不自动接受或合并，不开始 S-25。
