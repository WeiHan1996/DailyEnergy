# DailyEnergy 仓库结构与模块边界

- **文档状态**：Draft
- **所属任务**：S-30 — 仓库结构和模块边界
- **最后更新**：2026-07-26
- **适用范围**：Phase 0B / Phase 1～3 的 Monorepo 目录、workspace package、模块 public API、依赖方向、Worker profile 入口和静态边界 Gate
- **上游权威**：[ADR-0006 Monorepo 与技术栈](../decisions/ADR-0006-monorepo-and-stack.md)、[系统架构](./architecture.md)、[共享 Schema](../../packages/shared-schemas/README.md)、[数据库规格](./database.md)、[API 契约](./api.md)
- **可执行合同**：[Prisma 草案](../../prisma/schema.prisma)、[OpenAPI 草案](../../openapi/openapi.yaml)
- **下游任务**：S-31～S-34、E-001～E-011、C-001～C-016、AI-001～AI-016

## 1. 目的

本文把已接受的 pnpm/Turborepo 单仓和模块化单体架构，转换为可直接用于工程初始化的仓库合同。核心验收句是：

> deployable app 只做平台入口与组合，业务语义只存在于明确的领域/应用模块；调用方只能通过 package exports 和模块 public contract 依赖，客户端、普通服务端、AI 与受限数据能力在静态依赖图上不可越界。

本文回答：

1. 根目录、deployable app、共享 package、Schema、Prisma、OpenAPI、工具和测试放在哪里；
2. Mini Program、API、Admin 和单一 Worker artifact 的源码职责是什么；
3. 哪些能力属于 client-safe、server-only、AI-only、restricted-only 或 tooling-only；
4. 领域上下文如何映射到 `server-core` 内部模块，而不拆成过多 workspace package；
5. package 与模块允许导出什么，禁止 deep import 什么；
6. API、Interactive、Background、Restricted 和 Migration 入口如何获得不同 capability；
7. Zod、OpenAPI、生成客户端、Nest transport 与 Prisma 的生成和依赖方向；
8. E-001～E-011 应按什么顺序落地边界 Gate。

## 2. 不重开的已接受边界

- 一个 GitHub repository、一个 pnpm 11 workspace、一个 root `pnpm-lock.yaml` 和一个 Turborepo 2 task graph；
- Node.js 24 LTS、TypeScript 7 strict、服务端/共享 ESM 与微信小程序平台兼容输出；
- 微信原生小程序、NestJS 11 + Express 5、Next.js 16 + React 19；
- PostgreSQL 18 / Prisma 7 是权威持久化，Redis 8 / BullMQ 5 不是业务事实；
- `packages/shared-schemas` 的 Zod 4 Schema 是 JSON 业务字段权威，OpenAPI 是 HTTP 路径/envelope 权威；
- 模块化单体、一个 PostgreSQL database/application schema、无内部 HTTP/RPC；
- API、Admin、Interactive Worker、Background Worker、Restricted Worker 是独立运行时；
- 三类 Worker 使用同一代码产物，但必须有独立入口、handler allowlist、数据库角色、队列/并发和 egress；
- AI Gateway 位于 Worker 内，provider SDK 只能出现在受控 adapter 边界；
- Admin 只调用 `/v1/admin`，小程序只调用公开 `/v1`；二者不能直连数据库、Redis、provider 或对象存储；
- Safety、删除、owner、revision、epoch、CommandReceipt、PublishGuard 和 PostgreSQL 事务语义不因目录设计改变。

如本文与 Accepted ADR、系统架构、Schema、数据库或 API 合同冲突，以上游权威为准。

## 3. 范围与不做事项

### 3.1 本文负责

- 目标目录树和各目录所有权；
- deployable app 与 workspace package 的唯一职责；
- client-safe、server-only、AI-only、restricted-only、migration-only 和 tooling-only zone；
- package `exports`、module public contract、adapter SPI 与禁止 deep import；
- `server-core` 内部领域上下文、分层和允许依赖；
- Worker 单一 artifact 的 profile 入口与 capability mapping；
- Prisma/OpenAPI/shared-schemas/code generation 的位置和单向生成关系；
- tsconfig/ESLint 配置继承树的目标形态；
- manifest、import graph、bundle 和生成漂移的自动 Gate；
- 当前独立 `shared-schemas` 包迁入 root workspace 的兼容路径；
- 48 个固定仓库边界场景。

### 3.2 本文不负责

- 实际创建 root `package.json`、workspace、lockfile、Turbo、tsconfig、ESLint 或应用目录；
- 初始化 NestJS、Next.js、微信小程序、Worker、Prisma Client、Redis/BullMQ 或 Docker；
- 选择测试层级、runner、容器矩阵和 coverage 阈值；这些属于 S-31；
- 选择环境、云厂商、容器、网络、secret、发布、migration 和回滚流程；这些属于 S-32；
- 固定日志、metric、trace、SLO 和告警；这些属于 S-33；
- 创建业务实现、数据库 migration、queue/key、Prompt、provider adapter 或生产配置；
- 把 Phase 1 工程任务提前标记为开始。

