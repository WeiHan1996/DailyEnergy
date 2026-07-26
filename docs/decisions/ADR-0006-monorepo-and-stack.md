# ADR-0006：pnpm/Turborepo TypeScript Monorepo 与主版本基线

- **状态**：Accepted
- **日期**：2026-07-26
- **接受日期**：2026-07-26
- **所属任务**：S-28 — Monorepo 与技术栈决策
- **决策范围**：仓库模型、包管理、任务编排、运行时、框架、数据组件、模块格式、依赖边界、版本与供应链治理
- **决策所有者**：DailyEnergy 项目
- **相关文档**：[项目说明](../../README.md)、[Agent Instructions](../../AGENTS.md)、[AI Gateway](../ai/gateway.md)、[数据库规格](../technical/database.md)、[API 契约](../technical/api.md)、[隐私数据地图](../operations/privacy-data-map.md)、[共享 Schema](../../packages/shared-schemas/README.md)、[Prisma 草案](../../prisma/schema.prisma)、[ADR-0003](./ADR-0003-ai-provider-abstraction.md)、[ADR-0005](./ADR-0005-data-retention-and-deletion.md)

## 1. 背景

DailyEnergy 已经冻结微信小程序、NestJS API、Next.js 管理后台、PostgreSQL/Prisma、Redis/BullMQ、Zod、AI Gateway 和 Docker Compose 等技术方向，也已有可执行 shared-schemas 与 Prisma 结构草案。但仓库尚无 root package、workspace、统一 lockfile、任务图或运行时版本合同。

如果直接进入工程初始化，会留下这些歧义：

- 小程序、API、Admin 和共享包是否放在一个仓库；
- npm、pnpm、Yarn、Nx、Turbo 或多个独立构建怎样组合；
- 本地 package 是链接到源码还是误从 registry 下载；
- Node、TypeScript、NestJS、Next.js、Prisma、PostgreSQL 和 Redis 使用哪个主版本；
- 服务端 ESM 与微信小程序运行时输出怎样隔离；
- Zod、Nest DTO、Prisma model 与 OpenAPI 谁是业务 JSON 合同权威；
- AI 辅助开发是否会生成第二个 lockfile、跨 app 深层引用或泄漏服务端依赖；
- 缓存、自动升级和浮动版本是否会破坏可复现构建；
- Monorepo 是否被误解为一个部署单元，或成为提前拆微服务的理由。

S-28 必须在 E-001 初始化前固定这些工程约束，同时把系统架构、模块目录、测试、部署和可观测性留给 S-29～S-33。

## 2. 决策

DailyEnergy 使用一个 GitHub repository 和一个 pnpm workspace，包含所有 deployable apps、共享 packages、Prisma、OpenAPI、文档和工程工具。

依赖安装与 workspace linking 使用 pnpm 11；任务依赖图、并行执行和可复现缓存使用 Turborepo 2。仓库只有一个 root `pnpm-lock.yaml`，内部 package 必须使用 `workspace:` protocol。Turbo 不拥有依赖解析、业务模块、部署拓扑或数据边界。

生产 Node 基线为 Node.js 24 LTS，不使用当前但尚未 LTS 的 Node 26。TypeScript 基线为 7，默认 strict。已接受框架继续使用微信原生小程序、NestJS、Next.js、PostgreSQL/Prisma、Redis/BullMQ 和 Zod，不换成跨端框架、Bun/Deno、MongoDB、向量数据库或微服务平台。

主版本由本 ADR 冻结；精确 patch/minor 由 E-001/E-006 的 manifest、单 lockfile、Node 版本文件和容器 digest 固定。安装、升级和容器更新必须经过 PR 与验证，禁止 `latest`、无锁安装和共享/生产 `prisma db push`。

## 3. 决策摘要

