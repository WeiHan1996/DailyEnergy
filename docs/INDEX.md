# DailyEnergy 文档索引

- **文档状态**：Active
- **最后更新**：2026-08-05
- **当前阶段**：Phase 1 — 工程基础
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **当前任务**：[tasks/current.md](../tasks/current.md)

## 1. 使用方式

本文件是 DailyEnergy 的规范目录。

任何 AI Agent 或开发人员开始任务前：

1. 阅读 [AGENTS.md](../AGENTS.md)；
2. 阅读 [Agent Project Context](./agent/PROJECT_CONTEXT.md)；
3. 阅读 [tasks/current.md](../tasks/current.md)；
4. 运行 `pnpm agent:prepare <TASK_ID>`；
5. 实际读取命令返回的全部 required sources；
6. 阅读相关 Accepted ADR、Schema、接口、测试、fixtures 和附近代码。

若统一入口不可用或策略无效，按 AGENTS 中的完整恢复顺序回退。Project Context、
权威索引和命令摘要只负责导航，不能替代本索引中的权威原文。

不要从聊天记录猜测正式结论。如果聊天内容与仓库冲突，以仓库中的 Accepted 文档为准。

## 2. 状态定义

### 产品、AI、设计与技术文档

- **Planned**：已进入路线图，但尚未创建；
- **Draft**：正在编写或等待审核；
- **Accepted**：已经确认，是当前有效规范；
- **Implemented**：规范已经完成对应实现和验证；
- **Superseded**：被新文档或版本取代；
- **Deprecated**：仍保留历史，但不应继续使用。

### ADR

- **Proposed**：等待决策；
- **Accepted**：正式生效；
- **Rejected**：已评审但不采用；
- **Superseded**：被后续 ADR 取代；
- **Deprecated**：决策不再适用。

只有用户或明确授权的项目决策者可以把 Draft 或 Proposed 变为 Accepted。

### 项目控制文档

- **Draft**：新建或重大改版，等待审核；
- **Active**：当前生效并持续维护；
- **Archived**：不再用于当前工作，仅保留历史。

ROADMAP 属于长期计划，审核后使用 Accepted；AGENTS、INDEX 和 tasks 属于持续变化的控制文件，审核后使用 Active。

## 3. 冲突优先级

发生冲突时按以下顺序处理：

1. Accepted ADR；
2. 当前版本的 Accepted 产品、AI、设计、技术、安全和隐私规范；
3. API、数据与输出 Schema；
4. 自动化测试与验收样例；
5. tasks/current.md 中的当前任务范围；
6. tasks/backlog.md；
7. README 和 ROADMAP；
8. 聊天记录、临时草稿和未合并分支。

高优先级内容不一定更新得最晚。不能只按文件日期判断真相。

## 4. 项目控制文档

| 文件                                                                | 状态     | 作用                                    | 更新时机                 |
| ------------------------------------------------------------------- | -------- | --------------------------------------- | ------------------------ |
| [README.md](../README.md)                                           | Active   | 项目入口、定位和当前状态                | 阶段或入口变化           |
| [ROADMAP.md](../ROADMAP.md)                                         | Accepted | 长期阶段、交付物和退出门槛              | 里程碑或重大计划变化     |
| [AGENTS.md](../AGENTS.md)                                           | Active   | AI 与开发协作规则                       | 工作方式变化             |
| [docs/INDEX.md](./INDEX.md)                                         | Active   | 文档状态和依赖索引                      | 文档新增、接受或取代     |
| [tasks/current.md](../tasks/current.md)                             | Active   | 唯一当前任务和交接状态                  | 每个任务开始、进展和完成 |
| [tasks/backlog.md](../tasks/backlog.md)                             | Active   | 有序候选任务                            | 计划、优先级和依赖变化   |
| [docs/agent/PROJECT_CONTEXT.md](./agent/PROJECT_CONTEXT.md)         | Active   | Agent 稳定上下文导航，不复制权威结论    | 路由或入口变化           |
| [docs/agent/workflow.md](./agent/workflow.md)                       | Accepted | 上下文路由、Profile、分级验证与证据边界 | Agent 工作方式变化       |
| [docs/agent/authority-index.yaml](./agent/authority-index.yaml)     | Active   | 任务到 required sources 的版本化路由    | 任务类型或权威来源变化   |
| [docs/agent/validation-policy.yaml](./agent/validation-policy.yaml) | Active   | Profile、路径升级、命令和依赖策略       | Gate 或依赖变化          |

