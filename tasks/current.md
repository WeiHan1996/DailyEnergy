# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-22
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-12
- **当前任务名称**：AI Gateway 决策与规范
- **任务状态**：In Review
- **优先级**：最高
- **代码工作**：不开始正式业务代码；只允许 ADR、规范、接口伪结构、策略表和验收矩阵
- **当前分支**：`agent/ai-gateway-spec`
- **关联 PR**：[#15](https://github.com/WeiHan1996/DailyEnergy/pull/15)
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)
- **完整 Backlog**：[tasks/backlog.md](./backlog.md)

## 1. 当前目标

创建 `docs/decisions/ADR-0003-ai-provider-abstraction.md` 与 `docs/ai/gateway.md`，把已接受的 RuleFacts、Daily/Weekly ExpressionPlan、严格输出 Schema 和降级边界转换为唯一的服务端 AI 调用与失败编排规范。

本任务只决定 Gateway、provider adapter、route manifest、primary/backup/template、超时、熔断、成本、隐私、验证与可观测性；不实现生产 Gateway，不编写 Prompt 全文，不选择未经评测的具体供应商/模型，也不设计数据库或外部 API。

## 2. 必须交付

- 一份 Proposed ADR-0003，决定统一服务端 Gateway 与供应商隔离；
- 一份 Draft `gateway.md`，定义 Daily / Weekly 两个 workload；
- Gateway、orchestrator、provider adapter、template、validator 与 publish service 的职责边界；
- 不可变 route manifest、精确 model ID、capability、data handling、timeout、cost 与 compatibility 关系；
- primary → backup → controlled template 的有限顺序和禁止竞速/拼接规则；
- invocation、route snapshot、attempt、candidate 和 outcome 的概念契约；
- Daily / Weekly 输入最小化、大小上限和严格结构化输出；
- timeout、取消、未知 provider outcome、幂等、并发胜者和迟到响应语义；
- infrastructure / quality breaker、限流、容量隔离和 budget state；
- candidate 的结构、事实绑定、人格、隐私、Safety 与 projection 校验顺序；
- provider error / output failure / budget / lifecycle 的稳定内部 reason；
- secret、provider retention、raw request/response、日志、trace、usage 和成本边界；
- route 发布、canary、紧急禁用、回滚和 adapter conformance；
- 正常、降级、超时、结构越界、熔断、成本、并发、删除与隐私验收矩阵；
- 对 S-13～S-20、S-25、S-29、S-31、S-33 和 AI-001～AI-006 的约束。

## 3. 上游必读

1. [AGENTS.md](../AGENTS.md)；
2. [README.md](../README.md)；
3. [ROADMAP.md](../ROADMAP.md)；
4. [docs/INDEX.md](../docs/INDEX.md)；
5. [产品愿景](../docs/product/vision.md)；
6. [第一阶段 MVP](../docs/product/mvp.md)；
7. [数字朋友人格](../docs/ai/personality.md)；
8. [ADR-0001 产品定位](../docs/decisions/ADR-0001-product-positioning.md)；
9. [交互状态与恢复](../docs/design/interaction-states.md)；
10. [产品状态机](../docs/product/state-machine.md)；
11. [业务规则](../docs/product/business-rules.md)；
12. [今日内容 Schema](../docs/ai/daily-content-schema.md)；
13. [七天总结 Schema](../docs/ai/weekly-summary-schema.md)；
14. [共享 Schema 包](../packages/shared-schemas/README.md)；
15. [ADR-0002 稳定每日结果](../docs/decisions/ADR-0002-deterministic-daily-result.md)；
16. [确定性生成引擎](../docs/ai/generation-engine.md)；
17. [评分与规则选择](../docs/ai/scoring-rules.md)；
18. [S-11 测试向量](../docs/ai/s11-test-vectors.json)。

## 4. 已接受且不得重开的边界

