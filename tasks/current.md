# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-23
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-21
- **当前任务名称**：隐私数据地图
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/privacy-data-map`
- **交付文件**：`docs/operations/privacy-data-map.md`
- **关联 PR**：[Draft PR #26](https://github.com/WeiHan1996/DailyEnergy/pull/26)

## 1. 当前目标

将 Accepted 产品、AI、领域、保存删除、数据库和 API 契约整理为可审计的数据地图。

回答每项个人信息：

- 从哪里来；
- 为什么处理；
- 到哪里去；
- 谁能访问；
- 保存多久；
- 怎样删除。

## 2. 已完成

- 已从 main@eb75356 创建 S-21 独立分支；
- 已创建 Draft `docs/operations/privacy-data-map.md`；
- 已完成数据分类、完整 `PDM-*` 资产表、API/View/Prisma 交叉映射、存储与访问矩阵；
- 已对齐 AI/provider、memory、Safety、通知、分享、导出、保存删除、备份和跨境边界；
- 已补齐 Onboarding、受限审计、legal hold、analytics、未成年人和受限证据用户权利；
- 已定义 34 个验证场景，并将未冻结事项显式设为 production Gate。

## 3. 当前验证

- 未修改数据库、Prisma、migration、API、NestJS、worker 或生产代码；
- 未创建埋点字典；
- 未配置真实微信、AI provider、云存储或账号；
- 未改变任何 Accepted ADR。
- 已校验 33 个唯一数据资产、34 个唯一场景、Prisma model/字段映射、相对链接和 EOF newline；
- docs/INDEX、tasks/current 与 backlog 均指向 S-21 In Review / PR #26。

## 4. 待审核决定

- 用户审核 PR #26 是否接受 S-21 数据地图；
- `RestrictedAuditEvent` 最大保存期限仍由 S-22/S-29 按最短必要冻结，之前不得生产写入；
- 未成年人生产策略必须在上线前选择“排除不满十四周岁”或“监护人同意 + 专门规则”，不得擅自新增年龄/证件字段；
- S-24 前用户级 analytics SDK、事件表、队列和第三方发送保持关闭。

## 5. 下一步

1. 用户提出修改时继续在 PR #26 修订；
2. 用户确认后，将隐私数据地图状态改为 Accepted 并记录接受日期；
3. squash merge PR #26；
4. 合并后把 S-21 改为 Done，并将 S-22 内容审核和用户支持流程设为唯一 Ready。
