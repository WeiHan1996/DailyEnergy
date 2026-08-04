# DailyEnergy 测试策略与覆盖矩阵

- **文档状态**：Accepted
- **所属任务**：S-31 — 测试策略
- **最后更新**：2026-08-04（私有 GitHub Free required-check 临时补偿控制获接受）
- **适用范围**：Phase 1～3 的静态边界、单元、模块、数据库、契约、集成、端到端、故障恢复、AI 评测与发布证据
- **上游权威**：[ADR-0006 Monorepo 与技术栈](../decisions/ADR-0006-monorepo-and-stack.md)、[系统架构](./architecture.md)、[仓库结构与模块边界](./repository-structure.md)、[共享 Schema](../../packages/shared-schemas/README.md)、[AI 质量评价](../ai/evaluation.md)、[数据库规格](./database.md)、[API 契约](./api.md)、[隐私数据地图](../operations/privacy-data-map.md)
- **可执行合同**：[AI 评测语料](../ai/evaluation-corpus.json)、[Prisma 草案](../../prisma/schema.prisma)、[OpenAPI 草案](../../openapi/openapi.yaml)
- **下游任务**：S-32～S-35、E-001～E-014、C-001～C-017、AI-001～AI-017、A-007～A-010

## 1. 目的

本文把已接受的产品、AI、数据、API、系统架构和仓库边界转换为一套可实施、可追踪、能证明失败语义的测试合同。核心验收句是：

> 每个 Accepted 场景、数据库不变量、HTTP 契约和运行时 capability 都必须映射到可重复执行的断言；测试不仅证明正常路径能走通，还必须证明重复、并发、崩溃、迟到消息、权限不足、Redis 丢失、provider unknown、删除与恢复时不会产生第二份事实、越过 Safety/删除 guard 或泄漏内容。

本文回答：

1. 哪些检查属于静态、单元、模块、集成、契约、端到端、故障恢复和 AI 评测；
2. Vitest、Playwright、Testcontainers、微信开发者工具自动化与架构 Gate 各负责什么；
3. Accepted 场景怎样保留原 ID 并形成 many-to-many coverage map；
4. PostgreSQL constraint、事务、outbox/inbox、BullMQ 至少一次和 Worker profile 怎样验证；
5. OpenAPI、Zod、生成 client、Nest mapper、Prisma 和客户端 bundle 怎样防漂移；
6. 微信小程序、Admin、API 和 Worker 各在哪个真实运行时验证；
7. CI 何时跑哪些 lane，怎样处理 flaky、retry、artifact 和人工 Gate；
8. E-010/E-011 需要建立哪些测试骨架和发布证据。

## 2. 不重开的已接受边界

- 工程基线是 Node.js 24 LTS、TypeScript 7 strict、pnpm 11、Turborepo 2 与 Vitest 4；
- 微信原生小程序、NestJS 11/Express 5、Next.js 16/React 19、PostgreSQL 18/Prisma 7、Redis 8/BullMQ 5 和 Zod 4 不重新选型；
- 模块化单体、一个 PostgreSQL database/application schema、无内部 HTTP/RPC；
- PostgreSQL 是业务事实；Redis、BullMQ、cache、log、trace、analytics 和测试 artifact 都不是；
- API、Admin、Interactive、Background、Restricted 与 Migration 的静态和运行 capability 必须隔离；
- shared-schemas 是 JSON 字段/业务不变量权威，OpenAPI 是 HTTP path/envelope 权威，Prisma 只在 DB adapter 内；
- 同 owner + ProductDate 的 Checkin、GenerationIntent、AVAILABLE Daily result 与 Interaction 唯一；
- TX-01～TX-09、CommandReceipt、revision/CAS、PublishGuard、outbox/inbox、guard epoch 和删除语义不因测试便利改变；
- ordinary Gateway 只允许 primary → backup → controlled template，不能竞速、拼接、修补或重试同一 role；
- HIGH_RISK ordinary provider/template 调用数为 0；Safety、删除和用户权利测试优先于功能覆盖率；
- 测试只用合成主体和合成文本，禁止生产 dump、真实用户内容、真实微信身份、真实密钥或未批准 provider 调用；
- S-16 的 269-case corpus、硬 Gate、专业/人工评审和模型资格不能被普通单元测试或 LLM judge 代替。

如本文与 Accepted ADR、Schema、数据库、API、安全、隐私或 AI 评价合同冲突，以上游权威为准。

## 3. 范围与不做事项

### 3.1 本文负责

- 测试分层、目录、命名、元数据和证据格式；
- runner、容器、浏览器、微信运行时和故障注入的职责边界；
- 静态架构、manifest/exports、bundle、secret 与 codegen drift Gate；
- 共享 Schema、OpenAPI、生成 client、Nest mapper 与 Prisma 边界测试；
- PostgreSQL 18 空库/升级/约束/grants/transaction/restore 测试；
- Redis 8、BullMQ 5、outbox/inbox、duplicate、crash、late 与 rebuild 测试；
- API、Admin、小程序、Worker profile 和外部 adapter 的契约/E2E；
- S-16 AI corpus、controlled template、provider conformance 与人工 Gate 在工程流水线中的位置；
- coverage、flaky、retry、隔离、fixture、artifact 和 CI lane 规则；
- S28/S29/S30/S19/S20/Gateway/S16 场景的覆盖注册表；
- 48 个固定 S-31 验证场景。

### 3.2 本文不负责

- 创建 root workspace、测试目录、runner 配置、测试代码、CI workflow 或容器；
- 安装 Vitest、Playwright、Testcontainers、微信开发者工具或架构检查依赖；
- 运行真实 provider bake-off、专业 Safety 评审、人工盲评或产生模型费用；
- 选择 GitHub Actions runner、云厂商、secret store、artifact 后端或生产网络；这些属于 S-32/E-011；
- 固定生产 SLO、告警阈值或成本面板；这些属于 S-33；
- 定义部署、migration 执行、发布、回滚和备份系统；这些属于 S-32；
- 把现有 Draft Schema/Prisma/OpenAPI 视为已部署实现；
- 用 snapshot、覆盖率百分比或一次 E2E 替代精确业务断言；
- 提前开始 E-010、E-011、S-32 或业务实现。

## 4. 测试决策摘要

| 主题 | 唯一结论 |
|---|---|
| 主测试 runner | Vitest 4；root 使用 Vitest `projects` 编排 package/app 的 Node 与 browser-safe 单元/模块/契约测试 |
| 覆盖率 | `@vitest/coverage-v8`；只作缺口信号，不能补偿场景、Safety、权限或事务失败 |
| 性质测试 | `fast-check` 或等价 TypeScript property runner；用于日期、canonicalization、Schema、幂等和状态机不变量 |
| 数据/队列集成 | Testcontainers for Node；真实 PostgreSQL 18、Redis 8 与必要 Toxiproxy，镜像 exact + digest 由 E-010/E-011 固定 |
| API 黑盒 | 启动真实 Nest app，通过 Playwright `APIRequestContext` 或等价 HTTP client 验证 OpenAPI、鉴权、信封、幂等和错误 |
| Admin E2E | Playwright Test；Chromium 为每 PR 主 Gate，WebKit/Firefox 兼容矩阵在 main/RC，具体范围由实际支持策略固定 |
| Mini Program | 纯逻辑用 Vitest；真实页面/平台行为用微信开发者工具 CLI + automator 的受控 runner；RC 再做真机冒烟 |
| OpenAPI | Redocly CLI lint/bundle + 自定义 path/schema/source-ID drift；生成 public/Admin client 后编译与黑盒响应验证 |
| 架构边界 | dependency-cruiser + 项目 Node 检查器；同时扫描 manifest、exports、module edge、capability manifest 和 build metafile |
| Prisma/SQL | Prisma format/validate/migrate + PostgreSQL 查询/约束/grant harness；不用 SQLite、内存仓库或 `db push` 证明数据库语义 |
| 外部系统 | adapter unit 使用封闭 fake；协议集成使用本地 stub + Toxiproxy；普通 CI 不调用微信生产、AI provider 或对象存储 |
| AI 评价 | corpus integrity/确定性 Gate 进入 CI；真实 model/LOAD/human 只在显式、付费、受限评测 run 执行 |
| 证据 | 每个测试保留 source IDs、commit、toolchain、fixture/fault 版本和结果；普通 artifact 不含正文、Prompt、secret 或个人标识 |

