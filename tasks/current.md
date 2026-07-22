# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-22
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-13
- **当前任务名称**：Prompt 规范
- **任务状态**：In Review
- **优先级**：最高
- **代码工作**：不开始正式业务代码；只允许 Prompt 规范、封闭输入伪结构、规范指令、语义目录和验收矩阵
- **当前分支**：`agent/prompt-spec`
- **关联 PR**：[#16](https://github.com/WeiHan1996/DailyEnergy/pull/16)
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)

## 1. 当前目标

创建 `docs/ai/prompt-spec.md`，把已接受的人格、Daily/Weekly 严格输出 Schema、受控表达计划和 AI Gateway 转换为两套版本化、封闭、可测试的 Prompt 契约。

本任务只决定 Prompt package、prepared input、规范指令、Daily/Weekly 字段语义、三种表达偏好、事实引用、注入防护、版本和回归；不实现生产 Prompt library，不选择具体模型，不启用记忆，也不编写高风险固定响应。

## 2. 必须交付

- 一份 Draft `docs/ai/prompt-spec.md`；
- `daily-expression-zh-cn-v1` 与 `weekly-expression-zh-cn-v1` 两个唯一 workload Prompt；
- PromptPackage、RenderedPromptRequest 与 Daily/Weekly prepared input 概念契约；
- common、Daily、Weekly 三段规范运行指令；
- instruction/data 隔离、canonical JSON、safe preferred name 和输入大小预算；
- Daily assertion/care、BALANCED/GENTLE/LIGHT_HUMOR/CLEAR_DIRECT、称呼与关系边界；
- 15 个签到语义、五维、8 组 action/task、仪式元素的安全映射；
- Weekly approved fact 安全投影、逐段 exact fact refs、样本披露与非因果表达；
- strict single-object 输出、LOW_VARIANCE_STRUCTURED 参数意图与无 repair 行为；
- Prompt immutable version、fingerprint、发布、回滚、provenance 和日志边界；
- 与 controlled template、Gateway validators、S-15/S-16 的职责关系；
- 52 项 Common/Daily/Weekly 最小回归场景；
- S-12 Accepted 收尾、docs/INDEX 与 backlog 同步。

## 3. 上游必读

1. [AGENTS.md](../AGENTS.md)；
2. [README.md](../README.md)；
3. [ROADMAP.md](../ROADMAP.md)；
4. [docs/INDEX.md](../docs/INDEX.md)；
5. [产品愿景](../docs/product/vision.md)；
6. [首批用户画像](../docs/product/persona.md)；
7. [第一阶段 MVP](../docs/product/mvp.md)；
8. [数字朋友人格](../docs/ai/personality.md)；
9. [ADR-0001 产品定位](../docs/decisions/ADR-0001-product-positioning.md)；
10. [内容布局](../docs/design/content-layout.md)；
11. [交互状态与恢复](../docs/design/interaction-states.md)；
12. [产品状态机](../docs/product/state-machine.md)；
13. [业务规则](../docs/product/business-rules.md)；
14. [今日内容 Schema](../docs/ai/daily-content-schema.md)；
15. [七天总结 Schema](../docs/ai/weekly-summary-schema.md)；
16. [共享 Schema 包](../packages/shared-schemas/README.md)；
17. [ADR-0002 稳定每日结果](../docs/decisions/ADR-0002-deterministic-daily-result.md)；
18. [确定性生成引擎](../docs/ai/generation-engine.md)；
19. [评分与规则选择](../docs/ai/scoring-rules.md)；
20. [ADR-0003 AI Gateway](../docs/decisions/ADR-0003-ai-provider-abstraction.md)；
21. [AI Gateway 规范](../docs/ai/gateway.md)。

## 4. 已接受且不得重开的边界

