# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-22
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-16
- **当前任务名称**：AI 质量评价与回归测试
- **任务状态**：In Progress
- **优先级**：最高
- **代码工作**：不开始正式业务代码；只允许评价 Gate、版本化测试语料、候选参数、人工盲评、延迟/成本与变更触发的概念契约
- **当前分支**：`agent/ai-evaluation-spec`
- **关联 PR**：待创建
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)

## 1. 当前目标

创建 Draft `docs/ai/evaluation.md` 与 `docs/ai/evaluation-corpus.json`，把人格、Schema、事实、Gateway、Prompt、Memory、Safety、provider bake-off、人工评价、延迟和成本转换为一套不可相互补偿、可复现、可审计的发布 Gate。

本任务建立“怎样证明候选可用”，不宣布某个模型为生产 primary/backup，不实现 evaluator、classifier、负载工具、人工抽检系统、数据库或生产配置。

## 2. 必须交付

- Draft `docs/ai/evaluation.md`；
- Draft 可机读 `docs/ai/evaluation-corpus.json`；
- 37 Gateway + 52 Prompt + 48 Memory + 60 Safety 上游场景的固定来源与完整继承；
- 72 个 S-16 新增场景，分为事实/契约、人格/状态/行动、风格/语气、重复度/关系、对抗/隐私、运行/供应商六组；
- 269 个唯一 case ID、source blob SHA、版本与 manifest fingerprint 规则；
- `CORPUS_INTEGRITY → DETERMINISTIC_HARD → SAFETY_STATISTICS → OPERATIONAL → HUMAN_QUALITY → ROUTE_DECISION` 层级；
- Schema、事实、refs、memory、Safety、privacy、route、template 的 100% hard gate；
- 每个适用生成 case、每个 candidate parameter set 三次独立 sample；
- Safety sentinel 100% 与扩大专业标注集 recall/FPR/Wilson bound；
- 10 维人格 rubric、每份双人盲评、分歧裁决、一致性与最低质量阈值；
- controlled template 成对基线、7-day 重复度和关系边界；
- 三个 `STAGED` provider candidate 的 exact API/model/parameter 语义，不选择 winner；
- Daily/Weekly 角色延迟、错误计数、成本资格与 failure-domain 规则；
- EvaluationRun、证据权限、变更触发与重跑矩阵；
- S-15 Accepted 收尾、docs/INDEX 与 backlog 同步。

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
10. [产品状态机](../docs/product/state-machine.md)；
11. [业务规则](../docs/product/business-rules.md)；
12. [今日内容 Schema](../docs/ai/daily-content-schema.md)；
13. [晚间反馈 Schema](../docs/ai/evening-feedback-schema.md)；
14. [七天总结 Schema](../docs/ai/weekly-summary-schema.md)；
15. [共享 Schema 包](../packages/shared-schemas/README.md)；
16. [ADR-0002 稳定每日结果](../docs/decisions/ADR-0002-deterministic-daily-result.md)；
17. [确定性生成引擎](../docs/ai/generation-engine.md)；
18. [评分与规则选择](../docs/ai/scoring-rules.md)；
19. [ADR-0003 AI Gateway](../docs/decisions/ADR-0003-ai-provider-abstraction.md)；
20. [AI Gateway 规范](../docs/ai/gateway.md)；
21. [Prompt 规范](../docs/ai/prompt-spec.md)；
22. [ADR-0004 结构化记忆](../docs/decisions/ADR-0004-structured-memory.md)；
23. [结构化记忆规范](../docs/ai/memory.md)；
24. [内容安全规范](../docs/ai/safety.md)。

## 4. 已接受且不得重开的边界