## 4. 目标仓库树

以下是 Phase 1 逐步创建后的目标形态；目录出现不表示其全部子项必须由 E-001 一次创建。

```text
daily-energy/
├── AGENTS.md
├── README.md
├── ROADMAP.md
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
├── apps/
│   ├── miniapp/
│   ├── api/
│   ├── admin/
│   └── worker/
├── packages/
│   ├── shared-schemas/
│   ├── api-client/
│   ├── server-core/
│   ├── server-adapters/
│   ├── prompt-library/
│   ├── eslint-config/
│   └── typescript-config/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── openapi/
│   └── openapi.yaml
├── docs/
├── tasks/
├── tests/
├── tooling/
├── docker/
└── prototype/
```

约束：

- `apps/*` 是 deployable composition root，不互相依赖；
- `packages/*` 是明确可复用的 workspace package，不部署为独立服务；
- `prisma/`、`openapi/` 和 `docs/` 是根级权威源，不伪装为运行时 package；
- `tests/` 只放跨 app/黑盒 fixture 与 harness；package-local 测试留在所属 package，具体矩阵由 S-31 决定；
- `tooling/` 只放仓库检查、生成器和一次性开发工具，不承载业务规则；
- `docker/` 只放本地/部署构建资产，不能包含业务实现或 secret；
- `prototype/` 是设计验证历史，不进入生产 bundle；
- root package 只编排 workspace、版本和检查，不导出运行时代码。

## 5. 目录所有权

| 路径 | 唯一职责 | 禁止内容 |
|---|---|---|
| `apps/miniapp` | 微信页面、组件、平台 adapter、局部草稿、client API 调用 | 服务端规则、provider、Prisma、Node-only 依赖、secret |
| `apps/api` | Nest HTTP bootstrap、公开/Admin transport、auth/guard 组装、request/response mapper | 领域规则、provider 调用、BullMQ consumer、Prisma row 外泄 |
| `apps/admin` | Next UI、企业会话外壳、受控 Admin API client | 直连 PG/Redis/provider、通用 BFF、用户原文静态化 |
| `apps/worker` | 单一 Worker artifact、四个明确启动入口、profile composition | HTTP API、页面、未 allowlist handler、进程内业务事实 |
| `packages/shared-schemas` | Zod 权威 Schema、推断类型、JSON Schema、client-safe 投影源 | HTTP 路径、Prisma、网络、数据库、Prompt、provider |
| `packages/api-client` | 从 OpenAPI/Schema 生成或薄封装的公开/Admin transport client | 手写第二套业务字段、server credential、业务规则 |
| `packages/server-core` | 领域、application use case、跨模块 public contract、adapter port | Nest controller、Prisma/Redis/Bull/provider SDK、环境读取 |
| `packages/server-adapters` | DB/queue/cache/platform/provider/object/config 等 port 实现与 profile factory | 重新定义业务语义、客户端导出、通用 unrestricted DB |
| `packages/prompt-library` | 版本化 Prompt/template 资产与受控编译/加载合同 | provider key、真实用户数据、直接网络调用、客户端导出 |
| `packages/*-config` | 共享 TS/ESLint 配置 | runtime dependency、业务源代码 |
| `prisma` | 单一 Schema、migration 历史、受审 SQL 与 seed 合同 | API DTO、业务 service、生产 secret、`db push` 脚本 |
| `openapi` | `/v1` 与 `/v1/admin` 路径、envelope、错误和公开投影 | Prisma row、内部 event/job、provider raw Schema |
| `tooling` | graph/exports/codegen/drift/secret/bundle 检查 | 生产业务入口、真实数据或 provider response |

## 6. Deployable app 边界

### 6.1 `apps/miniapp`

建议内部结构：

```text
apps/miniapp/
├── src/
│   ├── app/
│   ├── pages/
│   ├── components/
│   ├── features/
│   ├── platform/
│   ├── services/
│   └── generated/
├── project.config.json
├── project.private.config.example.json
└── package.json
```

- `pages/features/components` 只消费 client-safe view 与命令类型；
- `platform` 封装微信 login、storage、network、share、subscription 等 API；
- `services` 只能通过 `@daily-energy/api-client/miniapp` 调公开 API；
- `generated` 必须由 root 生成任务产生且带来源指纹，不允许手改；
- 本地 storage 只保存允许的短期 view/ref/草稿，不能成为 ProductDate、owner、Safety 或删除权威；
- 禁止 import `node:*`、Nest、Prisma、Redis、BullMQ、Prompt、server package、provider SDK 或任意 secret 配置。

### 6.2 `apps/api`

建议内部结构：