这些文件负责控制项目，不取代产品和技术规范。

## 5. 已接受产品基线

| 文件                                            | 状态     | 主要内容                                           | 上游                     |
| ----------------------------------------------- | -------- | -------------------------------------------------- | ------------------------ |
| [docs/product/vision.md](./product/vision.md)   | Accepted | 产品愿景、使命、价值、边界和成功表现               | 无                       |
| [docs/product/persona.md](./product/persona.md) | Accepted | 22～35 岁职场女性、小红书/抖音渠道、场景和招募标准 | vision                   |
| [docs/product/journey.md](./product/journey.md) | Accepted | 渠道触达到连续 7 天的完整旅程                      | vision、persona          |
| [docs/product/mvp.md](./product/mvp.md)         | Accepted | P0/P1 范围、验收标准、指标、Gate 和完成定义        | vision、persona、journey |

## 6. 已接受 AI 与决策基线

| 文件                                                                                                        | 状态     | 主要内容                                         | 上游                                   |
| ----------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------ | -------------------------------------- |
| [docs/ai/personality.md](./ai/personality.md)                                                               | Accepted | 数字朋友人格、表达风格、记忆语言和安全边界       | 产品基线                               |
| [docs/decisions/ADR-0001-product-positioning.md](./decisions/ADR-0001-product-positioning.md)               | Accepted | 定位为日常陪伴，而非算命工具                     | 产品与人格基线                         |
| [docs/decisions/ADR-0002-deterministic-daily-result.md](./decisions/ADR-0002-deterministic-daily-result.md) | Accepted | 产品日期、稳定种子、结果身份、历史冻结与删除边界 | state-machine、business-rules、schemas |

## 7. Phase 0B 计划文档

### 7.1 设计与交互

| 文件                                                                    | 状态     | 目的                                                                   | 主要依赖                          |
| ----------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- | --------------------------------- |
| docs/design/information-architecture.md                                 | Accepted | 页面层级、入口和导航                                                   | journey、mvp                      |
| docs/design/screen-inventory.md                                         | Accepted | 页面、弹层、系统状态清单                                               | information-architecture          |
| [docs/design/screen-specs.md](./design/screen-specs.md)                 | Accepted | 每页字段、操作和验收                                                   | screen-inventory                  |
| [docs/design/interaction-states.md](./design/interaction-states.md)     | Accepted | 加载、失败、降级、权限和恢复                                           | screen-specs                      |
| [docs/design/content-layout.md](./design/content-layout.md)             | Accepted | 今日内容、趋势和分享的信息层级                                         | personality、daily-content-schema |
| [docs/design/prototype-validation.md](./design/prototype-validation.md) | Accepted | [S-04 静态原型](../prototype/s04/README.md)、5～8 人测试计划和结果模板 | Accepted S-03 设计规格            |
| docs/design/visual-direction.md                                         | Planned  | D-001 品牌人格、视觉路线和最终方向                                     | Accepted 页面与交互规格           |
| docs/design/design-system.md                                            | Planned  | D-002 Variables、Design Tokens、组件、动效和无障碍                     | D-001、E-004                      |
| docs/design/core-flow-high-fidelity.md                                  | Planned  | D-003 核心流程八页及关键状态高保真索引                                 | D-002                             |
| docs/design/developer-handoff.md                                        | Planned  | D-004 可点击原型、验证结果、Frame ID 和视觉 QA 交付                    | D-003、prototype-validation       |
| docs/design/phase2-remaining-handoff.md                                 | Planned  | D-005 晚间、趋势、数据权利页面高保真、状态矩阵和开发交付               | D-004                             |

### 7.2 产品状态与 Schema