- 产品是日常陪伴与娱乐行动参考，不是算命、诊断、投资或法律工具；
- 规则引擎独占 RuleFacts，AI 不得改分数、档位、排序、行动、任务、仪式或周事实；
- Daily/Weekly plan 是模型和 template 的封闭输入边界；
- primary、backup、template 必须返回同构完整 payload，任一段失败不局部发布；
- 同一用户同一产品日期只有一份 AVAILABLE 每日结果，历史不因模型恢复重写；
- Weekly 表达失败不遮挡真实记录、计数和图表；
- Safety、Deleting、账户与日期窗口优先，high-risk 退出普通娱乐流程；
- Client view 不接收 provider、model、Prompt、Token、成本、失败或审核元数据；
- v1 Daily 不解析 permitted context，Weekly 不读取晚间 note、AI 文本或娱乐分数；
- 完整 template 是正式 F2 路径，不是临时错误拼接；
- F3 表示上下文减少，不表示 provider failure；
- 已发布结果使用当时 provenance，模型文本不承诺字节级确定。

## 5. 本任务必须推荐并决定

1. 是否允许业务模块直连模型，Gateway 的唯一边界是什么；
2. provider adapter 可以和不能承担哪些职责；
3. route manifest 如何冻结 provider、model、参数、能力、数据处理和兼容性；
4. exact provider/model 是否写死在 ADR，怎样通过 S-16 评测后发布；
5. primary、backup 与 template 是顺序还是并行，最多调用几次；
6. Daily / Weekly 的 hard deadline、单 route deadline 和 template reserve；
7. 429/5xx、timeout、protocol、Schema、事实、安全失败是否重试或切换；
8. 是否允许 JSON repair、Markdown 提取、模型修复或跨尝试拼接；
9. 结构化输出、事实绑定、人格、隐私与 Safety 的验证顺序；
10. infrastructure / quality breaker 的 key、阈值、half-open 与状态故障行为；
11. input/output size、Token、per-invocation cost、global budget 与并发上限；
12. duplicate attempt、unknown provider outcome、迟到响应和并发 candidate 如何处理；
13. template 怎样预检、版本化且不依赖模型失败内容；
14. request/response、invalid raw output、Prompt、usage、trace 和日志保存什么；
15. route 怎样 staged、canary、emergency disable、rollback 且不重写历史；
16. 哪些故障注入与隐私测试足以进入 S-13 和后续实现。

## 6. v1 决策摘要

- 所有普通 AI 调用只通过服务端 `ExpressionGateway`；
- 业务只依赖 provider-neutral 契约，只有 adapter 依赖 provider SDK；
- 路由使用 immutable manifest，不允许 `latest` 或同版本换 model；
- 具体 provider/model 由 S-16 bake-off 后进入 route manifest，不写死在业务 ADR；
- primary、backup、template 严格顺序执行，禁止 hedge/race；
- 每个 provider role 最多一次调用，总 provider calls 最多两次；
- Daily 8 秒、Weekly 20 秒总 hard deadline，并保留 template/local validation 预算；
- provider 失败或 candidate 失败直接进入下一完整路径，不在同角色盲重试；
- 只接受单个严格 JSON object，禁止 fence stripping、宽松解析、字段修补和跨路径拼接；
- template 在付费调用前 preflight，并使用同一 frozen plan；
- infrastructure 与 output quality 使用独立 breaker，breaker 状态不可用时 fail closed 到 template；
- budget hard stop、route concurrency full 或 price catalog 无效时跳过 provider，template 不受影响；
- invalid raw output 默认不持久保存，日志/指标只记录脱敏元数据；
- high-risk input 不进入普通 Gateway，candidate unsafe 只拒绝该完整候选；
- Gateway 只返回 candidate，最终唯一性和原子发布仍由 publish service 负责。

## 7. 必须覆盖的验收场景

- primary 正常、backup 正常、template 正常的三条完整路径；
- primary timeout/429/5xx/protocol/structure/fact/safety 失败；
- backup 继续使用原 frozen plan，不读取 primary 输出；
- all AI fail 但 Daily template 可用；Weekly summary FAILED 但 facts 可读；
- JSON 前后文本、Markdown fence、unknown field、null、URL、HTML、emoji 和超长输出；
- AI 修改 action/task/ritual/dimension 或 Weekly 引用未批准 fact；
- LOW_ASSERTION/低状态下越界断言、幽默或压力；
- route manifest 缺失、fingerprint mismatch、latest、model drift 和 incompatibility；
- primary/backup 同故障域时不能误报 provider-level redundancy；
- 5 连败、20 次窗口、quality breaker、half-open 和 auth invalid；
- breaker state 不可用、cost hard stop、price missing、concurrency full；
- duplicate attempt、unknown outcome、late response、并发发布胜者；
- Safety、Deleting、DAY 删除、window closed 和 existing result 中止在途链路；
- provider request 不含 ID、seed、score、source refs、notes 和 permitted context；
- invalid raw output、Prompt、称呼、secret 和 expression 不进入普通日志；
- route canary、rollback 和紧急禁用不改变历史。

