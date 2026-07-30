# Prisma

PostgreSQL 18 / Prisma 7 数据模型与迁移基线。

- `schema.prisma`：唯一的数据模型来源（70 models / 35 enums）；
- `migrations/`：可审查、可追踪且 checksum 固定的迁移历史；
- `seed/synthetic-v1.json`：只含合成主体和系统目录的确定性 seed；
- `../prisma.config.ts`：从 `DATABASE_URL` 读取连接配置，不提交默认凭据；
- `../tooling/database/`：一次性 migration、checksum、drift、seed 与 `db push` Gate。

首个 migration 在单一 `daily_energy` application schema 中创建全部结构，并以受审 SQL
实现 `SQL-001`～`SQL-020` 的约束、trigger 和最小权限角色。运行 profile 不得使用
owner/superuser；应用启动不得迁移；共享或生产环境禁止 `prisma db push`。

任何 AI 或自动化工具都不得在生产环境执行未经人工审核的破坏性迁移。