```text
apps/api/
└── src/
    ├── main.ts
    ├── bootstrap/
    ├── transport/
    │   ├── public/
    │   └── admin/
    └── composition/
```

- `main/bootstrap` 只启动 Nest、配置进程级 middleware 和 graceful shutdown；
- `transport/public` 与 `transport/admin` 使用不同 auth/session/audience；
- controller 只解析 transport、调用 `server-core` command/query、映射 view/error；
- `composition` 只连接允许的 `server-core` public port 与 `server-adapters/api`；
- API 不能导入 `server-adapters/ai`、`worker-*`、`restricted`、Prompt 或 provider SDK；
- API 不注册 BullMQ processor，不在 controller 内生成 Daily/Weekly 表达。

### 6.3 `apps/admin`

建议内部结构：

```text
apps/admin/
└── src/
    ├── app/
    ├── features/
    ├── components/
    ├── services/
    └── generated/
```

- 只能通过 `@daily-energy/api-client/admin` 调 `/v1/admin`；
- Next server component/route handler 仍是 Admin API client，不成为第二业务 API；
- 不依赖 `server-core`、`server-adapters`、Prisma、Redis、BullMQ、Prompt 或 provider；
- `generated` 与 miniapp 分开构建，但都来自同一 OpenAPI/Schema fingerprint；
- 浏览器 bundle Gate 必须扫描 server-only import、secret name/value 和 restricted field。

### 6.4 `apps/worker`

一个 package、一个 build artifact，固定四个入口：

```text
apps/worker/
└── src/
    ├── entrypoints/
    │   ├── interactive.ts
    │   ├── background.ts
    │   ├── restricted.ts
    │   └── migration.ts
    ├── profiles/
    └── composition/
```

其中 `migration.ts` 是一次性 job 入口，不是长期 Worker profile。

| 入口 | 允许 adapter surface | 允许能力 |
|---|---|---|
| `interactive.ts` | `server-adapters/worker-interactive`、`/ai` | Daily 规则/Gateway/候选校验/PublishGuard/发布 |
| `background.ts` | `server-adapters/worker-background`、`/ai` | outbox、关系、Weekly、通知、投影、匿名分析、普通 TTL |
| `restricted.ts` | `server-adapters/worker-restricted` | DataTask、删除/导出、对象/provider cleanup、受限 TTL |
| `migration.ts` | `server-adapters/migration` | versioned migration、grants、drift/restore checks |

要求：

- 入口显式装配 profile，不接受任意字符串动态加载 handler；
- 构建产物可以相同，启动命令必须指向单一入口或已验证的 profile；
- 每个 profile 生成机器可读 handler/capability manifest；
- profile 启动时核对 DB role、queue allowlist、egress allowlist 和配置 fingerprint；
- restricted/migration capability 不能被 interactive/background/API import；
- migration 入口不在 API/Worker 常驻镜像命令中自动执行。

## 7. Workspace package 合同

### 7.1 Package 分区

每个 workspace package 必须声明机器可读的 `dailyEnergy.runtime`：

| 值 | 含义 | 可被谁依赖 |
|---|---|---|
| `client-safe` | 可进入浏览器/小程序 bundle | miniapp、admin、server、tooling |
| `server-core` | 无外部基础设施的服务端领域/application | api、worker、server adapter、server test |
| `server-adapter` | Node-only 外部适配与 capability | 仅 allowlist 的 server composition root |
| `server-asset` | Prompt/template 等服务端资产 | AI adapter/tooling；不得进入 API/client |
| `tooling` | 构建、lint、codegen、测试配置 | 开发/CI，不进入生产 runtime graph |

`dailyEnergy.runtime` 是静态 Gate 元数据，不是授权真值；运行时权限仍由数据库角色、配置、网络和业务 guard 执行。

### 7.2 `@daily-energy/shared-schemas`

保留现有 package 名和以下 public exports：

- `.`：完整 Zod runtime Schema 与推断类型；
- `./json-schema`：稳定 `$id` 的 JSON Schema；
- `./client`：由同一权威 Schema 生成/筛选的 client-safe runtime 投影，待 E-008 创建。

约束：

- 不能增加 DB row、queue job、Prompt、provider 或内部 Safety evidence Schema 到 client export；
- `./client` 不能手写复制 enum/字符预算/cross-field 规则；
- 如果微信运行时无法直接消费 Zod/ESM，生成器产生平台兼容 validator，来源仍是本包；
- 当前包迁入 root workspace 时保持已有 public export 和 fixture 行为。

### 7.3 `@daily-energy/api-client`

只提供 transport client：

- `./miniapp`：公开 `/v1` 的平台无关请求/响应与 client adapter port；
- `./admin`：`/v1/admin` 的独立 client；
- `./testing`：合成 fixture/client mock，生产 app 不导入。