| 主题 | S-28 唯一结论 |
|---|---|
| Git | 一个 repository；不拆 polyrepo、submodule 或独立发布仓 |
| Workspace | pnpm 11 workspace；单 root manifest 与单 lockfile |
| Task graph | Turborepo 2；只做任务依赖、并行和缓存 |
| Runtime | Node.js 24 LTS；开发、CI、容器同一 major |
| Language | TypeScript 7 strict；共享业务代码不写 JavaScript 旁路 |
| Mini Program | 微信原生小程序 + TypeScript；独立平台兼容 emit/bundle |
| API | NestJS 11 + Express 5；HTTPS JSON REST 契约不变 |
| Admin | Next.js 16 + React 19；只使用受控 Admin API |
| Contract | Zod 4 / shared-schemas 是 JSON 业务字段权威 |
| Database | PostgreSQL 18 + Prisma ORM 7；Prisma CLI/Client 同版本 |
| Queue/cache | Redis Open Source 8 + BullMQ 5；非业务事实 |
| Quality | Vitest 4、ESLint 10、Prettier 3；完整策略由 S-31 |
| Local/deploy | Docker Compose v2 为初始模型；生产拓扑由 S-32 |
| Version | 冻结 major，lockfile/digest 固定 exact，升级走 PR |
| Architecture | modular monolith 优先；进程与模块由 S-29/S-30 |

## 4. Monorepo 合同

### 4.1 单一仓库与 workspace

E-001 创建一个 `private: true` 的 root package。workspace 至少覆盖 deployable apps 和 reusable packages；确切目录由 S-30 固定。

仓库级不变量：

- 只有一个 `pnpm-lock.yaml`；
- 不提交 npm、Yarn 或第二个 pnpm lockfile；
- CI 只执行 `pnpm install --frozen-lockfile`；
- 本地 package 依赖使用 `workspace:*` 或更窄的 workspace range；
- workspace package 名使用 `@daily-energy/*`；
- package 必须声明公开 `exports`，调用方不能读取其 `src/internal`；
- app 不能通过 `../../apps/other-app/src` 共享源码；
- package graph 必须无环，业务依赖只朝稳定共享合同方向；
- root 负责统一命令和版本策略，不承载业务实现；
- 文档、OpenAPI 和 Prisma 可以留在 repository root，但不能被误当作运行时 package。

pnpm 的 `workspace:` protocol 会在本地 package 不存在或版本不匹配时失败，而不是静默从 registry 获取同名包；这是内部依赖的强制边界。

### 4.2 Turborepo 职责

Turbo 统一编排 `format:check`、`lint`、`typecheck`、`test`、`build` 和后续 contract/e2e 命令，并依据 package graph 先构建依赖。

Turbo 只能：

- 描述任务依赖、输入和输出；
- 并行运行互不依赖任务；
- 缓存确定性构建/检查结果；
- 为本地和 CI 提供一致入口。

Turbo 不能：

- 决定领域模块、数据库表、HTTP 路由或部署单元；
- 绕过 package manifest 声明隐式依赖；
- 缓存 secret、`.env`、真实用户数据、provider 输出或 production dump；
- 把失败测试、migration 或带外部副作用任务声明为可复用成功缓存；
- 在 S-32 评审前启用第三方 remote cache。

v1 只要求本地/CI 可删除缓存。远程缓存的服务商、区域、加密、访问、期限和 secret handling 由 S-32/S-21 类评审后再启用。

### 4.3 Monorepo 不等于单进程

一个仓库只代表统一版本、合同和变更审阅，不代表把所有能力部署在同一进程。

- 微信小程序是客户端构建产物；
- API 与 Admin 是不同 deployable app；
- worker 是否独立进程、事务/outbox、队列和 AI Gateway 运行边界由 S-29 决定；
- PostgreSQL 仍是单一权威数据库，Redis/BullMQ 不是第二事实库；
- Phase 1～3 不提前拆微服务仓库、独立数据库或网络 RPC；
- 若未来规模需要拆分，先用现有 package/module 边界和新 ADR 证明必要性。

## 5. 运行时与工具链基线

### 5.1 版本策略