除 ADR-0006 已冻结的 Vitest 4 外，新增测试工具的精确版本由 E-010 在落地日核验 Node 24/TypeScript 7/ESM 兼容后写入 root lockfile；本文固定职责，不授权使用浮动 `latest`。

## 5. 测试分类与命名

### 5.1 测试层级

| 层级 | 代码/系统范围 | 允许的替身 | 必须证明 |
|---|---|---|---|
| `STATIC` | manifest、源码、exports、配置、生成物、bundle | 不适用 | 禁止依赖、循环、secret、drift 和错误 capability 可被确定性拒绝 |
| `UNIT` | 纯 domain/value/policy/validator/mapper | fake clock/ID/port | 单个不变量、边界值和错误码 |
| `MODULE` | 一个 server-core module/application use case | in-memory port；无真实 SDK | command/query、事务意图、event 与 public contract |
| `DB` | migration、constraint、grant、repository、TX | 真实 PostgreSQL 18 | SQL-001～020、并发、回滚、角色和查询语义 |
| `CONTRACT` | Zod/OpenAPI/client/mapper/job/event/adapter | 协议 stub | 双方对同一版本/字段/失败语义达成一致 |
| `INTEGRATION` | API/Worker + PG/Redis/BullMQ/adapter | 只替换外部第三方 | outbox/inbox、queue、profile、cache 与外部失败协作 |
| `E2E` | 用户入口至权威结果/白名单 View | 合成微信/provider 平台 | 跨 app 核心旅程、guard、恢复和客户端状态 |
| `RESILIENCE` | 多进程、网络、崩溃、恢复 | fault proxy/kill point | duplicate、unknown、late、Redis loss、restore 不破坏事实 |
| `AI_EVAL` | Gateway/Prompt/template/Safety/evaluation corpus | 合成主体；STAGED provider 需显式 run | S-16 不可补偿 Gate、延迟/成本/人工质量 |
| `MANUAL_RC` | 微信真机、可访问性、运营/删除演练 | 受控测试账号 | 自动化覆盖不了的平台与人工 Gate |

### 5.2 稳定 ID

测试标题不是覆盖权威。每项可执行测试必须含机器可读 metadata：

```text
{
  test_id: "T-<area>-<ordinal>",
  source_ids: ["S29-ARCH-018", "S19-DB-050"],
  level: "INTEGRATION",
  workload_or_profile: "BACKGROUND",
  fixture_version: "fixture-v1",
  fault_id: "CRASH-RELAY-AFTER-ENQUEUE",
  expected_codes: ["DUPLICATE_NOOP"],
  evidence_class: "PR"
}
```

规则：

- `source_ids` 必须保留 Accepted 文档原 ID，不创建无法回溯的简写；
- 一个测试可以覆盖多个 source ID，但每个 ID 必须有独立 assertion 或清楚的共享不变量；
- 一个 source ID 可以由多个层级共同证明，例如 static 拒绝 + runtime deny；
- 只有测试文件存在、路径经过或 snapshot 出现，不能算覆盖；
- `UNMAPPED`、`MISSING_ASSERTION`、`SKIPPED_WITHOUT_EXPIRY` 和 `INFRA_UNKNOWN` 都不是 PASS；
- 场景语义变化必须先改上游文档/版本，不能只改测试让其“通过”。

## 6. 目标测试目录

S-30 的目录合同进一步细化为：

```text
apps/<app>/
└── src/**/*.test.ts                 # app-local UNIT/MODULE

packages/<package>/
├── src/**/*.test.ts                 # package-local UNIT/MODULE
└── test/
    ├── contract/
    └── integration/

tests/
├── registry/                        # source-ID coverage registry 与 lint
├── fixtures/                        # 版本化合成 factories/golden/fault plans
├── architecture/                    # manifest/exports/graph/bundle 负向夹具
├── contracts/                       # OpenAPI/Zod/client/job/event
├── database/                        # clean/upgrade/grants/TX/restore
├── integration/                     # API/Worker/PG/Redis/BullMQ
├── e2e/
│   ├── api/
│   ├── admin/
│   └── miniapp/
├── resilience/                      # crash/duplicate/late/loss/restore
├── ai-evaluation/                   # S-16 harness；不保存真实用户内容
└── manual-rc/                       # 真机/人工演练清单与证据模板

tooling/
└── testing/                         # runner、registry、report、fixture 工具；无业务规则
```

边界：

- package-local test 可以导入该 package 的 public surface 与显式 `./testing` export；不能 deep import 别的 package internal；
- `server-adapters/testing` 只提供合成 adapter/factory，不导出 production credential 或 unrestricted DB；
- root `tests/` 不复制业务实现，只组合 public contract、进程与真实基础设施；
- fixture 的期望来自 Accepted contract，不从当前实现输出“录制”后自动批准；
- 测试辅助代码也受 TypeScript strict、依赖图、secret/content 和 runtime zone Gate；
- production app/package 不能依赖 `tests/`、`./testing` 或 Playwright/Testcontainers。

## 7. 替身与真实依赖规则

### 7.1 可以 fake 的边界

- clock、UUID/ULID、random/seed source；
- application-owned repository/port，用于 UNIT/MODULE；
- 微信、AI provider、对象存储、通知平台的封闭协议 fake；
- 加密/KMS port 的合成 keyring，不使用生产算法 key；
- metrics/log sink，只收 allowlisted metadata。

fake 必须实现与 production adapter 相同的 port contract，并通过 adapter conformance suite；不能拥有 production 没有的便利语义。

### 7.2 不能用 fake 证明

- PostgreSQL unique、CHECK、FK、trigger、isolation、row lock、`SKIP LOCKED`、grant 与 migration；
- Redis/BullMQ duplicate、job ID、ACK、lease、retry 和 loss；
- HTTP parsing、header、closed JSON、auth audience、status/envelope；
- Next 浏览器行为、bundle 与 client/server boundary；
- 微信 WXML/page lifecycle、storage/network/share/subscription 平台行为；
- process crash、network timeout、late response、backup restore；
- provider strict-output/timeout/usage 行为的生产资格。

这些语义必须分别使用真实 PostgreSQL/Redis/BullMQ、黑盒 HTTP、真实浏览器、微信开发者工具/真机、故障代理或显式 provider evaluation。