它由 OpenAPI 路径/envelope 与 shared-schemas 公开投影共同生成或薄封装，不拥有业务字段语义。禁止 root wildcard export，防止 miniapp 误导入 Admin API。

### 7.4 `@daily-energy/server-core`

这是一个 server-only package，而不是每个领域一个 package。原因：

- 当前团队与规模不需要十多个可独立发布 package；
- 同一 PostgreSQL transaction 和模块化单体需要低摩擦组合；
- package 内仍可通过 module public contract、lint zone 和测试固定边界；
- 未来只有在稳定所有权、容量或安全证据成立后才拆 package/service。

显式 subpath exports：

- `./<module>`：跨模块可用的 command/query/event/value contract；
- `./<module>/spi`：仅 adapter/composition 可用的 repository/platform port；
- `./runtime/api`、`./runtime/worker-interactive`、`./runtime/worker-background`、`./runtime/worker-restricted`：对应 composition 所需的 handler registry 类型；
- 不提供 `./internal/*`、`./domain/*`、`./repositories/*` 或 wildcard export。

### 7.5 `@daily-energy/server-adapters`

实现 `server-core` SPI，并通过显式 capability subpath 导出：

- `./api`；
- `./worker-interactive`；
- `./worker-background`；
- `./worker-restricted`；
- `./ai`；
- `./migration`；
- `./testing`。

禁止 package root export。每个 subpath 只能导出 factory/adapter registration 和稳定配置 Schema，不能导出通用 Prisma client、Redis connection、provider SDK client、raw decryptor 或 `db.query(role)`。

### 7.6 `@daily-energy/prompt-library`

- `dailyEnergy.runtime = server-asset`；
- 只导出版本化 Prompt/template registry、编译结果类型和 source fingerprint；
- 不导出 secret、用户输入、provider SDK 或网络 client；
- 只能被 `server-adapters/ai`、合成 evaluation 和受控 tooling 依赖；
- API、Mini Program、Admin 和普通业务模块不能依赖。

### 7.7 配置 package

- `@daily-energy/eslint-config`：flat config 与 zone/secret/import 规则；
- `@daily-energy/typescript-config`：`base`、`node`、`next`、`miniapp`、`tooling` 等显式 config；
- 配置 package 为 `tooling`，不能拥有 runtime dependency 或业务代码；
- app/package 可扩展配置，但不能关闭 strict、边界 Gate 或 secret 检查。

## 8. `server-core` 模块布局

### 8.1 模块列表

初始模块与 S-29 上下文一一对应：

1. `identity-account`
2. `consent-profile`
3. `product-time`
4. `daily-records`
5. `generation`
6. `ai-gateway`
7. `content-publication`
8. `daily-interaction`
9. `relationship`
10. `matter-memory`
11. `weekly-reflection`
12. `safety`
13. `notification`
14. `data-rights`
15. `operations-catalog`

允许一个极小的 `shared-kernel` 保存 opaque ref、revision、fingerprint、result/error 基元和通用时钟/transaction port 类型。禁止把用户、Daily、Safety、删除、AI 或通知业务规则塞入 shared-kernel。

### 8.2 单模块内部

```text
packages/server-core/src/modules/<module>/
├── public/
│   ├── commands.ts
│   ├── queries.ts
│   ├── events.ts
│   ├── values.ts
│   └── index.ts
├── application/
├── domain/
├── spi/
└── internal/
```

- `public` 是跨模块唯一入口，只含稳定 contract、opaque ref、revision/fingerprint 和白名单 view；
- `application` 编排 use case/transaction/port，不包含 transport 或 SDK；
- `domain` 拥有 invariant/entity/value/policy，但不导出数据库行；
- `spi` 是该模块要求 adapter 实现的 port；只有 adapter/composition 可导入；
- `internal` 放 repository implementation-independent helper，永不 export；
- 同模块内部可相对导入；跨模块必须使用 package public subpath，不能走相对路径穿越目录。

### 8.3 允许依赖

依赖箭头从调用方指向被依赖方：

- 所有模块可依赖 `shared-kernel` 与 `shared-schemas` 的 server-safe export；
- `consent-profile` → `identity-account`、Safety/Data guard public contract；
- `daily-records` → `identity-account`、`product-time`、Safety/Data guard；
- `generation` → `daily-records`、`operations-catalog`、`ai-gateway` port；
- `ai-gateway` → `operations-catalog`、共享 Schema；provider/Prompt 通过 SPI；
- `content-publication` → `generation`、`ai-gateway` candidate contract、Safety/Data guard；
- `daily-interaction` → `content-publication`、`product-time`、Safety/Data guard；
- `relationship` → `daily-interaction` 的 allowlisted `DayLit` event，不读内部 repository；
- `matter-memory` → `consent-profile`、`product-time`、Safety/Data guard；
- `weekly-reflection` → Daily/Interaction/Publication 的公开 source、`ai-gateway` port；
- `notification` → 公开 approved-source event、Safety/Data guard 和平台 port；
- `data-rights` 通过 scope participant SPI 协调模块，不导入其 repository/Prisma delegate；
- `operations-catalog` 通过只读 operations port 观察稳定 projection，不能反向修改 source。

