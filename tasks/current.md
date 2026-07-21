# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-21
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-11
- **当前任务名称**：规则引擎规范
- **任务状态**：In Progress
- **优先级**：最高
- **代码工作**：不开始正式业务代码；允许规范、规则表、伪代码和确定性测试用例
- **当前分支**：`agent/rule-engine-spec`
- **关联 PR**：待创建
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)
- **完整 Backlog**：[tasks/backlog.md](./backlog.md)

## 1. 当前目标

创建 `docs/ai/generation-engine.md` 与 `docs/ai/scoring-rules.md`，把冻结的 GenerationInputSnapshot、已接受的 result manifest 和 ADR-0002 确定性协议转换为唯一 RuleFacts、候选集合与受控模板选择，使不同实现对相同输入和版本得到相同规则事实。

本任务只定义可实现、可复算的规则契约，不实现日期服务、TypeScript 规则包、API、数据库、缓存、队列、前端、AI Gateway 或 Prompt。

## 2. 必须交付

- 一份 Draft `generation-engine.md`，定义输入、处理阶段、输出、版本、失败与降级边界；
- 一份 Draft `scoring-rules.md`，定义五维、整体档位、重点排序、行动、任务与仪式规则；
- GenerationInputSnapshot 的允许字段、规范化、缺失值和不可变语义；
- `pace`、`action`、`connection`、`resources`、`recovery` 五维的 0～100 整数算法；
- LOW / STEADY / HIGH 的版本化阈值、整体分数与中性标签 token；
- `focus_dimension_id`、supporting、care 与完整 `display_order` 的确定性规则；
- 主要行动候选、可选任务、仪式元素和模板 variant 的资格与 canonical order；
- 所有具名 choice namespace、tie-break、rejection sampling 与候选为空时的处理；
- rule、algorithm、catalog、template 与 result manifest 的版本和 provenance 关系；
- RuleFacts 与 ExpressionPayload、客户端视图、关系状态和任务状态的边界；
- 模板降级需要的受控语义槽位，但不编写 Prompt 或开放式 AI 文案；
- 正常、缺失、边界、并列、版本变化、非法输入和降级的确定性验收用例；
- 对 S-12 AI Gateway、S-13 Prompt、S-16 评价、S-17～S-20 数据与接口以及 Phase 2 C-006/C-007 的约束。

## 3. 上游必读

1. [AGENTS.md](../AGENTS.md)；
2. [README.md](../README.md)；
3. [ROADMAP.md](../ROADMAP.md)；
4. [docs/INDEX.md](../docs/INDEX.md)；
5. [产品愿景](../docs/product/vision.md)；
6. [首批用户画像](../docs/product/persona.md)；
7. [MVP 用户旅程](../docs/product/journey.md)；
8. [第一阶段 MVP](../docs/product/mvp.md)；
9. [数字朋友人格](../docs/ai/personality.md)；
10. [ADR-0001 产品定位](../docs/decisions/ADR-0001-product-positioning.md)；
11. [产品状态机](../docs/product/state-machine.md)；
12. [业务规则](../docs/product/business-rules.md)；
13. [今日内容 Schema](../docs/ai/daily-content-schema.md)；
14. [晚间反馈 Schema](../docs/ai/evening-feedback-schema.md)；
15. [七天总结 Schema](../docs/ai/weekly-summary-schema.md)；
16. [共享 Schema 包](../packages/shared-schemas/README.md)；
17. [ADR-0002 稳定每日结果](../docs/decisions/ADR-0002-deterministic-daily-result.md)；
18. [ADR-0002 测试向量](../docs/decisions/adr-0002-test-vectors.json)。

## 4. 已接受且不得重开的边界

- 产品定位是日常陪伴与娱乐参考，不是算命、诊断、投资或法律判断；
- 产品日期固定由 `Asia/Shanghai` 04:00 和服务端 `product-date-v1` 决定；
- 根种子只由六个 LP32 字段组成，业务输入不得偷偷加入 seed；
- 使用 SHA-256 `seed-v1`、具名 `choice-v1` 和无偏 rejection sampling；
- 已保留 `focus.tie.v1`、`action.tie.v1`、`ritual.color.v1`、`ritual.number.v1`、`template.variant.v1`；
- 每个新 namespace 必须版本化登记，候选 canonical order 不得依赖数据库或对象偶然顺序；
- 五维稳定 ID、canonical order 和安全语义已经接受；
- 内部可以保存 0～100 整数，客户端不得接收原始分数或伪精确预测；
- 规则引擎独占 RuleFacts 写入权，AI 只能表达，不能改分数、排序、行动或仪式事实；
- 每个已发布结果只有一个主要行动和一个不可变可选任务定义；
- 关系节点、用户任务状态和晚间反馈属于外部组合状态，不写入不可变 RuleFacts；
- 同一用户同一产品日只发布一个结果，版本升级不重写历史，DAY 删除不自动复活；
- Safety、Deleting 和账户阻断优先，日期、种子或降级不得绕过；
- 已发布对象必须完整通过 Schema 与安全校验，不允许局部拼接或 AI 补事实。

## 5. 本任务必须推荐并决定

