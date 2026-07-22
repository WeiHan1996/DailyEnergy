# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-22
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-15
- **当前任务名称**：内容安全规范
- **任务状态**：In Review
- **优先级**：最高
- **代码工作**：不开始正式业务代码；只允许 Safety 分类、固定响应、资源、恢复、输出审核与验收矩阵的概念契约
- **当前分支**：`agent/content-safety-spec`
- **关联 PR**：[#18](https://github.com/WeiHan1996/DailyEnergy/pull/18)
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)

## 1. 当前目标

创建 Draft `docs/ai/safety.md`，把“高风险内容退出普通运势流程”转换为独立输入分类、最高优先级 Safety 覆盖、SAFE-001 固定响应、地区资源、受控恢复、普通专业边界与全候选输出审核契约。

本任务决定什么必须检查、哪些情况属于普通低状态/专业边界/高风险、高风险命中后各领域命令和在途生成怎样停止、固定响应与现实资源怎样组合、怎样解除产品覆盖，以及 ordinary AI/template 产生不安全表达时怎样拒绝；不实现生产 classifier、Safety service、数据库、API、页面或人工危机团队。

## 2. 必须交付

- Draft `docs/ai/safety.md`；
- `CLEAR_FOR_DECLARED_USE / PROFESSIONAL_BOUNDARY / HIGH_RISK / INDETERMINATE` 顶层输入决策；
- `SELF_HARM_OR_SUICIDE`、`HARM_TO_OTHERS`、`MEDICAL_EMERGENCY`、`IMMEDIATE_PHYSICAL_DANGER` 四类 high risk；
- 普通结构化低状态与 high risk 的明确分离；
- preferred name、evening note、important matter、support description 四个 MVP 检查面；
- must-trigger + dedicated classifier 的封闭契约与故障行为；
- high-risk 普通 primary/backup/template 调用为 0 的硬不变量；
- Safety state 原子触发、epoch/revision、in-flight cancel、迟到丢弃和 publish-time guard；
- SAFE-001 固定响应块、zh-CN 审核候选、禁用内容与多类别合并；
- 地区资源注册表、来源核验、过期/禁用、离线快照与未知地区回退；
- 中国大陆 110/120/12356 基线、条件与优先级；
- ACTIVE → RECOVERY_PENDING → CLEAR 用户受控恢复；
- 非紧急医疗/心理、投资、法律、职场/关系专业边界；
- ordinary AI/template 完整候选 12 类硬拒绝；
- Memory、历史、通知、分享、日志、指标与受限审计边界；
- policy/classifier/response/resource/validator/client view 独立版本与发布 Gate；
- 60 项 Input/Entry/Route/Fixed/Output/Data 最小回归场景；
- S-14 Accepted 收尾、docs/INDEX 与 backlog 同步。

## 3. 上游必读

1. [AGENTS.md](../AGENTS.md)；
2. [README.md](../README.md)；
3. [ROADMAP.md](../ROADMAP.md)；
4. [docs/INDEX.md](../docs/INDEX.md)；
5. [产品愿景](../docs/product/vision.md)；
6. [首批用户画像](../docs/product/persona.md)；
7. [连续七天旅程](../docs/product/journey.md)；
8. [第一阶段 MVP](../docs/product/mvp.md)；
9. [数字朋友人格](../docs/ai/personality.md)；
10. [ADR-0001 产品定位](../docs/decisions/ADR-0001-product-positioning.md)；
11. [信息架构](../docs/design/information-architecture.md)；
12. [页面规格](../docs/design/screen-specs.md)；
13. [交互状态与恢复](../docs/design/interaction-states.md)；
14. [内容布局](../docs/design/content-layout.md)；
15. [产品状态机](../docs/product/state-machine.md)；
16. [业务规则](../docs/product/business-rules.md)；
17. [今日内容 Schema](../docs/ai/daily-content-schema.md)；
18. [晚间反馈 Schema](../docs/ai/evening-feedback-schema.md)；
19. [七天总结 Schema](../docs/ai/weekly-summary-schema.md)；
20. [共享 Schema 包](../packages/shared-schemas/README.md)；
21. [ADR-0002 稳定每日结果](../docs/decisions/ADR-0002-deterministic-daily-result.md)；
22. [确定性生成引擎](../docs/ai/generation-engine.md)；
23. [评分与规则选择](../docs/ai/scoring-rules.md)；
24. [ADR-0003 AI Gateway](../docs/decisions/ADR-0003-ai-provider-abstraction.md)；
25. [AI Gateway 规范](../docs/ai/gateway.md)；
26. [Prompt 规范](../docs/ai/prompt-spec.md)；
27. [ADR-0004 结构化记忆](../docs/decisions/ADR-0004-structured-memory.md)；
28. [结构化记忆规范](../docs/ai/memory.md)。

## 4. 已接受且不得重开的边界

