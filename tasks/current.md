# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-26
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-30
- **当前任务名称**：仓库结构和模块边界
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/repository-structure`
- **上游 PR**：[S-29 PR #34](https://github.com/WeiHan1996/DailyEnergy/pull/34)
- **当前 PR**：待创建
- **交付文件**：`docs/technical/repository-structure.md`

## 1. 当前目标

把 Accepted 的 Monorepo/技术栈和系统架构转换为可实施的仓库合同，明确：

- root、apps、packages、Prisma、OpenAPI、tests、tooling 与 prototype 的目录职责；
- Mini Program、API、Admin 与单一 Worker artifact 的薄应用/组合根边界；
- client-safe、server-core、server-adapter、server-asset 和 tooling runtime zone；
- `shared-schemas`、`api-client`、`server-core`、`server-adapters`、`prompt-library` 与配置 package；
- 15 个 `server-core` 业务模块、public contract、adapter SPI 和允许依赖；
- Interactive、Background、Restricted、Migration 的入口与 capability allowlist；
- Schema/OpenAPI/client/Prisma 的单向权威和生成关系；
- workspace、exports、module graph、client、provider、restricted 与 drift Gate。

## 2. 必须交付

### 2.1 目录与 package

- 目标 Monorepo 树及目录所有权；
- 四个 deployable app 不互相依赖；
- 七类初始 workspace package 的职责、runtime zone 和 public exports；
- root Prisma/OpenAPI 权威源、tests/tooling/docker/prototype 边界；
- 当前独立 `shared-schemas` 迁入 root workspace 的兼容顺序。

### 2.2 模块与运行时能力

- `server-core` 的 15 个上下文、最小 shared-kernel 和模块内分层；
- 跨模块只用 public contract/event/port，adapter 只用 SPI；
- API/Worker composition 只获得对应 capability；
- provider SDK、Prompt、restricted 与 migration 能力不可越界；
- client/admin bundle 不能包含 server-only、secret 或受限字段。

### 2.3 自动验收与下游

- 12 类 clean-checkout 静态/生成/安全 Gate；
- 48 个唯一 `S30-REPO-*` 场景；
- E-001～E-011 的精确交接；
- S-31 测试、S-32 部署、S-33 可观测性与 S-34 Issues 的边界。

## 3. 上游读取顺序

1. `AGENTS.md`、`README.md`、`ROADMAP.md`、`docs/INDEX.md`、本文；
2. `docs/decisions/ADR-0006-monorepo-and-stack.md`；
3. `docs/technical/architecture.md`；
4. `packages/shared-schemas/README.md` 与现有 package exports；
5. `docs/technical/database.md`、`api.md`；
6. `prisma/schema.prisma`、`openapi/openapi.yaml`；
7. `docs/technical/repository-structure.md`。

## 4. 已冻结边界

- 一个 repository、pnpm workspace、root lockfile 和 Turbo task graph；
- Node 24 LTS、TypeScript 7 strict、服务端 ESM 与微信小程序兼容输出；
- 微信原生小程序、NestJS/Express、Next/React、PostgreSQL/Prisma、Redis/BullMQ、Zod 不重新选型；
- 模块化单体、一个数据库/application schema、无内部 HTTP/RPC；
- PostgreSQL 是业务事实；Redis、queue、cache、analytics 不是；
- API/Admin/三类 Worker runtime、事务/outbox/inbox/Gateway/Safety/删除语义不变；
- Zod 是 JSON 字段权威，OpenAPI 是 HTTP 路径/envelope 权威，Prisma 不成为 API DTO；
- 当前仓库尚无 root workspace 或 deployable app。

## 5. 不做

- 不创建 root package、workspace、lockfile、Turbo、tsconfig 或 ESLint；
- 不创建 apps/packages/tooling/tests 目录或业务代码；
- 不初始化 NestJS、Next.js、微信小程序、Worker、Prisma Client、Redis/BullMQ；
- 不创建 migration、queue/key、Docker、CI、secret 或生产配置；
- 不决定完整测试矩阵（S-31）、部署/回滚（S-32）、SLO/告警（S-33）；
- 不提前开始 E-001 或 S-31。

## 6. 验收标准

- `repository-structure.md` 为 Draft，包含目标树、app/package/module/public API、profile capability、Schema/codegen、配置与 Gate；
- 48 个 `S30-REPO-*` 场景完整且唯一；
- 所有相对链接可解析；
- `architecture.md` 根据用户确认转为 Accepted，S-29 backlog 为 Done；
- README、INDEX、tasks/current 和 backlog 一致标记 S-30 In Review；
- PR 仅包含 6 个 Markdown 文件，无 workspace、目录骨架、配置、代码、migration 或生产变更；
- 用户确认前 `repository-structure.md` 保持 Draft，S-30 保持 In Review。

## 7. 最近交接

- [PR #34](https://github.com/WeiHan1996/DailyEnergy/pull/34) 已于 2026-07-26 合并，S-29 系统架构已获用户明确确认；
- `architecture.md` 在本分支补记 Accepted/接受日期，不改变架构结论；
- S-30 Draft 冻结目标目录、薄 app、七类 package、15 个 server-core 模块和 public exports/SPI；
- Worker 使用一个 artifact 和 Interactive/Background/Restricted/Migration 四个入口，各自 capability 不可越界；
- 已定义 12 类自动 Gate 与 48 个仓库边界场景，S-31 是下一任务；
- 当前动作：等待用户审核当前 Draft PR；不自动接受、合并或开始 S-31。
