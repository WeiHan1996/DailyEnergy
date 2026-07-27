# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-27
- **当前阶段**：Phase 1 — 工程基础
- **当前任务 ID**：E-001
- **当前任务名称**：初始化 pnpm/Turborepo TypeScript Monorepo
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/e-001-monorepo`
- **上游 PR**：[S-35 PR #88](https://github.com/WeiHan1996/DailyEnergy/pull/88)
- **当前 Issue**：[E-001 Issue #39](https://github.com/WeiHan1996/DailyEnergy/issues/39)
- **当前 PR**：Draft PR（待创建）
- **Gate 结论**：`GO`

## 1. 当前目标

建立单一 pnpm workspace、Turborepo 任务图和目标目录骨架，把现有 shared-schemas 纳入根工作区，并为后续工程任务提供可重复的统一入口。

E-001 当前为唯一 In Review。pnpm/Turborepo workspace、目标目录骨架、统一根
脚本和现有 shared-schemas 兼容迁移已完成并通过干净检出验证，等待 Draft PR
审核。

## 2. 上游完成状态

- S-35 已获用户明确确认，[Phase 0B Gate 评审报告](../docs/reports/phase-0b-gate.md) 状态为 Accepted，结论为 `GO`；
- Phase 0B 的 6 项退出门槛全部满足，48 个工程 Issue 的依赖图无缺失、无循环；
- [E-001](https://github.com/WeiHan1996/DailyEnergy/issues/39) 无前置任务，继续绑定 [Phase 1 — 工程基础](https://github.com/WeiHan1996/DailyEnergy/milestone/1)；
- E-002 及其他 46 个下游工程 Issue 保持 Planned；
- 正式视觉设计系统仍为非阻塞 Planned；
- 云厂商、域名、主体、跨境、真实账号/密钥、热线、监控接收人和值班等外部 Gate 仍未解除；
- E-001 已从最新 `main`（`7a60c67`）创建独立分支；未启动任何下游 Issue。

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
- **Source-ID registry**：`NA_WITH_REASON` 待审核。Accepted
  [测试策略](../docs/technical/testing.md) 第 26 节把 registry 骨架分配给 E-010，
  当前仓库无 registry 可从 `PLANNED` 更新；E-001 在 Draft PR 正文记录覆盖证据，
  不提前实现 E-010；
- **当前等待**：Draft PR 审核；
- **唯一允许的下一状态**：用户批准并合并后进入 Done；E-002 在此之前保持
  Planned。

## 8. 最近交接

- 已完成：root pnpm workspace、Turbo task graph、11 个 workspace manifest、
  唯一 root lockfile、Node/pnpm exact 版本、最小目录占位、Workspace Gate 和
  shared-schemas 兼容迁移；
- 版本基线：Node `24.18.0`、pnpm `11.17.0`、Turbo `2.10.7`、TypeScript
  `7.0.2`、Zod `4.4.3`、Vitest `4.1.10`、Prettier `3.9.6`；
- 已验证：迁移前 `npm ci && npm run validate` 通过，34 项测试全部通过；
- 已验证：干净检出只有 root `pnpm-lock.yaml`，`pnpm install
  --frozen-lockfile`、`pnpm workspace:graph`、`pnpm dry-run`、`pnpm
  validate` 和 `pnpm clean` 全部通过；
- 已验证：Turbo 识别 11 个 workspace，dry-run 含 55 个任务定义、4 个现有可执行
  shared-schemas 任务、strict env 且无 configured env；public root export 与
  `./json-schema` 的 19 个稳定 ID 可运行；
- 未开始：E-002、业务代码、workflow、migration、容器或云资源；
- 下一动作：创建并审核 E-001 聚焦 Draft PR；
- 接受后的下一任务：E-002 统一 TypeScript、ESLint 和 Prettier 配置；本 PR 不启动；
- 禁止并行：E-002 及其他下游 Issue。
