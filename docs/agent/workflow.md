# Agent 上下文路由与分级验证规范

- **文档状态**：Accepted
- **接受日期**：2026-07-29
- **最后更新**：2026-07-29
- **适用范围**：DailyEnergy 仓库内由 Agent 执行的开发、设计、文档、研究与安全任务

## 1. 目标

在不降低实现、审核、安全或证据质量的前提下减少 Token 和重复等待，重点消除：

- 每次任务都恢复全部仓库文档；
- 与变更无关的全量验证；
- 成功命令的冗长原始输出；
- 失败后没有分类和稳定证据的试错循环。

优化手段是“索引式恢复 + 分级验证 + 有界结果”，不是跳过权威原文或降低最终
Gate。

## 2. 不可破坏的约束

> 上下文摘要只负责路由，相关权威原文必须实际读取。

> 增量验证负责快速反馈，最终代码必须通过与任务风险相称的完整 Gate。

> 无法确定影响范围、来源冲突或依赖状态时，必须保守扩大读取和验证。

后续实现 validation receipt 时，还必须满足：

> 完整验证后的变更必须分类；代码相关变更使凭据失效，白名单内的纯状态变更
> 只需文档/状态 Gate。

## 3. P0：执行规范

### 3.1 权威来源

`docs/agent/authority-index.yaml` 只记录路由关系、理由和 required 标志。它不复制
权威结论，也不改变 `AGENTS.md` 的 source-of-truth priority。

准备命令必须报告：

- task ID 和 Profile；
- required 与 optional sources；
- 当前任务状态是否一致；
- 相关 D 系列依赖是否满足；
- 本地分支相对基线的变更范围；
- `CONTEXT_CONFLICT`、`SOURCE_MISSING` 或 `DEPENDENCY_BLOCKED` 等稳定诊断。

### 3.2 Requirement-to-Proof Matrix

每个 Profile 都必须明确：

- 哪些要求可由静态检查、测试或构建证明；
- 哪些要求需要原始外部证据；
- 哪些决定只能由用户或授权审核人作出；
- 自动化无法证明时返回何种非成功状态。

人工证据不允许以占位截图、过期链接或“测试通过”替代。

### 3.3 输出预算与脱敏

- 成功默认只输出状态、实际执行项、耗时与升级理由；
- 失败只输出稳定 rule ID、失败命令和根因附近的有界内容；
- 输出必须遮蔽 token、authorization、cookie、password、secret 和私钥形态；
- 不把原始命令输出、用户正文或环境变量写入仓库；
- 详细持久化 artifact 与 receipt 属于 P2，不在 P1 偷跑。

## 4. P1：统一入口

### 4.1 `agent:prepare`

默认行为必须是只读、本地、快速：

- 不修改仓库、GitHub 或外部系统；
- 不联网；
- 不安装依赖；
- 不运行完整构建；
- 输出 required sources、Profile、风险、依赖和建议验证模式。

`--remote` 和 `--deep` 是显式扩展：

- `--remote` 只读核对 GitHub Issue/PR；
- `--deep` 检查 Node、pnpm、依赖和 GitHub CLI 等环境；
- 扩展失败必须区分代码阻塞、环境阻塞和外部状态阻塞。

### 4.2 `agent:validate`

支持：

- `changed`：基于变更路径选择最小安全命令集；
- `task`：执行 Profile 定义的任务 Gate；
- `full`：执行 Profile 定义的完整 Gate。

选择规则：

- 安全、Schema、Contract、锁文件、workspace、tooling 或验证策略变更直接升级；
- 未跟踪但属于相关输入范围的文件必须纳入；
- 未知路径或匹配冲突升级到 `full`；
- P1 尚无 E-010 的 Source-ID dependency map，因此生产代码、测试、Schema、配置和
  tooling 变更均保守升级到 `full`，不得以文件名规则冒充依赖选择器；
- 只有明确的纯任务状态和项目导航文档可在 P1 使用轻量文档 Gate；
- 显式 Profile 不能降低自动推导的风险；
- design/hybrid/research 的人工或外部证据未满足时返回
  `MANUAL_EVIDENCE_REQUIRED` 或 `EXTERNAL_AUTHORIZATION_REQUIRED`。

## 5. Profile 证据矩阵

| Profile    | 自动化 Gate                                     | 自动化不能替代                                |
| ---------- | ----------------------------------------------- | --------------------------------------------- |
| `code`     | format、lint、typecheck、test、build、架构 Gate | 产品接受、生产发布与真实外部账号验证          |
| `design`   | 策略、文档、依赖和证据字段检查                  | Figma 原始 Frame、视觉/交互人工审核、用户接受 |
| `hybrid`   | `code` 完整 Gate + 设计证据结构检查             | 设计原始证据和用户接受                        |
| `docs`     | 格式、链接、索引、状态一致性                    | 改变 Accepted 决策的授权                      |
| `research` | 来源结构和仓库一致性                            | 外部来源真实性、授权与最终选型决定            |
| `security` | `code` 完整 Gate、安全/架构规则与负向 fixture   | 生产密钥、生产数据、渗透授权与风险接受        |

## 6. D 系列约束

版本化策略必须表达并测试：

- D-001 → D-002 → D-003 → D-004 → D-005；
- D-004 → C-003、C-004、C-009；
- D-005 → C-012、C-013、C-014。

依赖的“完成”必须来自仓库任务状态或获授权的远端状态，不能由聊天摘要推断。若设计
需要用户接受，自动化只能报告证据齐备，不能自行将其标记为 Accepted。

## 7. 后续阶段

本规范允许后续独立任务继续建设，但 E-015 不实现：

- **P2**：有效输入集、验证凭据、状态提交双 Gate、结构化 artifacts，以及
  package graph + Source-ID dependency map 的真实增量选择器；
- **P3**：CI lanes、required checks、可信执行环境和缓存；
- **P4**：Task YAML、完整来源图、Dev Container、Figma/视觉回归自动化。

P2 的有效输入集必须纳入源代码、测试、fixture、配置、Schema、Contract、安全
策略和相关未跟踪文件；排除构建产物、报告、缓存、日志和凭据自身。状态更新只有
在白名单路径、父提交已有有效 full receipt 且文档 Gate 通过时才可继承代码验证
结果。