| 组件 | 冻结主版本 | E-001/E-006 规则 |
|---|---:|---|
| Node.js | 24 LTS | `engines >=24 <25`；版本文件和容器固定 exact patch |
| pnpm | 11 | root `packageManager` 固定 exact；CI 不使用全局漂移版本 |
| Turborepo | 2 | root devDependency 固定 exact |
| TypeScript | 7 | root catalog/override 固定 exact；全部 TS package 同版本 |
| NestJS / Express | 11 / 5 | 同一 Nest major；adapter 包同版本 |
| Next.js / React | 16 / 19 | 使用 Next 官方支持组合并锁 exact |
| Zod | 4 | shared-schemas 单一运行时版本 |
| PostgreSQL | 18 | image 固定 exact minor + digest；不用 19 beta |
| Prisma CLI/Client | 7 | 两者 exact 相同；adapter/driver 兼容矩阵通过 |
| Redis Open Source | 8 | image 固定 exact minor + digest |
| BullMQ | 5 | client/adapter/Redis 组合通过 E-007 验证 |
| Vitest | 4 | 单元/契约基线；S-31 决定其它层 |
| ESLint | 10 | flat config；共享规则包由 E-002 创建 |
| Prettier | 3 | 单一版本与配置 |
| Docker Compose | v2 | 开发与初始部署入口；镜像不得用 latest |

截至 2026-07-26 的兼容性证据：

