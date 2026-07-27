# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-27
- **当前阶段**：Phase 1 — 工程基础
- **当前任务 ID**：E-001
- **当前任务名称**：初始化 pnpm/Turborepo TypeScript Monorepo
- **任务状态**：Ready
- **优先级**：最高
- **当前分支**：无（尚未开始）
- **上游 PR**：[S-35 PR #88](https://github.com/WeiHan1996/DailyEnergy/pull/88)
- **当前 Issue**：[E-001 Issue #39](https://github.com/WeiHan1996/DailyEnergy/issues/39)
- **当前 PR**：无
- **Gate 结论**：`GO`

## 1. 当前目标

建立单一 pnpm workspace、Turborepo 任务图和目标目录骨架，把现有 shared-schemas 纳入根工作区，并为后续工程任务提供可重复的统一入口。

E-001 当前为唯一 Ready，尚未开始实现。只有用户明确要求开始 E-001 后，才创建工程分支并进入 In Progress。

## 2. 上游完成状态

- S-35 已获用户明确确认，[Phase 0B Gate 评审报告](../docs/reports/phase-0b-gate.md) 状态为 Accepted，结论为 `GO`；
- Phase 0B 的 6 项退出门槛全部满足，48 个工程 Issue 的依赖图无缺失、无循环；
- [E-001](https://github.com/WeiHan1996/DailyEnergy/issues/39) 无前置任务，继续绑定 [Phase 1 — 工程基础](https://github.com/WeiHan1996/DailyEnergy/milestone/1)；
- E-002 及其他 46 个下游工程 Issue 保持 Planned；
- 正式视觉设计系统仍为非阻塞 Planned；
- 云厂商、域名、主体、跨境、真实账号/密钥、热线、监控接收人和值班等外部 Gate 仍未解除；
- 本次只完成状态迁移，没有开始工程代码。

## 3. 开工前读取顺序

1. [E-001 Issue #39](https://github.com/WeiHan1996/DailyEnergy/issues/39)；
2. [ADR-0006 Monorepo 与技术栈](../docs/decisions/ADR-0006-monorepo-and-stack.md)；
3. [仓库结构和模块边界](../docs/technical/repository-structure.md)；
4. [测试策略](../docs/technical/testing.md)；
5. [shared-schemas](../packages/shared-schemas/README.md) 及现有 exports、fixtures 与测试；
6. 仓库现状与任何未提交改动。

如果上述 Accepted 权威相互冲突、文件缺失或 E-001 验收无法在一个主要 PR 内完成，应停止并将 E-001 设为 Blocked，不得在实现中静默改写上游决定。

## 4. E-001 范围

- 创建根 `package.json`、`pnpm-workspace.yaml`、唯一 lockfile、`turbo.json` 与 Node/pnpm 版本约束；
- 创建 apps/packages/tooling/tests/docker 的最小目录占位和 package manifest；
- 保留 `@daily-energy/shared-schemas` 的现有 public exports 与 fixture 行为；
- 提供 install、build、typecheck、lint、test、clean 的统一根脚本；
- 提供 clean-checkout install、workspace graph、根脚本 dry-run 与 shared-schemas 回归证据。

## 5. 不做

- 不初始化 NestJS、Next.js、微信小程序、PostgreSQL、Prisma、Redis 或 BullMQ 业务实现；
- 不选择或创建云资源、域名、生产账号、真实密钥或外部服务；
- 不修改 Accepted 产品、Schema、API、隐私、Safety、架构、测试、部署或可观测性合同；
- 不并行启动 E-002 或任何下游 Issue；
- 不在用户明确开始前创建工程分支、提交代码或 Draft PR。

## 6. 验收标准

- 干净检出后使用 Node 24 LTS 与 pnpm 11 可重复安装，仓库只有一个 lockfile；
- Turbo 能识别全部 workspace，缓存不包含 secret、用户数据或机器私有配置；
- 现有 shared-schemas 测试与 fixture 行为不回退，客户端与服务端运行区元数据已声明；
- 根脚本 dry-run 和 workspace graph 有可复核证据；
- 未创建 Nest/Next/小程序/数据库/队列业务实现；
- 交付一个聚焦的 Draft PR，等待用户审核。

## 7. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **外部上线 Gate**：仍存在，但不阻塞 E-001；
- **当前等待**：用户明确要求开始 E-001；
- **唯一允许的下一状态**：收到开工指令后 E-001 从 Ready 进入 In Progress。

## 8. 最近交接

- 已完成：S-35 Gate 接受、Phase 0B 收尾、E-001 唯一 Ready 状态迁移；
- 未开始：任何工程代码、配置、workflow、migration、容器或云资源；
- 下一动作：读取第 3 节权威输入，从最新 main 创建 E-001 独立分支；
- 下一交付：E-001 聚焦 Draft PR；
- 禁止并行：E-002 及其他下游 Issue。