| 文件                                                                  | 状态     | 目的                             | 主要依赖                |
| --------------------------------------------------------------------- | -------- | -------------------------------- | ----------------------- |
| [docs/product/state-machine.md](./product/state-machine.md)           | Accepted | 用户、关系和每日体验状态         | journey、mvp            |
| [docs/product/business-rules.md](./product/business-rules.md)         | Accepted | 点亮、中断、跨日、提醒和删除规则 | state-machine           |
| [docs/ai/daily-content-schema.md](./ai/daily-content-schema.md)       | Accepted | 今日结构化结果和 AI 输出契约     | mvp、personality        |
| [docs/ai/evening-feedback-schema.md](./ai/evening-feedback-schema.md) | Accepted | 晚间反馈输入和输出               | journey、mvp            |
| [docs/ai/weekly-summary-schema.md](./ai/weekly-summary-schema.md)     | Accepted | 七天趋势和总结契约               | daily-content、feedback |
| [packages/shared-schemas](../packages/shared-schemas/README.md)       | Accepted | 可执行 Zod Schema                | 已接受 Schema 文档      |

### 7.3 稳定生成与 AI

| 文件                                                          | 状态     | 目的                                                                | 主要依赖                                              |
| ------------------------------------------------------------- | -------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| [docs/ai/generation-engine.md](./ai/generation-engine.md)     | Accepted | 稳定种子、版本、缓存、幂等和受控表达计划                            | state-machine、daily-content-schema、ADR-0002         |
| [docs/ai/scoring-rules.md](./ai/scoring-rules.md)             | Accepted | 五维分数、行动候选与七天真实记录聚合规则                            | generation-engine、weekly-summary-schema              |
| [docs/ai/s11-test-vectors.json](./ai/s11-test-vectors.json)   | Accepted | 每日与七天规则的跨语言 golden vectors                               | generation-engine、scoring-rules、shared-schemas      |
| [docs/ai/gateway.md](./ai/gateway.md)                         | Accepted | 供应商隔离、路由、超时、降级、熔断、成本与隐私                      | generation-engine、schemas、ADR-0003                  |
| [docs/ai/prompt-spec.md](./ai/prompt-spec.md)                 | Accepted | Prompt package、封闭输入、规范指令、事实绑定、版本与回归            | personality、schemas、gateway                         |
| [docs/ai/memory.md](./ai/memory.md)                           | Accepted | 领域源、用途授权、确定性投影、有效期、无源回退与删除                | persona、journey、personality、prompt                 |
| [docs/ai/safety.md](./ai/safety.md)                           | Accepted | 输入分类、专业边界、固定响应、地区资源、恢复与全候选审核            | vision、personality、schemas、gateway、prompt、memory |
| [docs/ai/evaluation.md](./ai/evaluation.md)                   | Accepted | 不可补偿 Gate、自动/人工评价、provider bake-off、延迟成本与变更回归 | personality、schemas、gateway、prompt、memory、safety |
| [docs/ai/evaluation-corpus.json](./ai/evaluation-corpus.json) | Accepted | 37+52+48+60+72 共 269 项版本化机器可读测试清单                      | gateway、prompt、memory、safety、evaluation           |

### 7.4 数据与接口

| 文件                                                        | 状态     | 目的                                                    | 主要依赖                                           |
| ----------------------------------------------------------- | -------- | ------------------------------------------------------- | -------------------------------------------------- |
| [docs/data/domain-model.md](./data/domain-model.md)         | Accepted | 领域上下文、聚合、实体、关系、唯一性、修订与失效        | state-machine、schemas、memory、safety、evaluation |
| [docs/technical/database.md](./technical/database.md)       | Accepted | PostgreSQL 表、索引、约束、事务、迁移和删除规格         | domain-model、ADR-0005                             |
| [prisma/schema.prisma](../prisma/schema.prisma)             | Accepted | Prisma ORM 7 / PostgreSQL 可执行结构草案                | database spec                                      |
| [docs/technical/api.md](./technical/api.md)                 | Accepted | 小程序、后端和后台接口契约                              | domain、schemas、database                          |
| [docs/technical/error-codes.md](./technical/error-codes.md) | Accepted | 错误、恢复和降级语义                                    | API、interaction-states                            |
| [openapi/openapi.yaml](../openapi/openapi.yaml)             | Accepted | OpenAPI 3 可执行路径草案                                | api.md                                             |
| [packages/api-client](../packages/api-client/README.md)     | Draft    | E-008 Public/Admin 生成客户端、mapper 与 drift 使用说明 | shared-schemas、OpenAPI、error-codes               |

