# DailyEnergy Phase 0B Gate 评审报告

- **文档状态**：Accepted
- **所属任务**：S-35 — Phase 0B Gate 评审
- **评审日期**：2026-07-27
- **接受日期**：2026-07-27
- **评审基线**：`main@456de3ebcd1decf1ab9d6190f36c77ed648b5292`（[PR #87](https://github.com/WeiHan1996/DailyEnergy/pull/87) 合并提交）
- **适用范围**：Phase 0B 规格完整性、可执行契约、工程任务可开工性与 Phase 1 入口
- **上游**：[ROADMAP](../../ROADMAP.md)、[文档索引](../INDEX.md)、[当前任务](../../tasks/current.md)、[Backlog](../../tasks/backlog.md)
- **最终结论**：`GO`
- **工程入口**：[E-001 初始化 pnpm/Turborepo TypeScript Monorepo](https://github.com/WeiHan1996/DailyEnergy/issues/39)

## 1. 目的与决策边界

本报告回答一个问题：DailyEnergy 是否已经具备从 Phase 0B 进入 Phase 1、开始第一个工程 Issue 的充分输入。

本 Gate 只评审：

- P0 产品、页面、状态、Schema、数据与 API 是否有唯一权威；
- AI、记忆、安全、降级、隐私和运营规则是否可测试；
- 关键技术决策是否已经通过 Accepted ADR 固化；
- 可执行 Schema、OpenAPI、Prisma 草案、测试向量和 AI corpus 是否存在；
- Phase 1～3 工程 Issue 是否完整、依赖闭合且可在一个主要 PR 内验收；
- E-001 是否可以不重新讨论产品定义而直接开始。

本 Gate 不代表：

- Phase 1、MVP、内部 Alpha、种子内测或生产已经完成；
- 云厂商、域名、主体、跨境路径、真实账号、密钥或值班已经选定；
- Planned 的正式视觉设计系统已经完成；
- 代码、迁移、容器、CI、监控或生产资源已经实现；
- 48 个工程 Issue 可以绕过各自验收或阶段 Gate。

## 2. 最终结论

用户已于 2026-07-27 接受本报告。Phase 0B Gate 正式通过，E-001 成为唯一 Ready；此状态迁移不代表已开始实现。

| 判定项 | 结果 | 说明 |
|---|---|---|
| 阻塞 E-001 的重大未决规格 | 0 | E-001 的技术栈、仓库结构、测试边界和验收均有 Accepted 权威 |
| Phase 0B 总退出门槛 | 6 / 6 满足 | 见第 4 节 |
| Accepted ADR | 6 / 6 | 产品定位、稳定结果、AI Gateway、结构化记忆、数据保存删除、Monorepo 技术栈 |
| 可执行权威 | 已具备 | Zod/JSON Schema、规则向量、AI corpus、Prisma 草案、OpenAPI |
| 工程计划 | 48 / 48 | Phase 1 / 2 / 3 为 14 / 17 / 17，全部 open 并绑定真实 Milestone |
| 依赖图 | 通过 | 48 个唯一任务 ID，无缺失引用、无循环；E-001 无前置 |
| 非阻塞延后项 | 1 类 | 正式视觉设计系统仍为 Planned，不阻塞 E-001 或工程基础阶段 |
| 外部上线 Gate | 仍未解除 | 明确保留在后续 Issue、部署规范和 Production Gate 中 |
| 最终状态 | `GO` | S-35 已获用户确认；E-001 是唯一 Ready，等待明确开工指令 |

如果本报告在审核期间发现新的代码阻塞项，结论必须改为 `NO_GO` 或 `CONDITIONAL_GO`，写明 owner、解锁证据和受影响 Issue；不得靠聊天承诺绕过。

## 3. 审计基线

### 3.1 仓库与文档

- S-01～S-33 的交付在 [docs/INDEX.md](../INDEX.md) 中具有明确状态和读取顺序；
- S-34 已通过 [PR #87](https://github.com/WeiHan1996/DailyEnergy/pull/87) 合并，三个真实 Milestone 和 48 个 open Issue 已建立；
- 6 个 ADR 均为 Accepted；
- 产品、设计、AI、数据、API、分析、隐私、运营、架构、测试、部署和可观测性权威均已存在；
- `docs/design/design-system.md` 是索引中唯一明确为 Planned 的设计规格，按第 7 节作为非阻塞延后项处理。

### 3.2 可执行权威

| 权威 | 基线证据 | Gate 用途 |
|---|---|---|
| [shared-schemas](../../packages/shared-schemas/README.md) | TypeScript + Zod、JSON Schema exports 与 fixtures | 业务字段和跨字段约束 |
| [S-11 规则向量](../ai/s11-test-vectors.json) | Accepted、可解析的版本化 JSON | 稳定种子、评分、选择和周趋势 golden |
| [S-16 AI corpus](../ai/evaluation-corpus.json) | Accepted、269 个版本化 case | 人格、事实、记忆、Safety、降级与成本 Gate |
| [Prisma 草案](../../prisma/schema.prisma) | Accepted 结构草案，70 models / 35 enums | 数据结构、权限和 migration 输入 |
| [OpenAPI](../../openapi/openapi.yaml) | Accepted OpenAPI 3.0.3，62 个 path | HTTP transport、envelope、client 与 drift 输入 |
| [测试策略](../technical/testing.md) | Source-ID registry 合同和 48 个 `S31-TEST-*` 场景 | 实现后 `PLANNED → COVERED` 的证据规则 |

这里的“可执行”表示已经提供机器可读输入，不表示 Phase 1 测试工具、数据库或服务已经实现。

### 3.3 GitHub 工程计划

| 阶段 | Milestone | Issue | 初始估算 | 阶段 Gate |
|---|---|---:|---:|---|
| Phase 1 | [工程基础](https://github.com/WeiHan1996/DailyEnergy/milestone/1) | 14 | 35 理想工程日 | [E-014](https://github.com/WeiHan1996/DailyEnergy/issues/52) |
| Phase 2 | [确定性核心闭环](https://github.com/WeiHan1996/DailyEnergy/milestone/2) | 17 | 43.5 理想工程日 | [C-017](https://github.com/WeiHan1996/DailyEnergy/issues/69) |
| Phase 3 | [AI 陪伴层](https://github.com/WeiHan1996/DailyEnergy/milestone/3) | 17 | 44 理想工程日 | [AI-017](https://github.com/WeiHan1996/DailyEnergy/issues/83) |

总计 122.5 个 AI 辅助理想工程日，仅用于顺序和容量校准，不是发布日期。E-001～E-003 完成后必须用实际 cycle time 重新校准。

## 4. Phase 0B 总退出门槛

| ROADMAP 退出门槛 | 权威证据 | 工程承接 | 结果 |
|---|---|---|---|
| 所有 P0 页面、状态、Schema、数据和 API 有唯一规格 | [MVP](../product/mvp.md)、[信息架构](../design/information-architecture.md)、[页面清单](../design/screen-inventory.md)、[页面规格](../design/screen-specs.md)、[交互状态](../design/interaction-states.md)、[状态机](../product/state-machine.md)、3 份 Schema、[领域模型](../data/domain-model.md)、[数据库](../technical/database.md)、[API](../technical/api.md) | E-004～E-008、C-001～C-017 | PASS |
| AI、记忆、安全和降级规则可测试 | [生成引擎](../ai/generation-engine.md)、[评分规则](../ai/scoring-rules.md)、[Gateway](../ai/gateway.md)、[Prompt](../ai/prompt-spec.md)、[记忆](../ai/memory.md)、[Safety](../ai/safety.md)、[评价](../ai/evaluation.md)与 corpus | AI-001～AI-017、E-010 | PASS |
| 关键技术决策有 Accepted ADR | [ADR-0001](../decisions/ADR-0001-product-positioning.md)～[ADR-0006](../decisions/ADR-0006-monorepo-and-stack.md) | 各 Issue 必须服从对应 ADR；冲突先回到 ADR | PASS |
| 指标和隐私口径明确 | [事件字典](../analytics/event-tracking.md)、[指标](../analytics/metrics.md)、[实验](../analytics/experiments.md)、[归因](../analytics/channel-attribution.md)、[隐私地图](../operations/privacy-data-map.md) | C-014～C-016、AI-016、E-013 | PASS |
| Phase 1～3 已拆成可执行 Issues | 3 个真实 Milestone、48 个 open Issue、7 个必备章节、122.5 理想工程日 | E-001～E-014、C-001～C-017、AI-001～AI-017 | PASS |
| tasks/current 指向第一个工程任务且无重大代码阻塞 | 已执行 `S-35 Done → E-001 Ready`；E-001 无前置 | E-001 | PASS |

## 5. 端到端追踪矩阵

| 领域 | Accepted 权威 | 可执行/测试证据 | 主要 Issue | 结论 |
|---|---|---|---|---|
| 定位、用户与旅程 | vision、persona、journey、MVP、personality、ADR-0001 | 原型与用户研究模板 | C-001～C-004、C-009 | 闭合 |
| 页面与交互 | IA、screen inventory/specs、interaction states、content layout | S-04 静态原型 | E-004、E-005、C-003、C-004、C-009～C-013 | 闭合；正式视觉系统延后 |
| 状态与业务规则 | state-machine、business-rules | Source IDs、E2E 状态断言 | C-003～C-013 | 闭合 |
| 结构化契约 | daily、evening、weekly Schema | Zod、JSON Schema、fixtures | E-008、C-004～C-013、AI-006、AI-011 | 闭合 |
| 确定性生成 | ADR-0002、generation-engine、scoring-rules | S-11 vectors | C-005～C-008 | 闭合 |
| AI 表达与成本 | ADR-0003、gateway、prompt、evaluation | 269-case corpus、Gateway 场景 | AI-001～AI-007、AI-014～AI-017 | 闭合 |
| 记忆与关系 | ADR-0004、memory、personality | memory/evaluation corpus | AI-008～AI-011 | 闭合 |
| Safety | safety、moderation、incident、support | 固定 corpus、零预算硬 Gate | AI-012～AI-015 | 闭合；真实地区资源后续验证 |
| 数据与删除 | domain、ADR-0005、database、privacy map | Prisma 草案、SQL/TX/PDM 场景 | E-006、C-002、C-015、C-016 | 闭合 |
| API 与客户端 | api、error-codes | OpenAPI、Zod、client drift | E-003、E-008、C/AI transport Issues | 闭合 |
| 分析与渠道 | tracking、metrics、experiments、attribution | 唯一指标与禁止字段 Gate | C-014、AI-016、E-013 | 闭合 |
| 架构与仓库 | ADR-0006、architecture、repository-structure | S28/S29/S30 Source IDs | E-001～E-009 | 闭合 |
| 测试与交付 | testing、deployment、observability | S31/S32/S33 场景与发布证据合同 | E-010～E-014 | 闭合；真实外部资源后续验证 |

## 6. 固定审计记录

结果含义：`PASS` 为基线满足；`DEFERRED_NON_BLOCKING` 为明确延后且不阻塞 E-001；`OWNED_GATE` 为后续 Issue/上线 Gate 有明确 owner。

| ID | 审计断言 | 证据 | 结果 |
|---|---|---|---|
| S35-GATE-001 | 产品不是专业算命或预测工具 | vision、MVP、ADR-0001 | PASS |
| S35-GATE-002 | 首批用户和小红书/抖音渠道明确 | persona、journey、attribution | PASS |
| S35-GATE-003 | 一分钟、连续 7 天核心旅程明确 | journey、MVP | PASS |
| S35-GATE-004 | P0、P1 和明确不做范围唯一 | MVP | PASS |
| S35-GATE-005 | 页面层级、路由与入口唯一 | information-architecture | PASS |
| S35-GATE-006 | 页面、弹层与系统状态清单完整 | screen-inventory | PASS |
| S35-GATE-007 | 页面字段、动作和验收可引用 | screen-specs | PASS |
| S35-GATE-008 | loading/error/fallback/retry/delete 状态可引用 | interaction-states | PASS |
| S35-GATE-009 | 今日内容与长页阅读顺序明确 | content-layout | PASS |
| S35-GATE-010 | 原型和首次可用性验证方案存在 | prototype-validation、S-04 原型 | PASS |
| S35-GATE-011 | 用户、关系和每日体验状态唯一 | state-machine | PASS |
| S35-GATE-012 | 点亮、跨日、中断、提醒和删除规则唯一 | business-rules | PASS |
| S35-GATE-013 | Daily / Evening / Weekly 文档 Schema Accepted | 三份 Schema 文档 | PASS |
| S35-GATE-014 | 共享 Zod/JSON Schema 权威存在 | shared-schemas | PASS |
| S35-GATE-015 | 产品日期、种子和历史冻结有 ADR | ADR-0002 | PASS |
| S35-GATE-016 | 规则、评分、选择和周趋势有 golden | generation-engine、scoring-rules、S-11 vectors | PASS |
| S35-GATE-017 | AI 供应商隔离和降级有 ADR | ADR-0003、gateway | PASS |
| S35-GATE-018 | Prompt 输入、事实绑定和版本边界明确 | prompt-spec | PASS |
| S35-GATE-019 | 记忆来源、用途、期限和删除有 ADR | ADR-0004、memory | PASS |
| S35-GATE-020 | 高风险内容退出普通流程 | safety | PASS |
| S35-GATE-021 | AI 人格、事实、记忆、Safety 和降级可回归 | evaluation、269-case corpus | PASS |
| S35-GATE-022 | 领域聚合、身份、revision 和 invalidation 明确 | domain-model | PASS |
| S35-GATE-023 | 保存、删除、恢复和受限证据有 ADR | ADR-0005 | PASS |
| S35-GATE-024 | 数据库表、约束、事务和权限可实现 | database、Prisma 草案 | PASS |
| S35-GATE-025 | HTTP 契约、错误和恢复语义唯一 | api、error-codes、OpenAPI | PASS |
| S35-GATE-026 | 产品事件和禁止字段明确 | event-tracking | PASS |
| S35-GATE-027 | 激活、留存、帮助度、成本和完整性口径唯一 | metrics | PASS |
| S35-GATE-028 | 实验允许/禁止、停止和回滚边界明确 | experiments | PASS |
| S35-GATE-029 | 首次来源、素材与承接页归因明确 | channel-attribution | PASS |
| S35-GATE-030 | 数据用途、位置、访问、期限和权利可追踪 | privacy-data-map | PASS |
| S35-GATE-031 | 内容审核、支持和申诉流程可执行 | moderation、user-support | PASS |
| S35-GATE-032 | 故障、安全、隐私和删除事件有响应流程 | incident-response | PASS |
| S35-GATE-033 | 单仓、运行时和框架版本有 ADR | ADR-0006 | PASS |
| S35-GATE-034 | runtime、事务、outbox/inbox 和 Worker 边界明确 | architecture | PASS |
| S35-GATE-035 | workspace、public export 和依赖方向明确 | repository-structure | PASS |
| S35-GATE-036 | Source-ID registry、真实依赖和测试层级明确 | testing | PASS |
| S35-GATE-037 | 环境、配置、迁移、发布、回滚和恢复明确 | deployment | PASS |
| S35-GATE-038 | 日志、Trace、指标、SLO、告警和成本明确 | observability | PASS |
| S35-GATE-039 | 三个真实 Milestone 存在 | Milestone #1 / #2 / #3 | PASS |
| S35-GATE-040 | 48 个 Issue 均含 7 个必备章节 | GitHub Issue 回读 | PASS |
| S35-GATE-041 | Issue 权威输入指向现有仓库路径 | 48 个唯一 authority path | PASS |
| S35-GATE-042 | Issue ID 与依赖完整、唯一且无循环 | 48-node DAG | PASS |
| S35-GATE-043 | Phase 1/2/3 各有不可绕过的阶段 Gate | E-014、C-017、AI-017 | PASS |
| S35-GATE-044 | E-001 无前置且不需要业务定义 | Issue #39、ADR-0006、repository-structure、testing | PASS |
| S35-GATE-045 | 正式视觉设计系统未被伪装为已完成 | docs/INDEX 的 Planned 记录 | DEFERRED_NON_BLOCKING |
| S35-GATE-046 | 外部账号、主体、域名、跨境、资源与值班仍受后续 Gate 约束 | deployment、privacy、safety、observability 与对应 Issue | OWNED_GATE |
| S35-GATE-047 | 用户已接受 Gate，S-35 可标 Done、E-001 可设 Ready | 用户确认、AGENTS、tasks/current | PASS |
| S35-GATE-048 | 接受后唯一入口为 E-001，不并行启动下游 | ROADMAP、Issue DAG | PASS |

## 7. 非阻塞延后项与外部 Gate

### 7.1 正式视觉设计系统

`docs/design/design-system.md` 仍为 Planned。当前 Accepted 的 IA、页面清单、页面规格、交互状态、内容布局和 S-04 原型足以支持 E-001～E-004 工程骨架及后续功能验收，因此不阻塞 Phase 0B 退出。

约束：

- 不得在文档、Issue 或 PR 中声称正式视觉设计系统已完成；
- E-004 只创建小程序骨架，C-009 明确不实现正式视觉设计系统；
- 后续若种子内测或正式视觉质量需要统一 token、组件、动效和无障碍规范，必须先把该 Planned 项拆成有 owner、验收和测试的任务；
- 该延后不能降低页面可访问性、状态完整性、内容层级或安全页面优先级。

### 7.2 后续外部 Gate

| 未决项 | 当前状态 | 最晚解锁点 | 失败处理 |
|---|---|---|---|
| 云厂商、开发/生产域名与受控服务端点 | 未选择 | E-012 / E-014 / Production Gate | 不宣称环境可发布；保留本地与隔离验证 |
| 经营主体、隐私文本、地区与跨境路径 | 未确认 | C-002、E-014、种子内测前 | 阻止真实用户数据进入环境 |
| 微信 AppID、登录与订阅能力 | 未配置 | E-004、C-001、C-012 | 使用合成/测试环境；生产 fail closed |
| AI provider、模型、额度和真实密钥 | 未配置 | AI-001、AI-002、AI-016 | 使用 contract fake/template；不得伪造 provider 通过 |
| 地区热线与高风险资源 | 未核验 | AI-013、内部 Alpha 前 | 只使用通用安全 fallback；不猜测号码 |
| 监控后端、告警接收人与值班安排 | 未选择 | E-013、E-014、内部 Alpha 前 | 不宣称运行响应 Gate 已通过 |
| Alpha/Beta 日期 | 未设置 | E-001～E-003 cycle time 校准后 | 保持 Milestone 无虚假 due date |

这些项目不阻塞 E-001，但会阻塞各自 Issue、阶段 Gate 或真实用户上线；不得因为 S-35 通过而自动解除。

## 8. E-001 开工合同

用户已接受本报告；S-35 PR 合并后：

1. S-35 标记 Done，报告状态改为 Accepted 并记录接受日期；
2. [E-001](https://github.com/WeiHan1996/DailyEnergy/issues/39) 成为唯一 Ready；
3. `tasks/current.md` 改为 E-001，读取 ADR-0006、repository-structure、testing 和现有 shared-schemas；
4. E-001 只初始化 pnpm/Turborepo workspace、目标目录与统一脚本；
5. 保留 shared-schemas public exports 与 fixtures，不初始化 Nest/Next/小程序/数据库/队列业务；
6. 提交一个聚焦的 Draft PR，并提供 clean-checkout install、workspace graph、根脚本 dry-run 与 shared-schemas 回归证据；
7. 不并行启动 E-002 或任何下游 Issue。

## 9. Gate 失败与重开规则

S-35 接受后仍可被新证据重开，但必须满足以下任一条件：

- Accepted 权威之间出现无法实现的冲突；
- E-001 或后续 Issue 缺少阻塞其验收的业务决定；
- 可执行 Schema、OpenAPI、Prisma、vectors 或 corpus 与 Accepted 文档发生实质漂移；
- Issue 依赖缺失、形成循环或需要跨越未完成上游；
- 新的安全、隐私、删除或数据完整性风险无法由现有 Gate 收敛；
- 技术栈或产品定位需要改变，必须新建或 supersede ADR。

重开时将当前工程 Issue 设为 Blocked，记录最小冲突和解锁证据；不得在实现中静默改变 Accepted 决策。

## 10. 接受记录

用户于 2026-07-27 明确确认 Phase 0B Gate，并要求合并 [PR #88](https://github.com/WeiHan1996/DailyEnergy/pull/88)，同时将 E-001 设为唯一 Ready。

接受范围：

- Gate 结论正式转为 Accepted `GO`；
- 正式视觉设计系统继续作为非阻塞延后项；
- 外部 Production Gate 继续保持未解除；
- E-001 成为 Phase 1 唯一入口，但本次不启动实现。