### 7.3 禁止脆弱 mock

- 不 mock 被测模块内部私有函数或 Prisma delegate 调用顺序；
- 不用固定 `sleep` 等待异步完成；使用 barrier、poll condition、fake clock 或确定性 hook；
- 不把 implementation call count 当业务结果，除非合同明确规定 provider/ordinary call 数；
- 不 snapshot 整个随机 ID/时间/错误堆栈/AI 正文；
- 不让 mock 自动接受未知字段、未授权 ref、任意 SQL 或任意 provider response。

## 8. 合成 fixture、时钟与隔离

### 8.1 合成身份与内容

- 使用 `SyntheticSubjectRef`、合成微信 code/lookup token、合成称呼/事项/note；
- Safety case 只使用 S-15/S-16 经批准的合成 corpus，不在普通测试随意扩写危机原文；
- fixture 明确 `factory_version`、Schema/version、ProductDate policy、retention policy、route/template version 和 source fingerprint；
- 禁止生产 dump、截图、日志、provider raw response 或真实密文进入 fixture；
- 每次 property/fuzz 失败必须输出可重放 seed，但不得输出被测正文或 secret。

### 8.2 时间矩阵

固定 fake clock 与真实 PostgreSQL timestamp 组合至少覆盖：

- `Asia/Shanghai` 03:59:59.999 / 04:00:00.000；
- UTC 与上海日期不同；
- 月末、年末、闰日、夏令时不适用但输入含 offset；
- continuation grant 的前后边界；
- Daily/Evening window 开/关；
- TTL、30/35/45/72 小时/天与 6 个月期限边界；
- provider late、notification unknown、backup restore 的事件顺序。

客户端时间只能作为不可信输入；测试期望由 server clock + policy 计算。

### 8.3 资源隔离

- UNIT/MODULE 不共享可变 global；
- DB suite 每个 shard 使用独立临时 database 或 schema，且角色/grant 不能串；
- Redis/BullMQ suite 使用独立容器或不可碰撞 namespace，测试后由容器销毁而非清空共享 Redis；
- Playwright 每个 worker 使用独立合成账户、browser context 和 command ref；
- Mini Program runner 使用专用测试 AppID/项目配置与合成 backend，不使用生产账号；
- 并行测试不得依赖执行顺序；需要顺序的恢复场景明确为一个 scenario 内的 steps。

## 9. Source-ID coverage registry

### 9.1 必须纳入的上游集合

| 上游集合 | 数量/范围 | 主要测试落点 |
|---|---:|---|
| S-28 技术栈 | 32 `S28-STACK-*` | STATIC、CONTRACT、DB、INTEGRATION、clean checkout |
| S-29 系统架构 | 48 `S29-ARCH-*` | MODULE、DB、INTEGRATION、RESILIENCE、E2E |
| S-30 仓库边界 | 48 `S30-REPO-*` | STATIC、compile、bundle、profile startup |
| S-19 SQL | 20 `SQL-001..020` | migration SQL、constraint、grant、drift |
| S-19 事务 | 9 `TX-01..09` | DB/INTEGRATION 原子性与 failure injection |
| S-19 数据库场景 | 64 `S19-DB-*` | DB、INTEGRATION、restore |
| S-20 API 场景 | 48 `S20-*` | CONTRACT、API E2E、Admin E2E |
| S-12 Gateway | 37 个固定场景 | MODULE、adapter conformance、INTEGRATION、AI_EVAL |
| S-16 AI corpus | 269 个唯一 case | corpus lint、DETERMINISTIC、MODEL、LOAD、HUMAN |
| S-21 隐私场景 | 34 个唯一 `PDM-*` 场景 | field/content scanner、权限、删除/恢复 E2E |
| shared-schemas | 当前 Zod/JSON Schema fixtures | UNIT、property、JSON Schema/export contract |

这些集合存在重叠是预期行为，不能相加后当作“测试用例数”。registry 计算：

- 每个 source ID 是否至少映射到一个 planned/implemented test；
- 是否存在强制层级，例如 SQL-ID 必须有 DB，不接受 UNIT-only；
- 是否有正向与负向 assertion；
- 测试状态、最后通过 commit、fixture/toolchain fingerprint；
- 选择性 CI 是否运行了所有受影响 source IDs。

### 9.2 coverage map 最低要求

| 合同类型 | 最低证据 |
|---|---|
| Schema/cross-field | 正向、边界、未知字段、非法组合、property/golden |
| 数据库唯一性/constraint | 真实 PG 负向 insert/update + 友好错误映射 |
| transaction | 成功、每个关键 failure point、回滚后表/outbox/receipt 状态 |
| 权限/capability | static forbidden import + runtime credential/role/handler deny |
| API | OpenAPI lint + request/response Schema + HTTP status/header/envelope + post-condition |
| queue/outbox/inbox | enqueue/mark/commit/ACK 每个 crash window + duplicate/late |
| cache/Redis | hit/miss、guard change、Redis down/loss/rebuild、内容 allowlist |
| external adapter | request mapping、deadline/cancel、normalized error/usage、unknown/late |
| E2E journey | 用户可见状态 + PostgreSQL 权威 post-condition；不能只截屏 |
| AI hard gate | corpus integrity + 每次 sample 断言；不得取最好 sample |
| 删除/恢复 | guard 同步、物理清理、迟到消息、cache/queue/provider/object/backup 不复活 |

## 10. Static 与 architecture Gate

### 10.1 执行工具

- dependency-cruiser：源码 import、跨 app/package/module edge、cycle、forbidden zone；
- 自定义 manifest checker：单 lockfile、workspace protocol、`dailyEnergy.runtime`、版本/engine、无 app→app；
- package exports checker：显式 exports、无 wildcard/internal/deep import；
- capability manifest checker：profile → handler/queue/DB role/config/egress；
- build metafile/bundle scanner：client/server/provider/restricted/tooling 依赖与禁止字段；
- secret/content scanner：key pattern/value canary、Prompt、note/title/Safety/raw body；
- codegen/drift checker：Zod JSON Schema、OpenAPI bundle、api-client、mapper fixture、Prisma generated boundary；
- config checker：strict、coverage exclude、test skip、Turbo cache input/output 与 remote cache。

### 10.2 Known-fail fixtures

每条静态规则必须至少有一个最小负向 fixture，checker 对它必须失败并给稳定 rule ID。规则自测顺序：

1. valid fixture PASS；
2. one mutation/violation FAIL；
3. failure reason 命中预期 rule ID；
4. 删除/rename checker rule 时 registry 失败；
5. production graph 没有 ignore 或 baseline 豁免。

禁止用“known violations”长期白名单。临时迁移例外必须有 owner、reason、expiry、source IDs，且不能涉及 secret、Safety、删除、restricted、provider 或 client bundle。

## 11. Unit 与 module 测试

### 11.1 Unit

优先测试：

- ProductDate、窗口、continuation、retention/date 计算；
- canonical payload/fingerprint/command identity；
- revision/CAS decision、state transition、PublishGuard compare；
- rules、candidate validator、template renderer、Safety output validator；
- source fingerprint、fallback、relationship cutoff、notification semantic key；
- error mapping、view allowlist、redaction 与 event/job field allowlist。

每个 pure policy 至少覆盖：