### 7.5 数据分析、隐私与运营

| 文件                                                                                                | 状态     | 目的                                                           | 主要依赖                                              |
| --------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| [docs/analytics/event-tracking.md](./analytics/event-tracking.md)                                   | Accepted | 事件、属性、平面、匿名聚合与质量 Gate                          | information-architecture、state-machine、API、privacy |
| [docs/analytics/metrics.md](./analytics/metrics.md)                                                 | Accepted | 激活、D1/D3/D7、互动、运行、成本、小样本与研究 Gate 的唯一口径 | event-tracking                                        |
| [docs/analytics/experiments.md](./analytics/experiments.md)                                         | Accepted | 实验边界、方法、主指标、样本、停止、回滚与个人 assignment Gate | metrics                                               |
| [docs/analytics/channel-attribution.md](./analytics/channel-attribution.md)                         | Accepted | 小红书/抖音承接、来源令牌、首次触达、渠道指标与隐私 Gate       | event-tracking、metrics、experiments                  |
| [docs/operations/privacy-data-map.md](./operations/privacy-data-map.md)                             | Accepted | 数据、用途、位置、访问、保存、删除和用户权利                   | domain、database、API、ADR-0005                       |
| [docs/operations/content-moderation.md](./operations/content-moderation.md)                         | Accepted | 审核、抽检和申诉                                               | safety、evaluation、privacy                           |
| [docs/operations/user-support.md](./operations/user-support.md)                                     | Accepted | FAQ、支持、升级、用户权利摘要与受限访问                        | journey、privacy、moderation                          |
| [docs/operations/incident-response.md](./operations/incident-response.md)                           | Accepted | 故障和安全事件流程                                             | safety、privacy、moderation、support                  |
| [docs/operations/development-deployment-runbook.md](./operations/development-deployment-runbook.md) | Draft    | DEV publication、安装、发布、current reconciliation、回滚、secret 轮换与换机恢复 | deployment、testing、ADR-0007                         |

### 7.6 工程架构与交付

