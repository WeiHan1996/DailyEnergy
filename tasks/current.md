# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-22
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-20
- **当前任务名称**：API 契约
- **任务状态**：Ready
- **优先级**：最高
- **代码工作**：不开始 NestJS controller、migration、数据库、worker 或生产实现；只允许 Draft API / 错误码 / OpenAPI 契约
- **当前分支**：`agent/s19-accept-handoff`（本 PR 仅 S-19 Accepted 收尾；S-20 在合并后新分支开始）
- **关联 PR**：[Accepted 收尾 PR #23](https://github.com/WeiHan1996/DailyEnergy/pull/23)；S-19 内容已在 [#22](https://github.com/WeiHan1996/DailyEnergy/pull/22) 合并
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)

## 1. 当前目标

在 S-19 被用户确认 Accepted 并合并本收尾 PR 后，创建 Draft：

- `docs/technical/api.md`
- `docs/technical/error-codes.md`
- OpenAPI 草案

把 Accepted 领域模型、数据库规格、共享 Schema、状态机与交互状态转换为小程序 / 后端 / 管理端可独立开发的接口契约。

**本 PR 不开始写 API 正文**；只完成 S-19 Accepted 状态收尾与任务指针切换。

## 2. S-20 必须交付（合并本 PR 后的下一实现 PR）

- Draft `docs/technical/api.md`；
- Draft `docs/technical/error-codes.md`；
- OpenAPI 或等价可执行契约草案；
- 身份、同意、资料、签到、生成/读取、点亮、晚间反馈、趋势、事项/记忆、分享/通知、隐私导出与删除、管理端最小接口；
- 幂等、权限、revision/CAS、Safety/deletion 阻断与 Unknown outcome 语义；
- 与 interaction-states、state-machine、database 一致的错误与降级；
- 不创建 NestJS、Prisma Client 生产接入或 migration。

## 3. 上游必读（S-20 开始时）

1. [AGENTS.md](../AGENTS.md)；
2. [README.md](../README.md)；
3. [ROADMAP.md](../ROADMAP.md)；
4. [docs/INDEX.md](../docs/INDEX.md)；
5. 本文；
6. [产品状态机](../docs/product/state-machine.md)；
7. [业务规则](../docs/product/business-rules.md)；
8. [交互状态](../docs/design/interaction-states.md)；
9. [页面规格](../docs/design/screen-specs.md)；
10. Daily / Evening / Weekly Schema 与 [shared-schemas](../packages/shared-schemas/README.md)；
11. [领域模型](../docs/data/domain-model.md)；
12. [ADR-0005](../docs/decisions/ADR-0005-data-retention-and-deletion.md)；
13. [数据库规格](../docs/technical/database.md)；
14. [prisma/schema.prisma](../prisma/schema.prisma)；
15. Gateway / Prompt / Memory / Safety 中与入口和错误相关的边界。

## 4. 已接受且不得重开的边界

- 规则出事实、AI 只表达；同日结果稳定；
- Safety / Deleting / 账户阻断优先于普通 API；
- high-risk ordinary provider/template call = 0；
- 数据库 UUID 不是授权；API 必须再做 owner/日期/状态校验；
- 客户端不得提交 Safety/deletion epoch、seed、ciphertext 或内部 fingerprint；
- 删除与导出遵循 ADR-0005；不暴露 raw Safety / provider / Prompt；
- DTO 不直接等于 Prisma model。

## 5. 明确不做（本收尾 PR 与 S-20 Draft PR）

- 合并本 PR 前开始 S-20 正文实现以外的生产代码；
- 创建或运行 migration、真实数据库、NestJS controller；
- 改写 S-19 表结构或重开 ADR-0005；
- 自动 merge 任何 PR。

## 6. 验收标准（本收尾 PR）

- `docs/technical/database.md` 与 `prisma/schema.prisma` 为 Accepted，接受日期 2026-07-22；
- docs/INDEX、backlog 中 S-19 Done、S-20 Ready；
- 本 PR 无 migration、无生产代码、无 secret；
- **不自动 merge**；用户审核合并后，新会话/新分支再将 S-20 设为 In Progress 并撰写 API Draft。

## 7. 最近一次交接

- 日期：2026-07-22；
- 用户确认方案 A：接受 S-19 并做 Accepted 收尾；
- PR #22 已合并，main 含 Draft 版 database/Prisma 内容；
- 本分支 `agent/s19-accept-handoff` 仅状态与控制文件收尾；
- S-19 内容不重开设计；
- Draft/Open PR [#23](https://github.com/WeiHan1996/DailyEnergy/pull/23) 已创建，**不会自动 merge**；
- **下一步**：用户审核并合并 PR #23；合并前不开始 S-20 文档正文。

## 8. 状态更新规则

本 PR 合并前：

- database.md / schema.prisma 在分支上为 Accepted；
- S-20 保持 Ready，不写 api.md 正文。

用户合并本 PR 后：

- main 上 S-19 正式 Accepted/Done；
- 新分支将 S-20 改为 In Progress 并创建 Draft API 文档；
- 再开独立 Draft PR，仍不自动 merge。