出现循环时必须通过公开 event、consumer-owned port 或 application coordinator 打断；禁止用 `forwardRef`、barrel wildcard、全局 service locator 或 localhost HTTP 隐藏循环。

## 9. 分层与 import 规则

从外到内的允许方向：

```text
app transport / worker entry
  → composition
  → application public contract
  → domain
  → shared kernel / shared schemas

composition
  → adapter implementation
  → application-owned SPI
```

禁止：

- domain import application、adapter、Nest、Prisma、Redis、BullMQ、provider 或环境变量；
- application import controller、Prisma delegate、SDK concrete client 或另一个模块内部 entity；
- adapter 调用另一 adapter 承担业务编排；
- controller/processor/adapter 复制 invariant、重试、Safety、删除或发布规则；
- package/app 通过 TS path alias 绕过 manifest/exports；
- barrel `export *` 暴露未审核 internal 能力；
- transport DTO 或 Prisma row 被当作 domain/public view。

## 10. Profile capability 边界

每个 server app/entrypoint 必须有静态 allowlist：

| Consumer | 允许的 package/subpath | 明确禁止 |
|---|---|---|
| Mini Program | shared-schemas/client、api-client/miniapp | 所有 server/tooling/Admin subpath |
| Admin | shared-schemas/client、api-client/admin、UI dependencies | server-core/adapters、Prisma、Redis、provider、Prompt |
| API | server-core/runtime/api、server-adapters/api、shared-schemas | AI/provider、Worker handler、restricted、migration |
| Interactive | server-core/runtime/worker-interactive、server-adapters/worker-interactive、server-adapters/ai、prompt-library | Background/Restricted/Migration capability |
| Background | server-core/runtime/worker-background、server-adapters/worker-background、server-adapters/ai、prompt-library | Interactive reserve control、Restricted/Migration capability |
| Restricted | server-core/runtime/worker-restricted、server-adapters/worker-restricted | AI/Prompt、普通 analytics、API transport、Migration owner |
| Migration | server-adapters/migration、Prisma migration tooling | 常驻 handler、provider、用户 API |

capability manifest 必须同时约束：

- direct/transitive workspace dependency；
- source import；
- build output/bundle；
- runtime handler registry；
- 配置 key、数据库 role 和 egress target。

静态检查通过不代表运行时授权通过；启动时还要核对角色和配置，handler 执行时仍重读 PostgreSQL guard。

## 11. Schema、OpenAPI、Prisma 与生成物

### 11.1 权威与生成方向

```text
Accepted specs
  → shared-schemas (JSON fields/invariants)
  → OpenAPI (HTTP path/envelope/projection refs)
  → api-client/client projections

database spec
  → prisma/schema.prisma
  → generated Prisma Client (server-adapters internal only)
```

- 生成客户端不能反向修改 shared-schemas/OpenAPI；
- Prisma Client 不能生成或推导公开 API DTO；
- OpenAPI 不能引用内部 job/event/DB row；
- Nest transport mapper 显式把 command/view 与 HTTP envelope 连接；
- codegen 输出必须带 source fingerprint，可在 clean checkout 重建且 diff 为 0；
- 生成物是否提交由 E-008/S-31 按微信工具链和可复现性决定；无论是否提交都不能手改。

### 11.2 Root 权威源

- `prisma/schema.prisma` 保留在 root，migration 进入 `prisma/migrations`；
- Prisma generated output 只供 `server-adapters` 内部 DB adapter 使用；
- `openapi/openapi.yaml` 保留在 root，公开/Admin client 分开生成；
- package 测试 fixture 可引用 root 权威源的只读副本/路径，但不能复制一份可编辑源；
- root schema/codegen task 必须是 Turbo 不缓存外部副作用的确定性任务。

## 12. TypeScript 与配置继承

目标继承树：

| 配置 | 使用者 | 关键边界 |
|---|---|---|
| `typescript-config/base` | 所有 TS | strict、无隐式关闭、统一语言基线 |
| `typescript-config/node` | API、Worker、server package、tooling | NodeNext/ESM、Node 24 |
| `typescript-config/next` | Admin | Next/React 官方组合，不获得 server capability |
| `typescript-config/miniapp` | Mini Program | 微信兼容 emit/lib，无 `node` type |
| `typescript-config/config` | 配置文件 | 最小 Node tool context |

- package 只能使用适合自身 runtime zone 的 config；
- miniapp 不允许通过 `types: ["node"]` 修复错误依赖；
- path alias 只允许 app/package 内部便利，不跨 workspace；
- project reference 不替代 manifest dependency 和 public exports；
- `skipLibCheck`、strict 子项、module resolution 等例外必须有到期原因并受 Gate。

