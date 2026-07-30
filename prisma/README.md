# Prisma

PostgreSQL 18 / Prisma 7 数据模型与迁移基线。

- `schema.prisma`：唯一的数据模型来源（70 models / 35 enums）；
- `migrations/`：可审查、可追踪且 checksum/catalog fingerprint 固定的迁移历史；
- `seed/synthetic-v1.json`：只含合成主体和系统目录的确定性 seed；
- `../prisma.config.ts`：从 `DATABASE_URL` 读取连接配置，不提交默认凭据；
- `../tooling/database/`：bootstrap、一次性 migration、checksum、语义 drift、seed 与
  `db push` Gate。

bootstrap 先创建 `daily_energy_owner NOLOGIN`、group roles 和单一 `daily_energy`
application schema。两条 migration 由环境 migration LOGIN 受控切换到 owner 后执行，
并以受审 SQL 实现 `SQL-001`～`SQL-020` 的约束、trigger 和最小权限。运行 profile
不得使用 owner/superuser；应用启动不得迁移；共享或生产环境禁止 `prisma db push`。

任何 AI 或自动化工具都不得在生产环境执行未经人工审核的破坏性迁移。
