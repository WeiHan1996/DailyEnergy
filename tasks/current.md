# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-26
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-28
- **当前任务名称**：Monorepo 与技术栈决策
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/monorepo-stack`
- **上游 PR**：[S-27 PR #32](https://github.com/WeiHan1996/DailyEnergy/pull/32)
- **当前 PR**：[Draft PR #33](https://github.com/WeiHan1996/DailyEnergy/pull/33)
- **交付文件**：`docs/decisions/ADR-0006-monorepo-and-stack.md`

## 1. 当前目标

把 Accepted 的产品、AI、数据、API、隐私和分析规格转换为一套可重复初始化、可升级且不过度工程化的 Monorepo 与技术栈决策，明确：

- 单 Git 仓库、pnpm workspace、Turborepo 与单 lockfile；
- Node 24 LTS、TypeScript 7 和框架/数据组件主版本；
- 微信原生小程序、NestJS API、Next.js Admin 与共享 packages 的运行边界；
- ESM、微信运行时输出、Zod/DTO/Prisma/OpenAPI 权威关系；
- workspace dependency、frozen install、版本升级、容器 digest 和缓存规则；
- S-29～S-33 与 E-001～E-011 怎样接续。

## 2. 必须交付

### 2.1 Monorepo 决策

- 一个 GitHub repository，不拆 polyrepo、submodule 或独立版本线；
- pnpm 11 workspace 管依赖与本地 package linking；
- Turborepo 2 只负责任务图、并行与缓存，不定义业务架构；
- root private package、一个 `pnpm-lock.yaml`、workspace protocol 和 frozen CI install；
- deployable apps 与 reusable packages 分开，禁止跨 app 相对路径引用源码。

### 2.2 技术与版本基线

- Node 24 LTS、TypeScript 7 strict；
- 微信原生小程序 + TypeScript；
- NestJS 11 + Express 5、Next.js 16 + React 19；
- PostgreSQL 18 + Prisma ORM 7；
- Redis Open Source 8 + BullMQ 5；
- Zod 4、Vitest 4、ESLint 10、Prettier 3、Docker Compose v2；
- 主版本由 ADR 冻结，精确 patch 由 lockfile、版本文件和容器 digest 固定。

### 2.3 边界与下游

- server/admin/shared packages 默认 ESM；miniapp 输出由微信运行时兼容目标控制；
- Zod/shared-schemas 是 JSON 业务合同权威，Nest DTO 与 Prisma model 不成为第二套 Schema；
- Redis/queue/cache 不成为业务事实，数据库与 Accepted 契约仍是权威；
- remote cache、部署、进程、模块、测试和可观测性分别留给 S-29～S-33；
- S-28 PR 只包含 ADR 和项目控制文档，不创建工程骨架。

## 3. 上游读取顺序

1. `AGENTS.md`、`README.md`、`ROADMAP.md`、`docs/INDEX.md`、本文；
2. `docs/decisions/ADR-0002～ADR-0005`；
3. `docs/ai/gateway.md`；
4. `docs/data/domain-model.md`；
5. `docs/technical/database.md`、`api.md`、`error-codes.md`；
6. `docs/operations/privacy-data-map.md`；
7. `docs/analytics/event-tracking.md`、`metrics.md`、`experiments.md`、`channel-attribution.md`；
8. `packages/shared-schemas/README.md`、`package.json`、tsconfig 与测试；
9. `prisma/schema.prisma`；
10. `docs/decisions/ADR-0006-monorepo-and-stack.md`。

## 4. 已冻结边界

- TypeScript 全栈、微信原生小程序、NestJS、Next.js、PostgreSQL/Prisma、Redis/BullMQ、Zod 和 Docker Compose 不重新选型；
- 不因 Monorepo 把小程序、API、Admin 部署为同一进程；
- 不因共享 package 让客户端引用 Prisma、密钥、Node-only 模块或服务端实现；
- 不把 Turbo cache、Redis、queue 或日志当业务事实；
- 不用浮动 latest、无锁安装或共享/生产 `prisma db push`；
- 不提前拆微服务、数据库或独立仓库；
- 当前 repository 已有 shared-schemas 与 Prisma Draft，但还没有 root workspace/lockfile；
- 当前没有可部署工程骨架、CI、生产拓扑或远程缓存合同。

## 5. 不做

- 不创建或修改 root `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`turbo.json` 或 tsconfig；
- 不创建 apps/api、apps/admin、apps/miniapp 骨架；
- 不生成 Prisma Client、migration、数据库或 Redis；
- 不选择云厂商、KMS、对象存储、CI vendor、远程缓存 vendor 或生产网络；
- 不定义 S-29 服务/进程/事务架构、S-30 目录、S-31 测试矩阵或 S-32 部署；
- 不升级当前 shared-schemas 依赖；E-001 在 Accepted ADR 后统一落地。

## 6. 验收标准

- ADR-0006 为 Proposed，包含 Monorepo、版本、模块、依赖、构建、缓存、供应链、备选方案和迁移 Gate；
- 32 个 `S28-STACK-*` 场景 ID 唯一；
- 所有相对链接可解析；
- S-27 根据用户确认转为 Accepted，backlog 为 Done；
- README、INDEX、tasks/current 和 backlog 一致标记 S-28 In Review；
- PR 仅包含 6 个 Markdown 文件，无 root workspace、代码、Schema、API、数据库、migration 或生产配置；
- 用户确认前 ADR-0006 保持 Proposed，S-28 保持 In Review。

## 7. 最近交接

- [PR #32](https://github.com/WeiHan1996/DailyEnergy/pull/32) 已于 2026-07-26 合并，S-27 已获用户明确确认；
- `channel-attribution.md` 在本分支补记 Accepted/接受日期，不改变渠道合同内容；
- S-28 Proposed 已冻结 pnpm/Turbo 单仓、Node 24 LTS、TypeScript 7 与现有框架主版本；
- 精确 patch、root workspace、lockfile 和命令由 E-001 在 ADR Accepted 后落地；
- S-29 系统架构是下一任务，未提前开始；
- 当前动作：等待用户审核 [Draft PR #33](https://github.com/WeiHan1996/DailyEnergy/pull/33)；不自动接受或合并。