## 13. 自动边界 Gate

E-001/E-002/E-008/E-011 必须最终提供下列 clean-checkout Gate：

1. **Workspace Gate**：单 lockfile、workspace protocol、exact toolchain、无 app→app；
2. **Manifest Gate**：`dailyEnergy.runtime`、允许 dependency zone、无 undeclared/重复 major；
3. **Exports Gate**：只允许显式 exports，无 wildcard/internal/deep import；
4. **Module Graph Gate**：15 个模块边界、允许 edge、无循环；
5. **Client Gate**：Mini Program/Admin 的 direct/transitive/bundle 不含 server-only；
6. **Capability Gate**：API/Worker profile 只能导入对应 adapter/public surface；
7. **Provider Gate**：provider SDK 只在 AI adapter build graph；
8. **Restricted Gate**：restricted/migration capability 只在对应入口；
9. **Contract Drift Gate**：shared-schemas、OpenAPI、生成 client 和 mapper fixture 一致；
10. **Prisma Boundary Gate**：Prisma import 只在 DB adapter/migration/test allowlist；
11. **Generated Gate**：生成物无手改且 clean regeneration diff 为 0；
12. **Secret/Content Gate**：client/bundle/cache/job/log fixture 不含 secret 或禁止字段。

检查配置本身也必须纳入 review；禁止在 package 级通过 ignore、动态 import、复制文件或 runtime `require` 绕过。

## 14. 命名与版本规则

- workspace package 统一 `@daily-energy/*`，全部 `private: true`；
- app package 可命名为 `@daily-energy/app-*`，不从 registry 发布；
- 内部依赖使用 `workspace:*` 或经 ADR-0006 允许的更窄 workspace range；
- public command/query/event 使用业务语义名称，不使用 controller/Prisma 表名；
- event/job type 带稳定版本，不能以源码类名作为跨版本合同；
- file/folder 使用 kebab-case，TypeScript symbol 使用项目统一约定；
- `index.ts` 仅位于受审 public surface；internal 目录不建聚合出口；
- source import 使用 package export 或模块内相对路径，不混用跨包 alias；
- package 版本在 MVP 内统一审阅，不建立独立发布流水线。

## 15. 当前仓库迁移

当前仓库已有：

- `packages/shared-schemas` 自包含 npm package；
- root `prisma/schema.prisma`；
- root `openapi/openapi.yaml`；
- docs/tasks/prototype 等非运行时资产；
- 尚无 root workspace、apps、统一 tsconfig/ESLint/Turbo 或 Worker。

迁移顺序：

1. E-001 从当前 `main` 创建 root private workspace，不移动或重写已接受 Schema；
2. 将 `packages/shared-schemas` 纳入 workspace，保持 `.` 与 `./json-schema` public export 和现有 fixture；
3. root lockfile 验证完成后移除该包的嵌套 npm lockfile，禁止第二 lockfile；
4. 把包内 `npm run validate` 语义映射到 root pnpm/Turbo，不降低检查；
5. E-002 创建配置 package 与静态依赖 Gate；
6. E-003～E-005 只创建薄 app/composition skeleton；
7. E-006/E-007 创建 adapter 与基础设施骨架，不把 Prisma/Redis 暴露给 core/app；
8. E-008 创建 client-safe 投影/api-client 和 drift Gate；
9. E-010/S-31 建立跨层测试矩阵后才增加完整业务模块；
10. 每一步保持 clean checkout 可构建，禁止一次性大搬迁。

## 16. 工程任务交接

| 任务 | 本文交付的直接输入 |
|---|---|
| E-001 | root/app/package 目录、workspace 范围、单 lockfile、现有 shared-schemas 迁入顺序 |
| E-002 | runtime zone、tsconfig 继承、exports/import/module graph Gate |
| E-003 | `apps/api` 薄 transport/composition、API capability allowlist |
| E-004 | `apps/miniapp` 平台边界、client-only import 与 generated 目录 |
| E-005 | `apps/admin` Admin API-only 与 browser bundle Gate |
| E-006 | root Prisma、DB adapter-only import、role-specific factory |
| E-007 | Worker package/profile 入口、queue/Redis adapter surface、handler manifest |
| E-008 | shared-schemas/client、api-client、OpenAPI/codegen drift Gate |
| E-009 | apps/profile 对应容器入口；具体编排仍以 S-32 为准 |
| E-010 | package-local 与 root black-box 测试位置；具体矩阵以 S-31 为准 |
| E-011 | clean-checkout 12 类边界/供应链 Gate |

## 17. 固定验证场景（48）