- [Node.js release table](https://nodejs.org/en/about/previous-releases) 把 v24 标为 LTS、v26 标为 Current，并建议生产只用 LTS；
- [pnpm workspace](https://pnpm.io/workspaces) 明确支持 `workspace:` protocol；
- [pnpm package.json](https://pnpm.io/package_json) 说明 package-manager/runtime 版本与 lockfile 管理；
- [Turborepo configuration](https://turborepo.com/docs/reference/configuration) 依赖 root package manager 与 lockfile 建立 package graph/caching；
- [TypeScript 7 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-7-0.html) 是当前编译器主版本基线；
- [Prisma 7 upgrade guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7) 与已接受 Prisma 7 Schema 语法一致；
- [PostgreSQL 18 current documentation](https://www.postgresql.org/docs/current/index.html) 与 PostgreSQL 五年主版本支持政策一致；
- [Redis Docker instructions](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/docker/) 支持显式 `redis:<version>`；
- [BullMQ connections](https://docs.bullmq.io/guide/connections) 用于固定 Redis client/connection 组合；
- [Nest first steps](https://docs.nestjs.com/first-steps) 说明 Express 是默认、Fastify 是可选 adapter。

注册表快照显示当前 compatible release 包括 pnpm 11.17、Turbo 2.10、TypeScript 7.0、NestJS 11.1、Next.js 16.2、Prisma 7.9、Zod 4.4、BullMQ 5.81、Vitest 4.1、ESLint 10.8 与 Prettier 3.9。该快照用于证明主版本可用，不授权 manifest 使用浮动 range；E-001 仍须在落地日重新验证 exact patch。

### 5.2 为什么选择 Node 24 LTS

Node 26 在决策日仍是 Current，不作为生产基线。Node 24：

- 是官方 LTS；
- 满足 NestJS 11、Next.js 16、Prisma 7、Vitest 4 和 ESLint 10 的 engine 要求；
- 比已 EOL 的 Node 20 更适合新项目生命周期；
- 避免以未进入 LTS 的 runtime 作为数据库 migration、CI 和容器基础。

Node major 升级需要依赖 engine、原生模块、Prisma、Next、Nest、测试和容器全矩阵；不能仅因官网出现新 Current 就切换。

### 5.3 TypeScript 与模块格式

- 所有新业务源码使用 TypeScript strict；
- server/admin/shared package 默认 `type: module`；
- Node package 使用适合 Node 24 的 NodeNext 语义，不依赖 bundler 才能修复的错误 import；
- package public export 的相对 import 在编译后必须可运行；
- 禁止 TS path alias 跨越 package 边界并隐藏未声明依赖；
- miniapp 源码仍是 TypeScript，但 emit/bundle 必须符合微信开发者工具和目标基础库；
- miniapp 不得导入 `node:*`、Prisma、Nest、server env、provider SDK 或 secret-bearing package；
- 若 miniapp 不能直接消费某个 ESM runtime package，应由受控 build/generation 产生 client-safe 投影，不复制手写第二套 enum/Schema；
- Node 原生 TypeScript strip 不替代项目编译、声明生成和类型检查。

S-30 决定具体 tsconfig 继承树，S-31 决定 compile/runtime conformance 测试。

## 6. 应用与数据技术边界

### 6.1 微信原生小程序

保持微信原生小程序 + TypeScript，不改用 Taro、uni-app、React Native 或 WebView 主应用。

原因：

- 当前只验证微信生态核心旅程；
- 原生 API、登录、订阅消息、分享和审核路径最直接；
- 避免为尚未验证的多端目标引入适配层；
- 一分钟体验的页面规模不需要跨端框架复杂度。

具体基础库最低版本、组件方案、构建器和分包由 E-004/S-30 固定，并必须通过真机与包体检查。

### 6.2 API

API 使用 NestJS 11 + Express 5，继续实现 Accepted HTTPS JSON REST /v1 契约。

- module/controller/DTO 不能等同领域边界或 Prisma 行；
- Express 是当前 Nest 默认，MVP 没有证明 Fastify 的额外切换成本必要；
- 若 S-29/S-33 的量化证据要求 Fastify，必须以适配与回归 PR 明确修改本 ADR；
- 业务逻辑不得依赖 Express request/response 类型；
- AI provider 仍只经过 ADR-0003 Gateway adapter。

### 6.3 Admin

Admin 使用 Next.js 16 + React 19。

- Admin 只调用受控 Admin API，不直连 PostgreSQL、Redis 或 provider；
- server component / route handler 不能绕过 NestJS 权限与审计边界；
- 不把用户原文、密钥或受限记录打入静态 bundle；
- 部署模式、SSO、RBAC 和网络由 S-29/S-32 决定。

### 6.4 Schema、DTO、ORM 与 OpenAPI

权威关系固定为：

1. Accepted 产品/ADR 定义语义；
2. `packages/shared-schemas` 的 Zod 定义 JSON 字段、枚举、字符预算、cross-field 与 unknown-key 行为；
3. OpenAPI 定义 HTTP 路径、envelope、状态与公开投影；
4. Nest DTO/pipe 负责 transport adaptation，不复制一套可漂移业务 Schema；
5. Prisma model 负责持久化结构、relation 和数据库映射，不直接成为 API DTO；
6. PostgreSQL constraint/transaction 负责数据库可保护的不变量。

允许 class-validator 作为 Nest transport 层薄适配，但共享业务字段必须引用或生成自 Zod 权威。发现 Zod、OpenAPI、DTO、Prisma 漂移时构建失败，不由运行时“兼容”掩盖。

### 6.5 PostgreSQL、Prisma、Redis 与 BullMQ

- PostgreSQL 18 是 Phase 1～3 单一权威数据库；
- Prisma 7 CLI 与 Client exact 同版本；
- `prisma.config.ts` 持有连接配置入口，secret 来自环境，不提交；
- Prisma migration 只使用版本化历史与受审 SQL；共享/生产禁用 `db push`；
- Redis 8 用于 cache、rate limit、breaker、ephemeral coordination 和 BullMQ；
- BullMQ 5 用于明确可重试的后台工作，不代替数据库 command receipt/outbox/事实；
- queue payload 只含最小 opaque ref/version，不含用户原文、Prompt、Safety 内容或 secret；
- Redis 丢失、重复投递和迟到任务必须由 PostgreSQL 唯一性、revision、guard 与幂等恢复；
- client adapter、连接数、持久化、淘汰和 topology 由 S-29/E-007 固定。

## 7. 依赖、构建与供应链治理

### 7.1 依赖声明

- E-001 启用 save-exact；直接依赖不使用 `latest`、`next` 或宽泛 `*`；
- 所有 workspace package 使用统一 catalog/override 或等价 root policy；
- 同一库原则上只允许一个主版本，例外必须记录原因与移除计划；
- internal package 使用 `workspace:`，不从 registry 回退；
- runtime dependency 与 devDependency 分开；
- app 不能依赖另一个 deployable app；
- server-only package 明确阻止 client/miniapp import；
- install script、native binary 和 postinstall 新增必须单独审阅；
- lockfile 变化必须能对应 manifest 或 package-manager 变化。

### 7.2 构建与命令

每个 package 至少按适用范围提供：

- `format:check`；
- `lint`；
- `typecheck`；
- `test`；
- `build`；
- `validate` 或由 root/Turbo 聚合等价命令。

root 命令必须从 package graph 运行，不能依赖某位开发者全局安装。CI 在干净 checkout 上先 frozen install，再运行 format/lint/typecheck/test/build 和 S-31 后续合同检查。

### 7.3 版本升级

- patch/minor：受审 dependency PR，要求 lockfile diff、release/security note、相关检查和必要 migration/fixture；
- major：更新或 supersede 本 ADR，并执行跨 app、Schema、Prisma、migration、容器和回滚评审；
- Node LTS 切换：只在目标版本进入 LTS 且全部 engine/测试通过后；
- PostgreSQL major：独立升级/恢复演练，不随普通 package PR；
- Prisma major/minor：CLI/Client 同步，生成 SQL diff 与 schema/migration 验证；
- Redis/BullMQ：执行重复投递、连接中断、重启、脚本和队列兼容矩阵；
- Next/Nest major：执行 build、SSR/API、错误、鉴权、序列化和部署回归；
- 自动化工具可以开 PR，不能自动合并或直接更新生产 image。

### 7.4 缓存、secret 与产物

- cache key 必须包含 lockfile、相关源码、配置、Node/pnpm/Turbo/TypeScript 版本和显式环境输入；
- cache output 只包含可重建 build/test artifact；
- `.env*`、secret、证书、provider response、数据库 dump、真实内容和受限报告永不缓存；
- secret 只通过环境/secret store 注入，不写 package、Turbo config、Dockerfile 或客户端 bundle；
- source map、test report、coverage 和日志在 S-21/S-32/S-33 确认内容与期限后才能上传外部服务；
- container 使用 explicit version + digest；不得使用 `node:lts`、`postgres:latest`、`redis:latest`；
- SBOM、license、vulnerability 和 provenance Gate 由 E-011/S-32 定义，不得因尚未定义而关闭 lockfile/frozen install。

## 8. 备选方案

### 方案 A：每个 app 一个独立 repository

可独立发布，但当前只有一个产品团队和大量共享 Schema/契约。会制造跨仓版本漂移和多 PR 协调，拒绝。

### 方案 B：npm/Yarn workspace

都能实现单仓，但当前需要严格 workspace protocol、磁盘效率和明确 lockfile；pnpm 已满足且无额外平台依赖。拒绝作为基线。

### 方案 C：Nx

提供更完整的 generator、graph 和 enforcement，但当前三个 app 与少量 package 不需要第二套项目模型和 plugin migration。若规模证据出现再评估；当前拒绝。

### 方案 D：只用 pnpm scripts，不用 Turbo

初期最少依赖，但跨 package build/test 顺序、并行、输入输出和 CI cache 会逐渐手写。Turbo 只承担薄任务层，接受其小成本。

### 方案 E：Lerna

发布多 npm package 是其传统强项，而 DailyEnergy 的 packages 为 private、随产品统一版本。没有必要，拒绝。

### 方案 F：Bun 或 Deno

运行与工具体验有吸引力，但现有 Nest/Next/Prisma/微信工具链和 Node LTS 合同更成熟。拒绝用于 MVP runtime；未来需要新 ADR。

### 方案 G：Taro/uni-app 跨端小程序

可为多端复用 UI，但当前只验证微信，且会增加原生能力、审核与调试适配。拒绝用于 MVP。

### 方案 H：微服务与独立数据库

能隔离部署，但当前流量、团队和事务复杂度不支持其成本，并会损害同日唯一、删除与 Safety guard。拒绝；先 modular monolith。

### 方案 I：Fastify adapter

性能潜力更高，但当前没有容量证据，Express 是 Nest 默认且兼容成本最低。暂不采用；S-29/S-33 有量化证据时再评审。

## 9. 影响

### 9.1 正向影响

- 一个 PR 可原子更新 API、Schema、客户端与文档；
- 单 lockfile 和 exact toolchain 降低 AI 生成环境漂移；
- workspace protocol 防止内部包误从 registry 获取；
- Turbo 提供统一任务图而不引入重型架构平台；
- Node 24 LTS 与当前框架 engine 相容；
- Zod/DTO/Prisma/OpenAPI 权威边界清楚；
- 小程序与 Node-only 代码隔离；
- PostgreSQL/Redis 职责不因工具选择而漂移；
- 版本、缓存和容器更新可审计、可回滚。

### 9.2 代价与限制

- 单仓 CI 需要良好任务输入、缓存和 package graph；
- pnpm symlink/严格依赖会暴露隐式依赖，需要修复旧 package；
- ESM 与微信小程序输出需要两套受控编译目标；
- exact 版本需要持续依赖维护，不能依赖浮动 range 自动获取修复；
- Turbo 增加一个工具和配置文件；
- modular monolith 不能独立扩缩所有模块，但符合 MVP 规模；
- Express 极限性能低于 Fastify 的潜力，但当前不是验证瓶颈；
- PostgreSQL/Redis major 固定后，升级必须有专门演练。

## 10. 实施与迁移要求

### 10.1 E-001 初始化

E-001 必须：

1. 创建 root private `package.json`；
2. 固定 Node 24 exact patch 与 `engines >=24 <25`；
3. 固定 pnpm 11 exact packageManager；
4. 创建 `pnpm-workspace.yaml` 与唯一 `pnpm-lock.yaml`；
5. 创建最小 `turbo.json` 与 root 聚合命令；
6. 把现有 shared-schemas 纳入 workspace；
7. 将现有 npm scripts 语义迁移为 pnpm/Turbo 入口，不改变 Schema；
8. 在干净 clone 上 frozen install、format、typecheck、test、build 全部通过；
9. 添加禁止第二 lockfile、跨 app deep import 和 client 引入 server-only package 的 Gate；
10. 不在 E-001 顺手创建完整业务模块。

### 10.2 后续交接

- E-002：strict tsconfig、ESLint flat config、Prettier、dependency-boundary rule；
- E-003：NestJS 11 + Express 5 API 骨架；
- E-004：微信小程序 TypeScript 构建与真机基线；
- E-005：Next.js 16 + React 19 Admin 骨架；
- E-006：PostgreSQL 18、Prisma 7 exact、config 与 migration；
- E-007：Redis 8、BullMQ 5、连接/重试/幂等；
- E-008：共享 types/Schema 与生成投影；
- E-009：Docker Compose v2 本地环境；
- E-010：测试骨架；
- E-011：CI frozen install、检查、SBOM/security；
- S-29：系统、进程、事务、outbox、Gateway 与 worker 边界；
- S-30：目录、package public API 和依赖方向；
- S-31：测试层级、工具和矩阵；
- S-32：环境、容器、secret、发布、migration 和回滚；
- S-33：日志、指标、trace、成本和告警。

## 11. 固定验证场景

| ID | 场景 | 预期 |
|---|---|---|
| S28-STACK-001 | root 同时出现 package-lock.json | CI 拒绝；只允许 pnpm-lock.yaml |
| S28-STACK-002 | app 依赖内部包但不用 workspace protocol | CI 拒绝 |
| S28-STACK-003 | 本地包缺失时从 registry 下载同名包 | workspace 安装失败，不回退 |
| S28-STACK-004 | apps/admin 相对引用 apps/api/src | 依赖边界失败 |
| S28-STACK-005 | package 读取另一个 package 的 src/internal | exports/边界检查失败 |
| S28-STACK-006 | package graph 形成环 | graph 检查失败 |
| S28-STACK-007 | miniapp import node:crypto | 构建失败 |
| S28-STACK-008 | miniapp import Prisma Client | 构建失败 |
| S28-STACK-009 | Admin 静态 bundle 含 provider key | secret/bundle Gate 失败 |
| S28-STACK-010 | API 返回 Prisma row | contract test 失败 |
| S28-STACK-011 | Zod 与 OpenAPI enum 不同 | contract drift Gate 失败 |
| S28-STACK-012 | Nest DTO 新增业务字段但 Zod 未定义 | contract drift Gate 失败 |
| S28-STACK-013 | CI 使用非 frozen install | pipeline Gate 失败 |
| S28-STACK-014 | pnpm 全局版本不同于 root exact | bootstrap 拒绝或激活 root 版本 |
| S28-STACK-015 | Node 26 Current 被直接设为生产 | 拒绝；等待 LTS 与全矩阵 |
| S28-STACK-016 | Node 24 patch 升级且全检查通过 | 可由普通依赖 PR 接受 |
| S28-STACK-017 | TypeScript strict 被 package 关闭 | 配置 Gate 失败 |
| S28-STACK-018 | TS path alias 跨 package 隐藏依赖 | 依赖边界失败 |
| S28-STACK-019 | Turbo cache 包含 .env | 安全 Gate 失败 |
| S28-STACK-020 | 未评审启用第三方 remote cache | 拒绝 |
| S28-STACK-021 | migration 任务被成功缓存后跳过 | 配置 Gate 失败 |
| S28-STACK-022 | Prisma CLI 与 Client patch 不同 | 构建/迁移 Gate 失败 |
| S28-STACK-023 | 使用 PostgreSQL 19 beta 初始化 | 拒绝；基线为 18 |
| S28-STACK-024 | 共享环境执行 prisma db push | 拒绝 |
| S28-STACK-025 | Redis 丢失导致业务事实消失 | 架构测试失败；PostgreSQL 恢复 |
| S28-STACK-026 | BullMQ 重复投递同一 command | 由幂等/唯一性收敛为一次事实 |
| S28-STACK-027 | queue payload 含用户 note | 隐私 Gate 失败 |
| S28-STACK-028 | 为一个模块新建 repository/数据库 | 拒绝；需新 ADR 与证据 |
| S28-STACK-029 | 用 Taro 替换微信原生小程序 | 拒绝；需新 ADR |
| S28-STACK-030 | Next/Nest major 自动合并 | 拒绝；major 必须更新 ADR |
| S28-STACK-031 | S-28 PR 创建 workspace/代码骨架 | 范围 Gate 失败 |
| S28-STACK-032 | E-001 干净 clone 执行统一 validate | frozen install 与全任务通过 |

## 12. 验收标准

- 一个 repository、pnpm workspace、Turbo task graph 和单 lockfile 的职责完整；
- Node 24 LTS、TypeScript 7 与框架/数据主版本明确；
- exact patch、frozen install、workspace protocol、容器 digest 和升级规则明确；
- server/admin/shared ESM 与 miniapp 平台输出隔离；
- Zod、OpenAPI、Nest DTO、Prisma 和 PostgreSQL 权威关系唯一；
- app/package 边界、无环依赖和禁止 deep import 可自动验证；
- Turbo cache、remote cache、secret 和 artifact 边界明确；
- PostgreSQL 是权威，Redis/BullMQ 故障不创造或删除业务事实；
- 32 个固定场景 ID 唯一；
- E-001～E-011 与 S-29～S-33 的交接清楚；
- PR 只包含 ADR 与项目控制更新，不包含 workspace、业务代码、migration 或生产配置；
- 用户确认前本 ADR 保持 Proposed。

## 13. 决策状态

- 状态：Accepted；
- 接受日期：2026-07-26；
- 内容 PR：[PR #33](https://github.com/WeiHan1996/DailyEnergy/pull/33)；
- 已确认范围：pnpm/Turbo 单仓、Node 24 LTS、主版本矩阵、ESM/miniapp 边界、Schema 权威、依赖/缓存/升级规则、32 个场景和下游 Gate；
- 下一任务：S-29 系统架构；Phase 1 工程初始化仍须等待 Phase 0B Gate 与对应工程任务。