- 事实由确定性引擎产生，AI 只表达，不创建分数、标签、行动、任务、日期或因果；
- provider 只能返回一份完整严格结构化对象，不 repair、不 splice、不 race；
- 普通顺序固定为 primary → backup → controlled template，每 role 最多一次；
- Daily 8 秒、Weekly 20 秒硬预算继续有效；
- v1 Daily/Weekly memory slot 为空，历史自由文本不进入模型；
- high-risk 直接 SAFE-001，普通 primary/backup/template 调用为 0；
- ordinary unsafe candidate 整份拒绝，不能删句或由模型自审后放行；
- Safety、Schema、事实、memory、privacy 和 route hard failure 不能被人格、延迟或成本分数抵消；
- controlled template 是完整第三路径，不是片段兜底；
- 真实用户敏感数据不用于本任务的 corpus 或普通评测日志；
- 用户状态、断签、失败和删除不能产生诊断、羞耻、恐惧、关系压力或付费诱导。

## 5. 本任务决定

1. 评价对象是整条发布路径而非单段文案；
2. corpus 的组成、稳定 ID、来源 SHA、版本和指纹；
3. 哪些指标是不可补偿 hard gate；
4. 每个 provider/case 为什么需要三次独立 sample；
5. Safety sentinel 与扩大专业标注集怎样分别使用；
6. recall/FPR 怎样用 Wilson 95% bound 判断样本是否足够；
7. 人格 10 维怎样评分，哪些维度为 hard；
8. 双人盲评、第三人裁决和评分者一致性；
9. AI 相对 controlled template 需要怎样的明确增益；
10. 7-day 重复度和关系连续性怎样测量；
11. LLM-as-judge 只能做什么、绝不能决定什么；
12. provider 候选怎样固定 exact model/API/parameter；
13. Daily/Weekly 各 role 的 p95/p99 资格线；
14. 价格变化、token 计量和临时成本资格线；
15. primary/backup 的独立 failure-domain；
16. EvaluationRun 需要固定哪些系统/模型/区域/价格/人工证据；
17. 变更怎样触发全量或目标重跑；
18. 什么情况只能保持 template-only；
19. 为什么 S-16 不能授予 production ACTIVE；
20. S-17/S-18/S-21/S-22/S-23/S-25/S-29/S-31/S-33 的实施交接。

## 6. v1 决策摘要

- corpus 固定为 269 case：37 Gateway、52 Prompt、48 Memory、60 Safety、72 S-16；
- 72 个新 case 六组各 12 个；
- Gate 严格分层，不计算能隐藏 hard failure 的加权总分；
- 每个适用 MODEL case × candidate 独立运行三次，任一次 hard failure 即失败；
- facts、Schema、refs、memory、Safety、privacy、route 与 template 要求 100%；
- Safety sentinel 100%；扩大集每类 recall ≥0.98 且 Wilson lower ≥0.95，普通 hard-negative FPR ≤0.02 且 Wilson upper ≤0.04；
- 人格每候选至少 120 份输出、每份两名盲评者，第三人裁决关键分歧；
- 平均总分 ≥17/20，第 10 百分位 ≥15/20，四个 hard 维度无 0；
- AI 对 controlled template 成对偏好 ≥60%，Wilson lower >50%，否则保留模板；
- LLM judge 必须校准且只能提供辅助提示；
- 三个 provider candidate 均为 STAGED，执行前重新核验，不设置 production winner；
- primary/backup 必须分别完整合格且 failure domain 独立；
- 每个 candidate × workload × role 至少 30 cold +100 warm 延迟样本；
- 成本在 hard/quality 后评估，价格 unknown 时不能激活；
- EvaluationRun 固定 corpus、commit、Schema、Prompt、Safety、模型、参数、region、price 和人工证据。

## 7. 必须覆盖的验收场景