### 17.1 Workspace 与目录（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S30-REPO-001 | root 与 package 同时存在多个 lockfile | Workspace Gate 失败 |
| S30-REPO-002 | deployable app 放入 `packages/` 并被别的 app import | 拒绝；app 必须在 `apps/` 且 app→app 禁止 |
| S30-REPO-003 | root package 导出业务 runtime 源码 | Manifest/exports Gate 失败 |
| S30-REPO-004 | 文档、OpenAPI 或 Prisma 被包装成可任意 import 的业务 package | 拒绝；保持 root 权威源 |
| S30-REPO-005 | prototype 被生产 build input 收集 | Build input Gate 失败 |
| S30-REPO-006 | tooling package 被生产 runtime dependency 引入 | Runtime zone Gate 失败 |
| S30-REPO-007 | `shared-schemas` 迁入 workspace 后 fixture/exports 改变 | 兼容验证失败 |
| S30-REPO-008 | E-001 一次创建完整业务模块/Worker 实现 | 范围 Gate 失败 |

### 17.2 Public exports 与依赖图（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S30-REPO-009 | 调用方 import `package/src/internal/*` | Exports Gate 失败 |
| S30-REPO-010 | package 使用 wildcard export 暴露 internal | Exports review/Gate 失败 |
| S30-REPO-011 | TS path alias 跨 workspace 隐藏依赖 | Import Gate 失败 |
| S30-REPO-012 | manifest 未声明但源码可从 root hoist import | pnpm/undeclared dependency Gate 失败 |
| S30-REPO-013 | package graph 出现循环 | Module graph Gate 失败 |
| S30-REPO-014 | 跨模块相对路径导入另一模块 domain/internal | Module boundary Gate 失败 |
| S30-REPO-015 | 模块用 `forwardRef`/service locator 隐藏循环 | Architecture review/Gate 失败 |
| S30-REPO-016 | internal package 缺失时从 registry 获取同名包 | workspace protocol 安装失败，不回退 |

### 17.3 Client 与 Admin（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S30-REPO-017 | Mini Program import `node:*`/Prisma/Nest | Client Gate 失败 |
| S30-REPO-018 | Mini Program import api-client/admin | Subpath allowlist 失败 |
| S30-REPO-019 | Mini Program 手写复制 Schema enum | Contract drift Gate 失败 |
| S30-REPO-020 | Admin import server-core/server-adapters | Client/Admin Gate 失败 |
| S30-REPO-021 | Next route handler 直连 PG/Redis/provider | Import/bundle Gate 失败 |
| S30-REPO-022 | client generated 文件被手工修改 | Clean regeneration diff 失败 |
| S30-REPO-023 | browser/miniapp bundle 含 provider key 或 Prompt | Secret/content Gate 失败 |
| S30-REPO-024 | client-safe export 包含 restricted event/evidence 字段 | Export allowlist/contract test 失败 |

### 17.4 API、Worker 与 capability（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S30-REPO-025 | API import AI/provider/Prompt subpath | Capability Gate 失败 |
| S30-REPO-026 | API 注册 BullMQ processor | App boundary Gate 失败 |
| S30-REPO-027 | Interactive profile import restricted/migration adapter | Capability Gate 失败 |
| S30-REPO-028 | Background profile import restricted cleanup | Capability Gate 失败 |
| S30-REPO-029 | Restricted profile import AI/Prompt/analytics | Capability Gate 失败 |
| S30-REPO-030 | Migration entry被常驻 API/Worker 自动执行 | Entrypoint/deployment Gate 失败 |
| S30-REPO-031 | profile 用动态字符串装载任意 handler | Handler manifest Gate 失败 |
| S30-REPO-032 | profile 启动 DB role/egress 与 manifest 不匹配 | 启动 fail closed |

### 17.5 Domain、adapter 与数据（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S30-REPO-033 | domain import Prisma/Redis/Bull/provider/env | Layer Gate 失败 |
| S30-REPO-034 | application import controller 或 concrete SDK | Layer Gate 失败 |
| S30-REPO-035 | adapter 复制业务重试/Safety/发布规则 | Conformance/architecture review 失败 |
| S30-REPO-036 | 模块导出 entity/repository/Prisma row 给其它模块 | Public contract Gate 失败 |
| S30-REPO-037 | data-rights 直接遍历其它模块 Prisma delegate | SPI boundary 失败 |
| S30-REPO-038 | relationship 读取 interaction repository 计算 DayLit | Event/public port boundary 失败 |
| S30-REPO-039 | 通用 adapter 导出 unrestricted DB/decrypt client | Exports/capability Gate 失败 |
| S30-REPO-040 | Redis lock/import 被用于替代数据库唯一性 | Architecture test 失败 |

