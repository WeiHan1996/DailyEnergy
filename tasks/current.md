# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-22
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-20
- **当前任务名称**：API 契约
- **任务状态**：In Review
- **优先级**：最高
- **代码工作**：不开始 NestJS controller、migration、数据库、worker 或生产实现；只允许 Draft API / 错误码 / OpenAPI 契约
- **当前分支**：`agent/api-contract-spec`
- **关联 PR**：[Draft PR #24](https://github.com/WeiHan1996/DailyEnergy/pull/24)
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)

## 1. 当前目标

创建 Draft：

- `docs/technical/api.md`
- `docs/technical/error-codes.md`
- `openapi/openapi.yaml`

把 Accepted 领域模型、数据库规格、共享 Schema、状态机与交互状态转换为小程序 / 后端 / 管理端可独立开发的 HTTP 契约。

## 2. 必须交付

- Draft `docs/technical/api.md`（协议、命令/查询、页面映射、守卫、48 场景）；
- Draft `docs/technical/error-codes.md`（稳定 code、category、Unknown 恢复、16 场景）；
- OpenAPI 3 草案 `openapi/openapi.yaml`（`/v1` 路径与组件）；
- 身份、同意、资料、签到、生成/读取、点亮、晚间协调保存、趋势、事项/记忆、分享/通知、Safety、导出删除、支持、管理端最小接口；
- 幂等 `command_ref`、expected revision/CAS、Safety/deletion 阻断；
- 白名单 view；DTO ≠ Prisma model；
- docs/INDEX、backlog、current 同步；
- S-19 Accepted 已在 main（#23）。

## 3. 上游必读

见 docs/INDEX 第 12 节 S-20 读取顺序。

## 4. 已接受且不得重开的边界

- 产品日期服务端权威；同日唯一 intent/结果；
- 规则出事实、AI 只表达；
- Safety / Deleting 优先；high-risk ordinary call = 0；
- UUID 非授权；客户端不提交 epoch/seed/ciphertext；
- 晚间 note 不进 Weekly/AI/memory/通知/分享；
- 删除遵循 ADR-0005；DAY 删除后同日重建禁止。

## 5. 明确不做

- NestJS 实现、migration、真实微信证书配置；
- 改写 S-19 表结构或 shared-schemas 生产包；
- 自动 merge PR；
- 埋点字典（S-24）与完整运营 RBAC（S-22）。

## 6. 验收标准

- api.md / error-codes.md / openapi.yaml 保持 Draft；
- P0 页面可映射接口；
- 错误码与交互状态/领域 Unknown 规则一致；
- OpenAPI 路径覆盖 api.md 清单；
- 48+16 场景 ID 唯一；
- 无生产代码；用户确认前不标 Accepted。

## 7. 完成后的下一任务

- S-21 隐私数据地图（S-20 Accepted 后）。

## 8. 最近一次交接

- 日期：2026-07-22；
- PR #23 已合并，main `eac46d6`；S-19 Accepted；
- 分支 `agent/api-contract-spec` 从 main 创建；
- 新增 Draft api.md、error-codes.md、openapi/openapi.yaml；
- 64 个唯一 S20 场景（48 API + 16 error）；OpenAPI 58 paths；
- Draft PR [#24](https://github.com/WeiHan1996/DailyEnergy/pull/24) 已创建，**不会自动 merge**；
- 无 NestJS/migration/生产代码；
- **下一步**：用户审核 PR #24；确认前保持 Draft，不开始 S-21。

## 9. 状态更新规则

- In Review：Draft PR 打开；三份交付保持 Draft；
- 用户确认并合并后：三份 → Accepted；S-20 Done；S-21 Ready；
- 新会话再开始 S-21。