- 产品是每天约一分钟的日常陪伴，不是开放聊天、专业建议、专业算命、心理治疗或危机服务；
- 运势/能量/幸运只用于娱乐、反思和日常行动参考，不能预测灾祸、疾病、死亡、破财、背叛或必然成功；
- 晨间 mood/energy/sleep、晚间状态、任务、帮助度与高风险分类保持独立；
- 单次低心情、低精力或睡眠不足不能推断自伤、疾病、心理障碍或长期状态；
- high-risk input 在普通 Gateway 之前旁路，普通 Prompt 不是风险分类器；
- Safety ACTIVE / RECOVERY_PENDING 跨日期并优先于缓存、深链、账户删除、维护和普通页面；
- SAFE-001 只使用审核过的固定响应与现实帮助，不调用生成式 AI；
- ordinary candidate unsafe 时整份丢弃，不修补、删句或跨 attempt 拼段；
- primary、backup、template 使用同一冻结普通输入；provider safety block 不能推翻产品 Safety；
- 记忆只来自真实、获准、可解释、可删除的结构化源；高风险原文不能变成记忆；
- 晚间 note 不进入普通 AI、周总结、长期记忆、通知、分享或 analytics；
- 通知、分享、客户端和普通日志默认最小化；
- 中断、删除、低分或任务未完成不能产生羞耻、恐惧、关系压力或付费诱导。

## 5. 本任务决定

1. 哪些文本入口必须先 Safety 后领域写入；
2. 顶层 decision 与 high-risk / professional 类别；
3. 普通低状态为什么不能自动成为 high risk；
4. must-trigger、classifier、policy resolver 的职责与上下文边界；
5. classifier 超时、未知输出和迟到响应如何 fail closed；
6. high risk 对 profile、feedback、matter、support 命令的原子副作用；
7. Safety state revision/epoch 怎样阻断在途普通生成；
8. SAFE-001 固定块、顺序、exact candidate copy 与禁止内容；
9. 多类别怎样确定 CTA 优先级且不显示风险分数；
10. 地区资源如何注册、核验、过期、禁用和离线回退；
11. 中国大陆 110/120/12356 在不同类别中的角色；
12. 客户端首屏、导航、返回、弱网与无障碍约束；
13. 用户如何受控开始恢复并解除产品覆盖；
14. 为什么 clear 不等于临床安全；
15. 非紧急专业内容允许什么、禁止什么；
16. ordinary candidate 的硬拒绝代码和路径行为；
17. Safety 与 memory、history、notification、share 的关系；
18. 最小 Safety event、ordinary telemetry 和受限审计；
19. 版本、发布 Gate、紧急禁用和完整回滚；
20. S-16 必须继承的 60 项硬测试。

## 6. v1 决策摘要

- 四个输入面逐字段检查，任一 high risk 使协调命令整体停止；
- 四个顶层 decision，不暴露 classifier confidence、关键词或诊断；
- 四个 high-risk category 可多选，紧急医疗/人身行动优先；
- must-trigger 命中时 classifier 故障仍进入 SAFE-001；其它 classifier 故障不保存文本；
- mood VERY_LOW / energy EMPTY / sleep POOR 单独不创建 Safety event；
- high risk 原子递增 Safety epoch，普通保存、resolver、Gateway、template、通知、分享为 0；
- SAFE-001 使用 7 个固定块和版本化资源，不生成长文、不追问危机细节；
- 中国大陆：110 报警、120 医疗急救、12356 心理援助；立即危险先 110/120；
- 地区未知时不猜 GPS/IP，用通用当地紧急服务和地区选择；
- MVP 不主动发送 Safety push，不自动联系亲友、医院、警方或读取通讯录/定位；
- recovery 需要两个独立显式用户意图与 revision guard，不由时间、点击电话或模型自动解除；
- ordinary candidate 有 12 类硬禁止，任何一类失败整份拒绝；
- Safety 原文不保存为 ordinary note/matter/memory/log/analytics；
- policy、rule、classifier、response、resource、validator、client view 各自版本化；
- 60 项硬场景进入 S-16，专业审核和评测阈值是实现发布 Gate。

## 7. 必须覆盖的验收场景

- 结构化最低状态仍普通；明确自伤/自杀、伤害他人、医疗急症、人身危险分别旁路；
- 否定、引用、历史、第三人称、混合语言、拆字/同音与注入不靠简单关键词判断；
- classifier 超时、未知 Schema、policy mismatch 和 late response；
- preferred name、evening note、matter、support 的 whole-command semantics；
- trigger 在 dispatch 前、provider 中、publish 前、缓存/深链/通知之后；
- ACTIVE 跨日、重启、离线、旧客户端、ACCOUNT DELETING 和多设备冲突；
- 四类 fixed response、多类别合并、中国大陆/海外/未知地区；
- registry/response 局部和整体失败、过期资源、链接失败；
- 医疗/心理、投资、法律、关系/职场专业越界；
- 灾祸预测、恐惧付费、停药、交易、法律结论、暴力协助、依赖、仇恨、隐私泄漏；
- primary unsafe → backup，template unsafe，validator unavailable；
- ACTIVE → RECOVERY_PENDING → CLEAR、新触发、多端 revision；
- Safety event/telemetry 无原文、点击不证明接通、clear 后不进入记忆/关系；
- immutable version、发布 Gate、紧急禁用与完整 rollback。