## 8. 明确不做

- 编写 NestJS Gateway、provider adapters、Redis breaker、BullMQ 或数据库；
- 创建外部 API 路径、表结构、缓存 key 或精确错误码；
- 编写 S-13 Prompt 全文、模板完整中文或风格句式库；
- 决定 S-14 结构化记忆、S-15 high-risk 分类或固定安全资源；
- 在没有 S-16 corpus 与评测时宣称某个模型是最终主/备；
- 保存或分析用户原始模型输入/无效输出；
- 引入 streaming、tools、web、files、code、embedding、图片、语音或开放聊天；
- 自研/自托管模型、多区域微服务或智能动态模型竞价；
- 为提高成功率放宽 Schema、修补 JSON、拼段或绕过 template reserve；
- 修改 ADR-0002 的日期、seed、唯一性、历史和删除决定。

## 9. 验收标准

- ADR 为 Proposed、gateway.md 为 Draft，用户确认前不标记 Accepted；
- 组件职责、依赖方向和禁止直连 provider 明确；
- Daily/Weekly 输入、输出、版本、大小和 failure isolation 明确；
- route manifest、attempt、candidate 与 outcome 可以无歧义转换为实现；
- primary/backup/template 的次数、顺序、deadline、取消与降级有限；
- candidate 全链路严格校验，不存在 repair 或 partial publish；
- breaker、rate、budget、cost、concurrency 和 unknown outcome 有精确行为；
- secret、retention、raw body、provenance、日志和指标边界明确；
- route 发布、model drift、rollback 和故障域边界明确；
- 正常、异常、生命周期、成本和隐私矩阵可转为自动测试；
- 文档索引、tasks/current.md 和 backlog 同步；
- 通过独立 Draft PR 提交；
- 用户确认前不进入 S-13，也不开始生产 Gateway 实现。

## 10. 完成后的下一任务

S-12 被接受后，下一任务为：

- 当前任务 ID：S-13；
- 当前任务名称：Prompt 规范；
- 主要交付：`docs/ai/prompt-spec.md`；
- 依据：Accepted personality、Schema、RuleFacts/plan、ADR-0003 与 gateway.md；
- 不开始生产 Prompt library 或模型调用实现。

## 11. 最近一次交接

- 日期：2026-07-22；
- PR #14 已由用户确认并 squash 合并，main commit 为 `9db8672`；
- S-11 的 generation-engine、scoring-rules 和 test vectors 已获接受，状态收尾包含在本分支；
- S-12 分支 `agent/ai-gateway-spec` 已从合并后的 main 创建；
- 新增 Proposed ADR-0003 与 Draft `gateway.md`，覆盖 Daily/Weekly workload、immutable route manifest、顺序主备/模板、严格输出、8/20 秒预算、两类熔断、成本、隐私、可观测性和 route 发布；
- Draft PR [#15](https://github.com/WeiHan1996/DailyEnergy/pull/15) 已创建，等待用户审核；
- 远端范围复核为 8 个目标文件，无生产业务代码；S-11 fixture JSON 可解析，21 个仓库链接全部可读；
- Markdown 结构、任务生命周期和 37 项故障注入场景校验通过；无 TODO/TBD；
- 当前没有正式前端、后端、数据库或 AI Gateway 实现；
- 当前没有阻塞项；
- 下一操作：用户审核 PR #15 并决定是否接受 S-12；确认前不标记 Accepted、不合并、不开始 S-13。

## 12. 状态更新规则

任务完成待审核时：

- 状态改为 In Review；
- 写入 PR、交付物和验证；
- ADR 保持 Proposed、gateway.md 保持 Draft；
- S-13 不得开始。

用户确认并合并后：

- S-12 改为 Done；
- ADR-0003 与 gateway.md 变为 Accepted，并记录接受日期；
- 更新 docs/INDEX.md 与 backlog；
- S-13 成为唯一 Ready 任务；
- 新会话再开始 S-13。
