# Server Core

无框架、无数据库 SDK 的服务端领域与 application contract 包。

C-005 建立首批 public subpath：

- `@daily-energy/server-core/product-time`：`product-date-v1`、七天民用日期窗口、
  VIEW_CONTINUATION 与 generation-completion 纯策略；
- `@daily-energy/server-core/product-time/spi`：continuation grant 持久化 port；
- `@daily-energy/server-core/generation`：StableSubjectId、seed-v1、choice-v1、
  canonical candidate order、GenerationManifest 与冻结版本选择；
- `@daily-energy/server-core/generation/spi`：不可变 manifest registry port。

本包不得导入 Nest、Prisma、Redis、BullMQ、provider SDK、环境变量或客户端代码。
PostgreSQL 和运行 profile 实现位于 `@daily-energy/server-adapters` 的显式 capability
subpath。C-005 不实现评分、表达、发布或 GenerationIntent HTTP 命令。