- happy path；
- 最小/最大边界；
- UNKNOWN/ABSENT；
- stale revision/epoch；
- forbidden transition；
- property/invariant；
- 稳定 failure code。

### 11.2 Module

每个 `server-core` 模块通过 public command/query/port 测试：

- 不 deep import domain/internal；
- fake port 只记录封闭请求与允许结果；
- application orchestration 不依赖 Nest/Prisma/Redis/Bull/provider concrete；
- 发出的 event/outbox intent 只含 allowlisted metadata；
- 错误不泄露 adapter/SQL/provider；
- 跨模块只通过 public contract/event/SPI。

Module test 不声称证明 transaction/unique/grant；这些必须在 DB/INTEGRATION 重复验证。

## 12. PostgreSQL、Prisma 与 migration 矩阵

### 12.1 三种数据库路径

| 路径 | 初始状态 | 必须结果 |
|---|---|---|
| Clean | 空 PostgreSQL 18 | 全 migration 应用、SQL-001～020/grants/index/seed contract 通过 |
| Upgrade | 上一受支持 Schema + 合成 fixture | expand/validate/switch 后数据、version/fingerprint 与兼容读写正确 |
| Drift/Restore | introspection/format 或隔离备份 | 自定义 SQL/grants 不丢；restore deny/guard/TTL 先应用再开放 |

每个路径记录 PostgreSQL image digest、Prisma CLI/Client exact version、migration checksums 与 test commit。

### 12.2 SQL-001～020

- 每个 SQL-ID 对应 migration 注释、至少一个 must-pass 和 must-fail fixture；
- SQL 错误必须被 repository/transport 映射为稳定业务错误，不暴露 constraint/SQL；
- immutable table 测试包括普通角色 UPDATE/DELETE deny；
- SQL-020 使用实际 DB role 连接测试，不只检查 grant 文件文本；
- `prisma format/validate` 通过不能替代自定义 SQL；
- `prisma db push` 在共享/测试发布路径也必须被脚本 Gate 拒绝。

### 12.3 TX-01～TX-09

每个 transaction suite 使用受控 failure hook 在关键写之间抛错，并断言：

- 领域表、CommandReceipt、revision/history、outbox 全部提交或全部回滚；
- retry 使用原 command/event/task ref；
- unique/CAS loser 回读 existing，不重新创建；
- 外部网络调用数在 transaction 内为 0；
- commit 后才允许 relay/adapter 行为；
- Safety/delete guard 的同步事实不等待 queue；
- HIGH_RISK ordinary write/provider/template 调用数为 0。

### 12.4 并发

并发测试使用 barrier 同时释放真实连接，不用顺序 Promise 假装竞争。至少覆盖：

- identity、Checkin、GenerationIntent、Daily publish、LightFact、RelationshipCycle；
- attempt `(invocation, role, ordinal)`；
- Notification semantic intent/claim；
- active DataTask；
- Weekly current pointer；
- TTL `SKIP LOCKED` claim。

断言数据库最终唯一状态、输家结果、outbox/inbox 数量和稳定错误。

## 13. API 与契约测试

### 13.1 Contract direction

```text
shared-schemas
  → JSON Schema/client-safe projection
  → OpenAPI field refs
  → public/admin generated client
  → Nest request/response mapper
  → black-box HTTP response
```

每个箭头必须有 drift test，生成物 clean rerun diff 为 0。禁止：

- 从 Prisma 推导 API DTO；
- Nest/class-validator 手写第二套 enum/字符预算；
- public client 导出 Admin path；
- response 夹带未在 OpenAPI/shared-schemas 的字段。

E-008 已建立当前可执行基线：

- `pnpm codegen:check`：Zod JSON Schema、OpenAPI bundle、Public/Admin client 逐字节漂移；
- `pnpm contract:check`：OpenAPI parse、operation 唯一、error catalog/status/envelope、audience、projection/mapper、exports 和 client-safe 静态合同；
- `pnpm contract:fixtures`：正常 corpus、重复生成和 15 个稳定 rule ID 的最小 known-fail mutation；
- package-local Vitest/typecheck：Schema 正负 corpus、JSON Schema/Zod 代表样例、mapper、独立客户端和 transport stub。

正式 Source-ID coverage registry 在 E-010 前为 `NA_WITH_REASON`：本任务提供可执行命令和稳定 rule ID 机器证据，但不提前建立覆盖不完整的伪 registry。

### 13.2 HTTP 黑盒

对真实 Nest app 至少断言：

- Content-Type、request/response ID、server time/ProductDate、status 与 envelope；
- unknown field/oversize/malformed JSON/charset；
- ordinary 与 Admin session audience 不互换；
- Safety-first、account/deletion/consent/onboarding/date/owner/revision guard 顺序；
- Idempotency-Key 与 body command_ref 一致；
- same ref/same payload、same ref/different payload、Unknown outcome；
- 404 不泄露非 owner resource；
- Retry-After header/body 一致；
- error 无 stack、SQL、Prisma、provider、Prompt、openid、ciphertext；
- client view 无 epoch/seed/fingerprint/attempt/restricted evidence。

测试同时检查 PostgreSQL post-condition，不能只断言 HTTP 文案。

### 13.3 外部 adapter contract

每个微信/provider/object adapter 共享 conformance suite：

- request field/header/body allowlist；
- secret 只由 server injection，错误不回显；
- TLS/endpoint/region allowlist；
- deadline/cancel/429/5xx/protocol/content block；
- idempotency/attempt ref；
- normalized outcome/usage；
- timeout 后 UNKNOWN，late callback 不二次发布；
- raw invalid response 不落库/日志。

adapter fake 与 production adapter 都跑同一 suite；fake 不得比 production contract 更宽。

## 14. Outbox、BullMQ、Redis 与 cache

### 14.1 Outbox/inbox crash points

必须具名注入：

1. 领域写前；
2. 领域写后/outbox 前；
3. transaction commit 前；
4. relay claim 后/enqueue 前；
5. enqueue 后/PUBLISHED 标记前；
6. consumer receive 后/inbox 前；
7. inbox + domain commit 前；
8. commit 后/queue ACK 前；
9. ACK 后/后续 outbox relay 前。

每个 fault 后恢复原进程并断言：单业务事实、单稳定 intent/link/notification、允许重复的投递元数据、Inbox no-op 与无内容泄漏。

### 14.2 Redis loss

测试步骤：

- 先建立 PostgreSQL facts/outbox/due rows/DataTask；
- 清空或替换整个测试 Redis 容器；
- 重启 API/各 Worker profile；
- 从 PG 重建 queue/cache/协调；
- 验证 Safety、删除、result、relationship 和 command facts 未丢；
- breaker/budget 不可读时 provider calls=0、template fail-closed；
- stale cache 在 guard/source fingerprint 变化后不可命中。

禁止测试通过从 completed BullMQ job、cache 或 log 反向重建事实。

### 14.3 Payload allowlist

queue/cache/job/log/trace fixture scanner 必须拒绝：

- preferred name、checkin 值、matter title、note；
- Prompt、expression、provider raw body；
- Safety 原文/confidence/rationale；
- secret、external identity、object key；
- high-cardinality user/account label。

只允许 opaque ref、stable type/version、revision/fingerprint、必要 guard epoch、time、outcome 和低基数 metadata。

## 15. Worker profile、credential 与 egress

每个 profile 要同时通过五层证据：