1. 签到 mood、energy、sleep 及有效上下文怎样映射为五维整数信号；
2. 所有权重、基准值、调整上限、clamp 和舍入采用什么整数规则；
3. 整体分数与 LOW / STEADY / HIGH 阈值如何计算并版本化；
4. 同分时怎样选择 focus、supporting、care 和展示顺序；
5. 行动候选怎样筛选、去重、排序并用具名 choice 选出唯一行动；
6. 可选任务怎样保持更低或相同负担，并避免与主要行动重复；
7. COLOR / NUMBER 仪式元素何时为空、何时出现以及候选目录顺序；
8. 模板 variant 和受控语义槽位怎样由相同 RuleFacts 确定；
9. 输入缺失、`UNKNOWN`、非法枚举、候选为空和版本不匹配时如何 fail closed；
10. 规则、算法、目录、模板与 result_version manifest 怎样原子冻结；
11. 哪些 provenance、解释依据和调试信息只保留服务端；
12. 哪些 golden cases 足以让 TypeScript 和其他语言独立复算。

## 6. 必须覆盖的验收场景

- 每一种合法签到枚举和“说不准”输入；
- 低精力、睡眠一般、稳定状态及信号相互冲突；
- 可达分数 0、算法上界 clamp 100 和每个档位阈值的前后边界；
- 五维全并列、部分并列和唯一最高/最低；
- 相同输入、seed 和 manifest 重复执行得到逐字段相同 RuleFacts；
- 同一 manifest 内额外计算已登记但本次未消费的 namespace，不改变既有具名选择；registry 变化必须升级版本；
- 候选顺序、目录版本或算法语义改变时必须升级对应版本；
- 一个候选、多个候选、候选过滤后为空和 rejection counter 递增；
- 主要行动、可选任务和仪式引用都指向合法稳定 ID；
- RuleFacts 不包含关系卡、任务完成态、晚间反馈或 AI 文风字段；
- 原始分数和内部解释依据不会进入 ClientDailyContentView；
- 非法输入、未知版本和不完整 manifest 不调用 AI 猜测，按规范失败或安全默认；
- 模板降级与 AI 表达使用同一 RuleFacts，不改变核心行动；
- 历史 result_version 使用原 manifest，不因当前目录升级重算。

## 7. 明确不做

- 修改 ADR-0002 的日期、seed、choice、唯一性、历史或删除决策；
- 编写生产规则引擎、日期服务、共享运行时包或数据库迁移；
- 设计 API 路径、错误码、表结构、缓存键、队列和事务；
- 选择 AI 供应商、模型、超时、重试、熔断或成本策略；
- 编写 Prompt、人格文案、完整模板文案或前端展示文案；
- 完成 S-15 内容安全分类、S-14 结构化记忆或 S-16 质量评价；
- 实现微信小程序、管理后台、通知、埋点或页面组件；
- 用星座、八字、塔罗、日期吉凶或未经授权的个人数据参与评分；
- 依据尚未发生的用户实验偷偷调权重或创建隐藏版本。

## 8. 验收标准

- 两份规范状态为 Draft，用户确认前不得标记 Accepted；
- 任一合法输入与 manifest 都能按有限步骤得到唯一 RuleFacts；
- 所有分数、阈值、排序和选择均使用明确整数或字节级规则；
- 五维、行动、任务、仪式与模板候选都有稳定 ID 和 canonical order；
- namespace、规则、算法、目录和 result_version 之间无隐含版本；
- 正常、边界、并列、非法输入与降级都有确定期望；
- 输出满足已接受 Schema，AI 和客户端不能覆盖内部事实；
- 不重新决定日期、种子、唯一性、历史冻结或删除；
- 文档索引、tasks/current.md 和 backlog 同步；
- 通过独立 Draft PR 提交；
- 用户确认前不进入 S-12，也不开始生产实现。

## 9. 完成后的下一任务

S-11 被接受后，下一任务为：

- 当前任务 ID：S-12；
- 当前任务名称：AI Gateway 决策与规范；
- 主要交付：ADR-0003、docs/ai/gateway.md；
- 依据：Accepted RuleFacts、result manifest、Schema 与稳定生成规则；
- 不开始生产 AI Gateway 实现。

## 10. 最近一次交接

- 日期：2026-07-21；
- PR #13 已由用户确认，本提交完成 S-10 接受收尾；
- ADR-0002 已标记为 Accepted，73 个确定性断言保持通过；
- S-10 已标记为 Done，S-11 已设为唯一 Ready 任务；
- S-11 已在 `agent/rule-engine-spec` 分支启动，PR 待创建；
- 当前没有正式前端、后端、数据库或 AI 业务实现；
- 当前没有阻塞项；
- 下一操作：完成两份 Draft 规范、确定性测试向量和控制文件同步，验证后创建独立 Draft PR。

## 11. 状态更新规则

任务开始时：

- Ready → In Progress；
- 创建独立分支并记录 PR；
- 不改变任务范围。

任务受阻时：

- 状态改为 Blocked；
- 写明缺失决定、负责人和解锁条件；
- 不通过猜测继续。

任务完成待审核时：

- 状态改为 In Review；
- 填写 PR、交付物和验证；
- 下一任务仍不得开始。

用户确认并合并后：

- 状态改为 Done；
- generation-engine.md 与 scoring-rules.md 变为 Accepted；
- 更新 docs/INDEX.md；
- 从 Backlog 选择唯一下一任务；
- 将下一任务设为 Ready。
