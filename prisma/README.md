# Prisma

存放 PostgreSQL 数据模型与迁移。

计划包含：

- `schema.prisma`：唯一的数据模型来源；
- `migrations/`：可审查、可追踪的迁移历史。

任何 AI 或自动化工具都不得在生产环境执行未经人工审核的破坏性迁移。