| 层 | 证据 |
|---|---|
| Source graph | 只 import 允许的 core runtime 与 adapter subpath |
| Build graph | artifact/metafile 不含禁止 provider/restricted/migration 能力 |
| Handler manifest | job type/version/queue 与 profile allowlist 完全一致 |
| Startup attestation | 配置 fingerprint、DB role、queue、egress 不匹配即 fail closed |
| Runtime deny | 错 profile job、SQL table、external endpoint 的实际调用被拒绝并产生脱敏诊断 |

角色矩阵至少包括：

- `api-app` 不能读 restricted/ciphertext 或执行 migration；
- `api-safety` 只能执行 TX-05 所需最小 port；
- `worker-core` 无任意 restricted 文本；
- `worker-deletion` 只按 task/scope 访问；
- `operations-read` 只能读聚合/脱敏 view；
- `evaluation` 不能使用真实 AccountRef；
- migration owner 不服务常驻流量。

egress 使用本地 allowlist proxy/stub 验证目标和 TLS 配置；不把“测试环境没有网络”当作 allowlist 证据。

## 16. Mini Program 与 Admin

### 16.1 Mini Program 三层

1. **Vitest**：页面外纯状态机、view model、日期显示、草稿、retry/恢复决策、生成 client；
2. **微信开发者工具自动化**：真实 WXML/page lifecycle、路由、storage、network、share、permission/weak-network mock；
3. **真机 RC 冒烟**：目标基础库/常见 iOS 与 Android，登录、前后台、弱网、授权、分享、跨 04:00 与删除后状态。

浏览器或 jsdom 不能冒充微信运行时。开发者工具 runner 不可用时结果是 `INFRA_BLOCKED`，不是 PASS；影响平台边界的 PR 不能只靠 Unit 合并。

Mini Program 自动化至少覆盖：

- 首次认识 → 签到 → RUNNING → Today → 点亮；
- 重复点击/Unknown outcome 恢复原 command/intent；
- 04:00 前后与 continuation；
- offline/timeout/503/template/terminal；
- Safety overlay 覆盖深链；
- DELETING/DELETED；
- local storage 含 guard/source 旧 view 时服务端结果优先；
- bundle 无 server/provider/Prompt/secret/restricted field。

### 16.2 Admin

Playwright 使用独立 Admin session 测试：

- 登录/过期/CSRF/二次验证占位；
- overview 仅聚合；
- Safety/DataTask 列表脱敏；
- 无编辑已发布结果、解除 Safety 或任意全文接口；
- Next route/server component 只调用 Admin API；
- browser bundle 无 DB/Redis/provider/Prompt/secret；
- 普通小程序 session 调 `/v1/admin` 被拒绝。

视觉 snapshot 只用于稳定 layout/component，不能替代权限、数据或业务断言。

## 17. 核心 E2E journey

| Journey | 必须跨越 | 关键异常 |
|---|---|---|
| J01 First Light | auth、consent、onboarding、checkin、intent、worker、result、light | 双击、Unknown、template |
| J02 Same Day Return | today/history/interaction | cache stale、revision conflict |
| J03 Evening | feedback/helpfulness/task TX-04 | 任一 revision 冲突、HIGH_RISK |
| J04 Seven Days | 七个 ProductDate、light、weekly facts/current | missing day、source invalidation |
| J05 Matter/Memory | matter、purpose grant、candidate dependency | revoke/delete、fallback/BLOCKED |
| J06 Safety | free-text gate、TX-05、SafetyView、两步 recovery | deep link、跨日、provider down |
| J07 Notifications | preference、intent、claim、platform attempt | timeout/late、Safety before dispatch |
| J08 Data Rights | export、DAY/MATTER/RELATIONSHIP/ACCOUNT delete | failed step、Redis loss、late job、restore |

每条 E2E 同时断言用户可见 View、数据库权威事实、外部调用次数、queue payload 和敏感字段扫描。

## 18. AI 与内容质量测试

### 18.1 普通 PR

- corpus integrity：269 IDs、source path/blob/version/fingerprint；
- shared Schema、fact binding、template、Safety/privacy/memory hard validators；
- 受影响 deterministic cases；
- controlled template 无网络/随机/当前时间且完整通过相同 validators；
- Gateway adapter fake 的 primary/backup/template 顺序、deadline、unknown 与 call count；
- high-risk ordinary provider/template calls=0。

普通 PR 不调用真实 provider，也不通过生成模型自动修补失败 fixture。

### 18.2 模型/Prompt/policy 变更

严格执行 S-16 变更触发矩阵：

- 每个适用生成 case、candidate parameter set 三次 sample，hard case 每次通过；
- MODEL/LOAD 由显式受限 evaluation job 执行；
- exact model/API/parameter/region/data profile/price fingerprint；
- failure sample 不删除、不重试取最好；
- 输出 artifact 权限、期限和内容扫描通过；
- human 120-output 双盲、两评分者/第三人裁决与一致性门槛；
- LLM judge 不能覆盖 deterministic 或 human hard failure。

### 18.3 发布状态

测试只能产生：

- `INVALID_RUN`；
- `INELIGIBLE`；
- `QUALIFIED_STAGED`；
- `TEMPLATE_ONLY`；
- 后续显式流程批准的 `APPROVED_ACTIVE`。

不能因 CI green 自动把 provider/route 设为 ACTIVE。

## 19. 故障与恢复矩阵

| 故障 | 注入方式 | 核心断言 |
|---|---|---|
| API process kill | command commit 前/后 kill | 原 command receipt/aggregate 恢复 |
| PG unavailable | proxy cut/stop container | guarded read/write/publish fail closed |
| Redis unavailable/loss | proxy cut/replace container | PG facts 不丢；queue/cache 可重建 |
| Relay crash | enqueue 前/后 kill hook | outbox 重投、单业务效果 |
| Consumer crash | DB commit 前/后 kill hook | Inbox + ACK 顺序正确 |
| Provider timeout/late | stub + Toxiproxy latency/cut | OUTCOME_UNKNOWN、不重发 role、late 不发布 |
| Notification timeout | stub claim/late response | 原 intent/claim reconcile |
| Guard changes | invocation/job 中途 CAS | Publish/consumer 拒绝旧 epoch |
| Restricted step fails | checkpoint N 抛错 | task/guard 保持、原 scope 重试 |
| Bad config/role | startup fingerprint mismatch | 进程 fail closed |
| Migration incompatible | old app + new schema matrix | expand/compat 或发布阻断 |
| Backup restore | 隔离 old backup fixture | deny/guard/TTL/source invalidation 后才开放 |

故障测试使用确定性 hook/barrier 和 event timeline；随机 chaos 只作为补充，不替代上述可重放 case。

## 20. 性能、容量与成本

S-31 不创建生产 SLO，但测试必须保留测量能力：

- API command/query、DB transaction、outbox lag、queue age、worker duration；
- Daily/Weekly provider role 和 end-to-end deadline；
- DB pool、Redis connection、BullMQ concurrency、Daily reserve；
- migration lock/scan/batch 与 restore duration；
- bundle size 与 Mini Program 首屏/包大小；
- token/usage/actual billed cost 与 unknown usage。

资格门：

