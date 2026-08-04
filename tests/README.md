# Tests

项目级黑盒、基础设施、Source-ID registry、合成 fixture 与证据策略目录。package/app
内部的 UNIT、MODULE 和局部 CONTRACT 测试继续与源码同目录；这里不复制业务实现。

## E-010 正式测试入口

| 命令                                                 | 证据                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm registry:check`                                | 736 个 Accepted/Schema Source ID 的唯一状态、强制层级和生成漂移                  |
| `pnpm registry:test`                                 | missing、duplicate、unknown status、missing assertion 与 insufficient layer 负例 |
| `pnpm testing:policy`                                | runner、fixture、corpus、artifact、skip、quarantine 与 testing import 边界       |
| `pnpm testing:playwright-policy`                     | Playwright 首次失败后 retry 通过仍以 `FLAKY_FAIL` 退出                           |
| `pnpm test:harness`                                  | 固定时间/随机源、合成身份、封闭网络/provider、fault 与 evidence policy           |
| `pnpm test:projects`                                 | root Vitest projects 编排                                                        |
| `pnpm test:api:e2e`                                  | Playwright `APIRequestContext` + 真实 Nest 测试应用 HTTP                         |
| `pnpm database:test:integration`                     | 固定 digest 的真实 PostgreSQL 18                                                 |
| `pnpm queue:test`                                    | 固定 digest 的真实 PostgreSQL 18 / Redis 8 + BullMQ 5                            |
| `pnpm --filter @daily-energy/app-admin run test:e2e` | Playwright Chromium Admin E2E                                                    |
| `pnpm test:miniapp:devtools`                         | 微信开发者工具 + automator；不可用时为 `INFRA_BLOCKED`                           |

机器可读 runner 及其真实依赖、隔离、retry 和 unavailable 状态见
`registry/runners.json`。浏览器/jsdom 不能代替微信运行时，内存替身不能代替
PostgreSQL/Redis/BullMQ。

## E-011 CI 与供应链入口

| 命令                            | 证据                                                               |
| ------------------------------- | ------------------------------------------------------------------ |
| `pnpm ci:check`                 | 12 个 lane、最小权限、immutable action、TTL 与外部 pending 边界    |
| `pnpm ci:test`                  | action/权限/fork secret/cache/artifact/cardinality/digest 负例     |
| `pnpm ci:audit`                 | production dependency high/critical vulnerability fail-closed Gate |
| `pnpm ci:supply-chain:evidence` | SPDX SBOM、license、build digest 与 unsigned provenance 生成和扫描 |

普通 PR 自动执行 9 个可用 lane；`miniapp-conformance`、
`ai-model-load-human` 与 `manual-rc` 保持显式 pending/blocked，不能由普通 GitHub
job 冒充 PASS。普通合成报告保留 14 天，SBOM/provenance 等供应链证据保留 365 天。

## Registry 与证据

- `registry/source-sets.json` 从 Accepted 原文和 executable Schema 提取 ID；
- `registry/coverage-registry.json` 是确定性生成物，只允许 `COVERED`、`PLANNED`、
  `NA_WITH_REASON`；
- `registry/e010-evidence-manifest.json`、`registry/e011-evidence-manifest.json` 与已有
  database/queue/Compose manifest 提供逐项
  assertion，不把低层证据升级为高层 conformance；
- 尚未实现的业务、恢复、模型、真机或人工场景保持 `PLANNED` 或明确 pending，不能因
  runner/模板存在而变为 PASS；
- `manual-rc/evidence-template.json` 与 `ai-evaluation/evidence-template.json` 默认禁止
  PASS，且不调用 provider。

## 合成与 artifact 边界

`fixtures/catalog.json` 固定 factory、时钟、seed 和来源指纹；`resilience/fault-plans.json`
保存可重放 fault ID。普通测试和 artifact 只能含合成主体与白名单 metadata，禁止真实用户
内容、Prompt、provider raw body、secret、外部身份或生产 dump。临时输出只进入
`artifacts/output/`，不提交仓库。

E-002 的版本化质量 fixtures 包括：

- `architecture/boundary-cases.json`：24 个最小 known-fail case 覆盖 S-30
  的 12 类静态 Gate，包括生产源码通过 `devDependencies` 跨 runtime zone，以及
  client-safe 通过 TS/JS 或 JSON/资源相对路径穿越到 server-core workspace；
- `architecture/known-pass-project.json`：隔离正向 project，全部 12 类 Gate
  的 diagnostics 必须严格为 0；
- `config/shared-intermediate-strict-off`：共享中间 tsconfig 关闭 `strict` 时，
  resolved config Gate 必须失败；
- `typecheck/fixtures/non-shared-workspace-error.ts`：root typecheck 的非
  shared-schemas workspace `TS2322` must-fail；
- `typecheck/fixtures/excluded-workspace-source.ts`：workspace 已有 TypeScript
  源码但 `tsconfig.include` 全部或部分未覆盖时，root typecheck must-fail；
- `eslint/fixtures/nest-controller.ts`：NestJS 风格 class/method decorators
  必须能由 ESLint 正向解析。
- `agent-workflow/cases.json`：版本化覆盖单一当前任务、过期 main、状态来源冲突、
  D-004/D-005 下游阻断、topic source、任务/路径 Profile 合并、Git 作用域失败、
  dry-run/零变更状态、changed/full 升级与根因邻域脱敏；所有负向场景要求稳定
  rule ID，正向场景要求零诊断。

上述旧 fixtures 已接入 E-010 正式 Source-ID registry；其原有 assertion 与强制证据层级
保持不变。

E-007 增加独立的 queue lane：

- `queue/evidence-manifest.json`：E-010 前的 scoped manifest，将 37 个本任务直接覆盖的
  S28/S29/S30/S31/S32/S33 Source IDs 映射到具体断言；
- `queue/evidence.test.mjs`：拒绝缺失 Source ID、未知 proof 和虚假 coverage 状态；
- `queue/integration.test.mjs`：使用固定 digest 的真实 Redis 8.2.1、BullMQ 5.81.3 与
  PostgreSQL 18，验证 relay/ACK crash、Inbox duplicate、profile/guard/retry、空 Redis
  重建与 graceful drain；
- `pnpm queue:validate`：运行 scoped evidence Gate 和真实容器集成套件。
