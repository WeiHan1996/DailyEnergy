# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-28
- **当前阶段**：Phase 1 — 工程基础
- **当前任务 ID**：E-003
- **当前任务名称**：创建 NestJS API 组合根与运行基线
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/e-003-api-baseline`
- **上游 PR**：[E-002 PR #91](https://github.com/WeiHan1996/DailyEnergy/pull/91)
- **当前 Issue**：[E-003 Issue #40](https://github.com/WeiHan1996/DailyEnergy/issues/40)
- **当前 PR**：[Draft PR #93](https://github.com/WeiHan1996/DailyEnergy/pull/93)
- **Gate 结论**：`GO`

## 1. 当前目标

创建无状态 NestJS 11 + Express 5 API 薄入口，固定公开/Admin transport、配置、错误、健康检查和优雅关闭合同，为后续确定性业务闭环提供稳定的服务端组合根。

E-002 已通过三轮审核并随 [PR #91](https://github.com/WeiHan1996/DailyEnergy/pull/91) squash 合并，Issue #41 已自动关闭为 completed。用户已于 2026-07-28 明确开始 E-003；`agent/e-003-api-baseline` 已完成实现与全仓验证，[Draft PR #93](https://github.com/WeiHan1996/DailyEnergy/pull/93) 正在等待用户审核。

## 2. 上游完成状态

- Phase 0B Gate 已获用户确认，结论为 Accepted `GO`；
- E-001 已完成 pnpm/Turborepo Monorepo、11 个 workspace 和基础 Workspace Gate；
- E-002 已完成 TypeScript 7 strict、ESLint 10 flat config、Prettier、11/11 workspace typecheck 和 12 类静态边界 Gate；
- E-002 的 20 个 known-fail fixtures、全 Gate known-pass project、clean-checkout 验证和 Source-ID 证据分层均已通过审核；
- E-003 的有效前置为 E-001、E-002，均已满足；Issue #40 中误写的 E-008 前置由本次用户指令批准修正；
- E-004～E-014、E-008 及其他下游工程 Issue 继续保持 Planned；
- 云厂商、域名、主体、跨境、真实账号/密钥、热线、监控接收人和值班等外部 Gate 仍未解除，但不阻塞 E-003 的本地工程骨架。

## 3. 开工前读取顺序

1. [E-003 Issue #40](https://github.com/WeiHan1996/DailyEnergy/issues/40)；
2. [API 契约](../docs/technical/api.md)；
3. [错误码规范](../docs/technical/error-codes.md)；
4. [系统架构](../docs/technical/architecture.md)；
5. [仓库结构与模块边界](../docs/technical/repository-structure.md)；
6. [部署、配置和回滚](../docs/technical/deployment.md)；
7. [可观测性和成本监控](../docs/technical/observability.md)；
8. [测试策略](../docs/technical/testing.md)；
9. `apps/api`、root 配置、共享 TypeScript/ESLint 配置与 E-002 边界 Gate；
10. 仓库现状与任何未提交改动。

如果上述 Accepted 权威互相冲突、文件缺失，或 E-003 无法在一个主要 PR 内完成，应停止并将 E-003 设为 Blocked，不得在实现中静默改写上游决定。

## 4. E-003 范围

- 创建 `apps/api` 的 bootstrap、`transport/public`、`transport/admin` 与 composition 目录；
- 初始化 NestJS 11 + Express 5 的无状态 API 组合根；
- 实现严格配置 Schema、启动指纹、liveness、readiness、维护响应和 graceful shutdown；
- 统一 request context、错误 envelope、低基数 operation code 与脱敏 JSON 日志接口；
- 为公开与 Admin transport 建立独立 auth/audience 组合点；
- 只注册占位 handler，不实现业务用例；
- 补充 bootstrap、HTTP envelope、auth 分区、health、配置失败、依赖不可用和关闭流程测试。

## 5. 不做

- 不实现任何业务 API、领域规则或真实用户流程；
- 不实现真实 SSO、生产监控后端或 provider 调用；
- 不导入 AI/provider/Prompt、Worker、restricted 或 migration capability；
- 不引入 PostgreSQL、Prisma、Redis、BullMQ、Docker、workflow 或云资源；
- 不提前实现 E-004～E-014、E-008 或 Phase 2/3 任务；
- 不降低 Accepted API、隐私、Safety、删除、幂等、事务、运行 profile 或可观测性边界；
- 不在用户明确开始 E-003 前创建实现分支、提交代码或 Draft PR。

## 6. 验收标准

- API 保持薄入口，不包含领域规则；
- 公开与 Admin transport 使用独立 auth/audience 组合点；
- 错误响应符合 OpenAPI 和 error-codes，未知字段与无效配置 fail closed；
- liveness 不依赖外部服务，readiness 反映必需依赖且不泄露详情；
- 启动、维护模式、依赖不可用、信号关闭和 graceful shutdown 有黑盒测试；
- E-002 的 format、lint、typecheck、architecture 和 clean Gate 全部继续通过；
- Source-ID 证据按 `MACHINE_ENFORCED`、`PARTIAL / MANUAL_EVIDENCE`、`DEFERRED` 或获批 `NA_WITH_REASON` 准确记录；
- 交付一个聚焦的 Draft PR，等待用户审核。

## 7. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **依赖修正**：Issue #40 原正文将 E-008 列为前置，与 Accepted 执行顺序、Backlog 和“E-003 为 E-002 后下一任务”的交接冲突；本次用户明确要求 E-003 成为唯一 Ready，故修正为 E-001、E-002；
- **外部上线 Gate**：仍存在，但不阻塞 E-003；
- **Source-ID registry**：正式 registry 属于 E-010；E-003 PR 必须准确记录本任务实际证据，不得提前宣称下游能力完整覆盖；
- **Source-ID 证据**：`S29-ARCH-041`、`S30-REPO-025/048`、`S32-DEPLOY-002/006`、`S33-OBS-001/005/006/024`、`S31-TEST-035` 及对应 S-20 maintenance/validation/error/Admin 场景已有机器测试或静态 Gate；`S30-REPO-032`、`S32-DEPLOY-012`、`S33-OBS-017` 仅为 partial/manual，完整 DB role/image/metrics 证据仍由下游任务完成；
- **registry 处理**：沿用 E-001/E-002 已批准的 `NA_WITH_REASON`；E-010 前不存在可更新的正式 registry，本任务在交接和 PR 中记录实际证据等级，不提前创建 E-010 资产；
- **依赖审计**：npm 官方 audit 报告的 1 个 high 位于既有 ESLint → glob → brace-expansion 开发工具链，不在 API 运行时依赖图；不在 E-003 混入无关工具链升级；
- **当前等待**：[Draft PR #93](https://github.com/WeiHan1996/DailyEnergy/pull/93) 等待用户审核；
- **下一状态**：用户批准并合并后进入 Done，再单独选择下一个 Ready 任务。

## 8. 最近交接

- 已合并：[E-001 PR #89](https://github.com/WeiHan1996/DailyEnergy/pull/89)；
- E-001 merge commit：`6ab172d72d7ab221e565303254bdf135437870dd`；
- 已合并：[E-002 PR #91](https://github.com/WeiHan1996/DailyEnergy/pull/91)；
- E-002 merge commit：`bce224eb55c1ca92b32aebfe9a46df480af27b5f`；
- E-001 Issue #39、E-002 Issue #41 均已关闭为 completed；
- 当前工具链基线：Node `24.18.0`、pnpm `11.17.0`、Turbo `2.10.7`、TypeScript `7.0.2`、ESLint `10.8.0`、Prettier `3.9.6`、Zod `4.4.3`、Vitest `4.1.10`；
- 当前质量基线：11/11 workspace typecheck、resolved strict、Prettier、ESLint decorator 解析、12 类边界 Gate、20 个负向 fixtures、known-pass 零诊断和 clean-checkout validate；
- 已实现：NestJS `11.1.28` + Express `5.2.1` 无状态组合根，公开/Admin 独立 audience verifier，严格 Zod 配置与 deploy/capability fingerprint；
- 已实现：`/health/startup`、`/health/live`、`/health/ready`，BLOCKING/DEGRADED maintenance，统一 request ID、API error envelope、封闭 operation code 与脱敏 `OrdinaryLogV1`；
- 已实现：关闭前 readiness drain、Nest `SIGINT/SIGTERM` shutdown hooks，以及不含测试文件的确定性生产 build；
- 已测试：15 项 API/config/进程测试覆盖缺失/未知/错误指纹配置、未知字段、malformed JSON、公开/Admin audience 互斥、维护优先级、依赖不可用、日志脱敏、未知路由和真实 `SIGTERM`；
- 已验证：`pnpm validate` 全部通过；11/11 workspace strict typecheck、12 类边界 Gate（50 source files）、20 个 known-fail + 1 个 known-pass、API 15 项测试、shared-schemas 34 项测试和 build 全部 PASS；
- 当前任务：E-003 In Review；
- 当前分支：`agent/e-003-api-baseline`；
- 当前 PR：[Draft PR #93](https://github.com/WeiHan1996/DailyEnergy/pull/93)；
- 未开始：E-004～E-014、业务代码、数据库、队列、容器、workflow 或云资源；
- 下一动作：审核 [Draft PR #93](https://github.com/WeiHan1996/DailyEnergy/pull/93)；获批后标记 ready、合并并执行 E-003 收尾；
- 接受后的下一任务：候选为 E-004「创建微信原生小程序工程与运行基线」；当前仍保持 Planned，只有 E-003 获批合并并完成收尾后才移动为唯一 Ready；
- 禁止并行：E-004 及其他下游 Issue。