- S-16 已固定 Daily/Weekly provider deadline、样本与成本 Gate，测试实现不得放宽；
- load/performance 只用合成数据，不把真实用户正文复制到压测；
- 性能失败不通过提高 timeout、并发、重试或删除 Safety/Schema 字段“修复”；
- Weekly/background 压力必须证明 Daily 保留容量不被耗尽；
- benchmark 只在固定 runner/container/image/config 下比较，环境漂移则标 `INVALID_COMPARISON`。

## 21. 覆盖率与缺口政策

### 21.1 最低覆盖率

| 范围 | Statements/Lines | Branches | Functions |
|---|---:|---:|---:|
| shared-schemas/validator | 95% | 95% | 100% |
| critical pure policies | 100% | 100% | 100% |
| 其它 server-core | 90% | 85% | 90% |
| adapters/apps 手写逻辑 | 80% | 75% | 80% |

critical pure policies 至少包括 ProductDate/窗口、CommandReceipt/fingerprint、revision/CAS、PublishGuard、Safety/deletion guard、source invalidation、retention、outbox/inbox decision、notification claim 和 Gateway route/fallback。

规则：

- coverage include 显式包含所有生产 `src`；不能只统计被 import 文件；
- generated、type-only declaration、第三方 vendored 代码可排除；
- migration SQL、config、entrypoint 不能因无行覆盖被认为已验证，使用专用 Gate；
- coverage ignore 必须有 reason + reviewer；critical policy 禁止 ignore；
- 达到百分比仍不能补偿 missing source ID、错误断言、Safety miss 或权限缺口；
- 新代码不得降低所在 package 阈值，且所有新增分支应有明确测试或受审不可达说明。

### 21.2 缺口状态

- `COVERED`：强制层级和断言通过；
- `PARTIAL`：已有测试但缺少强制层级/故障/权限证据；
- `PLANNED`：对应工程 Issue 已确定但实现尚未存在；
- `BLOCKED`：平台/专业/合规/环境依赖未满足；
- `WAIVED`：只允许非关键临时例外，有 owner/expiry/impact；
- `UNMAPPED`：发布阻断。

Safety、删除、身份、owner、SQL-ID、TX-ID、profile capability 和 secret 泄漏不得 WAIVED。

## 22. CI lane 与触发

| Lane | 内容 | 触发 | 目标性质 |
|---|---|---|---|
| `docs` | Markdown/link/status/source-ID/corpus lint | 文档 PR | 快、无容器 |
| `static` | frozen install、format/lint/type、graph/exports/capability/secret/codegen | 每个代码 PR | 必须阻断 |
| `unit-contract` | Vitest UNIT/MODULE/Schema/OpenAPI/client | 每个代码 PR | 无外部网络 |
| `db-integration` | PG clean/upgrade/grants/TX/repository | DB/server 相关 PR；main 全量 | 真实 PG |
| `queue-integration` | Redis/BullMQ/outbox/inbox/profile | queue/server 相关 PR；main 全量 | 真实 Redis |
| `api-e2e` | Nest HTTP + PG/Redis + external stubs | API/core 相关 PR | 黑盒 |
| `admin-e2e` | Playwright Chromium；多浏览器在 main/RC | Admin/API contract 相关 PR | browser |
| `miniapp-conformance` | 微信开发者工具自动化 | Mini Program/client/Schema 相关 PR；RC | 专用 runner |
| `resilience` | crash/late/loss/restore | main/nightly；相关核心 PR 必跑受影响集 | 可重放 fault |
| `ai-deterministic` | corpus + hard validators/template/Gateway fake | AI/Schema/Safety/Prompt PR | 无真实 provider |
| `ai-model-load-human` | MODEL/LOAD/人工评审 | 显式 RC/evaluation run | 付费/受限 |
| `manual-rc` | 真机、删除/恢复/安全演练 | release candidate | 人工证据 |

### 22.1 选择性执行

- 选择器依据 package graph + source-ID dependency map，不按文件名猜测；
- shared-schemas/OpenAPI/Prisma/architecture/config/tooling 变化触发所有依赖 lane；
- migration、guard、Safety、删除、Gateway route、profile/capability 变化不得只跑 changed package；
- 无法确定影响范围时全量；
- docs-only 可以只跑 docs，但语义规范改变时必须更新 registry 并触发相关 contract lint；
- branch protection 的精确 required checks 由 E-011 落地，不能少于本文强制 lane；仅在
  22.2 的私有 GitHub Free 临时补偿控制有效时，允许替代平台强制机制，不允许减少或跳过 lane。

### 22.2 私有 GitHub Free 临时补偿控制

当且仅当私有仓库的当前 GitHub 计划明确不提供 branch protection required checks，并且
branch protection/rulesets API 返回能力不可用时，允许使用以下人工批准、机器核验的临时控制：

1. 只能通过 PR 合并到 `main`；禁止 direct push、force push、auto-merge 和在 GitHub UI
   中绕过本流程合并；
2. 合并前对一次读取返回的最新 `headRefOid`、`mergeable=MERGEABLE`、
   `mergeStateStatus=CLEAN` 与 `statusCheckRollup` 执行 fail-closed 核验；
3. `docs`、`static`、`unit-contract`、`db-integration`、`queue-integration`、`api-e2e`、
   `admin-e2e`、`resilience`、`ai-deterministic`、`supply-chain` 和聚合
   `E-011 automated full Gate` 共 11 个固定 check 必须来自同一 CI run，且全部为
   `COMPLETED/SUCCESS`；缺失、重复、pending、cancelled、skipped、failure 或 run 不一致均拒绝；
4. 必须有用户的明确合并批准，并使用
   `gh pr merge --squash --match-head-commit <HEAD_SHA>`；核验后 head 变化时命令必须拒绝；
5. PR comment 记录 PR、head SHA、run ID、11/11 结果、批准和核验时间；合并后项目交接记录
   merge SHA。该 receipt 是审计证据，不把人工控制冒充为 GitHub 平台保护；
6. `tests/ci/policy.json` 和 `pnpm ci:verify-pr-merge-gate -- <PR> <HEAD_SHA>` 固定上述
   规则并提供可执行核验；任何规则漂移或临时控制到期都使 CI policy fail closed。

该控制由仓库 owner 承担“有权限者仍可绕过”的残余风险，不豁免任何 Safety、删除、owner、
SQL/TX、capability、secret、contract drift 或其它强制 Gate。它于 2026-08-04 获用户明确接受，
最迟 2026-11-02 到期；GitHub 计划能力可用、出现第二位 merge-capable actor、E-014 开始或进入
RC 任一事件先发生时，必须在下一次合并前停止本控制并恢复 platform-enforced required checks。

## 23. Retry、flaky 与 quarantine

- Vitest、DB、contract、architecture 和 deterministic AI Gate 默认 retry=0；
- Playwright/微信 runner 可为收集 trace 在 CI 自动重跑一次，但第一次失败仍记录为 `FLAKY_FAIL`，不能被第二次 PASS 擦除；
- provider/load 的 S-16 sample 不因失败自动补样或取最好结果；
- flaky test 先当产品/测试缺陷处理，记录 seed、runner、container、timeline 和 source IDs；
- 关键 Gate 不允许 quarantine：Safety、删除、identity/owner、SQL/TX、profile capability、secret、contract drift；
- 非关键 quarantine 必须有 Issue、owner、到期日、影响 source IDs 与替代证据；到期自动失败；
- 不能用增加 sleep、timeout、serial 全局执行或重跑次数掩盖 race；
- runner/平台故障标 `INFRA_BLOCKED`；没有证据时不得改成 PASS 或跳过。