## 8. 明确不做

- 编写 classifier、Safety service、数据库/Prisma、Redis、队列、API、前端或后台；
- 选择模型/供应商、生产阈值、自动/人工评测比例；
- 上线 110/120/12356 配置或声称已完成专业评审；
- 建立人工危机值班、主动报警、外呼、联系亲友或现实机构联动；
- 读取定位、通讯录、短信、通话结果或健康记录；
- 保存 raw high-risk text、摘录、诊断、confidence 或 classifier rationale；
- 开放危机聊天、追问方法/计划/地点或提供临床评估；
- 发送 Safety push、营销召回、付费入口或关系挽留；
- 修改 Daily/Weekly v1 Prompt、Schema、Gateway route 或生产 template；
- 写 S-16 evaluation 阈值、S-18 retention、S-22 运营流程或 S-23 incident runbook；
- 为了安全扩大记忆、用户画像、跨用户或外部数据访问；
- 因用户 low state、断签、未完成或删除数据自动创建 Safety。

## 9. 验收标准

- `safety.md` 保持 Draft，用户确认前不得标记 Accepted；
- classification、state、fixed response、resource、recovery 和 output validator 可转为实现；
- high-risk ordinary provider/template call = 0 是明确可测试不变量；
- 低状态与 high risk、input high risk 与 output unsafe、专业边界与危机无混淆；
- 中国大陆资源角色正确且外部来源只作复核基线；
- Safety state 不被日期、缓存、深链、离线、删除或普通恢复绕过；
- clear 不表示“已安全”，且被取消的普通内容不补发；
- raw sensitive text 不进入 ordinary storage、memory、logs、analytics 或 provider；
- 60 个场景 ID 唯一并覆盖六组边界；
- 文档链接、状态、版本、下游职责与官方基线一致；
- ADR-0004/memory Accepted、docs/INDEX、tasks/current 与 backlog 同步；
- 通过独立 Draft PR 提交，不包含生产代码或资源上线。

## 10. 完成后的下一任务

S-15 被接受后，下一任务为：

- 当前任务 ID：S-16；
- 当前任务名称：AI 质量评价与回归测试；
- 主要交付：`docs/ai/evaluation.md` 与测试集；
- 依据：Accepted personality、schemas、Gateway、Prompt、memory 与 safety；
- 必须继承 S-13 的 52 项 Prompt、S-14 的 48 项 Memory 和 S-15 的 60 项 Safety 硬场景；
- 不开始生产 evaluator、classifier、provider bake-off 或人工抽检系统实现。

## 11. 最近一次交接

- 日期：2026-07-22；
- PR #17 已由用户确认并 squash 合并，main commit 为 `4b737b8`；
- S-14 ADR-0004 与 `memory.md` 已由用户接受，Accepted 状态收尾包含在本分支；
- S-15 分支 `agent/content-safety-spec` 从合并后的 main 创建；
- 新增 Draft `safety.md`，覆盖输入分类、四类 high risk、固定响应、地区资源、恢复、专业边界、输出审核、隐私和治理；
- Safety 规范包含 60 个唯一场景：10 Input、10 Entry、10 Route、10 Fixed、10 Output、10 Data/Recovery；
- 已核对中国大陆 110/120/12356 的当前政府/卫健公开资料，并将运行时资源保持为需复核的版本化注册表；
- 当前没有生产 classifier、Safety service、数据库、API、页面、资源配置或模型改动；
- 当前没有阻塞文档审核的事项；实现发布前仍必须完成专业评审、资源激活核验和 S-16 阈值；
- Draft PR [#18](https://github.com/WeiHan1996/DailyEnergy/pull/18) 已创建，等待用户审核；
- 远端范围为 6 个目标文档；60 个场景、34 个唯一相对链接、5 个外部参考、Markdown fence、生命周期状态、版本边界和逐字回读均通过；
- 当前没有配置 GitHub CI 状态检查；
- 下一操作：用户审核 PR #18 并决定是否接受 S-15；确认前不合并、不开始 S-16。

## 12. 状态更新规则

任务完成待审核时：

- 状态保持 In Review；
- 写入 PR、交付物和验证；
- safety.md 保持 Draft；
- S-16 不得开始。

用户确认并合并后：

- S-15 改为 Done；
- safety.md 变为 Accepted，并记录接受日期；
- 更新 docs/INDEX.md 与 backlog；
- S-16 成为唯一 Ready 任务；
- 新会话再开始 S-16。
