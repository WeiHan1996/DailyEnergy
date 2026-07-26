# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-26
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-26
- **当前任务名称**：实验规范
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/experiments-spec`
- **上游 PR**：[S-25 PR #30](https://github.com/WeiHan1996/DailyEnergy/pull/30)
- **当前 PR**：[Draft PR #31](https://github.com/WeiHan1996/DailyEnergy/pull/31)
- **交付文件**：`docs/analytics/experiments.md`

## 1. 当前目标

把 Accepted 的事件与指标合同转换为可预注册、可停止、可复盘的实验规则，明确：

- 不可实验的 Safety、隐私、删除、同意、稳定事实和非操纵边界；
- 合成评测、可用性测试、发布批次和产品日期 switchback 的适用范围；
- Alpha 与 50～100 人种子 Beta 的样本、成熟窗口和结论强度；
- 唯一主指标、G01～G04 硬 Gate、护栏、最小有意义变化与停止规则；
- 为什么个人随机 assignment 在 PDM 和工程合同变更前保持 Blocked；
- S-27、S-29、S-31、S-33 与 C-015 怎样接续。

## 2. 必须交付

### 2.1 实验合同

- 实验生命周期、registry 字段、不可变 revision 和五种结论；
- 每个实验恰好一个 S-25 主指标，最多三个额外产品/运行护栏；
- G01～G04 任何失败立即 STOPPED_GUARDRAIL；
- 变体只改变一个可描述因素，CONTROL 不得故意劣化；
- 开始前冻结资格、单位、日历/窗口、MME、样本、成熟、分析和回滚。

### 2.2 样本与隐私

- Alpha 只验证可用性与数据来源，不宣称因果；
- 种子 Beta 一次最多一个改变核心体验的实验；
- v1 在线比较只允许发布批次或按产品日期 switchback；
- 不建立 assignment/exposure 表、SDK、cookie、设备 ref 或用户级事件历史；
- 个人随机 assignment 必须先更新 PDM、依据、期限、权利和删除传播；
- T4 继续使用 k=10、最多两个维度、Wilson 95% 区间和 13 个月上限。

### 2.3 验证与下游

- 10 个固定 fixtures；
- 32 个唯一验证场景；
- Unknown、模板降级、删除、暂停、回滚和同日历史不重抽；
- S-27 前不做渠道 × 实验 × 留存联接；
- S-29/S-31/S-33/C-015 完成实现 Gate 前不启用生产实验能力。

## 3. 上游读取顺序

1. `AGENTS.md`、`README.md`、`ROADMAP.md`、`docs/INDEX.md`、本文；
2. `docs/product/vision.md`、`mvp.md`；
3. `docs/ai/personality.md`、`safety.md`；
4. `docs/product/business-rules.md`；
5. `docs/decisions/ADR-0005-data-retention-and-deletion.md`；
6. `docs/operations/privacy-data-map.md`；
7. `docs/analytics/event-tracking.md`；
8. `docs/analytics/metrics.md`；
9. `docs/analytics/experiments.md`。

## 4. 已冻结边界

- 不实验 Safety、删除、必要同意、保存期、专业边界、稳定种子或本地模板降级；
- 不使用恐惧、坏运势、断签压力、羞辱或排他性关系提高指标；
- 主指标和分母在首个曝光后不可静默修改；
- 运行故障、Unknown 或未成熟 cohort 不能被解释为某变体失败；
- p 值不是自动上线开关，未达到预注册样本只能 INCONCLUSIVE；
- 已发布当日结果在暂停、回滚或变体切换后仍保持原版本；
- Analytics 和实验不能反向影响业务事实、Safety、通知或删除；
- 当前没有生产实验平台、feature flag、assignment model、Dashboard 或自动统计服务。

## 5. 不做

- 不创建 Schema、API、Prisma、migration、worker、SDK、assignment/exposure 表或用户级导出；
- 不接入第三方实验、analytics、广告、归因、录屏或 session replay；
- 不做个人/设备/session 随机、多臂老虎机、多因素或动态个性化实验；
- 不把 Safety、支持文本、研究答卷、签到值、事项或模型内部信息与实验联接；
- 不提前实现 S-27 的渠道参数、素材 registry 或归因窗口；
- 不自动发布实验胜者或修改生产配置。

## 6. 验收标准

- `experiments.md` 为 Draft，包含硬边界、方法、生命周期、registry、指标、样本、停止与回滚；
- 10 个 fixture 和 32 个场景 ID 唯一；
- 所有相对链接可解析；
- S-25 根据用户确认转为 Accepted，backlog 为 Done；
- README、INDEX、tasks/current 和 backlog 一致标记 S-26 In Review；
- PR 仅包含 6 个 Markdown 文件，无业务代码、Schema、API、数据库或真实配置；
- 用户确认前 `experiments.md` 保持 Draft，S-26 保持 In Review。

## 7. 最近交接

- [PR #30](https://github.com/WeiHan1996/DailyEnergy/pull/30) 已于 2026-07-26 合并，S-25 已获用户明确确认；
- `metrics.md` 在本分支补记 Accepted/接受日期，不改变指标合同内容；
- S-26 Draft 已冻结不可实验边界、四类证据方法和个人 assignment Blocked；
- 已定义一个主指标、G01～G04、样本/停止规则、10 个 fixtures 和 32 个验证场景；
- S-27 渠道归因与 S-29/S-31/S-33/C-015 实现仍是后续任务；
- 当前动作：等待用户审核 [Draft PR #31](https://github.com/WeiHan1996/DailyEnergy/pull/31)；不自动接受或合并。