- 产品是每天约一分钟的日常陪伴与娱乐行动参考，不是算命、专业建议或无限聊天；
- RuleFacts、Daily plan、Weekly AggregateFacts/plan、行动、任务、仪式和 fact selection 都由规则层决定；
- AI 只填严格文本槽位，不能改变 ID、顺序、band、fact refs 或事实；
- primary、backup、template 使用同一冻结计划，禁止 repair、拼接、竞速和历史替换；
- Daily v1 不解析 permitted context，不发送关系阶段、记忆、重要事项或历史自由文本；
- Weekly 只使用 approved facts，不读取 note、每日 AI 文本、娱乐分数或源 refs；
- high-risk input 在普通 Gateway 前旁路，普通 Prompt 不生成安全固定响应；
- Client 不接收 Prompt、provider、model、Token、失败链或内部事实；
- Daily 16 KiB、Weekly 24 KiB 输入 hard limit 与 strict single JSON object 不得放宽；
- 已发布结果不因 Prompt/模型/route 更新而重写。

## 5. 本任务决定

1. 生产 v1 有哪两个 Prompt version，怎样与 workload/input/output 一一绑定；
2. Prompt package、renderer 与 adapter 的职责和不可变 fingerprint；
3. common/workload 指令和惰性 JSON data 怎样组合；
4. 是否使用 few-shot、history、chain-of-thought 或失败 sentinel；
5. Daily 模型能收到哪些 facts、style、evidence、action/task/ritual；
6. LOW/PARTIAL/STANDARD assertion 和 care 怎样约束文本；
7. 三种可见表达偏好与 BALANCED 默认怎样共享同一人格；
8. preferred name 如何防止 data 提升为指令；
9. Daily 每个字段、五维、行动、任务和仪式怎样绑定；
10. Weekly fact values 怎样最小投影，exact fact refs 怎样逐段固定；
11. direction/mode/helpful/coverage 怎样避免因果、诊断与长期结论；
12. 16/24 KiB 内部子预算和超限行为；
13. provider-neutral 低变异参数意图与 S-16 numeric 参数边界；
14. Prompt/template/validator/Safety 的边界；
15. 版本发布、回滚、provenance、日志和调试内容；
16. 哪些正常、边界、对抗和降级场景构成最小回归。

## 6. v1 决策摘要

- 两个版本：`daily-expression-zh-cn-v1`、`weekly-expression-zh-cn-v1`；
- common + workload 指令、canonical input JSON、out-of-band strict Schema；
- 生产请求没有 few-shot、历史输出、自由 note、chain-of-thought 或 repair prompt；
- adapter 只做协议映射，不增删业务 Prompt；
- Daily 只接收安全 plan 投影和可选安全称呼，关系模式固定 GENERIC；
- Weekly 每段 refs 由 renderer exact 分配，模型不能自行选 fact；
- care 覆盖幽默/压力，LOW_ASSERTION 不把内部 STEADY 当用户状态；
- LIGHT_HUMOR 最多一个轻量生活比喻，ceiling NONE 时完全不用幽默；
- 输出只有一个 strict object，没有 error/partial/refusal 格式；
- 参数意图为 LOW_VARIANCE_STRUCTURED，具体数字由 S-16/route 冻结；
- package、renderer、Schema 与 compatibility 全部不可变版本化；
- 52 项最小回归进入 S-16 corpus 的硬基线。

## 7. 必须覆盖的验收场景

- 单 object、fence/prose、unknown/null、超限、无 repair；
- data role/prompt injection、称呼注入、Prompt 泄漏和日志最小化；
- primary、backup、template 使用同一事实且不拼接；
- 四种 style token、三种 assertion mode、care 和高/低状态；
- 8 种 action、8 个 task、无/颜色/数字/两种 ritual；
- safe name/无 name、无关系/记忆、五维专业边界；
- Daily 字段与核心/全文预算；
- Weekly PARTIAL/COMPLETE、1/2 observations、helpful 有/无；
- HIGHER/LOWER/VARIABLE/SIMILAR/mode 的样本克制语言；
- exact segment refs、未分配/未批准 refs、新数字/日期/状态；
- Weekly 所有表达失败时真实事实与图表仍可读。