## 24. Artifact 与证据

每个 CI/evaluation run 的最小证据：

- commit SHA、branch/PR、开始/结束 UTC；
- Node/pnpm/tool exact version、lockfile hash；
- container image digest、migration checksum、config/profile fingerprint；
- 测试/fixture/fault/registry version 与 source IDs；
- JUnit/JSON outcome、coverage summary、失败 stable code；
- Playwright trace/screenshot 仅含合成数据；
- Mini Program runner/DevTools/基础库/设备矩阵版本；
- AI run 继承 S-16 EvaluationRun 字段；
- `PASS/FAIL/PARTIAL/BLOCKED` 与下一动作。

普通 artifact 禁止：

- 用户正文、称呼、签到值、事项、note；
- Prompt、provider body/raw response、Safety 原文；
- token、secret、header、数据库 URL、外部 identity；
- production dump、真实截图或可逆 pseudonym；
-无限期保留的高基数 trace。

artifact 保存位置、加密、访问、期限和删除由 S-21/S-32/E-011 落地；未完成前只允许本地/CI 短期合成证据，不启用第三方 remote cache 或外部测试报告上传。

## 25. Merge、main 与 release Gate

### 25.1 PR merge

- required lane 全部 PASS；
- source-ID selector 无遗漏；
- 新/改合同已有正负测试；
- coverage 不低于范围阈值；
- 无 unresolved flaky/quarantine expiry；
- generated/codegen clean diff；
- artifact/content/secret scan 通过。

### 25.2 main/nightly

- 全量 DB/queue/API/Admin；
- resilience 分组轮转但每个 source ID 在固定窗口内运行；
- Mini Program 专用 runner；
- corpus/contract/architecture 全量；
- dependency/container/security scanner。

### 25.3 Release candidate

- core E2E J01～J08；
- SQL-001～020、TX-01～09、S29/S30 强制场景；
- Redis loss、provider late、notification unknown、delete/restore；
- Admin/miniapp/真机矩阵；
- S-16 对应的 deterministic、MODEL、LOAD、HUMAN、专业 Gate；
- migration clean/upgrade/rollback/restore；
- 未决 BLOCKED/WAIVED 清零或明确停止发布。

任何 hard Gate 失败都阻断，不使用加权总分。

## 26. E-001～E-011 实施交接

| 任务 | S-31 直接输入 |
|---|---|
| E-001 | root test scripts、Vitest projects 位置、single lockfile 与 clean-checkout 命令 |
| E-002 | dependency-cruiser、runtime zone、exports、strict/coverage/skip rule |
| E-003 | Nest test bootstrap、HTTP envelope/auth/health contract 与合成 config |
| E-004 | Mini Program pure logic boundary、DevTools automator runner 与真机清单 |
| E-005 | Playwright Admin project、独立 Admin session 与 bundle Gate |
| E-006 | Testcontainers PG、clean/upgrade/drift、SQL-001～020、TX/grants |
| E-007 | Redis/BullMQ container、outbox/inbox crash hooks、profile/Redis-loss suite |
| E-008 | Zod/OpenAPI/api-client/mapper/codegen drift 与 client-safe contract |
| E-009 | 测试 Compose、health、stub/fault services；不创建第二套拓扑 |
| E-010 | fixture/registry/runner/coverage/E2E/resilience 测试骨架 |
| E-011 | CI lanes、required checks、artifact/secret/content、exact image/tool pin |

E-010 不需要一次实现全部业务场景，但必须建立 registry，使尚未实现的 source ID 显示 `PLANNED` 而不是静默缺失。业务 Issue 完成时才能将对应项变为 `COVERED`。

## 27. 固定验证场景（48）

### 27.1 Registry、fixture 与分层（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S31-TEST-001 | Accepted source ID 没有 coverage entry | Registry Gate 失败，状态 UNMAPPED |
| S31-TEST-002 | 一个 E2E 标记覆盖 20 个 ID 但无逐项 assertion | MISSING_ASSERTION，不能计覆盖 |
| S31-TEST-003 | fixture 从当前实现输出自动更新 expected | Golden review 失败；期望必须来自 Accepted contract |
| S31-TEST-004 | fixture 含真实 AccountRef/openid/用户文本 | Privacy scanner 失败 |
| S31-TEST-005 | property test 失败但未记录 seed/version | Evidence Gate 失败 |
| S31-TEST-006 | Unit mock 声称证明 PostgreSQL unique/grant | 强制层级不足，状态 PARTIAL |
| S31-TEST-007 | 测试辅助 package 被 production import | Architecture/runtime Gate 失败 |
| S31-TEST-008 | clean checkout 执行 registry lint | 所有 Accepted 集合、数量、ID、强制层级一致 |

### 27.2 Static、contract 与客户端（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S31-TEST-009 | dependency rule 被删除但无 known-fail fixture | Checker self-test 失败 |
| S31-TEST-010 | Zod/OpenAPI/client enum 漂移 | Contract drift Gate 失败 |
| S31-TEST-011 | Nest mapper 返回 Prisma row/未知字段 | HTTP contract test 失败 |
| S31-TEST-012 | public client 含 `/v1/admin` export | Client subpath Gate 失败 |
| S31-TEST-013 | Mini Program bundle 含 `node:*`/provider/Prompt | Bundle Gate 失败 |
| S31-TEST-014 | Admin bundle 含 DB/Redis/provider key canary | Secret/bundle Gate 失败 |
| S31-TEST-015 | codegen rerun 产生 diff | Generated Gate 失败 |
| S31-TEST-016 | 微信页面只在 jsdom/浏览器通过 | 仍缺 DevTools conformance，不能标 COVERED |

### 27.3 Database、事务与并发（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S31-TEST-017 | 空 PG18 应用 migrations | SQL-001～020、grants、Prisma/drift 全通过 |
| S31-TEST-018 | SQL-ID 只有 must-pass 无 must-fail | SQL coverage Gate 失败 |
| S31-TEST-019 | TX-02 在 snapshot 后/outbox 前失败 | Checkin/intent/snapshot/receipt/outbox 按合同全回滚 |
| S31-TEST-020 | TX-04 任一 revision 冲突 | feedback/helpfulness/task 全不写 |
| S31-TEST-021 | TX-05 high risk | Safety 最小事实提交；ordinary write/provider/template 0 |
| S31-TEST-022 | 两连接 barrier 并发 publish | 一份结果；输家读取 existing |
| S31-TEST-023 | 普通 API DB role 读 restricted table | 实际 PostgreSQL grant 拒绝 |
| S31-TEST-024 | upgrade/restore 后自定义 constraint/grant 丢失 | migration/drift/restore Gate 失败 |

### 27.4 Queue、profile 与故障（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S31-TEST-025 | relay enqueue 后、mark 前 crash | 原 event 重投；单业务效果 |
| S31-TEST-026 | consumer commit 后、ACK 前 crash | InboxReceipt 使重投 no-op |
| S31-TEST-027 | Redis 容器全量替换 | PG facts 保留；outbox/due/task 重建 |
| S31-TEST-028 | 旧 guard epoch job 迟到 | handler 同步拒绝 |
| S31-TEST-029 | Interactive 收到 Restricted job | manifest/runtime 双重拒绝 |
| S31-TEST-030 | profile DB role/egress 与 fingerprint 不匹配 | 启动 fail closed |
| S31-TEST-031 | provider timeout 后 late success | 不重发同 role；late 不发布 |
| S31-TEST-032 | queue payload 含 note/Prompt/expression | Contract/content Gate 失败 |

