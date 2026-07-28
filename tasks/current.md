# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-28
- **当前阶段**：Phase 1 — 工程基础
- **当前任务 ID**：E-004
- **当前任务名称**：创建微信原生小程序 TypeScript 骨架
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/e-004-miniapp-skeleton`
- **上游 PR**：[E-003 PR #93](https://github.com/WeiHan1996/DailyEnergy/pull/93)
- **当前 Issue**：[E-004 Issue #42](https://github.com/WeiHan1996/DailyEnergy/issues/42)
- **当前 PR**：[E-004 Draft PR #96](https://github.com/WeiHan1996/DailyEnergy/pull/96)
- **Gate 结论**：`GO`

## 1. 当前目标

建立微信原生小程序入口、启动路由、平台适配层和 client-only 构建边界，为后续确定性业务页面提供可加载、可测试、不会泄漏服务端能力的运行骨架。

E-003 已通过审核并随 [PR #93](https://github.com/WeiHan1996/DailyEnergy/pull/93) squash 合并，Issue #40 已自动关闭为 completed。E-004 已完成仓库内实现与验证，并以 [Draft PR #96](https://github.com/WeiHan1996/DailyEnergy/pull/96) 进入 In Review；任务不会在用户审核和平台证据处理前标记为 Done。

## 2. 上游完成状态

- Phase 0B Gate 已获用户确认，结论为 Accepted `GO`；
- E-001 已完成 pnpm/Turborepo Monorepo、11 个 workspace 和基础 Workspace Gate；
- E-002 已完成 TypeScript 7 strict、ESLint、Prettier、11/11 workspace typecheck 和 12 类静态边界 Gate；
- E-003 已完成 NestJS API 组合根、配置/能力指纹、Public/Admin/Safety 边界、错误与日志合同、健康检查及有界优雅关闭；
- E-001、E-002、E-003 均已完成，满足 E-004 当前硬前置；
- E-005～E-014、E-008 及其他下游工程 Issue 继续保持 Planned；
- 云厂商、域名、主体、跨境、真实账号/密钥、热线、监控接收人和值班等外部 Gate 仍未解除，但不阻塞 E-004 的本地工程骨架。

## 3. 开工前读取顺序

1. [E-004 Issue #42](https://github.com/WeiHan1996/DailyEnergy/issues/42)；
2. [信息架构](../docs/design/information-architecture.md)；
3. [页面清单](../docs/design/screen-inventory.md)；
4. [仓库结构与模块边界](../docs/technical/repository-structure.md)；
5. [测试策略](../docs/technical/testing.md)；
6. [部署、配置和回滚](../docs/technical/deployment.md)；
7. `apps/miniapp`、root 配置、共享 TypeScript/ESLint 配置与 E-002 边界 Gate；
8. E-003 API 运行合同及仓库现状。

如果上述 Accepted 权威互相冲突、文件缺失，或 E-004 无法在一个主要 PR 内完成，应停止并将 E-004 设为 Blocked，不得在实现中静默改写上游决定。

## 4. E-004 范围

- 创建 `apps/miniapp` 的 app/pages/components/features/platform/services/generated 结构；
- 配置微信原生小程序 TypeScript 构建、环境 API origin、开发者工具项目示例与启动路由占位；
- 封装 login、storage、network、share、subscription 平台 port，不实现真实业务流程；
- 固定 client-only bundle allowlist；当前不得导入尚未由 E-008 交付的生成 API Client；
- 建立最小启动、错误占位、平台 adapter 单元测试和 bundle forbidden-import scan；
- 保留后续 DevTools automator runner 的明确入口，不在本任务伪造真机 conformance。

## 5. 不做

- 不实现正式页面、首次认识、签到、今日内容、点亮、晚间反馈或周趋势业务；
- 不实现真实微信登录、订阅消息、分享业务或生产 AppID/AppSecret；
- 不提前实现 E-008 的 Zod/OpenAPI/api-client/codegen drift；
- 不引入 Nest、Prisma、PostgreSQL、Redis、BullMQ、Prompt、provider、Worker 或 restricted capability；
- 不创建生产云资源、域名、证书、真实账号或密钥；
- 不提前启动 E-005～E-014 或 Phase 2/3 任务。

## 6. 验收标准

- 微信开发者工具可加载最小应用，启动路由与错误占位可见；
- TypeScript、format、lint、typecheck、architecture、test 和 build Gate 全部通过；
- bundle 不含 `node:*`、Nest、Prisma、Redis、BullMQ、Prompt、provider、secret 或服务端 package；
- `project.private.config.json` 等私有配置不入库，公开配置可校验并携带封闭环境标识；
- login/storage/network/share/subscription adapter 使用可替换 port，纯逻辑可在 Vitest 运行；
- DevTools 冒烟证据与纯逻辑测试层级准确区分，不把 Node/jsdom 测试冒充微信平台 conformance；
- Source-ID 证据按 `MACHINE_ENFORCED`、`PARTIAL / MANUAL_EVIDENCE`、`DEFERRED` 或获批 `NA_WITH_REASON` 准确记录；
- 交付一个聚焦的 Draft PR，等待用户审核。

## 7. 当前阻塞与决策

- **仓库/代码阻塞**：无；frozen install、format、lint、typecheck、architecture、test、build 与 bundle Gate 均通过；
- **依赖修正**：Issue #42 原正文将 E-008 列为硬前置，但 Accepted 执行顺序、Backlog、E-003 交接及 2026-07-28 用户明确指令均要求 E-004 成为下一任务；现将 E-004 硬前置明确为 E-001、E-002、E-003；
- **E-008 边界**：E-008 仍负责 shared-schemas/client、api-client/miniapp 和 codegen/drift。E-004 只能建立允许未来接入这些 client-safe subpath 的边界，不得提前创建或复制生成客户端；
- **Source-ID registry**：正式 registry 属于 E-010；E-004 只能记录实际证据等级，不得提前宣称完整覆盖；
- **DevTools 平台证据**：runner、项目配置和构建产物已就绪；2026-07-28 在本机微信开发者工具启用服务端口并重启后，`miniprogram-automator` 仍返回 `MINIAPP_DEVTOOLS_INFRA_BLOCKED`。当前证据等级为 `PARTIAL / MANUAL_EVIDENCE`，不能标记微信 conformance PASS；解锁条件是 IDE automation endpoint 可连接后重跑 `pnpm --filter @daily-energy/app-miniapp test:devtools`；
- **外部上线 Gate**：仍存在，但不阻塞本地小程序骨架；
- **审核决策**：用户需确认是否允许 Draft PR 在 DevTools 为 `INFRA_BLOCKED` 的情况下继续评审，或要求先由可用专用 runner 补齐 SYS-001/SYS-003 平台 PASS；
- **下一状态**：等待用户审核 [Draft PR #96](https://github.com/WeiHan1996/DailyEnergy/pull/96)；不得自动标记 Ready 或合并。

## 8. 最近交接

- E-001 PR #89 merge commit：`6ab172d72d7ab221e565303254bdf135437870dd`；
- E-002 PR #91 merge commit：`bce224eb55c1ca92b32aebfe9a46df480af27b5f`；
- E-003 PR #93 merge commit：`fde441c9802d91aa707f47bfc09d9927a9e97b97`；
- E-001 Issue #39、E-002 Issue #41、E-003 Issue #40 均已关闭为 completed；
- 当前任务：E-004 In Review；
- 当前分支：`agent/e-004-miniapp-skeleton`，基于 `main` / `origin/main` 的 `817955cd8be72b8ea961e4e102568a592a5e9adf`；
- 当前 PR：[E-004 Draft PR #96](https://github.com/WeiHan1996/DailyEnergy/pull/96)；
- 已完成开工检查：Issue #42、Accepted 信息架构/页面清单、仓库结构、测试、部署和 ADR-0006 已复核，结论 `GO`；
- 已完成交付：`SYS-001` 启动占位、`SYS-003` 恢复占位、微信原生 TypeScript/CommonJS 构建、封闭公开配置、login/storage/network/share/subscription ports/adapters、生成配置指纹、DevTools runner 与 client-only bundle Gate；
- 已完成验证：`pnpm install --frozen-lockfile`；完整 `pnpm run validate` PASS（11/11 workspace typecheck、12 类 boundary Gate、miniapp 10 tests、shared-schemas 34 tests、API 36 tests、全部适用 build）；miniapp bundle 3 known-fail + 1 known-pass + 实际 `dist/` scan PASS；
- 平台证据：DevTools runner 已真实执行，但 IDE automation endpoint 无法连接，结果 `MINIAPP_DEVTOOLS_INFRA_BLOCKED`；微信平台 conformance 未标 PASS；
- 未开始：E-005～E-014、业务代码、数据库、队列、容器、workflow 或云资源；
- 下一动作：等待用户审核 Draft PR #96，并确认是否接受 DevTools `INFRA_BLOCKED` 作为当前阶段的受限证据；
- 接受后的下一任务：E-005；当前仍保持 Planned，不提前启动；
- 禁止并行：E-005 及其他下游 Issue。
