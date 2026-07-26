# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-26
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-25
- **当前任务名称**：指标唯一口径
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/metrics-definition`
- **上游 PR**：[S-24 PR #29](https://github.com/WeiHan1996/DailyEnergy/pull/29)
- **当前 PR**：待创建
- **交付文件**：`docs/analytics/metrics.md`

## 1. 当前目标

把 Accepted 的 MVP 决策门槛、领域事实和 S-24 事件合同转换为唯一、可审计的指标口径，明确：

- 首次漏斗、激活、Core Active、D1/D3/D7 和首周关系深度；
- 点亮、晚间反馈、帮助度、任务、七天回望和分享意图；
- AI 生成时延、模板降级、成本和记录完整性；
- cohort、成熟窗口、产品日期、Unknown、删除、重建和 revision；
- 小样本、Wilson 区间、维度、分组、保存与访问；
- “不像鸡汤”“它记得我”为何仍需独立研究合同；
- S-26/S-27 与 S-29/S-31/S-33/C-015 怎样接续。

## 2. 必须交付

### 2.1 指标合同

- 23 个正式指标、4 个硬 Gate、2 个研究指标；
- 唯一名称、目的、分子、分母、窗口、来源、状态和目标/读法；
- D1 核心回访留存为主指标，不合成“用户价值分”；
- 激活、CoreActiveUserDay、ActivationCycle、MatureCohort 和 EvaluableResultDay 定义；
- 客户端 best-effort 信号不冒充唯一用户转化。

### 2.2 隐私、删除与质量

- D1/D3/D7 只在第一方 T0 权威查询临时跨日 join，不保存 cohort membership；
- T4 默认 `k=10`、最多两个批准维度、匿名聚合最长 13 个月；
- 比例显示分子/分母与 Wilson 95% 区间；
- 模板降级仍算完整成功并单独披露；
- Unknown 不填 0，删除/关系周期重置/同日重建/迟到/重跑有固定语义；
- Safety、DataTask 与 PRODUCT 指标无 join path。

### 2.3 验证与下游

- 10 个固定 fixtures；
- 40 个唯一验证场景；
- T0 source views、留存查询和最终状态查询的验收语义；
- Q01/Q02 在研究 Schema、PDM、期限和删除接受前保持 UNAVAILABLE；
- S-26 不提前创建个体实验分配；
- S-27 前不发布小红书/抖音、素材或活动级留存；
- S-29/S-31/S-33/C-015 完成实现 Gate 前不发布生产 KPI。

## 3. 上游读取顺序

1. `AGENTS.md`、`README.md`、`ROADMAP.md`、`docs/INDEX.md`、本文；
2. `docs/product/vision.md`、`journey.md`、`mvp.md`；
3. `docs/product/state-machine.md`、`business-rules.md`；
4. `docs/data/domain-model.md`；
5. `docs/technical/database.md`、`api.md`；
6. `docs/decisions/ADR-0002-deterministic-daily-result.md`；
7. `docs/decisions/ADR-0005-data-retention-and-deletion.md`；
8. `docs/operations/privacy-data-map.md`；
9. `docs/ai/gateway.md`、`safety.md`；
10. `docs/analytics/event-tracking.md`；
11. `docs/analytics/metrics.md`。

## 4. 已冻结边界

- D1/D3/D7 以当前关系周期首个有效点亮为 D0，并要求 Dx 精确日期存在有效 EncounterLink；
- 关系中断不惩罚；三日/七日完整点亮只作观察，不改变产品状态；
- `day_lit` 不自动等于有帮助、活跃或自然回访；
- `daily_result_read` 不自动等于完整阅读；
- `share_intent_created` 不自动等于分享成功；
- `notification_deeplink_resolved` 不自动等于自然回访；
- helpfulness/task 使用截止时最终状态，不按 update 事件次数；
- Analytics 不是业务事实，不可反向影响路由、关系、Safety、通知或删除；
- 当前没有生产 analytics API、聚合器、Dashboard、研究问卷或渠道归因合同。

## 5. 不做

- 不创建 analytics API、SDK、Prisma、migration、queue、worker、Dashboard 或生产配置；
- 不接入第三方 analytics、广告、归因、实验、录屏或 session replay；
- 不建立 user/device/session/cross-day subject 或 raw event store；
- 不创建问卷字段、自由文本研究事件或用户级研究 join；
- 不定义个体实验 assignment、显著性或停止规则；
- 不定义小红书/抖音素材、活动或归因窗口；
- 不按 expression style、签到值、事项、Safety 或 provider 做产品留存切片；
- 不提前开始 S-26。

## 6. 验收标准

- `metrics.md` 为 Draft，包含 23 个指标、4 个 Gate、2 个研究指标、10 个 fixtures 和 40 个验证场景；
- 指标、Gate、fixture、场景 ID 唯一；
- 所有相对链接可解析；
- MVP 初步目标均映射到一个唯一口径或明确 UNAVAILABLE；
- D1/D3/D7、成熟窗口、删除、降级、Unknown、k=10、两维上限、Wilson 与 13 个月一致；
- S-24 根据用户确认转为 Accepted，backlog 为 Done；
- README、INDEX、tasks/current 和 backlog 一致标记 S-25 In Review；
- PR 仅包含 6 个 Markdown 文件，无业务代码、Schema、API、数据库或真实配置；
- 用户确认前 `metrics.md` 保持 Draft，S-25 保持 In Review。

## 7. 最近交接

- [PR #29](https://github.com/WeiHan1996/DailyEnergy/pull/29) 已于 2026-07-26 合并，S-24 已获用户明确确认；
- `event-tracking.md` 在本分支补记 Accepted/接受日期，不改事件合同内容结论；
- S-25 Draft 已冻结 D1 主指标、ActivationCycle、CoreActiveUserDay、成熟 cohort 和最终状态口径；
- 已定义 23 个正式指标、4 个硬 Gate、2 个研究指标、10 个 fixtures 和 40 个验证场景；
- Q01/Q02 在独立研究合同接受前保持 UNAVAILABLE；
- S-26 实验、S-27 渠道归因与 S-29/S-31/S-33/C-015 实现仍是后续任务；
- 当前动作：创建并等待用户审核 S-25 Draft PR；不自动接受或合并，不开始 S-26。
