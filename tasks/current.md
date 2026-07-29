# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-29
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-006 — PostgreSQL 与 Prisma
- **任务状态**：Ready（尚未开工）
- **当前分支**：无
- **当前 Issue**：[E-006 Issue #44](https://github.com/WeiHan1996/DailyEnergy/issues/44)
- **当前 PR**：无
- **Gate 结论**：`GO_TO_START`

## 1. 当前目标

E-005 已随 [PR #98](https://github.com/WeiHan1996/DailyEnergy/pull/98)
合并，merge commit 为 `bde64fd60128ab699eac3251bcf2eace88f0a902`，
Issue #43 已关闭。E-006 的前置已满足，现为唯一 Ready 工程任务，但尚未创建
执行分支或 PR。

D-001～D-004 已作为 Phase 2 正式视觉设计工作流纳入 Backlog，当前全部为
Planned。登记设计任务和依赖关系不代表开始设计，也不改变 E-006 的唯一
Ready 状态。

## 2. 开工检查

- 等待用户明确要求开始 E-006；Ready 不等于 In Progress；
- 开工时从包含 E-005 merge commit 的最新 `main` 创建聚焦分支；
- 重新读取 [E-006 Issue #44](https://github.com/WeiHan1996/DailyEnergy/issues/44)、
  `docs/data/domain-model.md`、`docs/technical/database.md`、
  `docs/operations/privacy-data-map.md`、测试、部署与相关 ADR；
- 先执行 GO/NO-GO 检查，发现 Accepted 规范实质冲突时不得静默选边；
- 开工后才把本文件和 Backlog 更新为 E-006 In Progress。

## 3. E-006 预定范围

- 以 Issue #44 和 Accepted 数据规范为准建立 PostgreSQL / Prisma 基线；
- 固定可验证的 Schema、迁移、约束、权限、测试数据与隔离边界；
- 证明迁移创建、验证、回滚和关键数据库负向场景；
- 保持 E-003 API、E-005 Admin、E-008 contract/codegen 及根 Gate 通过；
- 精确范围、测试矩阵和不做事项在开工 GO/NO-GO 后写入本文件。

## 4. 不做

- 本次项目控制 PR 不实现 E-006 代码、数据库迁移或生产资源；
- 不提前启动 E-007、E-009、E-010、E-011 或其他下游工程任务；
- 不开始 D-001～D-004，不创建 Figma 稿、Design Tokens 或业务页面；
- 不改变 D 系列以外的产品定位、技术栈或外部 Production Gate；
- 不降低 Accepted ADR、Schema、API、隐私、安全、删除、幂等、事务或运行 profile 边界。

## 5. 验收与证据

- [PR #98](https://github.com/WeiHan1996/DailyEnergy/pull/98) 显示 Merged；
- [Issue #43](https://github.com/WeiHan1996/DailyEnergy/issues/43) 显示 Closed；
- 最新 `main` 包含 E-005 merge commit
  `bde64fd60128ab699eac3251bcf2eace88f0a902`；
- [D-001 #99](https://github.com/WeiHan1996/DailyEnergy/issues/99)～
  [D-004 #102](https://github.com/WeiHan1996/DailyEnergy/issues/102) 均属于
  Phase 2 Milestone 且保持 Open / Planned；
- D-004 是 C-003、C-004、C-009 的直接前置，仓库路线图、Backlog 和文档索引一致；
- 项目控制 PR 仅包含文档和任务依赖，完整仓库验证通过后才能进入审核。

## 6. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **前置依赖**：E-006 的已知工程前置已完成，开工时仍需重新核对 Issue；
- **执行授权**：当前仅完成项目控制，等待用户明确要求开始 E-006；
- **视觉边界**：D-001～D-004 均为 Planned，不自动插队；
- **并行规则**：E-006 是唯一 Ready；不存在 In Progress 或 In Review 工程任务；
- **下一状态**：项目控制 PR 审核合并后仍保持 E-006 Ready，直到明确开工。

## 7. 最近交接

- E-004 PR #96 已合并，Issue #42 已关闭；
- E-008 PR #97 已通过复审并 squash 合并；
- E-008 merge commit：`29798917392e0e1db3b852083caf525bb756f8ad`；
- E-008 Issue #46 已按 `completed` 关闭；
- E-008 最终 contract fingerprint：
  `sha256:133257cc7336ea5bc217cf713d14c85bfe6a3661d3ea3168406c53ceb41c092a`；
- E-008 审核修复的必填输入、AST/递归依赖泄漏 Gate、status/envelope 判别联合均已验收；
- 已确认最新 `main` 与 `origin/main` 均为
  `bde64fd60128ab699eac3251bcf2eace88f0a902`；
- 已完成 Next.js 16 / React 19 App Router、ADM-001 登录外壳、基础布局和
  Loading / Empty / Recoverable Error / Disabled 状态；
- 已固定 server-only Admin API origin、Admin session cookie policy、production
  trusted-identity fail-closed Gate 与最小 CSP / 安全响应头；
- 已通过 `@daily-energy/api-client/admin` 建立唯一 Admin HTTP transport，并禁止
  未认证业务操作；
- 已建立真实 `.next/static` 扫描、Playwright 初始 HTML/RSC/网络响应扫描，
  并读取合成 secret 文件实际内容作为 canary；
- 已增加独立真实 Next known-fail app，由 Server Component 故意输出合成
  secret 与用户正文，证明 HTML 和 RSC 两条响应路径都会被稳定 rule ID 拒绝；
- Admin `typecheck` 已固定先执行 `next typegen`，不再依赖本地残留
  `.next/types`；
- 开发环境 CSP 仅增加 `'unsafe-eval'`，production 响应明确不包含；
- 已完成 11 条 Vitest、6 条 production shell Playwright 与 2 条真实 Next
  known-fail Playwright 用例；最终 `pnpm run validate` 全仓通过；
- 已按审核要求从 `pnpm clean` 开始，依次完成
  `pnpm install --frozen-lockfile` 与 `pnpm run validate`；clean run 中
  `@daily-energy/app-admin:typecheck` 为 cache miss 并明确执行
  `next typegen` 后再运行 workspace TypeScript 检查；
- 已完成全 diff 自审；known-fail app 仅位于 tests、临时 secret 与 fixture build
  均在 `finally` 清理，诊断不输出 canary 内容，无未解决代码发现；
- 已创建 [Draft PR #98](https://github.com/WeiHan1996/DailyEnergy/pull/98)，
  标题为 `[E-005] 创建 Next.js 管理后台骨架`，包含 `Closes #43`；
- [PR #98](https://github.com/WeiHan1996/DailyEnergy/pull/98) 已合并，
  merge commit 为 `bde64fd60128ab699eac3251bcf2eace88f0a902`，
  [Issue #43](https://github.com/WeiHan1996/DailyEnergy/issues/43) 已关闭；
- 已创建 [D-001 #99](https://github.com/WeiHan1996/DailyEnergy/issues/99)、
  [D-002 #100](https://github.com/WeiHan1996/DailyEnergy/issues/100)、
  [D-003 #101](https://github.com/WeiHan1996/DailyEnergy/issues/101) 与
  [D-004 #102](https://github.com/WeiHan1996/DailyEnergy/issues/102)，全部为 Planned；
- 已把 D-004 写入 C-003、C-004、C-009 的直接前置，并同步路线图、Backlog
  与设计文档索引；
- E-005 最后一个 Unicode 修复提交遗留一处 Prettier 漂移；已做一行纯格式
  修正，未改变运行逻辑；
- 已按 `pnpm run clean`、`pnpm install --frozen-lockfile`、`pnpm run validate`
  完成干净验证；全仓格式、Lint、边界、契约、类型、单元/fixture/Playwright
  测试与构建均通过；
- **当前唯一 Ready**：E-006 — PostgreSQL 与 Prisma；尚未开工。