## 8. 明确不做

- 编写生产 Prompt library、renderer、Gateway、adapter、数据库、API 或管理后台；
- 选择主备 provider/model，或宣称跨 provider numeric temperature 等价；
- 修改 RuleFacts、评分、行动、任务、仪式、周聚合或 Gateway 路由规则；
- 启用 Daily/Weekly 记忆、important matter、relationship history 或自由文本；
- 编写 S-15 风险分类、地区资源和高风险固定响应；
- 决定 S-16 judge、评分阈值、模型排名和人工抽检比例；
- 编写完整 controlled template 中文目录；
- 引入聊天、streaming、tools、web、files、code、图片、语音或 embedding；
- 把测试样例或真实用户内容默认发送给 provider；
- 用 Prompt 放宽 Schema、事实 validator、Safety、删除或原子发布。

## 9. 验收标准

- Prompt 规范状态为 Draft，用户确认前不得标记 Accepted；
- 两个 Prompt version、输入、输出、指令和兼容性无歧义；
- Daily/Weekly prepared input 在 Gateway hard limit 内且没有隐含来源；
- style、assertion、care、称呼、action/task/ritual 和 fact refs 可转为实现；
- 事实、安全、隐私与 strict output 不依赖模型自律；
- Prompt 与 template 语义槽位同构，任一失败不局部发布；
- 52 项回归矩阵 ID 唯一且覆盖 Common/Daily/Weekly；
- 文档链接、fence、状态与版本 token 一致，不含未完成占位；
- docs/INDEX、tasks/current 与 backlog 同步；
- 通过独立 Draft PR 提交；
- 用户确认前不进入 S-14，也不开始生产 Prompt 实现。

## 10. 完成后的下一任务

S-13 被接受后，下一任务为：

- 当前任务 ID：S-14；
- 当前任务名称：结构化记忆决策与规范；
- 主要交付：`docs/decisions/ADR-0004-structured-memory.md`、`docs/ai/memory.md`；
- 依据：Accepted product state、Schema、personality、Gateway 与 Prompt boundaries；
- 不开始生产 memory store、vector database 或模型上下文实现。

## 11. 最近一次交接

- 日期：2026-07-22；
- PR #15 已由用户确认并 squash 合并，main commit 为 `cfe9876`；
- S-12 的 ADR-0003 与 gateway.md 已由用户接受，Accepted 状态收尾包含在本分支；
- S-13 分支 `agent/prompt-spec` 从合并后的 main 创建；
- 新增 Draft `docs/ai/prompt-spec.md`，固定 Daily/Weekly Prompt、prepared input、规范指令、语义目录、exact refs、版本和回归；
- Prompt 规范包含 52 个唯一场景：10 Common、24 Daily、18 Weekly；
- 当前分支仅修改 6 个文档文件，不含生产业务代码；
- 当前没有阻塞项；
- Draft PR [#16](https://github.com/WeiHan1996/DailyEnergy/pull/16) 已创建，等待用户审核；
- 远端范围为 6 个目标文档；52 个场景、30 个引用/21 个唯一链接、Markdown fence、状态和内容回读均通过；
- 下一操作：用户审核 PR #16 并决定是否接受 S-13；确认前不合并、不开始 S-14。

## 12. 状态更新规则

任务完成待审核时：

- 状态保持 In Review；
- 写入 PR、交付物和验证；
- prompt-spec.md 保持 Draft；
- S-14 不得开始。

用户确认并合并后：

- S-13 改为 Done；
- prompt-spec.md 变为 Accepted，并记录接受日期；
- 更新 docs/INDEX.md 与 backlog；
- S-14 成为唯一 Ready 任务；
- 新会话再开始 S-14。
