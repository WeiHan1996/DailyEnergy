# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-29
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-008 — 统一 Zod Schema、OpenAPI 与生成 API Client
- **任务状态**：In Progress
- **当前分支**：`agent/e-008-contract-codegen`
- **当前 Issue**：[E-008 Issue #46](https://github.com/WeiHan1996/DailyEnergy/issues/46)
- **当前 PR**：尚未创建
- **Gate 结论**：`GO`

## 1. 当前目标

建立唯一、可执行且可重复生成的合同方向：

```text
Zod Schema
  → client-safe 投影 / JSON Schema
  → OpenAPI HTTP path / envelope
  → 显式 mapper
  → miniapp / admin API Client
```

E-004 已随 [PR #96](https://github.com/WeiHan1996/DailyEnergy/pull/96)
squash 合并，merge commit 为
`84f06b14e77a0df7f57bda60870cb8f4f30cfb32`，Issue #42 已关闭。
E-008 是唯一 In Progress 任务；E-005、E-006 及其他工程任务不得并行开始。

## 2. 开工检查

- 当前分支、本地 `main` 与 `origin/main` 均基于 E-004 merge commit；
- 工作区开工时无用户未提交改动；
- Issue #46、Accepted API/error/OpenAPI、仓库结构、测试、部署与
  ADR-0006 已复核；
- Zod 的业务值权威、OpenAPI 的 transport 权威和显式 mapper 边界一致；
- OpenAPI `EveningSaveRequest` 与
  `EveningReflectionSubmissionSchema` 存在有意的 transport/domain 形状差异，
  必须由单向 mapper 处理，不得复制或静默改写 Schema；
- 正式 Source-ID registry 属于 E-010，本任务只记录实际机器证据，不创建伪
  registry。

## 3. E-008 范围

- 发布 `@daily-energy/shared-schemas` 的根、`./client` 和
  `./json-schema` 显式出口；
- 建立 Zod → JSON Schema / OpenAPI projection 的确定性生成；
- 发布 `@daily-energy/api-client/miniapp`、`./admin` 和 `./testing`；
- 固定 Public/Admin audience、client-safe import/field 与 mapper 边界；
- 建立 source fingerprint、generated header、drift 和 clean-generation Gate；
- 提供 Schema corpus、OpenAPI/error、client compile、mapper 与 codegen
  正负测试；
- 保持 E-003 API 与 E-004 Mini Program 现有 Gate 通过。

## 4. 不做

- 不实现真实 HTTP handler、领域 use case、业务页面或视觉设计；
- 不实现数据库、Prisma migration、Redis、BullMQ、Worker 或 provider；
- 不新增 GitHub Actions、required checks 或 CI artifact；
- 不创建生产资源、账号、域名、密钥或真实用户 fixture；
- 不提前启动 E-005、E-006、E-009、E-010、E-011 或 D 系列设计任务。

## 5. 验收与证据

- **Schema/client-safe**：`./client` 使用独立白名单模块，不经根 barrel 或
  internal daily/evening/weekly 模块；38 个 Schema 测试通过；
- **生成**：20 个稳定 JSON Schema、OpenAPI bundle 和 Public/Admin client
  均带 generator/version、source fingerprint 与 do-not-edit header；
- **OpenAPI/error**：机器检查通过 56 个 error codes、62 条 paths、唯一
  operation ID、封闭 envelope/status 和 Public/Admin audience；
- **mapper**：`EveningSaveRequest` → `EveningReflectionSubmission` 为显式单向
  mapper，并在边界重新执行 Zod 校验；
- **静态失败证据**：15 个稳定 contract rule IDs 均有最小 known-fail，正常
  corpus 与同输入重复生成通过；
- **client compile/bundle**：miniapp、Admin、testing 三入口独立编译；E-004
  bundle Gate 与 client dist 禁用依赖/字段/secret 扫描通过；
- **clean generation**：四个生成文件在再次 `pnpm codegen` 前后 SHA-256
  完全一致，`codegen:check` 与 `git diff --check` 通过；
- **完整验证**：`pnpm install`、`pnpm install --frozen-lockfile` 和
  `pnpm run validate` 为 `PASS`。沙箱内 API 测试因禁止监听
  `127.0.0.1` 首次为 `INFRA_BLOCKED`，在获准的本机端口环境重跑后
  36/36 API 测试与全仓 validate 通过。
- **Source-ID 机器证据**：`S30-REPO-041`、`S30-REPO-044..048`、
  `S31-TEST-009`、`S31-TEST-010`、`S31-TEST-012`、`S31-TEST-013`、
  `S31-TEST-015`；
- **Partial/manual**：`S30-REPO-042`、`S30-REPO-043` 与
  `S31-TEST-011` 已有 canonical Schema/mapper/static leak 证据，但真实业务
  handler 与 Prisma row 尚未实现，不能宣称完整 HTTP/DB 覆盖；
- **Deferred**：`S31-TEST-014` 的真实 Admin app bundle 由 E-005 承接，
  正式 Source-ID registry 由 E-010 承接，CI 选择器与 artifacts 由 E-011
  承接。

## 6. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **外部 Gate**：云、生产身份、CI runner 等仍未解除，但不阻塞本地 E-008；
- **Source-ID registry**：`NA_WITH_REASON` — 正式 registry 由 E-010 交付；
  本任务已记录命令、测试数量、rule IDs 和 fingerprint 机器证据；
- **已知限制**：任意 Zod refinement（真实日历、Unicode grapheme、跨对象等式）
  不能由 JSON Schema 完整表达，所有信任边界仍以 Zod runtime parse 为权威；
- **下一状态**：提交、推送并创建 Draft PR 后切换为 In Review；不得自动合并。

## 7. 最近交接

- E-004 PR #96 已合并，Issue #42 已关闭；
- E-008 Issue #46 已进入 In Progress；
- 当前分支：`agent/e-008-contract-codegen`；
- 已完成：上下文恢复、基线校验、三类显式 exports、client-safe Zod 模块、
  JSON Schema/OpenAPI/client codegen、one-way mapper、drift/static Gate、
  known-fail fixtures、文档和全量验证；
- 开工结论：`GO`；
- 当前 fingerprint：
  `sha256:e31f3661912e0f42035d9a86736a6db0c6d19ed18e8f2a3a5f31b0234fcd28b6`；
- 当前动作：最终 diff 自审后提交、推送并创建 Draft PR；
- 接受后的下一任务：E-005（仍为 Planned，不提前开始）。