| 文件                                                                                                                                                                                                   | 状态        | 目的                                                                                     | 主要依赖                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [docs/technical/architecture.md](./technical/architecture.md)                                                                                                                                          | Accepted    | 系统上下文、运行时、事务、outbox/inbox、Worker 与故障恢复                                | Gateway、database、API、ADR-0006                              |
| [docs/technical/repository-structure.md](./technical/repository-structure.md)                                                                                                                          | Accepted    | Monorepo 目录、app/package/module、public exports 与依赖 Gate                            | architecture、ADR-0006                                        |
| [docs/technical/testing.md](./technical/testing.md)                                                                                                                                                    | Accepted    | 静态、单元、数据库、契约、端到端、恢复与 AI 测试矩阵；私有 Free 临时合并控制             | schemas、API、architecture、repository-structure              |
| [docs/technical/deployment.md](./technical/deployment.md)                                                                                                                                              | Accepted    | 环境、Compose、配置/密钥、release 容器与 TLS proxy 能力收敛、current reconciliation、发布、迁移、回滚、备份与恢复 | architecture、repository-structure、testing、privacy          |
| [docs/technical/observability.md](./technical/observability.md)                                                                                                                                        | Accepted    | 日志、Trace、指标、SLO、告警、Runbook 与 AI/基础设施成本                                 | metrics、Gateway、privacy、incident、architecture、deployment |
| [docs/technical/database-implementation.md](./technical/database-implementation.md)                                                                                                                    | Implemented | PostgreSQL 18 / Prisma 7、迁移、角色、seed、drift、SQL/TX 与恢复证据                     | database、testing、deployment、ADR-0005、Issue #44            |
| [tests/README.md](../tests/README.md)                                                                                                                                                                  | Active      | E-010 registry/harness 与 E-011 CI、artifact、SBOM/provenance 证据入口                   | testing、deployment、现有 DB/queue/API/Admin/miniapp evidence |
| [Phase 1](https://github.com/WeiHan1996/DailyEnergy/milestone/1) / [Phase 2](https://github.com/WeiHan1996/DailyEnergy/milestone/2) / [Phase 3](https://github.com/WeiHan1996/DailyEnergy/milestone/3) | Active      | 54 个 Issues 已按 15 / 22 / 17 绑定三个真实 Milestone；E-012 PR #133 已合并，真实演练完成并等待最终证据验收 | Accepted Phase 0B specs、E-012 Issue #50                      |

### 7.7 Phase Gate

| 文件                                                        | 状态     | 目的                                                                      | 主要依赖            |
| ----------------------------------------------------------- | -------- | ------------------------------------------------------------------------- | ------------------- |
| [docs/reports/phase-0b-gate.md](./reports/phase-0b-gate.md) | Accepted | 复核 Phase 0B 总退出门槛、端到端追踪、延后项、外部 Gate 与 E-001 开工合同 | S-01～S-34、ROADMAP |

## 8. 计划 ADR

| 文件                                                                                                     | 状态     | 决策主题                                                | 最晚完成点        |
| -------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------- | ----------------- |
| [ADR-0002-deterministic-daily-result.md](./decisions/ADR-0002-deterministic-daily-result.md)             | Accepted | 稳定种子、产品日期、历史不变与重生成                    | 规则引擎开发前    |
| [ADR-0003-ai-provider-abstraction.md](./decisions/ADR-0003-ai-provider-abstraction.md)                   | Accepted | AI Gateway 与供应商隔离                                 | AI Gateway 开发前 |
| [ADR-0004-structured-memory.md](./decisions/ADR-0004-structured-memory.md)                               | Accepted | 用途受限结构化记忆与不用向量库                          | 记忆开发前        |
| [ADR-0005-data-retention-and-deletion.md](./decisions/ADR-0005-data-retention-and-deletion.md)           | Accepted | 保存期限、删除、备份、受托方和受限证据                  | 数据库开发前      |
| [ADR-0006-monorepo-and-stack.md](./decisions/ADR-0006-monorepo-and-stack.md)                             | Accepted | pnpm/Turbo 单仓、运行时、框架、数据与版本治理           | 工程初始化前      |
| [ADR-0007-development-colocation-exception.md](./decisions/ADR-0007-development-colocation-exception.md) | Accepted | 临时 DEV 同机 PostgreSQL/Redis、私有 COS 与生产退出边界 | E-012 开工前      |

如果实际决策发生变化，应调整 ADR 名称和顺序，不为填满编号而创建无价值文档。

## 9. 实施阶段文档

Phase 1 开始后逐步增加：

- 变更日志；
- 环境与启动说明；
- 迁移记录；
- API 生成文档；
- 测试报告；
- 发布清单；
- Alpha 和 Beta 报告；
- 实验报告；
- 安全复盘；
- 性能和成本报告。

这些运行文档不能修改 Accepted 产品定位，只能记录实现和验证。

## 10. 文档依赖规则

- 下游文档不能隐式改变上游 Accepted 规范；
- 如果下游发现上游不可实现，先提出变更和影响；
- Schema 必须与产品词汇一致；
- 数据库和 API 不得创造产品未定义的状态；
- Prompt 不得突破人格和安全规范；
- 埋点不得采集隐私数据清单之外的信息；
- 代码和测试完成后同步更新对应文档状态；
- 被取代文档保留历史并指向新版本。

## 11. 文档完成定义

一份规范只有满足以下条件才能进入 Accepted：

- 目的和适用范围明确；
- 上游依赖已接受；
- 术语与现有文档一致；
- 正常、异常和边界行为完整；
- 有明确验收或决策标准；
- 与安全、隐私和 ADR 不冲突；
- 未决问题不会阻塞当前阶段；
- 已通过 PR 审核；
- 文档索引和当前任务已同步；
- 接受日期和状态已记录。

## 12. 当前读取顺序

S-35 已获用户确认，[Phase 0B Gate](./reports/phase-0b-gate.md) 于 2026-07-27 进入 Accepted；Phase 0B 已结束。E-001～E-011 与 E-015 已完成，E-012 是唯一当前任务并处于 In Review。读取顺序：

1. AGENTS.md；
2. README.md；
3. ROADMAP.md；
4. 本文；
5. tasks/current.md；
6. [E-012 Issue #50](https://github.com/WeiHan1996/DailyEnergy/issues/50)；
7. `docs/agent/PROJECT_CONTEXT.md`、Agent 工作流规范与
   `pnpm agent:prepare E-012 --remote --deep` 返回的全部 required sources；
8. [系统架构](./technical/architecture.md)、[仓库结构与模块边界](./technical/repository-structure.md)、
   [测试策略](./technical/testing.md)、[部署、配置和回滚](./technical/deployment.md)与
   [可观测性和成本监控](./technical/observability.md)；
9. 现有 runner、fixture、Source-ID evidence、API/Admin/miniapp、数据库/队列测试与附近代码；
10. tasks/backlog.md（仅在需要重排优先级时）。

E-001～E-004 已分别随 PR #89、#91、#93、#96 合并并进入 Done；E-008 已随
PR #97 squash 合并并关闭 Issue #46。E-005 已随
[PR #98](https://github.com/WeiHan1996/DailyEnergy/pull/98) 合并，merge commit
为 `bde64fd60128ab699eac3251bcf2eace88f0a902`，Issue #43 已关闭。
[E-015](https://github.com/WeiHan1996/DailyEnergy/issues/105) 已随
[PR #106](https://github.com/WeiHan1996/DailyEnergy/pull/106) squash 合并，
merge commit 为 `200e27de889a5cc47571e27d783aa570a381f889`，Issue #105
已关闭；E-006 的 PR #110 安全返工与 PR #111 post-merge full Gate 修复均已合并；
E-007 已随 [PR #113](https://github.com/WeiHan1996/DailyEnergy/pull/113) squash 合并为
`9630691a87b184bafe6ca78900a31244a6e6c237`，Issue #45 已关闭，merged `main` 的完整
验证通过，真实 PostgreSQL 18 suite `82/82`、Queue integration `7/7`。
[D-001 #99](https://github.com/WeiHan1996/DailyEnergy/issues/99)、
[D-002 #100](https://github.com/WeiHan1996/DailyEnergy/issues/100)、
[D-003 #101](https://github.com/WeiHan1996/DailyEnergy/issues/101)、
[D-004 #102](https://github.com/WeiHan1996/DailyEnergy/issues/102) 与
[D-005 #104](https://github.com/WeiHan1996/DailyEnergy/issues/104) 已纳入
Phase 2，全部保持 Planned。D-004 是 C-003、C-004、C-009 的直接前置；
D-005 是 C-012、C-013、C-014 的直接前置。
正式 Source-ID registry 已由 E-010 实现；E-011 已接入 CI、artifact、cache、
telemetry 与供应链 evidence 且不改变原有证据层级，未实现项继续为 `PLANNED`。
CI workflow/artifacts 已由 E-011 交付；私有 GitHub Free 的 platform required checks
暂由 testing 22.2 于 2026-08-04 获用户接受的有期限补偿控制替代，最迟在 E-014/RC 前恢复。
视觉设计与外部 Production Gate 未被自动解除；E-015 只实现了 P0/P1，没有提前交付 E-010、E-011、
E-013 或 D 系列能力。E-009 已随 PR #115 squash 合并并进入 Done，Issue #47 已关闭；
E-010 已随 PR #117 squash 合并并进入 Done；E-011 已随 PR #119 squash 合并为
`266a7dc39b87aec23740d64656bf33081a3aa34b` 并进入 Done。E-012 是唯一当前任务；开发基础设施与
ADR-0007 DEV-only 例外已获明确授权，首个 Accepted DEV release 已建立。项目所有者于 2026-08-12 接受显式
`reconcile-current` 合同与第二候选的 deploy/rollback/redeploy 演练方案；PR #133 已 squash 合并，第二 candidate 的 18 阶段
deploy/rollback/redeploy、17 阶段 clean restart reconciliation、无代理清理和独立验收审计均已完成。当前分支为
`agent/e012-final-evidence`，等待 final evidence Draft PR Gate 与项目所有者验收；E-012 尚未置为 Done，E-013 尚未提升。
公网固定 TLS 地址仍等待 ICP 备案、DNS 与证书授权，STAGING/PRODUCTION 独立状态服务 Gate 不变。
当前 Gate 与交接见 tasks/current.md。