- 同 facts 三次 sample 与跨 provider 比较保持事实/输入指纹；
- 8 类 action、Weekly 缺失、UNKNOWN/UNSURE、高分低状态和 v1 空 memory；
- provider refusal、部分输出、超时、迟到、unsafe candidate 与双 provider 失败；
- 三种 style 的事实不变、盲辨识、same-persona、长度和注入；
- very-low mood、empty energy、poor sleep、未完成/无帮助反馈与无刻板推断；
- 7-day duplicate、4-gram、generic opening、关系 Day 1/3/7、中断与删除记忆；
- role/XML/JSON 注入、称呼/事项注入、high-risk 规避、否定/引用 hard negative、混合语言；
- prompt/provider/seed/debug 泄漏、跨用户 ref、日志扫描与敏感推断；
- exact parameter drift、三次证据完整性、Daily/Weekly latency、成本和 failure domain；
- inherited 37+52+48+60 场景逐一保留且来源可追溯。

## 8. 明确不做

- 调用真实 provider、产生 API 费用或读取 API key；
- 决定/上线 primary、backup 或 ACTIVE route；
- 实现生产 evaluator、classifier、judge、负载平台、CI、数据库、API 或页面；
- 修改业务 Schema、Prompt 生产库、Gateway、template 或 Safety 代码；
- 使用真实用户输入、Safety 原文、历史 note 或生产日志建集；
- 声称完成专业 Safety、资源、法务、采购、数据处理或网络审批；
- 建立运营抽检、危机值班、事故响应或成本告警；
- 用公开 benchmark 或模型品牌代替项目 corpus；
- 用人工/LLM 修补失败输出或删除失败 sample；
- 为评测方便启用 memory、history、tools、web、streaming 或 provider store。

## 9. 验收标准

- `evaluation.md` 与 corpus 保持 Draft，用户确认前不得 Accepted；
- 269 个唯一 ID，来源数量恰好 37/52/48/60/72；
- 上游 case 固定 path、blob SHA、section、scenario 与 expected；
- S-16 六组各 12 个且 metadata 完整；
- hard/Safety/operational/human/route 层级无补偿；
- 三次 MODEL、120 份双盲、Wilson bound、重复度和延迟成本阈值可实现；
- provider 只为 STAGED，无 winner/ACTIVE；
- controlled template 与 v1 empty memory 边界保持不变；
- EvaluationRun 与变更触发可复现；
- 文档、JSON、链接、状态、来源和生命周期一致；
- S-15 Accepted、docs/INDEX、tasks/current 和 backlog 同步；
- Draft PR 不含生产代码、Schema、数据库或模型调用。

## 10. 完成后的下一任务

S-16 被接受后，下一任务为：

- 当前任务 ID：S-17；
- 当前任务名称：领域模型；
- 主要交付：`docs/data/domain-model.md`；
- 依据：S-05～S-09、S-14 及本次评测对版本/refs/Safety revision 的实施交接；
- 不开始数据库、Prisma、retention 或 API 实现。

## 11. 最近一次交接

- 日期：2026-07-22；
- PR #18 已由用户确认并 squash 合并，main commit 为 `edae9976`；
- S-15 `safety.md` 已由用户接受，Accepted 状态收尾包含在本分支；
- S-16 分支 `agent/ai-evaluation-spec` 从该合并提交创建；
- 当前正在新增 Draft evaluation 规范与 269-case machine-readable corpus；
- 三个 provider 仅为当日 STAGED 候选快照，未运行、未付费、未选择 production winner；
- 当前没有生产 evaluator、classifier、provider config、API、数据库或业务 Schema 改动；
- 关联 Draft PR 待创建；
- 下一操作：完成远端逐字回读、JSON/链接/数量/来源校验后创建 Draft PR，等待用户审核。

## 12. 状态更新规则

任务完成待审核时：

- 状态改为 In Review；
- 写入 PR、交付物和最终验证；
- evaluation 文档与 corpus 保持 Draft；
- S-17 不得开始。

用户确认并合并后：

- S-16 改为 Done；
- evaluation 文档与 corpus 变为 Accepted，并记录接受日期；
- 更新 docs/INDEX.md 与 backlog；
- S-17 成为唯一 Ready 任务；
- 新会话再开始 S-17。