### 17.6 Contract、生成与交付（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S30-REPO-041 | OpenAPI 与 shared-schemas enum/字段漂移 | Contract drift Gate 失败 |
| S30-REPO-042 | Nest DTO 手写第二套业务约束 | Mapper/contract Gate 失败 |
| S30-REPO-043 | Prisma model/row 直接成为 API response | Contract test 失败 |
| S30-REPO-044 | provider SDK 出现在非 AI adapter build graph | Provider Gate 失败 |
| S30-REPO-045 | Prisma import 出现在非 DB adapter/migration/test allowlist | Prisma Boundary Gate 失败 |
| S30-REPO-046 | codegen clean rerun 产生 diff | Generated Gate 失败 |
| S30-REPO-047 | package 关闭 strict 或边界 lint rule | Configuration Gate 失败 |
| S30-REPO-048 | clean checkout 运行 root validate | workspace、exports、graph、client、capability、contract 与 build 全通过 |

## 18. 验收标准

- 目标 root/apps/packages/prisma/openapi/tests/tooling 目录职责唯一；
- Mini Program、API、Admin、Worker 四个 deployable app 不互相依赖；
- Worker 单一 artifact 的 Interactive/Background/Restricted/Migration 入口与 capability 明确；
- 七类初始 workspace package 的 public export 和 runtime zone 明确；
- `server-core` 15 个模块、最小 shared-kernel、内部层次和允许依赖明确；
- 跨 package/module 只能通过 public exports/contract/SPI，禁止 deep import、wildcard 和循环；
- client-safe、server-only、AI-only、restricted-only、migration-only 和 tooling-only 可静态验证；
- shared-schemas、OpenAPI、api-client、Nest mapper、Prisma 的权威与生成方向唯一；
- TypeScript 配置继承、Node/miniapp 隔离与 path alias 边界明确；
- 12 类自动 Gate 与 48 个 `S30-REPO-*` 场景完整且唯一；
- 当前 `shared-schemas` 迁入 root workspace 的兼容顺序可执行；
- E-001～E-011 交接清楚；
- PR 只包含本文、S-29 接受记录和项目控制 Markdown，不创建目录、package、配置、代码或 migration；
- 用户确认前本文保持 Draft，S-30 保持 In Review。

## 19. 下游交接

### S-31 测试策略

- 把 S28、S29、S30 场景映射到 unit/module/integration/contract/E2E/architecture/bundle 测试；
- 定义 graph/exports/client/capability/codegen Gate 的具体工具与失败 fixture；
- 证明每个 profile 的 handler、DB role、配置和 egress allowlist；
- 决定生成物提交策略、微信运行时 conformance 和 clean-checkout 矩阵。

### S-32 部署、配置和回滚

- 把四个 app 和 Worker profile 映射到镜像/命令/network/secret/role；
- 保证同一 Worker artifact 的不同入口不会共享错误 capability；
- 为 migration 一次性 job、rollback、restore 和配置 fingerprint 固定流程；
- 不因容器便利合并 API/Worker/Admin 或放宽 restricted egress。

### S-33 可观测性

- 观测 package/adapter 不得成为业务依赖或把正文带入 client/job/log/trace；
- metric/log/trace schema 遵守 runtime zone 和低基数规则；
- profile/capability/contract Gate 失败需要可定位但不泄密的诊断。

### S-34 / Phase 1 Issues

- E-001 先建立最小 workspace 和兼容迁移，不一次铺满目录；
- 每个后续 Issue 明确允许创建的 app/package/subpath 与 Gate；
- 任何新增 workspace package、runtime zone 或跨模块 edge 必须更新本文或获得同等评审。

## 20. 明确禁止

- app 依赖另一个 app 或复制其源码；
- 为每个领域上下文创建独立 repository/service/database；
- 用 workspace package 模拟微服务或内部 RPC；
- 客户端/Admin 导入 server-only、Prompt、provider、Prisma、Redis 或 restricted 能力；
- API 直接导入 provider/Gateway Worker、注册 consumer 或执行 migration；
- Interactive/Background/Restricted/Migration profile 互相获得未授权 capability；
- 跨模块 import repository、Prisma delegate、entity、internal helper 或数据库 row；
- 用 TS alias、barrel、dynamic import、文件复制或 runtime loader 绕过 exports；
- 把 Zod、OpenAPI、Nest DTO、Prisma 或生成 client 建成多套可编辑真相；
- 把业务规则写进 controller、processor、adapter、tooling 或 root scripts；
- 在 root/package/runtime config、Prompt 或客户端中提交 secret；
- 在 S-30 PR 中创建 workspace、app、package、tsconfig、lockfile、代码、migration、queue 或容器。

## 21. 审核记录

- 状态：Draft；
- 接受日期：待用户确认；
- 内容 PR：[Draft PR #35](https://github.com/WeiHan1996/DailyEnergy/pull/35)；
- 基线：`main`（S-29 系统架构已随 PR #34 合并并获用户确认）；
- 待确认范围：目标目录、薄 app、七类 package、15 个 server-core 模块、public exports/SPI、Worker profile capability、Schema/codegen 方向、12 类 Gate 与 48 个场景；
- 下一任务：S-31 测试策略；S-30 被接受前不初始化 workspace 或应用代码。
