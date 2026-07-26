# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-26
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-31
- **当前任务名称**：测试策略
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/testing-strategy`
- **上游 PR**：[S-30 PR #35](https://github.com/WeiHan1996/DailyEnergy/pull/35)
- **当前 PR**：创建后补充
- **交付文件**：`docs/technical/testing.md`

## 1. 当前目标

把 Accepted 的 Schema、AI 评价、数据库/API、系统架构和仓库边界转换为可实施的测试合同，明确：

- Static、Unit、Module、DB、Contract、Integration、E2E、Resilience、AI Eval 与 Manual RC 层级；
- Vitest、Playwright、Testcontainers、微信开发者工具自动化、Redocly、Prisma/SQL 与 architecture checker 职责；
- Accepted source ID 的 coverage registry、强制测试层级和证据字段；
- PostgreSQL 18、Redis 8、BullMQ 5 的真实集成、并发、crash、late、loss 与 restore；
- Mini Program、Admin、API、Worker profiles 和外部 adapter 的运行时验证；
- coverage、CI lane、flaky、retry、quarantine、artifact 和 release Gate。

## 2. 必须交付

### 2.1 测试分层与工具

- 每个测试层级的范围、允许替身、真实依赖与完成定义；
- Vitest 4、V8 coverage、property tests、Playwright 和 Testcontainers 边界；
- Mini Program 纯逻辑、微信 DevTools automator 与真机 RC 三层；
- package-local/root 测试目录与 testing export 约束；
- architecture/manifest/exports/capability/bundle/codegen known-fail fixture。

### 2.2 覆盖与关键语义

- S28/S29/S30、SQL-001～020、TX-01～09、S19/S20、Gateway/S16/PDM/shared-schemas coverage registry；
- Schema/OpenAPI/client/mapper/Prisma 的单向 contract/drift；
- DB constraint/grant/transaction/concurrency 与友好错误；
- outbox/inbox 每个 crash window、duplicate、late、Redis loss 和 rebuild；
- Worker handler、DB role、config、queue 和 egress allowlist；
- Safety、删除、恢复、用户权利与高风险 ordinary calls=0。

### 2.3 流水线与验收

- CI lane、触发/选择规则、merge/main/RC Gate；
- coverage 阈值与不可补偿 hard Gate；
- flaky/retry/quarantine/infra blocked 规则；
- 合成 fixture、时钟、隔离、artifact 与敏感内容扫描；
- 48 个唯一 `S31-TEST-*` 场景；
- E-001～E-011 与 S-32～S-34 的实施交接。

## 3. 上游读取顺序

1. `AGENTS.md`、`README.md`、`ROADMAP.md`、`docs/INDEX.md`、本文；
2. `docs/decisions/ADR-0006-monorepo-and-stack.md`；
3. `docs/technical/architecture.md`；
4. `docs/technical/repository-structure.md`；
5. `packages/shared-schemas/README.md` 与现有 package tests/exports；
6. `docs/ai/evaluation.md`、`evaluation-corpus.json`、`gateway.md`；
7. `docs/technical/database.md`、`api.md`、`error-codes.md`；
8. `prisma/schema.prisma`、`openapi/openapi.yaml`；
9. `docs/operations/privacy-data-map.md`；
10. `docs/technical/testing.md`。

## 4. 已冻结边界

- Node 24 LTS、TypeScript 7 strict、pnpm 11、Turbo 2、Vitest 4；
- 微信原生小程序、NestJS/Express、Next/React、PostgreSQL/Prisma、Redis/BullMQ、Zod 不重新选型；
- 模块化单体、一个 PostgreSQL database/schema、无内部 RPC；
- PostgreSQL 是事实，Redis/BullMQ/cache/artifact 不是；
- API/Admin/Worker profiles、事务/outbox/inbox/Gateway/Safety/删除语义不变；
- Zod/OpenAPI/Prisma 权威方向与 S-30 runtime/capability zone 不变；
- 只使用合成数据；普通 CI 不调用生产微信、AI provider、对象存储或通知；
- S-16 hard/专业/人工 Gate 不由 coverage、snapshot 或 LLM judge 替代。

## 5. 不做

- 不创建 root test 配置、tests/tooling 目录、runner、fixture 或测试代码；
- 不创建 GitHub Actions、branch protection、container、Compose、secret 或 artifact store；
- 不运行真实 provider、专业 Safety 评审、人工盲评、微信真机或生产外部调用；
- 不创建 migration、数据库/Redis/BullMQ、故障代理或生产资源；
- 不固定 S-32 的 runner/deployment/rollback，也不固定 S-33 SLO/告警；
- 不提前开始 E-010、E-011 或 S-32。

## 6. 验收标准

- `testing.md` 为 Draft，包含分层、工具、fixture、registry、关键矩阵、CI/flaky/artifact 与 release Gate；
- 48 个 `S31-TEST-*` 场景完整且唯一；
- 所有相对链接可解析；
- `repository-structure.md` 根据用户确认转为 Accepted，S-30 backlog 为 Done；
- README、INDEX、tasks/current 和 backlog 一致标记 S-31 In Review；
- PR 仅包含 6 个 Markdown 文件，无测试代码、配置、workflow、container、migration、secret 或生产变更；
- 用户确认前 `testing.md` 保持 Draft，S-31 保持 In Review。

## 7. 最近交接

- [PR #35](https://github.com/WeiHan1996/DailyEnergy/pull/35) 已于 2026-07-26 合并，S-30 仓库结构与模块边界已获用户明确确认；
- `repository-structure.md` 在本分支补记 Accepted/接受日期，不改变目录、package、module 或 capability 结论；
- S-31 Draft 定义 source-ID coverage registry、十类测试层级与真实依赖/替身边界；
- PostgreSQL/Redis/BullMQ 关键语义使用真实容器；微信小程序需 DevTools automator 与真机 RC，不由浏览器替代；
- 已定义 48 个测试策略场景；S-32 是下一任务；
- 当前动作：创建 Draft PR 后等待用户审核；不自动接受、合并或开始 S-32。
