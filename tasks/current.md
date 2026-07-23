# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-23
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-21
- **当前任务名称**：隐私数据地图
- **任务状态**：In Progress
- **优先级**：最高
- **当前分支**：`agent/privacy-data-map`
- **交付文件**：`docs/operations/privacy-data-map.md`
- **关联 PR**：待创建 Draft PR

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
- 已完成第一版数据分类、入口映射、AI/第三方边界、保存删除、用户权利和验证场景。

## 3. 当前验证

- 未修改数据库、Prisma、migration、API、NestJS、worker 或生产代码；
- 未创建埋点字典；
- 未配置真实微信、AI provider、云存储或账号；
- 未改变任何 Accepted ADR。

## 4. 下一步

- 补充逐字段与 Prisma/API/View 的精确映射；
- 补充受托方、跨境核验项和访问角色矩阵；
- 更新 docs/INDEX 与 backlog；
- 创建 Draft PR 等待审核。

## 5. 下一任务

S-21 Accepted 后进入 S-22 内容审核和用户支持流程。
