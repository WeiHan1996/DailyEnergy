# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-28
- **当前阶段**：Phase 1 — 工程基础
- **当前任务 ID**：E-002
- **当前任务名称**：建立 TypeScript、Lint 与依赖边界基线
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/e-002-code-quality`
- **上游 PR**：[E-001 PR #89](https://github.com/WeiHan1996/DailyEnergy/pull/89)
- **当前 Issue**：[E-002 Issue #41](https://github.com/WeiHan1996/DailyEnergy/issues/41)
- **当前 PR**：[Draft PR #91](https://github.com/WeiHan1996/DailyEnergy/pull/91)
- **Gate 结论**：`GO`

## 1. 当前目标

把 strict TypeScript、格式化、静态依赖区和 package exports 固化为机器可执行 Gate，为后续 NestJS、微信小程序、Next.js、数据库和 Worker 工程提供统一且不可绕过的代码质量基线。

E-001 已通过审核并随 [PR #89](https://github.com/WeiHan1996/DailyEnergy/pull/89) 合并，Issue #39 已关闭。E-002 的共享配置、静态边界 Gate、负向 fixtures 与 clean-checkout 等价验证均已完成，现在是唯一 In Review，正在 [Draft PR #91](https://github.com/WeiHan1996/DailyEnergy/pull/91) 等待审核。

## 2. 上游完成状态

- Phase 0B Gate 已获用户确认，结论为 Accepted `GO`；
- E-001 已完成 root pnpm workspace、Turborepo task graph、11 个 workspace manifest、唯一 root lockfile、Node/pnpm exact 版本、Workspace Gate 和 shared-schemas 兼容迁移；
- E-001 的 Source-ID registry 例外已按 `NA_WITH_REASON` 批准，正式 registry 仍由 E-010 建立；
- [E-002](https://github.com/WeiHan1996/DailyEnergy/issues/41) 的唯一前置 E-001 已满足，继续绑定 [Phase 1 — 工程基础](https://github.com/WeiHan1996/DailyEnergy/milestone/1)；
- E-003 及其他 45 个下游工程 Issue 保持 Planned；
- 正式视觉设计系统仍为非阻塞 Planned；
- 云厂商、域名、主体、跨境、真实账号/密钥、热线、监控接收人和值班等外部 Gate 仍未解除，但不阻塞 E-002。

## 3. 开工前读取顺序

1. [E-002 Issue #41](https://github.com/WeiHan1996/DailyEnergy/issues/41)；
2. [ADR-0006 Monorepo 与技术栈](../docs/decisions/ADR-0006-monorepo-and-stack.md)；
3. [仓库结构和模块边界](../docs/technical/repository-structure.md)；
4. [测试策略](../docs/technical/testing.md)；
5. root `package.json`、`pnpm-workspace.yaml`、`turbo.json`；
6. `tooling/check-workspace.mjs`；
7. `packages/shared-schemas` 现有配置、exports、fixtures 和测试；
8. 仓库现状与任何未提交改动。

如果上述 Accepted 权威相互冲突、文件缺失或 E-002 验收无法在一个主要 PR 内完成，应停止并将 E-002 设为 Blocked，不得在实现中静默改写上游决定。

## 4. E-002 范围

- 创建可复用的 `typescript-config` 与 `eslint-config` workspace package；
- 启用 TypeScript 7 strict，并建立 ESM/server、miniapp、Next 和 tooling 分层配置；
- 配置 ESLint flat config、Prettier、dependency-cruiser 或等价 import graph 检查；
- 禁止 deep import、wildcard root export、跨 runtime zone 依赖和 server-only 进入客户端；
- 为 12 类 S-30 静态边界 Gate 提供命令入口和至少一个负向 fixture；
- 保证全仓 format、lint、typecheck 可在 clean checkout 确定执行。

## 5. 不做

- 不创建 NestJS、Next.js 或微信小程序业务骨架；
- 不引入 PostgreSQL、Prisma、Redis、BullMQ、Docker 编排或生产供应链账号；
- 不引入业务逻辑、真实密钥、真实用户数据或 provider 内容；
- 不修改 Accepted 产品、Schema、API、隐私、Safety、删除、幂等、事务、运行 profile 或可观测性合同；
- 不并行启动 E-003 或任何下游 Issue；
- 不在用户明确开始 E-002 前创建实现分支、提交代码或 Draft PR。

## 6. 验收标准

- 所有 workspace 继承批准的配置，不能局部关闭 strict 或边界规则；
- client-safe、server-core、server-adapter、server-asset、tooling 依赖方向可自动验证；
- package exports、TS path alias、side-effect import 和跨 runtime zone 绕过有正负验证；
- 12 类 S-30 静态边界 Gate 有统一命令入口和至少一个负向 fixture；
- `pnpm format:check`、`pnpm lint`、`pnpm typecheck` 与聚合验证在 clean checkout 可重复通过；
- 未提前实现 E-003 及后续业务或基础设施范围；
- 交付一个聚焦的 Draft PR，等待用户审核。

## 7. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **外部上线 Gate**：仍存在，但不阻塞 E-002；
- **Source-ID registry**：正式 registry 属于 E-010。E-002 必须在 PR 中按 `MACHINE_ENFORCED`、`PARTIAL / MANUAL_EVIDENCE`、`DEFERRED` 或经批准的 `NA_WITH_REASON` 准确记录证据，不得静默宣称完整覆盖；
- **TypeScript ESLint parser**：`typescript-eslint@8.65.0` 尚未声明 TypeScript 7 兼容；E-002 不采用未受支持组合，使用 ESLint 10 flat config 配合独立于 TypeScript compiler 版本的 TypeScript 语法解析，并由真实 lint/typecheck 双 Gate 验证；
- **dependency-cruiser**：`18.1.0` 尚未支持 TypeScript 7 compiler API，只作为 JS/ESM 图补充并会输出兼容警告；TypeScript import、source cycle、runtime zone 与 capability 由项目 Node Gate 直接验证，PR 未扩大证据结论；
- **当前等待**：Draft PR #91 审核；
- **下一状态**：用户批准并合并后进入 Done；E-003 在此之前保持 Planned。

## 8. 最近交接

- 已合并：[E-001 PR #89](https://github.com/WeiHan1996/DailyEnergy/pull/89)；
- E-001 merge commit：`6ab172d72d7ab221e565303254bdf135437870dd`；
- E-001 Issue #39 已自动关闭为 completed；
- 当前工具链基线：Node `24.18.0`、pnpm `11.17.0`、Turbo `2.10.7`、TypeScript `7.0.2`、Zod `4.4.3`、Vitest `4.1.10`、Prettier `3.9.6`；
- 当前 Workspace Gate 已覆盖实际 workspace 枚举、唯一 lockfile、exact toolchain、显式 exports、workspace protocol、循环、app→app、deep import 和基础 client allowlist；
- E-002 需要把现有临时/局部 Gate 升级为统一 TypeScript、ESLint、Prettier 和依赖边界基线；
- 已完成：6 类 TypeScript 配置、ESLint 10 flat config、Prettier、dependency-cruiser
  补充检查、12 类项目静态 Gate、16 个 known-fail fixtures 与全 workspace clean；
- 已完成：11 个 workspace 全部继承批准 tsconfig，config Gate 使用 TypeScript 7
  实际加载每个配置并拒绝 strict/path 绕过；
- 已完成：shared-schemas wildcard barrel 改为显式导出，34 项测试与 19 个 JSON
  Schema ID 均保持通过；
- 已验证：Node `24.18.0` / pnpm `11.17.0` 隔离目录从无 `node_modules` 状态执行
  frozen install 与 `pnpm validate` 全部通过；
- 已验证：format、Workspace、config、ESLint、12 类 architecture、16 个负向
  fixtures、typecheck、34 tests、build 和 clean 全部通过；
- 当前 PR：[Draft PR #91](https://github.com/WeiHan1996/DailyEnergy/pull/91)；
- 未开始：E-003、业务代码、workflow、migration、容器或云资源；
- 下一动作：审核 Draft PR #91，重点确认 TypeScript 7 的 ESLint 解析兼容策略与
  dependency-cruiser 的证据边界；
- 接受后的下一任务：E-003 NestJS API 骨架；本 PR 不启动；
- 禁止并行：E-003 及其他下游 Issue。
