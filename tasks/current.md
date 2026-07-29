# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-29
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-005 — 创建 Next.js 管理后台骨架
- **任务状态**：Ready
- **当前分支**：`main`
- **当前 Issue**：[E-005 Issue #43](https://github.com/WeiHan1996/DailyEnergy/issues/43)
- **当前 PR**：无
- **Gate 结论**：`GO_TO_START`

## 1. 当前目标

建立 Next.js 16 / React 19 管理后台外壳，并固定以下单向边界：

```text
apps/admin
  → @daily-energy/api-client/admin
  → 受控 Admin HTTP contract
```

E-008 已随 [PR #97](https://github.com/WeiHan1996/DailyEnergy/pull/97)
squash 合并，merge commit 为
`29798917392e0e1db3b852083caf525bb756f8ad`，Issue #46 已关闭。
E-005 的 E-001、E-002、E-008 前置均已完成，现为唯一 Ready 工程任务；
E-006 及其他工程任务不得并行开始。

## 2. 开工检查

- 从最新 `main` 创建聚焦分支，建议分支名：`agent/e-005-admin-shell`；
- 开工前确认本地 `main` 与 `origin/main` 均包含 E-008 merge commit；
- 复核 [E-005 Issue #43](https://github.com/WeiHan1996/DailyEnergy/issues/43)、
  `docs/design/screen-inventory.md`、API、仓库结构、测试与部署规范；
- 管理后台只允许通过 `@daily-energy/api-client/admin` 访问受控 Admin API；
- 浏览器 bundle 不得到达 PG、Redis、Prisma、Nest、provider、object storage、
  server-core、adapter、secret 或 restricted field；
- 正式视觉设计仍由 D 系列任务承接，本任务只实现可验证的管理后台工程骨架与状态外壳。

## 3. E-005 范围

- 创建 `apps/admin` 的 App Router、登录外壳和基础布局；
- 提供 loading、empty、error 与恢复状态；
- 接入 `@daily-energy/api-client/admin`，固定独立 Admin origin/session 配置边界；
- 实现 production-disabled Gate、最小 CSP 与安全 headers；
- 建立 browser bundle 的 server-only、secret、restricted-field 和越界依赖扫描；
- 增加 Next build、Playwright shell 冒烟及缺失身份配置负向测试。

## 4. 不做

- 不实现真实 SSO、业务 Dashboard、用户下钻或生产部署；
- 不连接数据库、Redis、BullMQ、Worker、provider 或 object storage；
- 不实现正式视觉设计系统、业务数据可视化或完整页面交互；
- 不提前启动 E-006、E-009、E-010、E-011 或 D 系列任务；
- 不降低 Accepted ADR、Schema、API、隐私、安全、删除、幂等、事务或运行 profile 边界。

## 5. 验收与证据

- `apps/admin` 可独立 typecheck、build 和启动；
- 登录外壳、基础布局、loading/empty/error/retry 状态有 Playwright 冒烟证据；
- 未配置可信 Admin 身份时，production profile 必须 fail closed；
- bundle scan 能拒绝 server-only package、secret 名值、用户正文 fixture、provider 与 restricted field；
- Admin app 不直接依赖 server-core、adapters、Prisma、Redis 或 provider；
- 所有生成客户端继续由 E-008 codegen/drift Gate 维护，不得在 E-005 手改；
- `pnpm run validate` 与 E-003 API、E-004 Mini Program、E-008 contract Gate 保持通过；
- S31-TEST-014 的真实 Admin bundle 证据在本任务中完成或以批准理由明确记录。

## 6. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **前置依赖**：E-001、E-002、E-008 已完成；
- **生产身份**：尚未配置真实 Admin 身份，不阻塞骨架实现，但 production 必须默认关闭；
- **视觉边界**：本任务使用最小可验证布局，不替代后续 D 系列正式设计；
- **并行规则**：E-005 是唯一 Ready，完成并进入审核前不得启动 E-006；
- **下一状态**：创建实现分支和 Draft PR 后，将 E-005 更新为 In Progress / In Review。

## 7. 最近交接

- E-004 PR #96 已合并，Issue #42 已关闭；
- E-008 PR #97 已通过复审并 squash 合并；
- E-008 merge commit：`29798917392e0e1db3b852083caf525bb756f8ad`；
- E-008 Issue #46 已按 `completed` 关闭；
- E-008 最终 contract fingerprint：
  `sha256:133257cc7336ea5bc217cf713d14c85bfe6a3661d3ea3168406c53ceb41c092a`；
- E-008 审核修复的必填输入、AST/递归依赖泄漏 Gate、status/envelope 判别联合均已验收；
- 当前唯一 Ready：[E-005 Issue #43](https://github.com/WeiHan1996/DailyEnergy/issues/43)；
- 当前动作：从最新 `main` 启动 E-005，不自动启动其他任务。
