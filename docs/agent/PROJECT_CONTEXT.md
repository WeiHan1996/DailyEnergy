# DailyEnergy Agent Project Context

- **文档状态**：Active
- **最后更新**：2026-07-29
- **用途**：为 Agent 提供稳定、低 Token 的上下文导航
- **权威性**：本文件不是新的产品、技术或设计权威源

## 1. 使用原则

本文件只负责把任务路由到应当实际读取的权威原文。它不能替代 Accepted
ADR、Accepted 规范、Schema、API Contract、测试、任务文件或原始设计证据。

开始任务时：

1. 阅读根目录 `AGENTS.md` 和 `tasks/current.md`；
2. 运行 `pnpm agent:prepare <TASK_ID>`；
3. 阅读命令返回的全部 required sources；
4. 对冲突、缺失来源或未满足依赖先停止，不自行猜测；
5. 无法确定影响范围时扩大读取和验证。

若统一入口不可用或策略文件无效，回退到 `AGENTS.md` 中的完整恢复顺序。

## 2. 稳定项目边界

- 当前产品定位、AI/内容、安全与技术边界以 `AGENTS.md` 和 Accepted 文档为准；
- 当前唯一任务、状态、分支、PR、阻塞与下一动作以 `tasks/current.md` 为准；
- 长期排期和依赖以 `tasks/backlog.md` 与 `ROADMAP.md` 为准；
- 文档状态和导航以 `docs/INDEX.md` 为准；
- 冲突时遵循 `AGENTS.md` 的 source-of-truth priority，不按时间戳简单选边。

## 3. 任务 Profile

| Profile    | 典型工作                            | 自动化证据边界                                     |
| ---------- | ----------------------------------- | -------------------------------------------------- |
| `code`     | 应用、服务、Schema、工具链与测试    | 静态检查、测试、构建和相关架构 Gate                |
| `design`   | Figma、视觉规范、交互原型与设计验收 | 仓库检查不能替代 Frame、截图、人工审核和用户决定   |
| `hybrid`   | 同时修改设计来源和生产代码          | 需要 `code` 自动 Gate 与 `design` 原始证据         |
| `docs`     | 不改变行为的文档和项目状态          | 文档一致性、链接、格式和状态 Gate                  |
| `research` | 外部研究、供应商或能力评估          | 必须记录来源、日期、限制与需要的外部授权           |
| `security` | 密钥、隐私、权限、依赖与安全边界    | 默认扩大验证；人工威胁审查和生产授权不能自动化替代 |

任务 Profile 由 `docs/agent/authority-index.yaml` 路由，也可通过统一入口显式指定。
显式指定不能降低策略计算出的安全级别。

## 4. 统一入口

```text
pnpm agent:prepare <TASK_ID>
pnpm agent:prepare <TASK_ID> --remote
pnpm agent:prepare <TASK_ID> --deep

pnpm agent:validate --mode=changed
pnpm agent:validate --mode=task --task=<TASK_ID>
pnpm agent:validate --mode=full --profile=<PROFILE>
```

- `agent:prepare` 默认只读、仅使用本地信息、快速且输出有界；
- `--remote` 才读取 GitHub 状态，`--deep` 才执行环境和依赖深检；
- `changed` 用于快速反馈；P1 中生产代码、测试、配置和 tooling 因尚无完整
  Source-ID dependency map 而保守升级，只有明确的纯状态/导航文档可走轻量 Gate；
- `task` 覆盖任务 Profile 的必要自动化证据；
- `full` 是提交审核前的完整代码 Gate；
- design/hybrid/research 需要外部或人工证据时必须明确返回未完成状态，不能伪装
  成 `PASS`。

## 5. D 系列依赖

视觉设计任务按以下顺序推进：

```text
D-001 → D-002 → D-003 → D-004 → D-005
```

并且：

- D-004 被接受前，不得开始 C-003、C-004、C-009 的正式页面实现；
- D-005 被接受前，不得开始 C-012、C-013、C-014 的正式页面实现；
- 自动检查只能证明仓库状态和证据字段存在，不能代替用户接受设计。

## 6. 当前实施边界

E-015 P0/P1 只建立路由、Profile、依赖阻断、统一验证入口和固定 fixtures。
以下能力保留给后续任务：

- validation receipt、有效输入集哈希和状态提交双 Gate；
- CI lanes、required checks 和托管验证 artifacts；
- 完整 Source-ID registry；
- Dev Container、Testcontainers、remote cache；
- Figma 自动化、视觉回归平台和 Design Token 生成。