### 27.5 E2E、安全、删除与恢复（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S31-TEST-033 | 首次到点亮双击/超时 | 单 command/intent/result/light，可恢复 |
| S31-TEST-034 | Safety ACTIVE 深链今日页 | 返回 SafetyView；普通路径 0 |
| S31-TEST-035 | 小程序 session 调 Admin | 鉴权拒绝，audience 不互换 |
| S31-TEST-036 | 04:00 前后用客户端旧日期写 | 服务端 ProductDate/continuation 权威 |
| S31-TEST-037 | 删除 confirm 后 Worker 未运行 | guard 已同步阻断全部普通路径 |
| S31-TEST-038 | Restricted 删除第三步失败 + 重启 | 原 task/checkpoint 重试，guard 保持 |
| S31-TEST-039 | 删除后旧 cache/job/provider 回调到达 | 全部拒绝，不复活 |
| S31-TEST-040 | 隔离恢复含已删 DAY 的备份 | deny/guard/TTL/source invalidation 后才开放 |

### 27.6 AI、CI 与证据（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S31-TEST-041 | 269-case corpus ID/source SHA 漂移 | Evaluation run INVALID |
| S31-TEST-042 | hard case 三次 sample 中一次失败 | candidate INELIGIBLE，不补样 |
| S31-TEST-043 | breaker/budget state 不可读 | provider calls 0，validated template |
| S31-TEST-044 | AI output 部分字段安全且部分非法 | 整份拒绝，禁止修补/拼接 |
| S31-TEST-045 | Playwright retry 第二次通过 | 仍记录 FLAKY_FAIL，不能静默 green |
| S31-TEST-046 | critical Gate 被 quarantine | 配置 Gate 失败 |
| S31-TEST-047 | artifact 含 Prompt/secret/真实内容 | 隔离并失败，按事件流程处理 |
| S31-TEST-048 | RC 执行完整 Gate | S28/S29/S30、SQL/TX、API、profiles、E2E、restore、AI 证据全部可追踪 |

## 28. 验收标准

- 测试层级、工具职责、替身边界和目录位置明确；
- Vitest、Playwright、Testcontainers、微信 DevTools、Redocly、Prisma/SQL 与 architecture checker 不互相冒充；
- S28/S29/S30、SQL-001～020、TX-01～09、S19、S20、Gateway、S16、PDM 与 shared-schemas 都进入 source-ID registry；
- Schema、数据库、事务、HTTP、queue、cache、profile、client、AI 和删除/恢复均有强制证据层；
- PostgreSQL/Redis/BullMQ 关键语义使用真实目标主版本，不用内存替身证明；
- outbox/inbox 所有 crash window、duplicate、late、unknown、Redis loss 和 restore 可重复注入；
- Mini Program 明确区分纯逻辑、微信开发者工具和真机，不用 Playwright/jsdom 假装平台 conformance；
- 每个 Worker profile 的 source/build/handler/startup/runtime capability 与 DB role/egress 可验证；
- coverage、retry、flaky、quarantine、artifact 和 CI 选择规则明确且不能绕过 hard Gate；
- S-16 deterministic/MODEL/LOAD/HUMAN/专业 Gate 在流水线中的位置清楚，普通 PR 不调用真实 provider；
- 48 个 `S31-TEST-*` 场景完整且唯一；
- S-32/S-33、E-001～E-011 的交接清楚；
- PR 只包含本文、S-30 接受记录和项目控制 Markdown，不创建测试代码、配置、workflow、容器、secret 或生产变更；
- 本文已随 PR #36 获用户确认并记录为 Accepted；后续实现不得静默降低测试层级、真实依赖、hard Gate、证据或 48 个场景。

## 29. 下游交接

### S-32 部署、配置与回滚

- 为每个 CI/test/runtime profile 固定 runner、container image/digest、network、secret、artifact 和 retention；
- 定义 migration/rollback/restore 的环境与凭据；
- 建立微信 DevTools/真机 runner 的隔离与 secret 路径；
- 不让测试、coverage、source map、remote cache 或报告上传泄漏内容。

### S-33 可观测性

- 复用测试稳定 operation/outcome/failure code，不复用正文；
- 把 queue age、outbox lag、unique/CAS、template/F4、TTL/delete/backup/provider deadline 纳入低基数指标；
- 生产信号与测试 source IDs 建立 runbook 链接，但不把用户 trace 复制进 fixture。

### S-34 / E-010 / E-011

- 每个工程 Issue 列出 source IDs、强制层级、正负 fixture 与 CI lane；
- E-010 建立 registry/harness/fixture/fault hook，未实现业务场景保持 PLANNED；
- E-011 将 lane 变为 branch protection required checks，并固定 exact tool/image；私有
  GitHub Free 能力不可用期间只能使用 22.2 已接受的有期限补偿控制；
- Phase 1～3 每个功能 PR 必须更新 coverage registry，不能在最后集中补测试。

## 30. 明确禁止

- 用 SQLite、内存 repository、mock Redis 或同步 fake queue 证明 PostgreSQL/BullMQ 语义；
- 用 Playwright、jsdom 或浏览器截图证明微信小程序运行时兼容；
- 只测 happy path，不测 duplicate、concurrency、crash、late、unknown、permission 和 restore；
- 以 coverage 100%、snapshot 或 E2E 页面可见代替数据库/权限/契约断言；
- 自动更新 golden/snapshot 后直接接受；
- 用 sleep、无限 retry、提高 timeout 或全局串行掩盖 race/flaky；
- quarantine Safety、删除、owner、SQL/TX、capability、secret 或 contract drift；
- 让测试代码/fixture 包进入 production graph；
- 在测试、artifact、coverage、trace、screenshot、HAR、queue UI 或 report 中保存真实用户内容、Prompt、Safety 原文、provider raw body 或 secret；
- 普通 CI 调用真实 provider、微信生产、对象存储或发送通知；
- 用 LLM judge、人工改写或挑最好 sample 让 AI Gate 通过；
- 让 migration、restore、provider/load、真机或人工 Gate 被 Turbo/remote cache 当作可复用 PASS；
- 在 S-31 PR 中创建测试代码、workspace 配置、CI、Docker、migration、queue、provider 调用或生产资源。

## 31. 审核记录

- 状态：Accepted；
- 接受日期：2026-07-26；
- 2026-08-04 修订：用户明确接受 22.2 的私有 GitHub Free 临时补偿控制；它只替代平台
  enforcement，不降低 11 个自动 checks、人工批准、head 绑定或其它 hard Gate；
- 内容 PR：[PR #36](https://github.com/WeiHan1996/DailyEnergy/pull/36)；
- 基线：`main`（S-30 仓库结构与模块边界已随 PR #35 合并并获用户确认）；
- 已确认范围：测试层级/工具、真实依赖与替身边界、source-ID registry、DB/TX/queue/profile/客户端/AI/恢复矩阵、CI/flaky/artifact 和 48 个场景；
- 下一任务：S-32 部署、配置和回滚；测试骨架与 CI 仍须等待 E-010/E-011。
